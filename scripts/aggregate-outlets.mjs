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
const MIN_ARTICLES     = 1
const EDITORIAL        = 50  // neutral baseline
const LOOKBACK_DAYS    = 30  // rolling 30-day window for outlet score calculation

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── Helpers ──────────────────────────────────────────────────────────────────

function majorityDirection(counts) {
  const { left = 0, centre = 0, right = 0 } = counts
  const total = left + centre + right
  if (total === 0) return 'centre'
  // Lean score: how much more right vs left, as a fraction of all articles
  // e.g. Fox with 5% left, 65% centre, 30% right → leanScore = 0.25 → right
  const leanScore = (right - left) / total
  if (leanScore > 0.15) return 'right'
  if (leanScore < -0.15) return 'left'
  return 'centre'
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

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Paginate articles to avoid Supabase's 1000-row default limit.
  // Primary window: last 30 days. For outlets with no recent scored articles
  // we fall back to all-time so newly-ingested outlets with older RSS dates
  // still get a score rather than being silently skipped.
  async function fetchAllArticles() {
    const PAGE = 1000
    let all = [], from = 0
    while (true) {
      const { data, error } = await supabase
        .from('articles').select('outlet_id, accuracy_score, bias_score, bias_direction, headline_vote, published_at')
        .not('accuracy_score', 'is', null)
        .gte('published_at', since)
        .range(from, from + PAGE - 1)
      if (error) return { data: null, error }
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return { data: all, error: null }
  }

  // Fallback: fetch all-time scored articles for outlets that had nothing in the 30-day window
  async function fetchAllTimeArticles(outletIds) {
    if (!outletIds.length) return []
    const PAGE = 1000
    let all = [], from = 0
    while (true) {
      const { data, error } = await supabase
        .from('articles').select('outlet_id, accuracy_score, bias_score, bias_direction, headline_vote, published_at')
        .not('accuracy_score', 'is', null)
        .in('outlet_id', outletIds)
        .range(from, from + PAGE - 1)
      if (error) break
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return all
  }

  const [
    { data: articles,  error: artErr  },
    { data: outlets,   error: outErr  },
    { data: ratings,   error: ratErr  },
  ] = await Promise.all([
    fetchAllArticles(),
    supabase.from('outlets').select('id, name'),
    supabase.from('outlet_ratings').select('outlet_id, overall_stars'),
  ])

  if (artErr) { console.error('❌  Articles:', artErr.message); process.exit(1) }
  if (outErr) { console.error('❌  Outlets:', outErr.message); process.exit(1) }
  if (ratErr) { console.error('❌  Ratings:', ratErr.message); process.exit(1) }

  console.log(`   ${articles.length} AI-scored articles (last ${LOOKBACK_DAYS} days), ${ratings.length} community ratings`)

  // Group articles by outlet
  const grouped = {}
  for (const a of articles) {
    if (!a.outlet_id) continue
    if (!grouped[a.outlet_id]) grouped[a.outlet_id] = []
    grouped[a.outlet_id].push(a)
  }

  // Fallback: for outlets with no articles in the 30-day window, fetch all-time
  const missingOutletIds = outlets
    .map(o => o.id)
    .filter(id => !grouped[id] || grouped[id].length < MIN_ARTICLES)

  if (missingOutletIds.length > 0) {
    console.log(`   ⏳  ${missingOutletIds.length} outlets have no recent articles — fetching all-time fallback…`)
    const fallbackArticles = await fetchAllTimeArticles(missingOutletIds)
    console.log(`   ${fallbackArticles.length} all-time articles found for fallback outlets`)
    for (const a of fallbackArticles) {
      if (!a.outlet_id) continue
      if (!grouped[a.outlet_id]) grouped[a.outlet_id] = []
      grouped[a.outlet_id].push(a)
    }
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

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  for (const outlet of outlets) {
    const arts = grouped[outlet.id] || []
    if (arts.length < MIN_ARTICLES) { skipped.push(outlet.name); continue }

    const avgAccuracy = Math.round(arts.reduce((s, a) => s + (a.accuracy_score || 0), 0) / arts.length)
    const avgBias     = Math.round(arts.reduce((s, a) => s + (a.bias_score || 50), 0) / arts.length)

    const dirCounts = {}
    for (const a of arts) { const d = a.bias_direction || 'centre'; dirCounts[d] = (dirCounts[d] || 0) + 1 }
    const biasDirection = majorityDirection(dirCounts)

    // Headline quality rates
    const votedArts    = arts.filter(a => a.headline_vote)
    const votedCount   = votedArts.length || 1
    const fairRate     = Math.round(votedArts.filter(a => a.headline_vote === 'fair').length       / votedCount * 100)
    const clickbaitRate= Math.round(votedArts.filter(a => a.headline_vote === 'clickbait').length  / votedCount * 100)
    const misleadRate  = Math.round(votedArts.filter(a => a.headline_vote === 'misleading').length / votedCount * 100)

    // 7-day delta — compare last 7 days vs previous period
    const recentArts = arts.filter(a => a.published_at && new Date(a.published_at).getTime() >= sevenDaysAgo)
    const olderArts  = arts.filter(a => a.published_at && new Date(a.published_at).getTime() <  sevenDaysAgo)
    let accuracyDelta7d = null
    if (recentArts.length >= 3 && olderArts.length >= 3) {
      const recentAvg = Math.round(recentArts.reduce((s, a) => s + (a.accuracy_score || 0), 0) / recentArts.length)
      const olderAvg  = Math.round(olderArts.reduce((s, a) => s + (a.accuracy_score || 0), 0) / olderArts.length)
      accuracyDelta7d = recentAvg - olderAvg
    }

    // Community
    const outletRatings = ratingsByOutlet[outlet.id] || []
    const voteCount     = outletRatings.length
    const avgStars      = voteCount ? outletRatings.reduce((s, r) => s + (r.overall_stars || 0), 0) / voteCount : 0
    const communityScore = voteCount ? starsToScore(avgStars) : 0

    const overall = computeOverall({ accuracyScore: avgAccuracy, communityScore, voteCount })

    updates.push({ id: outlet.id, name: outlet.name, accuracy_score: avgAccuracy, bias_score: avgBias, bias_direction: biasDirection, overall_score: overall, voteCount, communityScore, accuracyDelta7d, articleCount: arts.length, fairRate, clickbaitRate, misleadRate })
  }

  console.log(`\n📊  Updating ${updates.length} outlets (${skipped.length} skipped)\n`)

  let successCount = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('outlets')
      .update({
        accuracy_score:      u.accuracy_score,
        bias_score:          u.bias_score,
        bias_direction:      u.bias_direction,
        overall_score:       u.overall_score,
        community_score:     u.communityScore || null,
        total_ratings:       u.voteCount,
        accuracy_delta_7d:   u.accuracyDelta7d,
        article_count_30d:   u.articleCount,
        fair_rate:           u.fairRate,
        clickbait_rate:      u.clickbaitRate,
        misleading_rate:     u.misleadRate,
      })
      .eq('id', u.id)

    const tier = u.voteCount === 0 ? 'AI-led' : u.voteCount < 5 ? 'early' : u.voteCount < 20 ? 'growing' : 'full'
    const delta = u.accuracyDelta7d !== null ? (u.accuracyDelta7d >= 0 ? `+${u.accuracyDelta7d}` : `${u.accuracyDelta7d}`) : 'n/a'
    if (error) {
      console.error(`   ❌  ${u.name}: ${error.message}`)
    } else {
      console.log(`   ✅  ${u.name.padEnd(25)} overall=${u.overall_score}  accuracy=${u.accuracy_score} (${delta})  bias=${u.bias_direction.padEnd(6)}  community=${u.communityScore} (${u.voteCount} votes)  [${tier}]`)
      successCount++
    }
  }

  // ── Daily snapshot upsert ──────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const snapshots = updates.map(u => ({
    outlet_id:      u.id,
    snapshot_date:  today,
    accuracy_score: u.accuracy_score,
    bias_score:     u.bias_score,
    overall_score:  u.overall_score,
    article_count:  u.articleCount,
  }))

  const SNAP_BATCH = 50
  let snapCount = 0
  for (let i = 0; i < snapshots.length; i += SNAP_BATCH) {
    const { error: snapErr } = await supabase
      .from('outlet_score_snapshots')
      .upsert(snapshots.slice(i, i + SNAP_BATCH), { onConflict: 'outlet_id,snapshot_date' })
    if (snapErr) console.error(`   ⚠️  Snapshot batch error: ${snapErr.message}`)
    else snapCount += snapshots.slice(i, i + SNAP_BATCH).length
  }
  console.log(`\n📸  Saved ${snapCount} daily snapshots for ${today}`)

  console.log(`\n✨  Done — updated ${successCount}/${updates.length} outlets`)
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })
