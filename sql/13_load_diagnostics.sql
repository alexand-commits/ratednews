-- Read-only diagnostics for the CPU 100% / memory 99% / disk-IO 78% state seen
-- on 2026-09-12. Paste the whole file into the Supabase SQL editor.
--
-- Nothing here writes, locks, or scans table data — it reads statistics views
-- only, so it is safe to run on a database that is already struggling.
--
-- The question each block answers is in its comment. Read them in order: block
-- 1 usually settles it on its own.

-- 1. CACHE HIT RATIO — the single most diagnostic number.
--    Healthy is 99%+. Below ~95% means the working set does not fit in memory,
--    so reads that should be served from RAM are going to disk. That drives
--    disk IO AND cpu (i/o wait) at the same time, which is exactly the shape of
--    the reported numbers. If this is low, no amount of query tuning fixes it:
--    the instance is too small for the data, or the data is too big for the
--    instance.
select
  'cache hit ratio' as metric,
  round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as pct
from pg_statio_user_tables
union all
select
  'index cache hit ratio',
  round(100.0 * sum(idx_blks_hit) / nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2)
from pg_statio_user_indexes;

-- 2. HOW MUCH MEMORY DOES POSTGRES ACTUALLY HAVE?
--    shared_buffers is typically 25% of instance RAM on Supabase. Compare it
--    with the table sizes in block 3: if the hot table alone dwarfs this, the
--    cache can never hold it.
select name, setting, unit from pg_settings
where name in ('shared_buffers', 'effective_cache_size', 'work_mem',
               'maintenance_work_mem', 'max_connections', 'random_page_cost');

-- 3. WHERE THE 1.6 GB LIVES — and how much of it is index rather than rows.
--    Every index is maintained on every INSERT. At ~14,000 articles/day, an
--    index nobody reads is pure write cost.
select
  relname as "table",
  pg_size_pretty(pg_total_relation_size(relid))  as total,
  pg_size_pretty(pg_relation_size(relid))        as heap,
  pg_size_pretty(pg_indexes_size(relid))         as indexes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  case when n_live_tup > 0
       then round(100.0 * n_dead_tup / n_live_tup, 1) end as dead_pct,
  last_autovacuum,
  last_autoanalyze
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 15;

-- 4. UNUSED INDEXES — idx_scan = 0 means it has never been read since stats
--    were last reset, while still costing a write on every row inserted.
select
  s.relname as "table",
  s.indexrelname as "index",
  s.idx_scan as times_used,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as size
from pg_stat_user_indexes s
join pg_index i on i.indexrelid = s.indexrelid
where not i.indisunique and not i.indisprimary
order by s.idx_scan asc, pg_relation_size(s.indexrelid) desc
limit 20;

-- 5. WAL IS 848 MB AGAINST A 1.6 GB DATABASE — over half the data size, which
--    is high. The usual cause is a replication slot that is not being consumed:
--    Postgres cannot recycle WAL a slot still needs, so it accumulates forever
--    and every checkpoint has more to write. An 'inactive' slot here, or a
--    large retained_bytes, is a real and fixable problem.
select slot_name, slot_type, active, restart_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_wal
from pg_replication_slots;

-- 6. WHAT IS ACTUALLY BURNING THE CPU.
--    Needs pg_stat_statements (Supabase ships it enabled). mean_exec_time finds
--    slow queries; total_exec_time finds the ones that matter, which are often
--    fast queries run enormously often.
select
  round(total_exec_time::numeric / 1000, 1) as total_seconds,
  calls,
  round(mean_exec_time::numeric, 1)         as mean_ms,
  round(100.0 * total_exec_time / sum(total_exec_time) over (), 1) as pct_of_total,
  left(regexp_replace(query, '\s+', ' ', 'g'), 150) as query
from pg_stat_statements
order by total_exec_time desc
limit 15;

-- 7. ANYTHING RUNNING RIGHT NOW, and anything stuck.
--    A long-idle 'idle in transaction' connection holds back vacuum and pins
--    dead rows, which quietly inflates everything above.
select pid, state,
       now() - xact_start as txn_age,
       now() - query_start as query_age,
       wait_event_type, wait_event,
       left(regexp_replace(query, '\s+', ' ', 'g'), 120) as query
from pg_stat_activity
where state <> 'idle' or (state = 'idle in transaction')
order by xact_start nulls last
limit 20;
