// api/aggregate.js — Vercel Serverless Function + Cron
// Aggregates article AI scores up to outlet level with tiered community weighting.

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET      = process.env.CRON_SECRET
const MIN_ARTICLES     = 3
const COMMUNITY_THRESHOLD = 20   // ratings needed before community influences the score
const COMMUNITY_WEIGHT    = 0.20 // weight given to community once threshold is met

function majorityDirection(counts) {
  const { left = 0, centre = 0, right = 0 } = counts
  const total = left + centre + right
  if (total === 0) return 'centre'
  const leanScore = (right - left) / total
  if (leanScore > 0.15) return 'right'
  if (leanScore < -0.15) return 'left'
  return 'centre'
}

function computeOverall({ accuracyScore, communityScore, voteCount }) {
  if (voteCount < COMMUNITY_THRESHOLD) return accuracyScore
  return Math.round(accuracyScore * (1 - COMMUNITY_WEIGHT) + communityScore * COMMUNITY_WEIGHT)
}

function starsToScore(avgStars) {
  return Math.round(((avgStars - 1) / 4) * 100)
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth: only allow cron runner with CRON_SECRET
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Only consider articles from the last 90 days — enough for accurate outlet scores
  // and prevents the query growing unbounded as the DB scales
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: articles, error: artErr },
    { data: outlets,  error: outErr },
    { data: ratings,  error: ratErr },
  ] = await Promise.all([
    supabase.from('articles').select('outlet_id, accuracy_score, bias_score, bias_direction, article_type').not('accuracy_score', 'is', null).or('article_type.is.null,article_type.not.in.(opinion,pr)').gte('published_at', since90d),
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
