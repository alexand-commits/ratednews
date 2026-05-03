#!/usr/bin/env node
/**
 * RatedNews — Clean Test Articles
 * Usage: node scripts/clean-test-articles.mjs [--delete]
 *
 * Without --delete: shows the test articles found
 * With --delete:    removes community votes and resets community-influenced fields
 *
 * "Test articles" = articles that have community_score set (manually seeded)
 * We don't delete the articles themselves — just wipe the fake community data.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN         = !process.argv.includes('--delete')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function run() {
  // Find articles with a community_score set (manually seeded data)
  const { data: testArticles, error } = await supabase
    .from('articles')
    .select('id, title, outlet_id, community_score, accuracy_score, outlets(name)')
    .not('community_score', 'is', null)
    .order('community_score', { ascending: false })

  if (error) { console.error('❌  Error:', error.message); process.exit(1) }

  if (!testArticles || testArticles.length === 0) {
    console.log('✅  No test articles found (no articles with community_score set)')
    return
  }

  console.log(`\n🔍  Found ${testArticles.length} articles with community scores:\n`)
  for (const a of testArticles) {
    console.log(`   [${a.id.slice(0, 8)}…]  community=${a.community_score}  accuracy=${a.accuracy_score ?? 'null'}`)
    console.log(`   └─ "${(a.title || '').slice(0, 70)}"`)
    console.log(`      outlet: ${a.outlets?.name || 'unknown'}\n`)
  }

  if (DRY_RUN) {
    console.log('ℹ️   Dry run — rerun with --delete to clear community_score on these articles')
    return
  }

  console.log('🧹  Clearing community_score on test articles…')
  const ids = testArticles.map(a => a.id)
  const { error: updateErr } = await supabase
    .from('articles')
    .update({ community_score: null })
    .in('id', ids)

  if (updateErr) {
    console.error('❌  Error clearing community scores:', updateErr.message)
    process.exit(1)
  }

  console.log(`✅  Cleared community_score on ${ids.length} articles`)
  console.log('\n   Re-run aggregate-outlets.mjs to refresh outlet scores with clean data.')
}

run().catch(err => { console.error(err); process.exit(1) })
