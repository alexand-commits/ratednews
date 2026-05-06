import { createClient } from '@supabase/supabase-js'

// Simple in-memory rate limit: max 3 requests per IP per 60 seconds
const rateLimitMap = new Map()
function isRateLimited(ip) {
  const now = Date.now()
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60_000 }
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000 }
  entry.count++
  rateLimitMap.set(ip, entry)
  return entry.count > 3
}

// Server-side only — uses service role key to delete the authenticated user's account
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests — please wait a moment' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'No auth token' })

  // Verify the token and get user ID
  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: userErr } = await anonClient.auth.getUser()
  if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

  // Use service role to delete the user
  const adminClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteErr) return res.status(500).json({ error: deleteErr.message })

  return res.status(200).json({ success: true })
}
