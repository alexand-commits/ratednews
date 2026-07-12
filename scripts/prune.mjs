#!/usr/bin/env node
/**
 * RatedNews article prune — keeps the database as a rolling window of recent
 * news so it never creeps toward the storage cap.
 *
 * Deletes articles older than PRUNE_DAYS, EXCEPT any that have community
 * engagement (a comment or rating) — those are preserved indefinitely.
 *
 * Safe because:
 *  - The feed (newest-first), clustering (72h) and trending (24h) never touch
 *    articles this old, so pruning changes nothing a user sees.
 *  - Foreign keys from dependent tables (article_views, saves, media_diet, …)
 *    are ON DELETE CASCADE, so dependents clean up automatically — no orphans.
 *  - Outlet ratings / community scores live on the `outlets` table and are
 *    never affected.
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const PRUNE_DAYS = 90
const BATCH      = 1000
const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000).toISOString()

console.log(`Pruning articles published before ${cutoff.slice(0, 10)} (older than ${PRUNE_DAYS} days)`)

// Preserve any article with engagement (a comment or a rating).
// PostgREST caps a response at 1,000 rows, so we MUST page through — a
// truncated engaged-set would let ON DELETE CASCADE drop users' comments and
// ratings along with the article. Community data is the whole product.
async function collectArticleIds(table) {
  const ids = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select('article_id')
      .not('article_id', 'is', null)
      .range(from, from + 999)
    if (error) { console.error(`Reading ${table} failed:`, error.message); process.exit(1) }
    if (!data || data.length === 0) break
    for (const r of data) ids.add(r.article_id)
    if (data.length < 1000) break
  }
  return ids
}
const [comIds, ratIds] = await Promise.all([
  collectArticleIds('comments'),
  collectArticleIds('ratings'),
])
const engaged = new Set([...comIds, ...ratIds])
console.log(`Preserving ${engaged.size} engaged article(s).`)

// Collect every prunable id first (paged, engaged rows filtered out), then
// delete in chunks. Collecting up front avoids the "engaged rows stay at the
// front and stall the scan" problem and any published_at tie skips.
const prunable = []
for (let from = 0; ; from += BATCH) {
  const { data: batch, error } = await db
    .from('articles')
    .select('id')
    .lt('published_at', cutoff)
    .order('published_at', { ascending: true })
    .range(from, from + BATCH - 1)
  if (error) { console.error('Select failed:', error.message); process.exit(1) }
  if (!batch || batch.length === 0) break
  for (const a of batch) if (!engaged.has(a.id)) prunable.push(a.id)
  if (batch.length < BATCH) break
}

let deleted = 0
for (let i = 0; i < prunable.length; i += BATCH) {
  const ids = prunable.slice(i, i + BATCH)
  const { error: delErr } = await db.from('articles').delete().in('id', ids)
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1) }
  deleted += ids.length
  process.stdout.write(`\r  deleted ${deleted}`)
}

console.log(`\n✅ Prune done — removed ${deleted} article(s).`)
const { count } = await db.from('articles').select('*', { count: 'exact', head: true })
console.log(`Articles remaining: ${count}`)
