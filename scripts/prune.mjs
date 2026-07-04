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

// Preserve any article with engagement (a comment or a rating)
const [{ data: com }, { data: rat }] = await Promise.all([
  db.from('comments').select('article_id').not('article_id', 'is', null),
  db.from('ratings').select('article_id').not('article_id', 'is', null),
])
const engaged = new Set([
  ...(com || []).map(c => c.article_id),
  ...(rat || []).map(r => r.article_id),
])
console.log(`Preserving ${engaged.size} engaged article(s).`)

let deleted = 0
for (;;) {
  const { data: batch, error } = await db
    .from('articles')
    .select('id')
    .lt('published_at', cutoff)
    .limit(BATCH)
  if (error) { console.error('Select failed:', error.message); process.exit(1) }
  if (!batch || batch.length === 0) break

  const ids = batch.map(a => a.id).filter(id => !engaged.has(id))
  if (ids.length === 0) break  // remaining old rows are all engaged — done

  const { error: delErr } = await db.from('articles').delete().in('id', ids)
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1) }
  deleted += ids.length
  process.stdout.write(`\r  deleted ${deleted}`)

  if (batch.length < BATCH) break
}

console.log(`\n✅ Prune done — removed ${deleted} article(s).`)
const { count } = await db.from('articles').select('*', { count: 'exact', head: true })
console.log(`Articles remaining: ${count}`)
