import { NextResponse } from 'next/server'

/**
 * Legacy WordPress URLs → 410 Gone.
 *
 * These used to 301 to the homepage. That looked tidy but was actively costing
 * us: Google treats a redirect from an unrelated URL to the homepage as a SOFT
 * 404, so those URLs never leave the crawl queue — they get re-crawled forever.
 * Search Console showed 48% of all crawl requests going to redirects while
 * Discovery sat below 1%, against a budget of only ~190 crawls/day. Every
 * legacy URL re-crawled is a story page that never gets discovered.
 *
 * 410 says "permanently gone, drop it" — Google de-indexes and stops crawling
 * far faster than it does for a 301. We give up any residual link equity from
 * these URLs, which is the right trade: a redirect to an irrelevant page passes
 * essentially none anyway.
 *
 * Redirects with a GENUINELY related destination are deliberately NOT here and
 * stay as 301s in next.config.js — /rankings → /outlets, /media-ratings/:slug →
 * /outlet/:slug, /tag → /explore, /about-us → /about. Those pass real equity.
 *
 * The matcher keeps this off the hot path: middleware is only invoked for these
 * legacy shapes, never for real routes. Verified none of these collide with a
 * live page (there is no /feed, /news or /page route).
 */
export function middleware() {
  return new NextResponse(null, {
    status: 410,
    headers: {
      'x-robots-tag': 'noindex',
      // Let the edge absorb repeat hits rather than invoking this each time.
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

export const config = {
  matcher: [
    '/Archives/:path*',
    '/archives/:path*',
    '/:year(\\d{4})/:month(\\d{2})/:path*',
    '/wp-admin/:path*',
    '/wp-content/:path*',
    '/wp-includes/:path*',
    '/wp-json/:path*',
    '/news/:path*',
    '/page/:n(\\d+)',
    '/feed',
    '/comments/feed',
  ],
}
