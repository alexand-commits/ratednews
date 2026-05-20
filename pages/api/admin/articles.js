/**
 * GET  /api/admin/articles?type=bad_meta|affiliate&page=0
 * DELETE /api/admin/articles  body: { id }
 *
 * Owner-only — requires valid Supabase session for alexandchow@gmail.com
 */

import { createClient } from '@supabase/supabase-js'

const ALLOWED_EMAIL  = 'alexandchow@gmail.com'
const PAGE_SIZE      = 50

// Keywords that signal sales / affiliate / sponsored content
const AFFILIATE_RE = /\b(sponsored|advertorial|affiliate|partner content|buy now|shop now|best buy|buying guide|top \d+ (best|cheap|affordable)|deal of the|promo code|coupon|discount code|limited.?time offer|paid post|paid partnership|#ad\b|gifted|review:.*vs\.|vs\..*review|product review|unboxing|hands.?on review|best .{2,30} to buy|cheapest|most affordable|our pick|editor.?s pick|we tested|we tried)\b/i

// ── Auth helper ──────────────────────────────────────────────────────────────
async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return null
  const client = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user } } = await client.auth.getUser()
  return user?.email === ALLOWED_EMAIL ? user : null
}

// ── Admin Supabase client (service role) ─────────────────────────────────────
function adminDb() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(403).json({ error: 'Forbidden' })

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const { error } = await adminDb().from('articles').delete().eq('id', id)
    if (error) {
      console.error('[admin/articles] delete error:', error.message)
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const type = req.query.type || 'bad_meta'
    const page = parseInt(req.query.page || '0', 10)
    const from = page * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    const db = adminDb()

    if (type === 'bad_meta') {
      // Missing image OR summary identical to title OR title has outlet suffix appended
      const { data, error, count } = await db
        .from('articles')
        .select('id, title, summary, image_url, url, published_at, category, outlet_id, outlets(name)', { count: 'exact' })
        .or('image_url.is.null,summary.is.null')
        .order('published_at', { ascending: false })
        .range(from, to)

      if (error) return res.status(500).json({ error: error.message })

      // Also flag articles where summary == title (pure duplicate) — mark client-side flag
      const enriched = (data || []).map(a => ({
        ...a,
        issues: [
          !a.image_url                                   && 'no_image',
          !a.summary                                     && 'no_summary',
          a.summary && a.title && a.summary.trim() === a.title.trim() && 'summary_equals_title',
          // Title has " - Outlet Name" suffix appended (common Google News artifact)
          a.title && / - [A-Z]/.test(a.title.slice(-40)) && 'title_has_suffix',
          !a.category                                    && 'no_category',
        ].filter(Boolean),
      }))

      return res.status(200).json({ articles: enriched, total: count, page, pageSize: PAGE_SIZE })
    }

    if (type === 'affiliate') {
      // Fetch a broad set sorted by newest and keyword-match title+summary
      const { data, error } = await db
        .from('articles')
        .select('id, title, summary, image_url, url, published_at, category, outlet_id, outlets(name)')
        .order('published_at', { ascending: false })
        .range(from, from + 500) // scan 500 at a time to find matches

      if (error) return res.status(500).json({ error: error.message })

      const matches = (data || [])
        .filter(a => {
          const text = `${a.title || ''} ${a.summary || ''}`
          return AFFILIATE_RE.test(text)
        })
        .slice(0, PAGE_SIZE)
        .map(a => {
          const text = `${a.title || ''} ${a.summary || ''}`
          const match = text.match(AFFILIATE_RE)
          return { ...a, issues: ['affiliate_signal'], matched_keyword: match?.[0] }
        })

      return res.status(200).json({ articles: matches, total: matches.length, page: 0, pageSize: PAGE_SIZE })
    }

    return res.status(400).json({ error: 'Unknown type' })
  }

  return res.status(405).end()
}
