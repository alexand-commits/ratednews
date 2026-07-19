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
import { generateTrendingBatch, trendingStories } from './social-compose'
import { postToX, postToBluesky } from './social-post'
import { AUTO_RATE_LIMITS } from '../../src/server/social-gates'

// Story-level approximation of the post gates, used by the cheap pre-check
// (before any Claude spend). Post-level gates still run after generation.
function storyAutoEligible(s, platform) {
  if (s.liveEvent) return false          // in-game state goes stale in transit
  if (s.coreCoverage === false) return false // regional-only — owner's call
  if (platform === 'x' && s.breaking && s.outlets.size < 4) return false
  // Only NEW material triggers a run: a story never served before, or a
  // previously-served story that genuinely escalated (grown). A slow-drip
  // update isn't worth waking the generator for.
  return !s.update || s.grown === true
}

const OWNER = 'alexandchow@gmail.com'

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

// Everything the bot has published — or, in dry-run, WOULD have published.
// Would-posts count exactly like posts so the dry-run history is a faithful
// simulation of live behaviour (rate limits, story cool-downs) rather than
// firing on every trigger.
function postedLike(runs, platform) {
  const out = []
  for (const r of runs) {
    for (const p of [...(r.pack?.posted || []), ...(r.pack?.wouldPost || [])]) {
      if (p.platform === platform) out.push({ ...p, at: p.at || r.created_at })
    }
  }
  return out
}

function rateCheck(platform, runs) {
  const limits = AUTO_RATE_LIMITS[platform]
  const posted = postedLike(runs, platform)
  if (posted.length >= limits.maxPerDay) return `daily cap (${limits.maxPerDay}) reached`
  const latest = posted.map(p => new Date(p.at)).sort((a, b) => b - a)[0]
  if (latest && (Date.now() - latest) < limits.minGapMin * 60000) {
    return `min gap ${limits.minGapMin}min not elapsed`
  }
  return null
}

// Story-level cool-down: the same story may not be auto-picked twice within
// 6h, updates included — a big development inside that window is exactly the
// kind of post the owner fires manually from the desk.
const STORY_COOLDOWN_H = 6
function recentClusterIds(runs) {
  const cutoff = Date.now() - STORY_COOLDOWN_H * 3600000
  const ids = new Set()
  for (const r of runs) {
    for (const p of [...(r.pack?.posted || []), ...(r.pack?.wouldPost || [])]) {
      const at = new Date(p.at || r.created_at)
      if (at >= cutoff && p.clusterId != null) ids.add(p.clusterId)
    }
  }
  return ids
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
    const svcG = configured && process.env.SUPABASE_SERVICE_ROLE_KEY ? svcClient() : null
    const runs = svcG ? await recentRuns(svcG) : []
    const heartbeat = svcG ? await getHeartbeat(svcG) : null
    return res.status(200).json({
      configured,
      heartbeat,
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

    // ── Cheap pre-check (no Claude spend): is there anything NEW worth a run? ─
    // The cron fires every 15 min for reaction speed; generation only happens
    // when a rate-open platform has a gate-passing, not-yet-served story.
    const rateOpen = {
      x:       !rateCheck('x', runs),
      bluesky: !rateCheck('bluesky', runs),
    }
    const coolingIds = recentClusterIds(runs)
    const candidates = (await trendingStories({ record: false, lean: true }))
      .filter(s => !coolingIds.has(s.clusterId))
    const trigger =
      (rateOpen.x && candidates.some(s => storyAutoEligible(s, 'x'))) ||
      (rateOpen.bluesky && candidates.some(s => storyAutoEligible(s, 'bluesky')))
    if (!trigger) {
      // Nothing new and postable — no run pack, but the heartbeat proves the
      // scout checked.
      const reason = !rateOpen.x && !rateOpen.bluesky ? 'rate limits' : 'no new eligible story'
      await beatHeart(svc, `checked — ${reason}`)
      return res.status(200).json({ ok: true, trigger: false, reason })
    }

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

    // Per platform: batch is hottest-first. Skip stories in the 6h cool-down,
    // prefer a genuinely fresh story over an ↻ update when both pass gates.
    for (const [platform, live, textOf] of [
      ['x',       liveX, p => p.text],
      ['bluesky', liveB, p => p.short],
    ]) {
      const eligible = (batch.posts || []).filter(p =>
        p.auto?.[platform] === 'ok' && !coolingIds.has(p.meta?.clusterId))
      const candidate = eligible.find(p => !p.meta?.update) || eligible[0]
      if (!candidate) continue
      const rateBlock = rateCheck(platform, runs)
      const d = decisions[batch.posts.indexOf(candidate)]
      if (rateBlock) { d[platform] = `eligible, skipped — ${rateBlock}`; continue }

      const entry = {
        platform,
        story: candidate.story,
        clusterId: candidate.meta?.clusterId ?? null,
        text: textOf(candidate),
        at: new Date().toISOString(),
      }
      if (!live) {
        d[platform] = 'WOULD POST (dry-run)'
        wouldPost.push(entry)
        continue
      }
      try {
        const out = platform === 'x'
          ? await postToX(textOf(candidate))
          : await postToBluesky(textOf(candidate))
        d[platform] = 'POSTED'
        posted.push({ ...entry, url: out.url })
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
    await beatHeart(svc, posted.length ? 'posted' : wouldPost.length ? 'drafted to queue' : 'generated — all gated')
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
