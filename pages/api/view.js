/**
 * POST /api/view
 * Increments view_count for an article.
 * - Rejects known bots/crawlers by user-agent
 * - Deduplicates by hashing IP + article_id within a 1-hour window (via in-memory cache)
 */

import { createClient } from '@supabase/supabase-js'

// Simple in-memory dedup cache: "ip:articleId" -> timestamp
// Resets on each cold start, which is fine — it's a soft signal not an exact count
const seen = new Map()
const DEDUP_WINDOW_MS = 60 * 60 * 1000 // 1 hour

const BOT_UA_RE = /bot|crawler|spider|crawling|facebookexternalhit|Twitterbot|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|whatsapp|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|ia_archiver/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Reject bots
  const ua = req.headers['user-agent'] || ''
  if (BOT_UA_RE.test(ua)) {
    return res.status(200).json({ ok: true, skipped: 'bot' })
  }

  const { id } = req.body || {}
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing article id' })
  }

  // IP-based dedup
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const key = `${ip}:${id}`
  const now = Date.now()
  const last = seen.get(key)
  if (last && now - last < DEDUP_WINDOW_MS) {
    return res.status(200).json({ ok: true, skipped: 'dedup' })
  }
  seen.set(key, now)

  // Prune old entries to prevent memory leak on long-lived instances
  if (seen.size > 10000) {
    for (const [k, ts] of seen) {
      if (now - ts > DEDUP_WINDOW_MS) seen.delete(k)
    }
  }

  // Use service role key if available (bypasses RLS), fall back to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL

  if (!supabaseUrl || !supabaseKey) {
    console.error('[view] Missing Supabase env vars')
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch current view count then increment — avoids relying on a DB RPC function
    const { data, error: fetchError } = await supabase
      .from('articles')
      .select('view_count')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('[view] fetch error:', fetchError.message)
      return res.status(500).json({ error: 'Internal server error' })
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update({ view_count: (data?.view_count || 0) + 1 })
      .eq('id', id)

    if (updateError) {
      console.error('[view] update error:', updateError.message)
      return res.status(500).json({ error: 'Internal server error' })
    }

    // If the user is logged in, record a user-attributed view for media diet tracking
    const authHeader = req.headers['authorization']
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (!authError && user?.id) {
          await supabase.from('article_views').insert({
            user_id:    user.id,
            article_id: id,
          })
        }
      } catch (_) {
        // Non-fatal — view_count already updated above
      }
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[view] unexpected error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
