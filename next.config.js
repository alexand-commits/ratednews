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
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,  // restore scroll position on back navigation
  },
  // Map existing Vite env var names to Next.js public env vars so
  // Vercel's existing environment variables need no changes.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GA_ID:             process.env.NEXT_PUBLIC_GA_ID,
  },
  // News thumbnails come from hundreds of different CDN domains so a strict
  // hostname whitelist isn't practical. Mitigate SSRF/XSS risk by:
  //   - blocking SVG (can embed scripts)
  //   - serving images with a sandbox CSP so any embedded JS can't execute
  //   - attachment disposition so browsers don't render unknown MIME types inline
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'none'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },

  async redirects() {
    return [
      // /rankings was a near-duplicate of /outlets (moved here from a page-level
      // getServerSideProps so it no longer spins up a function per hit).
      { source: '/rankings', destination: '/outlets', permanent: true },
      // ── Old site: /media-ratings/:slug → /outlet/:slug ──────────────────────
      // Direct slug matches — old and new slugs are identical
      { source: '/media-ratings/bbc-news',               destination: '/outlet/bbc-news',               permanent: true },
      { source: '/media-ratings/Sky-News',               destination: '/outlet/sky-news',               permanent: true },
      { source: '/media-ratings/South-China-Morning-Post', destination: '/outlet/south-china-morning-post', permanent: true },
      { source: '/media-ratings/The-Globe-and-Mail',     destination: '/outlet/the-globe-and-mail',     permanent: true },
      { source: '/media-ratings/The-Guardian',           destination: '/outlet/the-guardian',           permanent: true },
      { source: '/media-ratings/cnbc',                   destination: '/outlet/cnbc',                   permanent: true },
      { source: '/media-ratings/npr',                    destination: '/outlet/npr',                    permanent: true },
      { source: '/media-ratings/propublica',             destination: '/outlet/propublica',             permanent: true },
      { source: '/media-ratings/the-nation',             destination: '/outlet/the-guardian',           permanent: true },
      // Slug differs between old and new site — explicit mapping
      { source: '/media-ratings/The-Sydney-Morning-Herald', destination: '/outlet/sydney-morning-herald', permanent: true },
      { source: '/media-ratings/la-times',               destination: '/outlet/los-angeles-times',      permanent: true },
      // Outlets not in our DB — send to outlets listing
      { source: '/media-ratings/Kuwait-Times',           destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/The-Cyprus-Mail',        destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/city-news-toronto',      destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/india-times',            destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/kyodo-news',             destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/social-media-today',     destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/taipei-times',           destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/the-press',              destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/the-rio-times',          destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/the-star',               destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/the-western-journal',    destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/times-kuwait',           destination: '/outlets',                       permanent: true },
      { source: '/media-ratings/vancouver-sun',          destination: '/outlets',                       permanent: true },
      // Catch-all for any remaining /media-ratings/ paths
      { source: '/media-ratings/:slug*',                 destination: '/outlets',                       permanent: true },

      // ── Old site: /media-reviews/:slug → /outlet/:slug ──────────────────────
      { source: '/media-reviews/new-york-post',          destination: '/outlet/new-york-post',          permanent: true },
      { source: '/media-reviews/:slug*',                 destination: '/outlets',                       permanent: true },

      // ── Old site: archive and section pages → homepage ───────────────────────
      { source: '/Archives/:path*',                      destination: '/',                              permanent: true },
      { source: '/all-news',                             destination: '/',                              permanent: true },
      { source: '/all-news/',                            destination: '/',                              permanent: true },
      { source: '/egypt',                                destination: '/',                              permanent: true },
      { source: '/egypt/',                               destination: '/',                              permanent: true },
      { source: '/thailand',                             destination: '/',                              permanent: true },
    ]
  },
}

module.exports = nextConfig
