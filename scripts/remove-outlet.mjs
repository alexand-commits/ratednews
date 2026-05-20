#!/usr/bin/env node
/**
 * Remove an outlet and all its articles from the database.
 * Usage: node scripts/remove-outlet.mjs "The Spectator"
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const outletName = process.argv[2]
if (!outletName) {
  console.error('Usage: node scripts/remove-outlet.mjs "Outlet Name"')
  process.exit(1)
}

async function main() {
  // 1. Find the outlet
  const { data: outlet, error: findErr } = await supabase
    .from('outlets')
    .select('id, name, rss_url')
    .ilike('name', outletName)
    .single()

  if (findErr || !outlet) {
    console.error(`Outlet not found: "${outletName}"`)
    process.exit(1)
  }

  console.log(`Found: ${outlet.name} (${outlet.id})`)
  console.log(`RSS:   ${outlet.rss_url || '(none)'}`)

  // 2. Count articles
  const { count } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('outlet_id', outlet.id)

  console.log(`Articles to remove: ${count}`)
  console.log('')

  // 3. Delete articles in batches (avoid timeout on large sets)
  let deleted = 0
  while (true) {
    const { data: batch } = await supabase
      .from('articles')
      .select('id')
      .eq('outlet_id', outlet.id)
      .limit(200)

    if (!batch?.length) break

    const ids = batch.map(a => a.id)
    const { error: delErr } = await supabase
      .from('articles')
      .delete()
      .in('id', ids)

    if (delErr) { console.error('Article delete error:', delErr.message); process.exit(1) }
    deleted += ids.length
    console.log(`  Deleted ${deleted} articles…`)
  }

  // 4. Delete the outlet
  const { error: outletErr } = await supabase
    .from('outlets')
    .delete()
    .eq('id', outlet.id)

  if (outletErr) { console.error('Outlet delete error:', outletErr.message); process.exit(1) }

  console.log(`\n✅ Removed "${outlet.name}" and ${deleted} articles.`)
}

main().catch(err => { console.error(err); process.exit(1) })
