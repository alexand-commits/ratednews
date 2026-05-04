import { createClient } from '@supabase/supabase-js'

// Works in both Next.js (process.env) and any server-side context.
// next.config.js maps VITE_SUPABASE_* → NEXT_PUBLIC_SUPABASE_* so
// Vercel's existing env vars need no changes.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const db = createClient(supabaseUrl, supabaseKey)
