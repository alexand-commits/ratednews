-- Performance indexes for the hot query paths.
-- Run once in the Supabase SQL editor. CONCURRENTLY avoids table locks, but
-- note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block — run
-- these statements one at a time (the SQL editor runs each as its own tx).

-- Feed, trending, sitemap, "new articles" polls — newest-first scans.
create index concurrently if not exists articles_published_at_idx
  on articles (published_at desc);

-- Category pages + Explore category fetch.
create index concurrently if not exists articles_category_published_idx
  on articles (category, published_at desc);

-- "My feed" (followed outlets) + outlet pages.
create index concurrently if not exists articles_outlet_published_idx
  on articles (outlet_id, published_at desc);

-- The N+1: comments(count) is embedded in every feed/list select. Without an
-- index on the FK, PostgREST runs a seq scan of comments per article row.
create index concurrently if not exists comments_article_id_idx
  on comments (article_id);
