/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Map existing Vite env var names to Next.js public env vars so
  // Vercel's existing environment variables need no changes.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  },
  // Allow images from Google favicon service
  images: {
    domains: ['www.google.com'],
  },
}

module.exports = nextConfig
