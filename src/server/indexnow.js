/**
 * IndexNow — push new URLs to Bing (and Yandex, Seznam; it also feeds
 * DuckDuckGo and Copilot) instead of waiting to be crawled.
 *
 * Why this matters here specifically: Google crawls us ~190 times a day while
 * we publish ~14,000 articles a day, so discovery there is hopeless by
 * arithmetic. Bing is the opposite — it already ranks our article pages around
 * position 3 and accepts direct submission. IndexNow turns "wait for crawl
 * budget" into "tell them it exists", which is the single biggest lever we have
 * on the engine that is actually sending traffic.
 *
 * Google does NOT support IndexNow, which is fine: its constraint is crawl
 * budget, and we serve that separately with a curated, story-weighted sitemap.
 * Each engine gets the approach that suits it.
 *
 * The key is self-hosted verification: the file at keyLocation must contain the
 * key, which is why it lives in public/. Rotate by generating a new hex string,
 * dropping the matching .txt in public/, and updating INDEXNOW_KEY.
 */

export const INDEXNOW_KEY = '08adfaddce3ba11061da88a1b6477149'
const HOST = 'www.ratednews.com'
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_URLS = 10000 // protocol limit per request

/**
 * @param {string[]} urls absolute URLs on HOST
 * @returns {Promise<{submitted:number, status:number|null, skipped?:string}>}
 */
export async function submitToIndexNow(urls) {
  const list = [...new Set((urls || []).filter(u => typeof u === 'string' && u.startsWith(`https://${HOST}/`)))]
  if (!list.length) return { submitted: 0, status: null, skipped: 'no urls' }
  // Opt-out for dry runs and local experiments — never notify search engines
  // about URLs from a scratch run.
  if (process.env.INDEXNOW_DISABLED === '1') return { submitted: 0, status: null, skipped: 'disabled' }

  const batch = list.slice(0, MAX_URLS)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: batch,
      }),
    })
    // 200 = accepted, 202 = accepted pending key validation. Anything else is
    // informational only — this must never be able to fail a clustering run.
    return { submitted: batch.length, status: res.status }
  } catch (err) {
    return { submitted: 0, status: null, skipped: err.message }
  }
}
