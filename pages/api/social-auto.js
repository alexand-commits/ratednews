/**
 * Autopilot — scheduled social posting with hard safety gates.
 *
 * POST (cron, header x-auto-secret === SOCIAL_AUTO_SECRET):
 *   Generates a trending batch, applies the gates in src/server/social-gates,
 *   rate-checks against recent runs, then per platform either publishes the
 *   top eligible post (mode 'live') or records what it WOULD publish (dry).
 *   Every run is logged to social_drafts as a {kind:'auto_run'} pack.
 *
 * GET (owner bearer auth): mode + the last runs, for the desk's Autopilot panel.
 *
 * Env:
 *   SOCIAL_AUTO_SECRET  — shared secret for the cron caller (required)
 *   AUTO_POST_X         — 'live' publishes to X;      anything else = dry-run
 *   AUTO_POST_BLUESKY   — 'live' publishes to Bluesky; anything else = dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { generateTrendingBatch } from './social-compose'
import { postToX, postToBluesky } from './social-post'
import { AUTO_RATE_LIMITS } from '../../src/server/social-gates'

const OWNER = 'alexandchow@gmail.com'

function svcClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function recentRuns(svc, limit = 12) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await svc.from('social_drafts')
    .select('created_at, pack')
    .eq('pack->>kind', 'auto_run')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

function rateCheck(platform, runs) {
  const limits = AUTO_RATE_LIMITS[platform]
  const posted = []
  for (const r of runs) for (const p of r.pack?.posted || []) if (p.platform === platform) posted.push(p)
  if (posted.length >= limits.maxPerDay) return `daily cap (${limits.maxPerDay}) reached`
  const latest = posted.map(p => new Date(p.at)).sort((a, b) => b - a)[0]
  if (latest && (Date.now() - latest) < limits.minGapMin * 60000) {
    return `min gap ${limits.minGapMin}min not elapsed`
  }
  return null
}

export default async function handler(req, res) {
  // ── GET: desk panel data (owner auth) ─────────────────────────────────────
  if (req.method === 'GET') {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const authClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user }, error: authErr } = await authClient.auth.getUser()
    if (authErr || !user || user.email !== OWNER) return res.status(403).json({ error: 'Forbidden' })

    const configured = !!process.env.SOCIAL_AUTO_SECRET
    const runs = configured && process.env.SUPABASE_SERVICE_ROLE_KEY ? await recentRuns(svcClient()) : []
    return res.status(200).json({
      configured,
      mode: {
        x:       process.env.AUTO_POST_X === 'live' ? 'live' : 'dry',
        bluesky: process.env.AUTO_POST_BLUESKY === 'live' ? 'live' : 'dry',
      },
      runs: runs.map(r => ({ at: r.created_at, ...r.pack })),
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── POST: the cron run (shared-secret auth) ───────────────────────────────
  if (!process.env.SOCIAL_AUTO_SECRET) return res.status(501).json({ error: 'SOCIAL_AUTO_SECRET not configured' })
  if ((req.headers['x-auto-secret'] || '') !== process.env.SOCIAL_AUTO_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const liveX = process.env.AUTO_POST_X === 'live'
  const liveB = process.env.AUTO_POST_BLUESKY === 'live'
  const svc = svcClient()

  try {
    const runs = await recentRuns(svc)
    const batch = await generateTrendingBatch()

    const decisions = (batch.posts || []).map(p => ({
      story: p.story,
      type: p.type,
      preview: (p.text || '').slice(0, 140),
      x: p.auto?.x,
      bluesky: p.auto?.bluesky,
      meta: p.meta ? { outlets: p.meta.outlets, breaking: p.meta.breaking, update: !!p.meta.update, first: p.meta.first } : null,
    }))
    const posted = []
    const wouldPost = []

    // Per platform: the batch is hottest-first, so the first gate-passing post wins.
    for (const [platform, live, textOf] of [
      ['x',       liveX, p => p.text],
      ['bluesky', liveB, p => p.short],
    ]) {
      const candidate = (batch.posts || []).find(p => p.auto?.[platform] === 'ok')
      if (!candidate) continue
      const rateBlock = rateCheck(platform, runs)
      const d = decisions[batch.posts.indexOf(candidate)]
      if (rateBlock) { d[platform] = `eligible, skipped — ${rateBlock}`; continue }

      if (!live) {
        d[platform] = 'WOULD POST (dry-run)'
        wouldPost.push({ platform, story: candidate.story, text: textOf(candidate) })
        continue
      }
      try {
        const out = platform === 'x'
          ? await postToX(textOf(candidate))
          : await postToBluesky(textOf(candidate))
        d[platform] = 'POSTED'
        posted.push({ platform, story: candidate.story, text: textOf(candidate), url: out.url, at: new Date().toISOString() })
      } catch (e) {
        d[platform] = `post failed: ${e.message}`
      }
    }

    const pack = {
      kind: 'auto_run',
      mode: { x: liveX ? 'live' : 'dry', bluesky: liveB ? 'live' : 'dry' },
      note: batch.note || null,
      decisions,
      posted,
      wouldPost,
    }
    await svc.from('social_drafts').insert({ pack })
    // Prune old auto_run packs alongside the seen_stories prune cadence
    svc.from('social_drafts').delete().eq('pack->>kind', 'auto_run')
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).then(() => {})

    return res.status(200).json({ ok: true, posted: posted.length, wouldPost: wouldPost.length, decisions })
  } catch (err) {
    console.error('[social-auto]', err)
    // Log failed runs too, so the desk panel shows gaps honestly
    try { await svc.from('social_drafts').insert({ pack: { kind: 'auto_run', error: err.message, decisions: [], posted: [], wouldPost: [] } }) } catch {}
    return res.status(500).json({ error: err.message || 'Auto run failed' })
  }
}
