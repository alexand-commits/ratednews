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
import { trendingStories } from './social-compose'
import { FLUFF_RE, BAIT_RE, isPromo } from '../../src/server/social-gates'

// Story-level approximation of the post gates, used by the cheap pre-check
// (before any Claude spend). Post-level gates still run after generation.
function storyAutoEligible(s) {
  if (s.liveEvent) return false          // in-game state goes stale in transit
  if (s.headlines.some(h => FLUFF_RE.test(h.title || ''))) return false // gossip-grade
  if (s.headlines.some(h => BAIT_RE.test(h.title || ''))) return false  // crime-footage bait
  if (s.headlines.some(h => isPromo(h.title))) return false             // advertorial/giveaway
  if (s.outlets.size < 3) return false   // 2 outlets is too thin a signal to queue
  // Only NEW material triggers a run: a story never served before, or a
  // previously-served story that genuinely escalated (grown). A slow-drip
  // update isn't worth waking the generator for.
  return !s.update || s.grown === true
}

const OWNER = 'alexandchow@gmail.com'

async function ownerAuth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return null
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user || user.email !== OWNER) return null
  return user
}

// Owner-dismissed queue stories — single in-place row, entries expire with the
// queue window. A dismissed story stays in the 6h cool-down (rejected ≠ retry).
async function getDismissedRow(svc) {
  const { data } = await svc.from('social_drafts')
    .select('id, pack').eq('pack->>kind', 'queue_dismissed').limit(1).maybeSingle()
  return data || null
}

// Owner-published record — single in-place row, {story, platform, url, at}
// entries, 7d retention. The desk uses it to mark drafts ✓ Posted so the
// same draft can't be double-posted from another device or after a refresh.
async function getPublishedRow(svc) {
  const { data } = await svc.from('social_drafts')
    .select('id, pack').eq('pack->>kind', 'published_log').limit(1).maybeSingle()
  return data || null
}

function svcClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// One always-current heartbeat row — proves the scout is alive even when
// every tick finds nothing. Updated in place, never accumulates.
async function beatHeart(svc, lastResult) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await svc.from('social_drafts')
    .select('id, pack').eq('pack->>kind', 'auto_heartbeat').limit(1).maybeSingle()
  const prev = existing?.pack || {}
  const pack = {
    kind: 'auto_heartbeat',
    at: new Date().toISOString(),
    date: today,
    checks_today: prev.date === today ? (prev.checks_today || 0) + 1 : 1,
    last_result: lastResult,
  }
  if (existing) await svc.from('social_drafts').update({ pack }).eq('id', existing.id)
  else await svc.from('social_drafts').insert({ pack })
}

async function getHeartbeat(svc) {
  const { data } = await svc.from('social_drafts')
    .select('pack').eq('pack->>kind', 'auto_heartbeat').limit(1).maybeSingle()
  return data?.pack || null
}

export default async function handler(req, res) {
  // ── GET: desk panel data (owner auth) ─────────────────────────────────────
  if (req.method === 'GET') {
    if (!(await ownerAuth(req))) return res.status(401).json({ error: 'Unauthorized' })

    const configured = !!process.env.SOCIAL_AUTO_SECRET
    const svcG = configured && process.env.SUPABASE_SERVICE_ROLE_KEY ? svcClient() : null
    const heartbeat = svcG ? await getHeartbeat(svcG) : null
    const dismissed = svcG ? ((await getDismissedRow(svcG))?.pack?.stories || []) : []
    let manualRuns = []
    if (svcG) {
      const { data: mr } = await svcG.from('social_drafts')
        .select('id, created_at, pack')
        .eq('pack->>kind', 'manual_run')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5)
      manualRuns = (mr || []).map(r => ({ id: r.id, at: r.created_at, mode: r.pack.mode, posts: r.pack.posts || [] }))
    }
    const published = svcG ? ((await getPublishedRow(svcG))?.pack?.entries || []) : []
    // Engagement metrics — refreshed by /api/social-metrics on its own cron
    const metricsRow = svcG ? await svcG.from('social_drafts')
      .select('pack').eq('pack->>kind', 'post_metrics').limit(1).maybeSingle() : null
    const metrics = metricsRow?.data?.pack?.entries || []
    return res.status(200).json({
      configured,
      heartbeat,
      dismissed,
      published,
      metrics,
      manualRuns,
      runs: runs.map(r => ({ at: r.created_at, ...r.pack })),
    })
  }

  // ── PUT: record an owner publish (story + platform + url) ─────────────────
  if (req.method === 'PUT') {
    if (!(await ownerAuth(req))) return res.status(401).json({ error: 'Unauthorized' })
    const platform = (req.body?.platform || '').toString().slice(0, 20)
    const story = (req.body?.story || '').toString().slice(0, 200)
    const url = (req.body?.url || '').toString().slice(0, 300)
    if (!platform || !story) return res.status(400).json({ error: 'Missing platform/story' })
    const svcP = svcClient()
    const row = await getPublishedRow(svcP)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    // pulse + preview ride along so the metrics loop can show predicted vs
    // actual and feed real winners/losers back into the compose prompt.
    const pulse = Number.isFinite(+req.body?.pulse) ? Math.round(+req.body.pulse) : null
    const preview = (req.body?.preview || '').toString().slice(0, 220)
    const entries = [
      ...((row?.pack?.entries || []).filter(e =>
        new Date(e.at) >= cutoff && !(e.story === story && e.platform === platform))),
      { story, platform, url, at: new Date().toISOString(), pulse, preview },
    ]
    const pack = { kind: 'published_log', entries }
    if (row) await svcP.from('social_drafts').update({ pack }).eq('id', row.id)
    else await svcP.from('social_drafts').insert({ pack })
    return res.status(200).json({ ok: true })
  }

  // ── DELETE: dismiss a queue draft, or bin a manual run (owner auth) ───────
  if (req.method === 'DELETE') {
    if (!(await ownerAuth(req))) return res.status(401).json({ error: 'Unauthorized' })
    const runId = req.body?.runId
    if (runId) {
      const svcR = svcClient()
      // Kind check so this can only ever remove run-history rows
      const { error: delErr } = await svcR.from('social_drafts')
        .delete().eq('id', runId).eq('pack->>kind', 'manual_run')
      if (delErr) return res.status(502).json({ error: delErr.message })
      return res.status(200).json({ ok: true })
    }
    const story = (req.body?.story || '').toString().slice(0, 200)
    if (!story) return res.status(400).json({ error: 'Missing story' })
    const svcD = svcClient()
    const row = await getDismissedRow(svcD)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const stories = [
      ...((row?.pack?.stories || []).filter(d => new Date(d.at) >= cutoff && d.story !== story)),
      { story, at: new Date().toISOString() },
    ]
    const pack = { kind: 'queue_dismissed', stories }
    if (row) await svcD.from('social_drafts').update({ pack }).eq('id', row.id)
    else await svcD.from('social_drafts').insert({ pack })
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── POST: the cron run (shared-secret auth) ───────────────────────────────
  if (!process.env.SOCIAL_AUTO_SECRET) return res.status(501).json({ error: 'SOCIAL_AUTO_SECRET not configured' })
  if ((req.headers['x-auto-secret'] || '') !== process.env.SOCIAL_AUTO_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const svc = svcClient()

  try {
    // ── Detector-only (queue retired 15 Aug 2026): no Claude calls, no
    // drafts, no queue. The owner rarely used the queue; the valuable part
    // was knowing WHEN something surges. The cron now just watches: when a
    // genuinely surging story passes the content gates, it pings the owner's
    // phone (ntfy) and the owner drafts on the desk — trending, story-link
    // or composer. Zero generation spend.
    const candidates = (await trendingStories({ lean: true })).filter(storyAutoEligible)

    // Surge bar — deliberately high; this is an interruption channel:
    // breaking tier, or wide pickup across the press.
    const surging = candidates.filter(c => c.breaking || c.outlets.size >= 8)

    // 6h don't-re-alert memory, keyed by (now stable) cluster ids.
    const { data: alertRow } = await svc.from('social_drafts')
      .select('id, pack').eq('pack->>kind', 'alert_log').limit(1).maybeSingle()
    const cutoff = Date.now() - 6 * 60 * 60 * 1000
    const past = (alertRow?.pack?.entries || []).filter(e => new Date(e.at) >= cutoff)
    const seen = new Set(past.map(e => e.clusterId))
    const fresh = surging.filter(c => !seen.has(c.clusterId))

    if (fresh.length && process.env.NTFY_TOPIC) {
      try {
        await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
          method: 'POST',
          headers: {
            Title: fresh.length > 1 ? `${fresh.length} stories surging` : 'Story surging',
            Click: 'https://www.ratednews.com/social',
            Priority: 'high',
            Tags: 'fire',
          },
          body: fresh.slice(0, 3).map(c => `${c.breaking ? '⚡ ' : ''}${c.headlines[0]?.title || 'story'}`).join('\n'),
        })
      } catch (e) { console.warn('[social-auto] ntfy alert failed:', e.message) }
    }

    if (fresh.length) {
      const entries = [...past, ...fresh.map(c => ({ clusterId: c.clusterId, at: new Date().toISOString() }))]
      const pack = { kind: 'alert_log', entries }
      if (alertRow) await svc.from('social_drafts').update({ pack }).eq('id', alertRow.id)
      else await svc.from('social_drafts').insert({ pack })
    }

    await beatHeart(svc, fresh.length
      ? `alerted: ${fresh.slice(0, 2).map(c => (c.headlines[0]?.title || '').slice(0, 40)).join(' · ')}`
      : 'checked — nothing surging')
    return res.status(200).json({ ok: true, surging: fresh.length })
  } catch (err) {
    console.error('[social-auto]', err)
    return res.status(500).json({ error: err.message || 'Detector run failed' })
  }
}
