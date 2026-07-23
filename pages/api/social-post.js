/**
 * POST /api/social-post — publish a social desk draft to X or Bluesky.
 * Owner-only, same auth pattern as social-compose.
 *
 * Body: { platform: 'x' | 'bluesky', text: string, pollOptions?: string[] }
 * Returns: { url } of the created post.
 *
 * Env:
 *  X_API_KEY, X_API_SECRET           — app consumer keys (developer portal)
 *  X_ACCESS_TOKEN, X_ACCESS_SECRET   — user tokens, created with Read+Write
 *  BLUESKY_HANDLE, BLUESKY_APP_PASSWORD — e.g. ratednews.bsky.social + app password
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const OWNER = 'alexandchow@gmail.com'

// ── OAuth 1.0a (HMAC-SHA1) for the X v2 API ─────────────────────────────────
// Only the JSON-body POST case: the signature base string covers just the
// OAuth params (body isn't form-encoded, so it's excluded per spec).
function pctEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function oauthHeader(method, url) {
  const params = {
    oauth_consumer_key:     process.env.X_API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_token:            process.env.X_ACCESS_TOKEN,
    oauth_version:          '1.0',
  }
  const paramString = Object.keys(params).sort()
    .map(k => `${pctEncode(k)}=${pctEncode(params[k])}`).join('&')
  const base = [method.toUpperCase(), pctEncode(url), pctEncode(paramString)].join('&')
  const signingKey = `${pctEncode(process.env.X_API_SECRET)}&${pctEncode(process.env.X_ACCESS_SECRET)}`
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64')
  return 'OAuth ' + Object.keys(params).sort()
    .map(k => `${pctEncode(k)}="${pctEncode(params[k])}"`).join(', ')
}

// Pull the first URL out of post text. FB demotes root posts with external
// links and Bluesky link posts under-engage, so both publish the text clean
// and attach the link as a first comment / threaded reply instead.
function splitLink(text) {
  const m = (text || '').match(/https?:\/\/\S+/)
  if (!m) return { clean: text, link: null }
  const clean = text.replace(m[0], '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { clean, link: m[0] }
}

// Fetch an image (our card endpoint or a photo) as bytes for upload.
async function fetchImageBytes(imageUrl) {
  const r = await fetch(imageUrl)
  if (!r.ok) throw new Error(`image fetch failed (${r.status})`)
  const buf = Buffer.from(await r.arrayBuffer())
  const type = r.headers.get('content-type') || 'image/png'
  return { buf, type }
}

// X v2 media upload (multipart, OAuth 1.0a — body excluded from signature).
// Defensive about the id field: v2 returns data.id; older shapes differ.
async function uploadMediaToX(imageUrl) {
  const { buf, type } = await fetchImageBytes(imageUrl)
  const url = 'https://api.x.com/2/media/upload'
  const form = new FormData()
  form.append('media', new Blob([buf], { type }), 'card.png')
  form.append('media_category', 'tweet_image')
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', url) },
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`X media: ${json?.detail || json?.errors?.[0]?.message || `HTTP ${res.status}`}`)
  const id = json?.data?.id || json?.data?.media_key || json?.media_id_string
  if (!id) throw new Error('X media: no media id in response')
  return String(id)
}

export async function postToX(text, pollOptions, imageUrl) {
  const url = 'https://api.x.com/2/tweets'
  const body = { text }
  if (pollOptions?.length >= 2) {
    body.poll = { options: pollOptions.slice(0, 4).map(o => String(o).slice(0, 25)), duration_minutes: 1440 }
  } else if (imageUrl) {
    // X forbids media alongside polls — image only on non-poll posts
    body.media = { media_ids: [await uploadMediaToX(imageUrl)] }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: oauthHeader('POST', url) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = json?.detail || json?.errors?.[0]?.message || json?.title || `HTTP ${res.status}`
    throw new Error(`X: ${detail}`)
  }
  return { url: `https://x.com/i/web/status/${json.data.id}` }
}

// ── Bluesky (atproto) ───────────────────────────────────────────────────────
// Links must be declared as facets with BYTE offsets or they render as plain text.
function linkFacets(text) {
  const enc = new TextEncoder()
  const facets = []
  const re = /https?:\/\/[^\s)\]}"',<>]+/g
  let m
  while ((m = re.exec(text)) !== null) {
    facets.push({
      index: {
        byteStart: enc.encode(text.slice(0, m.index)).length,
        byteEnd:   enc.encode(text.slice(0, m.index + m[0].length)).length,
      },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    })
  }
  return facets
}

export async function postToBluesky(text, imageUrl, imageAlt = '') {
  const pds = 'https://bsky.social'
  const sess = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD }),
  })
  const session = await sess.json().catch(() => ({}))
  if (!sess.ok) throw new Error(`Bluesky login: ${session?.message || `HTTP ${sess.status}`}`)

  const { clean, link } = splitLink(text)
  const record = {
    $type: 'app.bsky.feed.post',
    text: clean,
    createdAt: new Date().toISOString(),
    langs: ['en'],
  }
  const facets = linkFacets(clean)
  if (facets.length) record.facets = facets

  // Optional image embed. Bluesky caps blobs at ~976KB — post without the
  // image rather than fail the whole post.
  if (imageUrl) {
    try {
      // Our card endpoint supports a scaled variant — Bluesky caps blobs ~976KB
      const blueskyUrl = imageUrl.includes('/api/social-card?') ? `${imageUrl}&w=900` : imageUrl
      const { buf, type } = await fetchImageBytes(blueskyUrl)
      if (buf.length <= 950 * 1024) {
        const up = await fetch(`${pds}/xrpc/com.atproto.repo.uploadBlob`, {
          method: 'POST',
          headers: { 'Content-Type': type, Authorization: `Bearer ${session.accessJwt}` },
          body: buf,
        })
        const upJson = await up.json().catch(() => ({}))
        if (up.ok && upJson?.blob) {
          record.embed = { $type: 'app.bsky.embed.images', images: [{ image: upJson.blob, alt: imageAlt.slice(0, 300) }] }
        }
      }
    } catch (e) { console.warn('[social-post] bluesky image skipped:', e.message) }
  }

  const res = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Bluesky: ${json?.message || `HTTP ${res.status}`}`)
  // Story link as a threaded reply from our own account
  if (link && json.uri && json.cid) {
    try {
      const replyRecord = {
        $type: 'app.bsky.feed.post',
        text: link,
        createdAt: new Date().toISOString(),
        langs: ['en'],
        facets: linkFacets(link),
        reply: {
          root:   { uri: json.uri, cid: json.cid },
          parent: { uri: json.uri, cid: json.cid },
        },
      }
      await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
        body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record: replyRecord }),
      })
    } catch (e) { console.warn('[social-post] bluesky link reply failed:', e.message) }
  }
  const rkey = (json.uri || '').split('/').pop()
  return { url: `https://bsky.app/profile/${process.env.BLUESKY_HANDLE}/post/${rkey}` }
}

// ── Facebook (Graph API, Page posts) ────────────────────────────────────────
// Free (no per-post charge). Needs a Page + long-lived Page token:
// FB_PAGE_ID + FB_PAGE_TOKEN in Vercel. Links are welcome — FB renders a
// preview card from the story page's OG tags.
export async function postToFacebook(text, imageUrl) {
  const page = process.env.FB_PAGE_ID
  const token = process.env.FB_PAGE_TOKEN
  const { clean, link } = splitLink(text)
  let url, body
  if (imageUrl) {
    url = `https://graph.facebook.com/v21.0/${page}/photos`
    body = { url: imageUrl, message: clean, access_token: token }
  } else {
    url = `https://graph.facebook.com/v21.0/${page}/feed`
    body = { message: clean, access_token: token }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Facebook: ${json?.error?.message || `HTTP ${res.status}`}`)
  const id = json.post_id || json.id
  if (!id) throw new Error('Facebook: no post id in response')
  // Story link as the first comment — reach for the root, clicks in the thread.
  // The post succeeded; a comment failure shouldn't fail the call.
  if (link) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: link, access_token: token }),
      })
    } catch (e) { console.warn('[social-post] fb link comment failed:', e.message) }
  }
  return { url: `https://www.facebook.com/${id}` }
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Owner-only auth (same pattern as social-compose)
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (authErr || !user || user.email !== OWNER) return res.status(403).json({ error: 'Forbidden' })

  const platform = req.body?.platform
  const text = (req.body?.text || '').toString().trim()
  const pollOptions = Array.isArray(req.body?.pollOptions) ? req.body.pollOptions.filter(Boolean) : undefined
  const rawImage = (req.body?.imageUrl || '').toString().trim()
  // Only our own card endpoint or https images may be attached
  const imageUrl = /^https:\/\//.test(rawImage) ? rawImage : undefined
  const imageAlt = (req.body?.imageAlt || '').toString().slice(0, 300)
  if (!text) return res.status(400).json({ error: 'Nothing to post' })
  if (text.length > 4000) return res.status(400).json({ error: 'Text too long' })

  try {
    if (platform === 'x') {
      if (!process.env.X_API_KEY || !process.env.X_API_SECRET || !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_SECRET) {
        return res.status(501).json({ error: 'X keys not configured — add X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET in Vercel.' })
      }
      // Hard no-links policy on X: link posts cost 13x ($0.20 vs $0.015) and X
      // suppresses their reach. Links live on Bluesky.
      if (/https?:\/\/|www\./i.test(text)) {
        return res.status(400).json({ error: 'No links on X — X charges 13x for URL posts and buries them. Remove the link (it lives in the Bluesky variant).' })
      }
      const out = await postToX(text, pollOptions, imageUrl)
      return res.status(200).json(out)
    }
    if (platform === 'facebook') {
      if (!process.env.FB_PAGE_ID || !process.env.FB_PAGE_TOKEN) {
        return res.status(501).json({ error: 'Facebook not configured — add FB_PAGE_ID / FB_PAGE_TOKEN in Vercel.' })
      }
      const out = await postToFacebook(text, imageUrl)
      return res.status(200).json(out)
    }
    if (platform === 'bluesky') {
      if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
        return res.status(501).json({ error: 'Bluesky not configured — add BLUESKY_HANDLE / BLUESKY_APP_PASSWORD in Vercel.' })
      }
      if (text.length > 300) return res.status(400).json({ error: `Bluesky caps posts at 300 chars — this is ${text.length}.` })
      const out = await postToBluesky(text, imageUrl, imageAlt)
      return res.status(200).json(out)
    }
    return res.status(400).json({ error: 'Unknown platform' })
  } catch (e) {
    console.error('[social-post]', e.message)
    return res.status(502).json({ error: e.message || 'Post failed' })
  }
}
