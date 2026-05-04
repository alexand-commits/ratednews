// api/aggregate.js — Vercel Serverless Function + Cron
// Aggregates article AI scores up to outlet level with tiered community weighting.

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MIN_ARTICLES     = 3
const EDITORIAL        = 50

function majorityDirection(counts) {
  const { left = 0, centre = 0, right = 0 } = counts
  if (centre >= left && centre >= right) return 'centre'
  if (left >= right) return 'left'
  return 'right'
}

function computeOverall({ accuracyScore, communityScore, voteCount }) {
  if (voteCount === 0)  return Math.round(accuracyScore * 0.70 + EDITORIAL * 0.30)
  if (voteCount < 5)   return Math.round(accuracyScore * 0.50 + EDITORIAL * 0.30 + communityScore * 0.20)
  if (voteCount < 20)  return Math.round(accuracyScore * 0.40 + EDITORIAL * 0.25 + communityScore * 0.35)
  return Math.round(accuracyScore * 0.35 + EDITORIAL * 0.25 + communityScore * 0.40)
}

function starsToScore(avgStars) {
  return Math.round(((avgStars - 1) / 4) * 100)
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const [
    { data: articles, error: artErr },
    { data: outlets,  error: outErr },
    { data: ratings,  error: ratErr },
  ] = await Promise.all([
    supabase.from('articles').select('outlet_id, accuracy_score, bias_score, bias_direction').not('accuracy_score', 'is', null),
    supabase.from('outlets').select('id, name'),
    supabase.from('outlet_ratings').select('outlet_id, overall_stars'),
  ])

  if (artErr) return res.status(500).json({ error: artErr.message })
  if (outErr) return res.status(500).json({ error: outErr.message })
  if (ratErr) return res.status(500).json({ error: ratErr.message })

  const grouped = {}
  for (const a of articles) {
    if (!a.outlet_id) continue
    if (!grouped[a.outlet_id]) grouped[a.outlet_id] = []
    grouped[a.outlet_id].push(a)
  }

  const ratingsByOutlet = {}
  for (const r of ratings) {
    if (!r.outlet_id) continue
    if (!ratingsByOutlet[r.outlet_id]) ratingsByOutlet[r.outlet_id] = []
    ratingsByOutlet[r.outlet_id].push(r)
  }

  const results = { updated: 0, skipped: 0, errors: [] }

  for (const outlet of outlets) {
    const arts = grouped[outlet.id] || []
    if (arts.length < MIN_ARTICLES) { results.skipped++; continue }

    const avgAccuracy = Math.round(arts.reduce((s, a) => s + (a.accuracy_score || 0), 0) / arts.length)
    const avgBias     = Math.round(arts.reduce((s, a) => s + (a.bias_score || 50), 0) / arts.length)

    const dirCounts = {}
    for (const a of arts) { const d = a.bias_direction || 'centre'; dirCounts[d] = (dirCounts[d] || 0) + 1 }
    const biasDirection = majorityDirection(dirCounts)

    const outletRatings  = ratingsByOutlet[outlet.id] || []
    const voteCount      = outletRatings.length
    const avgStars       = voteCount ? outletRatings.reduce((s, r) => s + (r.overall_stars || 0), 0) / voteCount : 0
    const communityScore = voteCount ? starsToScore(avgStars) : 0
    const overall        = computeOverall({ accuracyScore: avgAccuracy, communityScore, voteCount })

    const { error } = await supabase
      .from('outlets')
      .update({ accuracy_score: avgAccuracy, bias_score: avgBias, bias_direction: biasDirection, overall_score: overall })
      .eq('id', outlet.id)

    if (error) results.errors.push({ outlet: outlet.name, error: error.message })
    else results.updated++
  }

  console.log(`Aggregate done: updated=${results.updated} skipped=${results.skipped} errors=${results.errors.length}`)
  return res.status(200).json({ ok: true, ...results })
}
