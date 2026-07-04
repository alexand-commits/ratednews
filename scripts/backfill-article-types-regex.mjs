#!/usr/bin/env node
/**
 * Heuristic backfill of article_type using title/summary pattern matching.
 * Zero API cost — pure regex on existing data.
 * Usage: node scripts/backfill-article-types-regex.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function classify(title = '', summary = '') {
  const t = title.toLowerCase()
  const s = summary.toLowerCase()

  // Opinion signals
  if (/^\[?(opinion|editorial|column|comment|letters?)\]?[:\s–-]/i.test(title)) return 'opinion'
  if (/\|\s*(opinion|editorial|column|comment)$/i.test(title)) return 'opinion'
  if (/^(opinion|editorial|comment):/i.test(title)) return 'opinion'
  if (/\b(why (we|i|you) (must|should|need|can't|cannot)|the case (for|against)|i believe|my view|my take)\b/i.test(title)) return 'opinion'

  // Analysis signals
  if (/^\[?analysis\]?[:\s–-]/i.test(title)) return 'analysis'
  if (/\|\s*analysis$/i.test(title)) return 'analysis'
  if (/^analysis:/i.test(title)) return 'analysis'
  if (/\b(explained|in (depth|full)|what (it means|this means)|why (it|this) matters|what (you need to know|we know))\b/i.test(t)) return 'analysis'
  if (/\bfact.?check/i.test(t)) return 'analysis'

  // Live blog signals
  if (/\b(–\s*live|:\s*live\b|live (updates?|blog|coverage|results?)|as it happened|rolling updates?|latest (updates?|news|live))\b/i.test(t)) return 'live_blog'

  // PR signals
  if (/\b(today announced|proud to announce|pleased to announce|we are (delighted|thrilled|excited) to)\b/i.test(t + ' ' + s)) return 'pr'

  return null // can't determine — leave as null
}

async function run() {
  console.log('🔍  Fetching articles without article_type…')

  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary')
      .is('article_type', null)
      .range(from, from + PAGE - 1)
    if (error) { console.error('❌', error.message); process.exit(1) }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  console.log(`   ${all.length} articles to scan\n`)

  const toUpdate = []
  const typeCounts = { opinion: 0, analysis: 0, live_blog: 0, pr: 0, unclassified: 0 }

  for (const a of all) {
    const type = classify(a.title || '', a.summary || '')
    if (type) {
      toUpdate.push({ id: a.id, article_type: type })
      typeCounts[type]++
    } else {
      typeCounts.unclassified++
    }
  }

  console.log(`   Will tag ${toUpdate.length} articles (${all.length - toUpdate.length} left as null/news)`)
  console.log('   Breakdown:', typeCounts, '\n')

  // Batch update in chunks of 50
  const BATCH = 50
  let done = 0
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const chunk = toUpdate.slice(i, i + BATCH)
    await Promise.all(chunk.map(({ id, article_type }) =>
      supabase.from('articles').update({ article_type }).eq('id', id)
    ))
    done += chunk.length
    process.stdout.write(`\r   Updated ${done}/${toUpdate.length}…`)
  }

  console.log(`\n\n✨  Done`)
}

run().catch(err => { console.error(err); process.exit(1) })
