/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

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
    remotePatterns: [
      { protocol: 'https', hostname: 'www.google.com' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

module.exports = nextConfig
