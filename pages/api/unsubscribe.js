/**
 * GET /api/unsubscribe?token=<unsub_token>
 * One-click digest opt-out — the token is the capability, no login required.
 * RLS only permits setting weekly_digest to false via this path.
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const token = (req.query.token || '').toString()
  if (!/^[0-9a-f-]{36}$/.test(token)) return res.status(400).send('Invalid link')
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  // Token-scoped opt-out via a SECURITY DEFINER function — the token is checked
  // server-side, so anon has no raw UPDATE on the tables (which it could
  // otherwise run unfiltered to nuke the whole list). Handles both an account
  // token (email_prefs) and a public subscriber token (digest_subscribers).
  const { error } = await db.rpc('unsubscribe_by_token', { p_token: token })
  res.setHeader('Content-Type', 'text/html')
  if (error) return res.status(500).send('<body style="font-family:sans-serif;padding:40px">Something went wrong — email info@ratednews.com and we\'ll sort it.</body>')
  return res.status(200).send('<body style="font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto"><h2>You\'re unsubscribed</h2><p>No more weekly digests. You can keep using RatedNews as usual — <a href="https://www.ratednews.com">ratednews.com</a>.</p></body>')
}
