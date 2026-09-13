-- Follow-up to 14_articles_url_index.sql. Full audit of every filtered column
-- in the codebase against the indexes that actually exist, 2026-09-13.
--
-- Method: extract every .eq/.in/.ilike/.not filter from pages, src and scripts,
-- then check each against the migrations. Only `articles` matters — it holds
-- 848,724 rows, while every other table is small enough that a sequential scan
-- is free (follows averages 79 rows per scan, comments 4). Table size is what
-- decides whether a missing index hurts, so this deliberately does NOT add
-- indexes to small tables: each one costs write throughput forever and buys
-- nothing until the table grows.
--
-- Run both statements in the Supabase SQL editor. Same lock note as before:
-- plain CREATE INDEX holds a SHARE lock, so reads continue and writes wait a
-- few seconds.

-- 1. STORY PAGES — the one that has been firing hardest.
--
--    pages/story/[slug].jsx resolves a story by fetching every article in its
--    cluster:
--
--      .eq('cluster_id', anchor.cluster_id).order('published_at', desc)
--
--    with no index on cluster_id, so each story page generation sequentially
--    scanned all 848,724 rows. There were 58,960 ISR writes last week, a large
--    share of them crawlers generating story pages after the sitemap and
--    IndexNow work — so this ran constantly, and got worse precisely as the SEO
--    push succeeded.
--
--    Partial, because roughly half of all articles are singletons with a null
--    cluster_id and are never looked up this way — excluding them keeps the
--    index materially smaller. It still serves `cluster_id = $1` (equality
--    implies not-null) AND the three `.not('cluster_id','is',null)` callers in
--    trending-stories, social-compose and digest.
--
--    published_at is the second column so the query's ORDER BY comes free from
--    the index rather than needing a sort.
create index if not exists articles_cluster_published_idx
  on articles (cluster_id, published_at desc)
  where cluster_id is not null;

-- 2. SEARCH — an index the code already believes in.
--
--    src/pages/ExplorePage.jsx and src/pages/FeedPage.jsx both carry the
--    comment "Title-only so it uses the pg_trgm GIN index on articles.title".
--    No migration ever created that index. Every search has been a full
--    sequential scan with no date narrowing, which is why search flirted with
--    the anon role's ~3s statement timeout.
--
--    A btree cannot serve `ilike '%term%'` — a leading wildcard has no prefix
--    to seek on. Trigram GIN is the only thing that can.
--
--    Cost: expect roughly 100-250 MB on 849k titles. That is real (the database
--    is 1.6 GB of 8 GB provisioned), and it is the price of keeping the product
--    promise that search covers every story rather than a recent window.
create extension if not exists pg_trgm;

create index if not exists articles_title_trgm_idx
  on articles using gin (title gin_trgm_ops);

analyze articles;

-- NOT added, deliberately:
--
--   comments.article_id already has an index and its idx_scan is 0 — the table
--   is small enough that the planner correctly prefers a scan. Leave it.
--
--   follows.user_id, saved_articles.user_id, notifications.user_id,
--   ratings.user_id, outlet_ratings.user_id, profiles.username — all foreign
--   keys or lookups on small tables. Postgres does not auto-index foreign keys,
--   so these WILL need indexes eventually, but at present each table is in the
--   hundreds of rows and an index would cost writes to save nothing. Revisit if
--   any of them passes ~50k rows.
--
--   articles.category, outlet_id, published_at, url, id — already covered by
--   08_indexes.sql and 14_articles_url_index.sql.

-- Verify afterwards — both new indexes should show a climbing idx_scan:
--   select indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
--   from pg_stat_user_indexes where relname = 'articles' order by idx_scan desc;
