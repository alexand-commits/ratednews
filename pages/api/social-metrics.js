/**
 * /api/social-metrics — pulls real engagement for every post in the 7-day
 * published_log and stores it as a single {kind:'post_metrics'} pack.
 *
 * Free reads only: Bluesky (public API, batched) and Facebook (Page token).
 * X reads are pay-per-call, so X entries are kept without metrics.
 *
 * Triggered by .github/workflows/social-metrics.yml every 6h with the same
 * x-auto-secret as the autopilot. The desk shows predicted-vs-actual from
 * this pack, and social-compose feeds winners/losers back into the prompt.
 */
import { createClient } from '@supabase/supabase-js'

function svcClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// https://bsky.app/profile/{handle}/post/{rkey} → at://{handle}/app.bsky.feed.post/{rkey}
function blueskyUri(url) {
  const m = (url || '').match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/)
  return m ? `at://${m[1]}/app.bsky.feed.post/${m[2]}` : null
}

async function fetchBlueskyMetrics(entries) {
  const out = new Map() // url → metrics
  const parsed = entries.map(e => ({ e, uri: blueskyUri(e.url) })).filter(x => x.uri)
  if (!parsed.length) return out

  // getPosts silently returns nothing for handle-based AT-URIs — resolve each
  // handle to its DID first (in practice one handle: the RatedNews account).
  const dids = new Map()
  for (const handle of new Set(parsed.map(x => x.uri.split('/')[2]))) {
    try {
      const r = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`)
      const { did } = await r.json()
      if (did) dids.set(handle, did)
    } catch (err) { console.warn('[social-metrics] resolveHandle failed:', err.message) }
  }
  const uris = parsed
    .map(x => ({ ...x, uri: x.uri.replace(/^at:\/\/([^/]+)/, (_, h) => `at://${dids.get(h) || h}`) }))

  for (let i = 0; i < uris.length; i += 25) {
    const chunk = uris.slice(i, i + 25)
    const qs = chunk.map(x => `uris=${encodeURIComponent(x.uri)}`).join('&')
    try {
      const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?${qs}`)
      if (!r.ok) continue
      const json = await r.json()
      for (const post of json?.posts || []) {
        const match = chunk.find(x => x.uri.endsWith(`/${post.uri.split('/').pop()}`))
        if (match) out.set(match.e.url, {
          likes: post.likeCount ?? 0,
          reposts: (post.repostCount ?? 0) + (post.quoteCount ?? 0),
          // Every root post carries our own threaded link reply — don't count it
          replies: Math.max(0, (post.replyCount ?? 0) - 1),
        })
      }
    } catch (err) { console.warn('[social-metrics] bluesky batch failed:', err.message) }
  }
  return out
}

async function fetchFacebookMetrics(entry) {
  const token = process.env.FB_PAGE_TOKEN
  const id = (entry.url || '').split('facebook.com/')[1]
  if (!token || !id) return null
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=reactions.summary(total_count),comments.summary(total_count),shares&access_token=${token}`)
    if (!r.ok) return null
    const json = await r.json()
    return {
      likes: json?.reactions?.summary?.total_count ?? 0,
      reposts: json?.shares?.count ?? 0,
      // FB posts carry our own link-in-first-comment — don't count it
      replies: Math.max(0, (json?.comments?.summary?.total_count ?? 0) - 1),
    }
  } catch (err) {
    console.warn('[social-metrics] fb fetch failed:', err.message)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const secret = req.headers['x-auto-secret']
  if (!process.env.SOCIAL_AUTO_SECRET || secret !== process.env.SOCIAL_AUTO_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const svc = svcClient()
  const { data: pubRow } = await svc.from('social_drafts')
    .select('pack').eq('pack->>kind', 'published_log').order('created_at', { ascending: false }).limit(1).maybeSingle()
  const published = pubRow?.pack?.entries || []
  if (!published.length) return res.status(200).json({ ok: true, entries: 0 })

  const bskyMetrics = await fetchBlueskyMetrics(published.filter(e => e.platform === 'bluesky'))

  const entries = []
  for (const e of published) {
    let metrics = null
    if (e.platform === 'bluesky') metrics = bskyMetrics.get(e.url) || null
    else if (e.platform === 'facebook') metrics = await fetchFacebookMetrics(e)
    // x: reads are billed — entry kept so the desk still lists the post
    entries.push({
      platform: e.platform,
      story: e.story,
      url: e.url,
      at: e.at,
      pulse: e.pulse ?? null,
      preview: e.preview || '',
      ...(metrics || { likes: null, reposts: null, replies: null }),
    })
  }

  const pack = { kind: 'post_metrics', updated: new Date().toISOString(), entries }
  const { data: existing } = await svc.from('social_drafts')
    .select('id').eq('pack->>kind', 'post_metrics').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) await svc.from('social_drafts').update({ pack }).eq('id', existing.id)
  else await svc.from('social_drafts').insert({ pack })

  const withMetrics = entries.filter(e => e.likes != null).length
  return res.status(200).json({ ok: true, entries: entries.length, withMetrics })
}
