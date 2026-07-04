#!/usr/bin/env node
// Backfill category on articles from the last 30 days using the deterministic
// categoriser. New articles get categorised at ingest; this fills the gap for
// articles ingested while categorisation was broken (null category).
import { createClient } from '@supabase/supabase-js'
import { categorise } from './categorise.mjs'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
const BATCH = 500

let from = 0, updated = 0, scanned = 0
for (;;) {
  const { data, error } = await db
    .from('articles')
    .select('id, title, summary, category')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .range(from, from + BATCH - 1)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data.length) break
  scanned += data.length

  // Recategorise where category is missing OR still the 'World' catch-all —
  // improved rules may now pull World articles into a specific category. Skip
  // writes where nothing changes (World stays World).
  const updates = data
    .filter(a => !a.category || a.category === 'World')
    .map(a => ({ id: a.id, from: a.category, category: categorise(a.title || '', a.summary || '') }))
    .filter(u => u.category !== u.from)

  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100)
    await Promise.all(chunk.map(u => db.from('articles').update({ category: u.category }).eq('id', u.id)))
    updated += chunk.length
  }
  process.stdout.write(`\r  scanned ${scanned} · updated ${updated}`)
  if (data.length < BATCH) break
  from += BATCH
}
console.log(`\nDone — backfilled category on ${updated} articles.`)

// Distribution check
const { data: sample } = await db.from('articles').select('category').gte('published_at', cutoff).limit(5000)
const dist = {}
sample.forEach(a => { dist[a.category || '(null)'] = (dist[a.category || '(null)'] || 0) + 1 })
console.log('Category distribution (sample 5000):')
Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${v}`))
