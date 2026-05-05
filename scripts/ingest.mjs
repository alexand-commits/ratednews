#!/usr/bin/env node
/**
 * RatedNews RSS Ingestion Script
 * Usage: node scripts/ingest.mjs
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * RSS feed URLs are stored on each outlet row (rss_url column).
 * To add a new outlet: insert a row into outlets with rss_url set.
 * No code changes needed.
 */

import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import 'dotenv/config'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
})

function extractImageUrl(item) {
  if (item.enclosure?.url) return item.enclosure.url
  if (item.mediaContent?.['$']?.url) return item.mediaContent['$'].url
  if (item.mediaThumbnail?.['$']?.url) return item.mediaThumbnail['$'].url
  const html = item.contentEncoded || item.content || ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] || null
}

function extractSummary(item) {
  const raw = item.contentSnippet || item.summary || item.description || ''
  return raw.replace(/<[^>]*>/g, '').trim().slice(0, 500) || null
}

// ── Junk filter ───────────────────────────────────────────────────────────────
// Titles matching any of these patterns are skipped at ingest time.
// Keeps promotional, betting, and non-editorial content out of the feed.
const JUNK_PATTERNS = [
  // Sports betting & odds
  /\bbonus code\b/i,
  /\bbet\d+\b/i,                     // bet365, bet888 etc.
  /\bbetting (tips?|odds|picks?|lines?|preview)\b/i,
  /\bodds\b.*\bprediction\b/i,
  /\bfree bets?\b/i,
  /\bpromo code\b/i,
  // Sponsored / advertorial
  /\b(sponsored|advertorial|paid post|partner content|promoted)\b/i,
  // Deals & commerce
  /\b(best deals?|discount|coupon|% off|save \$|flash sale)\b/i,
  /\bamazon (deals?|prime day)\b/i,
  // Affiliate roundups
  /^best \d+ /i,                      // "Best 10 VPNs for…"
  /\b(buy now|shop now|order now)\b/i,
  // Horoscopes & puzzles
  /\b(horoscope|star sign|crossword answer|wordle answer|quiz)\b/i,
  // Weather & traffic (very local, no editorial value)
  /^(weather|traffic) (update|alert|warning|forecast)/i,
  // Listicle bait with no news value
  /\byou won't believe\b/i,
  // Photo galleries & multimedia — no text content to score
  /\bin pictures?\b/i,
  /\bin photos?\b/i,
  /\bpictures? of the (day|week|year|month)\b/i,
  /\bphoto ?gallery\b/i,
  /\bwatch:\s/i,                      // "Watch: Moment when…"
  /\blisten:\s/i,                     // "Listen: Full interview…"
  // Live blogs — updated constantly, low signal
  /^live:/i,
  /\blive (blog|updates?|coverage|score)\b/i,
  /\bas it happened\b/i,
  // Factboxes & wires noise
  /\bfactbox:\b/i,
  /\bfact ?check:\b/i,                // keep actual fact-checks but factbox= wire filler
  /^corrects?\b/i,                    // AP/Reuters correction notices
  /^update\d*:/i,                     // "Update: Story now includes…"
  // Pure TV/radio schedules
  /\b(tv|radio) (listings?|schedule|guide|tonight)\b/i,
  /\bwhat('s| is) on (tv|tonight|this week)\b/i,
  // Non-editorial aggregates
  /\bweekly roundup\b/i,
  /\bmorning (briefing|digest|newsletter)\b/i,
  /\bevening (briefing|digest|newsletter)\b/i,
  // Extremely short titles are usually malformed feed entries
]

const MAX_ARTICLE_AGE_DAYS = 1  // skip articles whose pubDate is older than this

function isTooOld(pubDate) {
  if (!pubDate) return false  // no date = allow through (date will default to now)
  const published = new Date(pubDate)
  if (isNaN(published)) return false
  const ageMs = Date.now() - published.getTime()
  return ageMs > MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000
}

function isTooShort(title) {
  return title.trim().length < 15
}

// Rough non-English heuristic — if >40% of chars are non-ASCII, skip
function isLikelyNonEnglish(title) {
  const nonAscii = (title.match(/[^\x00-\x7F]/g) || []).length
  return nonAscii / title.length > 0.4
}

function isJunk(title) {
  return JUNK_PATTERNS.some(re => re.test(title))
}

async function ingestOutlet(outlet) {
  if (!outlet.rss_url) {
    console.log(`  ⚠️  No rss_url set — skipping`)
    return { inserted: 0, skipped: 0, errors: 0 }
  }

  let feed
  try {
    feed = await parser.parseURL(outlet.rss_url)
  } catch (err) {
    console.error(`  ❌ Failed to fetch feed: ${err.message}`)
    return { inserted: 0, skipped: 0, errors: 1 }
  }

  const items = feed.items.slice(0, 25)
  let inserted = 0, skipped = 0, errors = 0

  const urls   = items.map(i => i.link || i.guid).filter(Boolean)
  const titles = items.map(i => i.title?.trim()).filter(Boolean)

  const [{ data: existingByUrl }, { data: existingByTitle }] = await Promise.all([
    supabase.from('articles').select('url').in('url', urls),
    supabase.from('articles').select('title').eq('outlet_id', outlet.id).in('title', titles),
  ])

  const existingUrls   = new Set((existingByUrl   || []).map(r => r.url))
  const existingTitles = new Set((existingByTitle || []).map(r => r.title))

  for (const item of items) {
    const url   = item.link || item.guid
    const title = item.title?.trim()
    if (!url || !title) continue
    if (isTooOld(item.pubDate))    { skipped++; continue }
    if (isTooShort(title))         { skipped++; continue }
    if (isLikelyNonEnglish(title)) { skipped++; continue }
    if (isJunk(title))             { skipped++; continue }
    if (existingUrls.has(url) || existingTitles.has(title)) { skipped++; continue }

    const { error } = await supabase.from('articles').insert({
      outlet_id:    outlet.id,
      title,
      url,
      summary:      extractSummary(item),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      image_url:    extractImageUrl(item),
    })

    if (error) {
      if (error.code === '23505') { skipped++; continue }
      console.error(`    ❌ ${error.message}`)
      errors++
    } else {
      inserted++
    }
  }

  return { inserted, skipped, errors }
}

async function main() {
  console.log('🚀 RatedNews RSS Ingestion')
  console.log('===========================\n')

  const { data: outlets, error } = await supabase
    .from('outlets')
    .select('id, name, rss_url')
    .not('rss_url', 'is', null)

  if (error) {
    console.error('Failed to fetch outlets:', error.message)
    process.exit(1)
  }

  console.log(`Found ${outlets.length} outlets with RSS feeds\n`)

  let totalInserted = 0

  for (const outlet of outlets) {
    console.log(`📡 ${outlet.name}`)
    const { inserted, skipped, errors } = await ingestOutlet(outlet)
    console.log(`   ✅ ${inserted} new  •  ${skipped} already exist  •  ${errors} errors`)
    totalInserted += inserted
  }

  console.log(`\n===========================`)
  console.log(`✅ Done — ${totalInserted} new articles ingested`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
