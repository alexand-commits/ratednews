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
import { postToX, postToBluesky, postToFacebook } from './social-post'
import { AUTO_RATE_LIMITS, FLUFF_RE, BAIT_RE, isPromo } from '../../src/server/social-gates'

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

async function recentRuns(svc, limit = 40) {
  // 7 days — the queue persists until dismissed/posted, so the desk needs
  // more than a day of drafts. Rate checks filter to 24h internally.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
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
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const posted = postedLike(runs, platform).filter(p => new Date(p.at) >= dayAgo)
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
    if (!(await ownerAuth(req))) return res.status(401).json({ error: 'Unauthorized' })

    const configured = !!process.env.SOCIAL_AUTO_SECRET
    const svcG = configured && process.env.SUPABASE_SERVICE_ROLE_KEY ? svcClient() : null
    const runs = svcG ? await recentRuns(svcG) : []
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
    return res.status(200).json({
      configured,
      heartbeat,
      dismissed,
      published,
      manualRuns,
      mode: {
        x:       process.env.AUTO_POST_X === 'live' ? 'live' : 'dry',
        bluesky: process.env.AUTO_POST_BLUESKY === 'live' ? 'live' : 'dry',
      },
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
    const entries = [
      ...((row?.pack?.entries || []).filter(e =>
        new Date(e.at) >= cutoff && !(e.story === story && e.platform === platform))),
      { story, platform, url, at: new Date().toISOString() },
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

  const liveX = process.env.AUTO_POST_X === 'live'
  const liveB = process.env.AUTO_POST_BLUESKY === 'live'
  const svc = svcClient()

  try {
    const runs = await recentRuns(svc)

    // ── Cheap pre-check (no Claude spend): is there anything NEW worth a run? ─
    // The cron fires every 15 min for reaction speed; generation only happens
    // when a rate-open platform has a gate-passing, not-yet-served story.
    const rateOpen = {
      x:        !rateCheck('x', runs),
      bluesky:  !rateCheck('bluesky', runs),
      facebook: !rateCheck('facebook', runs),
    }
    const coolingIds = recentClusterIds(runs)
    const candidates = (await trendingStories({ record: false, lean: true }))
      .filter(s => !coolingIds.has(s.clusterId))
    const trigger = (rateOpen.x || rateOpen.bluesky || rateOpen.facebook) && candidates.some(s => storyAutoEligible(s))
    if (!trigger) {
      // Nothing new and postable — no run pack, but the heartbeat proves the
      // scout checked.
      const reason = !rateOpen.x && !rateOpen.bluesky && !rateOpen.facebook ? 'rate limits' : 'no new eligible story'
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
      facebook: p.auto?.facebook,
      pulse: p.pulse ?? null,
      meta: p.meta ? { outlets: p.meta.outlets, breaking: p.meta.breaking, update: !!p.meta.update, first: p.meta.first } : null,
    }))
    const posted = []
    const wouldPost = []

    // ONE story per drafting run, drafted for EVERY platform whose gate
    // passes — a queue card should carry both the X and Bluesky variants.
    // Batch is hottest-first; skip cool-down stories, prefer fresh over ↻.
    // Queue bar: pulse >= 7. Gate-passing but socially inert drafts stay in
    // "Your call" — the owner can still post them, the scout won't push them.
    const eligible = (batch.posts || [])
      .filter(p =>
        (p.auto?.x === 'ok' || p.auto?.bluesky === 'ok' || p.auto?.facebook === 'ok') &&
        !coolingIds.has(p.meta?.clusterId) &&
        (p.pulse ?? 7) >= 7)
      .sort((a, b) => (b.pulse ?? 0) - (a.pulse ?? 0))
    const candidate = eligible.find(p => !p.meta?.update) || eligible[0]
    if (candidate) {
      const d = decisions[batch.posts.indexOf(candidate)]
      // Facebook variant: the X copy plus the story link (lifted from the
      // Bluesky short) — FB welcomes links and renders a preview card.
      const fbTextOf = p => {
        const link = (p.short || '').match(/https?:\/\/\S+/)
        return link ? `${p.text}\n\n${link[0]}` : p.text
      }
      for (const [platform, live, textOf] of [
        ['x',        liveX, p => p.text],
        ['bluesky',  liveB, p => p.short],
        ['facebook', false, fbTextOf],
      ]) {
        if (candidate.auto?.[platform] !== 'ok') continue
        const entry = {
          platform,
          story: candidate.story,
          pulse: candidate.pulse ?? null,
          clusterId: candidate.meta?.clusterId ?? null,
          text: textOf(candidate),
          card: candidate.card || null,
          alt: candidate.meta?.title || candidate.story || '',
          at: new Date().toISOString(),
        }
        if (!live) {
          d[platform] = 'WOULD POST (dry-run)'
          wouldPost.push(entry)
          continue
        }
        try {
          const out = platform === 'x'
            ? await postToX(textOf(candidate), undefined, candidate.card || undefined)
            : platform === 'facebook'
              ? await postToFacebook(textOf(candidate), candidate.card || undefined)
              : await postToBluesky(textOf(candidate), candidate.card || undefined, entry.alt)
          d[platform] = 'POSTED'
          posted.push({ ...entry, url: out.url })
        } catch (e) {
          d[platform] = `post failed: ${e.message}`
        }
      }
    }

    const pack = {
      kind: 'auto_run',
      mode: { x: liveX ? 'live' : 'dry', bluesky: liveB ? 'live' : 'dry' },
      note: batch.note || null,
      decisions,
      posted,
      wouldPost,
      // Full drafts of EVERY generated post — gated ones included. The desk
      // shows manual-call drafts with their reasons; a gate means "the owner
      // decides", not "the owner never sees it". Generation was paid for.
      posts: (batch.posts || []).map((p, i) => ({
        story: p.story,
        type: p.type,
        text: p.text,
        short: p.short || null,
        poll_options: p.poll_options || null,
        card: p.card || null,
        why: p.why || null,
        x: decisions[i]?.x,
        bluesky: decisions[i]?.bluesky,
        facebook: decisions[i]?.facebook,
        pulse: p.pulse ?? null,
        meta: decisions[i]?.meta || null,
      })),
    }
    await svc.from('social_drafts').insert({ pack })
    await beatHeart(svc, posted.length ? 'posted' : wouldPost.length ? 'drafted to queue' : 'generated — nothing cleared the pulse bar')
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
