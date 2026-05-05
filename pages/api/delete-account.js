import { createClient } from '@supabase/supabase-js'

// Server-side only — uses service role key to delete the authenticated user's account
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'No auth token' })

  // Verify the token and get user ID
  const anonClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
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
