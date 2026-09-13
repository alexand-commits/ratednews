-- THE index. Run this in the Supabase SQL editor.
--
-- scripts/ingest.mjs dedups each feed against what we already have:
--
--   supabase.from('articles').select('url').in('url', urls)
--
-- which becomes `WHERE url = ANY ($1)`. There was no index on articles.url, so
-- every call sequentially scanned the whole table.
--
-- Measured on 2026-09-13, over a ~29 hour window:
--
--   calls                81,284
--   mean                  1,598 ms
--   total        129,890 SECONDS  = 36.1 hours of database time
--   share of all DB time    ~96%
--
--   articles seq_scan            122,555
--   articles seq_tup_read   72,903,799,712   (72.9 billion rows)
--
-- Ingest runs every 15 minutes across ~300 outlets, so this fires thousands of
-- times an hour and each one drags through ~595,000 rows. It is the reason CPU
-- sat at 100%, memory at 99%, and the cache hit ratio at 60% — the working set
-- could never stay cached because the server was re-reading the entire articles
-- table dozens of times a minute.
--
-- Expected after: 1,598 ms -> sub-millisecond, and ~96% of database load gone.
--
-- Cost: roughly 100 MB of index on 849k rows, which is a real but obviously
-- worthwhile trade against 72.9 billion row reads.
--
-- Lock note: plain CREATE INDEX (not CONCURRENTLY) because the Supabase SQL
-- editor wraps statements in a transaction and CONCURRENTLY cannot run inside
-- one. It holds a SHARE lock: reads continue, writes block for the duration —
-- expect a few seconds to ~30s on this table, during which one ingest cycle may
-- wait. Worth it; run it whenever.

create index if not exists articles_url_idx on articles (url);

analyze articles;

-- Afterwards, confirm it is being used. idx_scan on articles_url_idx should
-- climb within one ingest cycle (15 minutes), and seq_scan on articles should
-- stop climbing:
--
--   select indexrelname, idx_scan from pg_stat_user_indexes
--   where relname = 'articles' order by idx_scan desc;
--
--   select relname, seq_scan, idx_scan from pg_stat_user_tables
--   where relname = 'articles';
