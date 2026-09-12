/**
 * POST /api/coverage-compute — recompute the Coverage Report on demand.
 * Owner-only (desk button); the Monday GH cron remains the scheduled
 * backstop via scripts/coverage-report.mjs. Both run the same shared core.
 * ~15-30s: hour-chunked index-range fetch of 14 days of headlines.
 */
import { createClient } from '@supabase/supabase-js'
import { computeCoverageReport, storeCoverageReport } from '../../src/server/coverage-compute'

const OWNER = 'alexandchow@gmail.com'

export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (authErr || !user || user.email !== OWNER) return res.status(403).json({ error: 'Forbidden' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(501).json({ error: 'Service key not configured' })
  const svc = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Cost guard. One sweep reads 14 days of headlines — measured at 157,560
    // rows for the week of 7 Sept. That is fine weekly (about 0.8% of what
    // clustering already reads in a day) and NOT fine on a button anyone can
    // lean on: twenty idle clicks is 3.1M rows, more than a full day of
    // clustering, against a database that has been taken down by a burst
    // before.
    //
    // The data only moves as fast as ingest does, so recomputing within the
    // hour buys nothing anyway. Skipping is a 200, not an error — nothing has
    // gone wrong, there is just no work worth doing. `force: true` is the
    // escape hatch for when the watchlist changed and the age is irrelevant.
    const MIN_AGE_MIN = 60
    const force = req.body?.force === true
    if (!force) {
      const { data: recent } = await svc.from('social_drafts')
        .select('pack').eq('pack->>kind', 'coverage_report')
        .order('created_at', { ascending: false }).limit(1)
      const generatedAt = recent?.[0]?.pack?.generatedAt
      if (generatedAt) {
        const ageMin = Math.floor((Date.now() - new Date(generatedAt)) / 60000)
        if (ageMin < MIN_AGE_MIN) {
          return res.status(200).json({
            ok: true, skipped: true, generatedAt, ageMinutes: ageMin, minAgeMinutes: MIN_AGE_MIN,
          })
        }
      }
    }

    const report = await computeCoverageReport(svc)
    await storeCoverageReport(svc, report)
    return res.status(200).json({
      ok: true,
      generatedAt: report.generatedAt,
      headlines: report.corpus.headlines,
      prevHeadlines: report.corpus.prevHeadlines,
      outlets: report.corpus.outlets,
      framingSplits: report.framing.length,
    })
  } catch (err) {
    console.error('[coverage-compute]', err)
    return res.status(500).json({ error: err.message || 'Compute failed' })
  }
}
