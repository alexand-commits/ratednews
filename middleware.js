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
// A 410 is for crawlers, but PEOPLE still land on these URLs from old search
// results. An empty body would give them a blank page, so serve a real one
// with a way onward. The status stays 410 either way, so this costs nothing
// in de-indexing terms.
const GONE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Page no longer available — RatedNews</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#F8F6F4;color:#201E1C;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
  @media(prefers-color-scheme:dark){body{background:#201E1C;color:#F8F6F4}}
  .w{max-width:30rem;text-align:center}
  h1{font-size:1.35rem;margin:0 0 .5rem}
  p{opacity:.75;margin:0 0 1.5rem}
  a{display:inline-block;padding:.6rem 1.1rem;margin:0 .25rem;border-radius:8px;
    background:#D85A30;color:#fff;text-decoration:none;font-weight:600;font-size:.9rem}
  a.alt{background:transparent;color:inherit;border:1px solid currentColor;opacity:.7}
</style></head>
<body><div class="w">
  <h1>This page is no longer available</h1>
  <p>It was part of an earlier version of RatedNews and has been retired.</p>
  <a href="/">Today's top stories</a><a class="alt" href="/explore">Browse by topic</a>
</div></body></html>`

export function middleware() {
  return new NextResponse(GONE_HTML, {
    status: 410,
    headers: {
      'content-type': 'text/html; charset=utf-8',
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
