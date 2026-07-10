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
  // Token may belong to an account (email_prefs) or a public subscriber
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    db.from('email_prefs').update({ weekly_digest: false, updated_at: new Date().toISOString() }).eq('unsub_token', token),
    db.from('digest_subscribers').update({ subscribed: false }).eq('unsub_token', token),
  ])
  const error = e1 && e2 ? e1 : null
  res.setHeader('Content-Type', 'text/html')
  if (error) return res.status(500).send('<body style="font-family:sans-serif;padding:40px">Something went wrong — email info@ratednews.com and we\'ll sort it.</body>')
  return res.status(200).send('<body style="font-family:sans-serif;padding:40px;max-width:480px;margin:0 auto"><h2>You\'re unsubscribed</h2><p>No more weekly digests. You can keep using RatedNews as usual — <a href="https://www.ratednews.com">ratednews.com</a>.</p></body>')
}
