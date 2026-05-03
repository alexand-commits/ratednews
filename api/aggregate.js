// api/aggregate.js — Vercel Serverless Function + Cron
// Aggregates article AI scores up to outlet level.
// Called daily by Vercel cron after /api/score finishes.

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MIN_ARTICLES     = 3

function majorityDirection(counts) {
  const { left = 0, centre = 0, right = 0 } = counts
  if (centre >= left && centre >= right) return 'centre'
  if (left >= right) return 'left'
  return 'right'
}

function computeOverall({ accuracyScore, communityScore = 0 }) {
  const editorial = 50
  return Math.round(
    communityScore * 0.40 +
    accuracyScore  * 0.35 +
    editorial      * 0.25
  )
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Fetch all AI-scored articles
  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select('outlet_id, accuracy_score, bias_score, bias_direction')
    .not('accuracy_score', 'is', null)

  if (artErr) return res.status(500).json({ error: artErr.message })

  // Fetch all outlets
  const { data: outlets, error: outErr } = await supabase
    .from('outlets')
    .select('id, name, community_score')

  if (outErr) return res.status(500).json({ error: outErr.message })

  // Group articles by outlet
  const grouped = {}
  for (const a of articles) {
    if (!a.outlet_id) continue
    if (!grouped[a.outlet_id]) grouped[a.outlet_id] = []
    grouped[a.outlet_id].push(a)
  }

  const results = { updated: 0, skipped: 0, errors: [] }

  for (const outlet of outlets) {
    const arts = grouped[outlet.id] || []
    if (arts.length < MIN_ARTICLES) { results.skipped++; continue }

    const avgAccuracy = Math.round(arts.reduce((s, a) => s + (a.accuracy_score || 0), 0) / arts.length)
    const avgBias     = Math.round(arts.reduce((s, a) => s + (a.bias_score || 50), 0) / arts.length)

    const dirCounts = {}
    for (const a of arts) {
      const d = a.bias_direction || 'centre'
      dirCounts[d] = (dirCounts[d] || 0) + 1
    }
    const biasDirection = majorityDirection(dirCounts)
    const communityScore = outlet.community_score || 0
    const overall = computeOverall({ accuracyScore: avgAccuracy, communityScore })

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
