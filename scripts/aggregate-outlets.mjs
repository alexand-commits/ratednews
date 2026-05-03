#!/usr/bin/env node
/**
 * RatedNews Outlet Score Aggregation
 * Usage: node scripts/aggregate-outlets.mjs
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Computes outlet-level scores from article AI data and updates:
 *   outlets.accuracy_score   — avg article accuracy_score (0–100)
 *   outlets.bias_score       — avg article bias_score (0–100)
 *   outlets.bias_direction   — majority direction ('left'|'centre'|'right')
 *   outlets.overall_score    — weighted composite:
 *                              35% AI accuracy + 25% editorial (fixed) + 40% community
 *                              (community stays 0 until real votes come in)
 *
 * Only outlets with at least MIN_ARTICLES AI-scored articles are updated.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MIN_ARTICLES     = 3   // minimum scored articles before we update an outlet

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── Helpers ──────────────────────────────────────────────────────────────────

function majorityDirection(counts) {
  const { left = 0, centre = 0, right = 0 } = counts
  if (centre >= left && centre >= right) return 'centre'
  if (left >= right) return 'left'
  return 'right'
}

function computeOverall({ accuracyScore, communityScore = 0 }) {
  // Weights from "How ratings work" widget:
  //   40% community, 35% AI accuracy, 25% editorial (treated as 50/100 neutral baseline)
  const editorial = 50 // neutral default until editorial reviews exist
  return Math.round(
    communityScore * 0.40 +
    accuracyScore  * 0.35 +
    editorial      * 0.25
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🔍  Fetching AI-scored articles…')

  // Fetch all articles that have been AI-scored
  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select('outlet_id, accuracy_score, bias_score, bias_direction')
    .not('accuracy_score', 'is', null)

  if (artErr) { console.error('❌  Error fetching articles:', artErr.message); process.exit(1) }
  console.log(`   Found ${articles.length} AI-scored articles`)

  // Fetch all outlets
  const { data: outlets, error: outErr } = await supabase
    .from('outlets')
    .select('id, name, community_score')

  if (outErr) { console.error('❌  Error fetching outlets:', outErr.message); process.exit(1) }

  // Group articles by outlet
  const grouped = {}
  for (const a of articles) {
    if (!a.outlet_id) continue
    if (!grouped[a.outlet_id]) grouped[a.outlet_id] = []
    grouped[a.outlet_id].push(a)
  }

  // Build updates
  const updates = []
  const skipped = []

  for (const outlet of outlets) {
    const arts = grouped[outlet.id] || []
    if (arts.length < MIN_ARTICLES) {
      skipped.push(`${outlet.name} (${arts.length} scored articles)`)
      continue
    }

    // Average accuracy
    const avgAccuracy = Math.round(
      arts.reduce((sum, a) => sum + (a.accuracy_score || 0), 0) / arts.length
    )

    // Average bias score
    const avgBias = Math.round(
      arts.reduce((sum, a) => sum + (a.bias_score || 50), 0) / arts.length
    )

    // Majority bias direction
    const dirCounts = {}
    for (const a of arts) {
      const d = a.bias_direction || 'centre'
      dirCounts[d] = (dirCounts[d] || 0) + 1
    }
    const biasDirection = majorityDirection(dirCounts)

    // Community score (existing value or 0)
    const communityScore = outlet.community_score || 0

    const overall = computeOverall({ accuracyScore: avgAccuracy, communityScore })

    updates.push({
      id: outlet.id,
      name: outlet.name,
      accuracy_score: avgAccuracy,
      bias_score: avgBias,
      bias_direction: biasDirection,
      overall_score: overall,
      article_count: arts.length,
    })
  }

  console.log(`\n📊  Updating ${updates.length} outlets (skipping ${skipped.length} with <${MIN_ARTICLES} scored articles)\n`)

  if (skipped.length) {
    console.log('   Skipped:', skipped.join(', '), '\n')
  }

  // Apply updates
  let successCount = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('outlets')
      .update({
        accuracy_score: u.accuracy_score,
        bias_score:     u.bias_score,
        bias_direction: u.bias_direction,
        overall_score:  u.overall_score,
      })
      .eq('id', u.id)

    if (error) {
      console.error(`   ❌  ${u.name}: ${error.message}`)
    } else {
      console.log(`   ✅  ${u.name.padEnd(25)} accuracy=${u.accuracy_score}  bias=${u.bias_score} (${u.bias_direction.padEnd(6)})  overall=${u.overall_score}  [n=${u.article_count}]`)
      successCount++
    }
  }

  console.log(`\n✨  Done — updated ${successCount}/${updates.length} outlets`)
}

run().catch(err => { console.error(err); process.exit(1) })
