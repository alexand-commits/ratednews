-- Performance indexes for the hot query paths.
-- Run once in the Supabase SQL editor (paste the whole file).
--
-- Note: these are plain (non-CONCURRENTLY) CREATE INDEX. The Supabase SQL
-- editor runs everything in a transaction, and CREATE INDEX CONCURRENTLY can't
-- run inside one. A plain build briefly locks writes on each table while it
-- runs — negligible at this scale. (If the tables ever get large enough that
-- the write lock matters, run the CONCURRENTLY form from a direct psql session
-- outside a transaction instead.)

-- Feed, trending, sitemap, "new articles" polls — newest-first scans.
create index if not exists articles_published_at_idx
  on articles (published_at desc);

-- Category pages + Explore category fetch.
create index if not exists articles_category_published_idx
  on articles (category, published_at desc);

-- "My feed" (followed outlets) + outlet pages.
create index if not exists articles_outlet_published_idx
  on articles (outlet_id, published_at desc);

-- The N+1: comments(count) is embedded in every feed/list select. Without an
-- index on the FK, PostgREST runs a seq scan of comments per article row.
create index if not exists comments_article_id_idx
  on comments (article_id);
