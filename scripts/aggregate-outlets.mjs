#!/usr/bin/env node
/**
 * RatedNews Outlet Score Aggregation
 * Usage: node scripts/aggregate-outlets.mjs
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Weighting tiers — community influence grows as real votes accumulate:
 *   0 votes   →  70% AI  + 30% editorial
 *   1–4 votes →  50% AI  + 30% editorial + 20% community
 *   5–19      →  40% AI  + 25% editorial + 35% community
 *   20+       →  35% AI  + 25% editorial + 40% community
 *
 * Editorial baseline is fixed at 50 (neutral) until manual review data exists.
 * Community score = average star rating converted to 0–100 scale.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MIN_ARTICLES     = 3
const EDITORIAL        = 50  // neutral baseline

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

function computeOverall({ accuracyScore, communityScore, voteCount }) {
  if (voteCount === 0) {
    // No community data yet — AI-led
    return Math.round(accuracyScore * 0.70 + EDITORIAL * 0.30)
  }
  if (voteCount < 5) {
    return Math.round(accuracyScore * 0.50 + EDITORIAL * 0.30 + communityScore * 0.20)
  }
  if (voteCount < 20) {
    return Math.round(accuracyScore * 0.40 + EDITORIAL * 0.25 + communityScore * 0.35)
  }
  // 20+ votes — full community weight
  return Math.round(accuracyScore * 0.35 + EDITORIAL * 0.25 + communityScore * 0.40)
}

// Stars (1–5) → 0–100
function starsToScore(avgStars) {
  return Math.round(((avgStars - 1) / 4) * 100)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🔍  Fetching data…')

  const [
    { data: articles,  error: artErr  },
    { data: outlets,   error: outErr  },
    { data: ratings,   error: ratErr  },
  ] = await Promise.all([
    supabase.from('articles').select('outlet_id, accuracy_score, bias_score, bias_direction').not('accuracy_score', 'is', null),
    supabase.from('outlets').select('id, name'),
    supabase.from('outlet_ratings').select('outlet_id, overall_stars'),
  ])

  if (artErr) { console.error('❌  Articles:', artErr.message); process.exit(1) }
  if (outErr) { console.error('❌  Outlets:', outErr.message); process.exit(1) }
  if (ratErr) { console.error('❌  Ratings:', ratErr.message); process.exit(1) }

  console.log(`   ${articles.length} AI-scored articles, ${ratings.length} community ratings`)

  // Group articles by outlet
  const grouped = {}
  for (const a of articles) {
    if (!a.outlet_id) continue
    if (!grouped[a.outlet_id]) grouped[a.outlet_id] = []
    grouped[a.outlet_id].push(a)
  }

  // Group ratings by outlet
  const ratingsByOutlet = {}
  for (const r of ratings) {
    if (!r.outlet_id) continue
    if (!ratingsByOutlet[r.outlet_id]) ratingsByOutlet[r.outlet_id] = []
    ratingsByOutlet[r.outlet_id].push(r)
  }

  const updates = []
  const skipped = []

  for (const outlet of outlets) {
    const arts = grouped[outlet.id] || []
    if (arts.length < MIN_ARTICLES) { skipped.push(outlet.name); continue }

    const avgAccuracy = Math.round(arts.reduce((s, a) => s + (a.accuracy_score || 0), 0) / arts.length)
    const avgBias     = Math.round(arts.reduce((s, a) => s + (a.bias_score || 50), 0) / arts.length)

    const dirCounts = {}
    for (const a of arts) { const d = a.bias_direction || 'centre'; dirCounts[d] = (dirCounts[d] || 0) + 1 }
    const biasDirection = majorityDirection(dirCounts)

    // Community
    const outletRatings = ratingsByOutlet[outlet.id] || []
    const voteCount     = outletRatings.length
    const avgStars      = voteCount ? outletRatings.reduce((s, r) => s + (r.overall_stars || 0), 0) / voteCount : 0
    const communityScore = voteCount ? starsToScore(avgStars) : 0

    const overall = computeOverall({ accuracyScore: avgAccuracy, communityScore, voteCount })

    updates.push({ id: outlet.id, name: outlet.name, accuracy_score: avgAccuracy, bias_score: avgBias, bias_direction: biasDirection, overall_score: overall, voteCount, communityScore })
  }

  console.log(`\n📊  Updating ${updates.length} outlets (${skipped.length} skipped)\n`)

  let successCount = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('outlets')
      .update({ accuracy_score: u.accuracy_score, bias_score: u.bias_score, bias_direction: u.bias_direction, overall_score: u.overall_score })
      .eq('id', u.id)

    const tier = u.voteCount === 0 ? 'AI-led' : u.voteCount < 5 ? 'early' : u.voteCount < 20 ? 'growing' : 'full'
    if (error) {
      console.error(`   ❌  ${u.name}: ${error.message}`)
    } else {
      console.log(`   ✅  ${u.name.padEnd(25)} overall=${u.overall_score}  accuracy=${u.accuracy_score}  community=${u.communityScore} (${u.voteCount} votes)  [${tier}]`)
      successCount++
    }
  }

  console.log(`\n✨  Done — updated ${successCount}/${updates.length} outlets`)
}

run().catch(err => { console.error(err); process.exit(1) })
