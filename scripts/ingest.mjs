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
  // Racing tipster columns (e.g. The Sun's Templegate, tabloid NAP picks)
  /\bhorse.?racing tips?\b/i,        // "Horse racing tips: …"
  /\bracing tips?\b/i,               // "Racing tips for …"
  /\btips?:\s/i,                     // "Tips: best bets today" etc.
  /\btemplegate\b/i,                 // The Sun's tipster column
  /\b(nap|nb|each.?way)\b.*\btips?\b/i,  // "NAP tips", "each-way tips"
  /\bday \w+ nap\b/i,                // "day one NAP", "day two NAP"
  /\bnap\s*$/i,                      // title ending in "… NAP"
  /\b(accumulator|acca) tips?\b/i,   // "accumulator tips"
  /\b(best bets?|top picks?|selections?) (today|tonight|this week)\b/i,
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

  // ── Paywalled article markers ─────────────────────────────────────────────────
  // Der Spiegel prefixes subscriber-only articles with "(S+)" — drop them
  /^\(S\+\)/,

  // ── Magazine / publisher events and shop pages ────────────────────────────────
  // The Spectator's Google News feed picks up events and shop listings alongside journalism
  /\bSpectator Events\b/i,
  /\bSpectator Shop\b/i,
  /\bSpectator Boardroom\b/i,
  /\bWinemaker (Dinner|Lunch)\b/i,
  /\bCarol Service\b/i,
  // Generic "magazine covers" and cartoon listings
  /\b\d{1,2} \w+ \d{4} (Cover|Cartoons?)\b/i,
  /\b20\d{2} [Cc]overs?\b/,

  // ── Magazine shopping / product recommendation sections ───────────────────────
  // New York Magazine's "The Strategist" is a product rec section, not journalism
  /\bThe Strategist\b/i,
  /\bHalf-Off\b.*\b(sale|deal|discount|weekend)\b/i,
  /\bSales? This (Weekend|Week)\b/i,

  // ── Advice columns ────────────────────────────────────────────────────────────
  /^Dear (Abby|Ann|Prudence|Carolyn)\b/i,

  // ── Government / sponsored campaign promotions (common in Indian press) ───────
  // Catches "PFRDA Mother's Day Campaign 2026 | NPS Vatsalya" style entries
  /\b(campaign|scheme|yojana|initiative|drive)\s+\d{4}\b/i,
  /\bNPS (Vatsalya|scheme)\b/i,
  // Store/showroom openings dressed as news (PR releases)
  /\b(Authorised|Authorized) Reseller Store\b/i,
  /\bopens? (its |a |new )?(flagship|mega|new) store\b/i,

  // ── Scholarship & listing pages ───────────────────────────────────────────────
  /^Scholarships?:\s/i,

  // ── TV programme listings (Channel 4 and similar broadcasters) ───────────────
  // "Fri 8 May 2026 – Programmes" style schedule pages
  /\b[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]+ \d{4} [–-] Programmes?\b/,

  // ── Sun / tabloid travel & consumer puff ─────────────────────────────────────
  // "I visited the foodie city..." personal travel pieces used as destination ads
  /^I (visited|tried|tested|went to|stayed at|ate at)\b/i,
  // Shopping product recommendations disguised as news
  /\b(tumble dryer|clothes airer|air fryer|heated airer)\b/i,
  /\b(half.?price|£\d+ (deal|saving|off))\b.*\b(airer|dryer|gadget|device)\b/i,

  // ── Tabloid lifestyle / celebrity clickbait (Daily Mail, The Sun, etc.) ──────
  // ALL-CAPS "YOUR" is the Daily Mail's signature engagement trigger
  /\bYOUR\b/,                           // "judging YOUR bathroom", "YOUR home is…"
  // Question-opener personal lifestyle titles
  /^(should|are|is|do|would|could) (you|your)\b/i,  // "Should you X", "Are you X"
  // "What your X says/reveals about you" — classic DM formula
  /\bwhat your [a-z ]+ (says?|reveals?|means?|shows?)\b/i,
  // Celebrity reaction / body / outfit clickbait
  /\b(wows?|stuns?|shocks?|dazzles?) (fans?|followers?|internet|viewers?|critics?|crowds?)\b/i,
  /\b(fans?|viewers?) (go wild|react|are (stunned|shocked|baffled|divided|furious))\b/i,
  /\b(shows? off|flaunts?|puts on a display|steps out)\b/i,
  /\blooks (incredible|stunning|unrecognisable|amazing) (as she|in|at)\b/i,
  // Health anxiety bait — no clinical value
  /\b(signs? you (may|might|could) have|warning signs?)\b/i,
  /\b(symptoms? (of|you should)|silent (killer|symptom))\b/i,
  // Domestic lifestyle tips that are not news
  /\b(home|kitchen|bathroom|bedroom|garden) (tips?|hacks?|tricks?|ideas?|inspo|inspiration|secrets?)\b/i,
  /\bhow to (clean|organise|organize|declutter|make) your (home|house|kitchen|bathroom|bedroom|garden)\b/i,
  // Food & drink lifestyle (non-news)
  /\brecipe(s)? (you|to try|of the (day|week))\b/i,
  /\b(best|top) (restaurants?|places? to eat|cafes?|bars?) (in|near|for)\b/i,
  // "Inside X's Y" celebrity home/life tours
  /^inside [a-z]+'s (home|house|mansion|life|wedding|relationship)\b/i,
  // Relationship / sex advice columns
  /\b(dating|relationship|sex) (tips?|advice|hacks?|secrets?|rules?)\b/i,
  /\bhow to (get|keep|attract|impress) (a |your )?(man|woman|partner|date|husband|wife)\b/i,
  // Fashion, clothing & style (tabloid filler — not news)
  /\b(how to (style|wear|rock))\b/i,
  /\b(fashion|style|beauty|wardrobe) (tips?|hacks?|tricks?|secrets?|guide|edit|haul)\b/i,
  /\b(best|top|must-have) (jeans?|trainers?|sneakers?|dresses?|shoes?|boots?|coats?|jackets?|leggings?) (for|to buy|under|worth|you need)\b/i,
  /\bjeans? (you need|every woman|that will|for every|to try|worth buying)\b/i,
  /\b(spring|summer|autumn|winter|fall) (fashion|style|outfits?|wardrobe|must-haves?|edit|pieces?)\b/i,
  /\b(on-trend|trending (looks?|styles?|outfits?))\b/i,
  /\b(capsule|staple|timeless) (wardrobe|pieces?|outfits?)\b/i,
  /\bhigh street (finds?|picks?|buys?|favourites?|gems?)\b/i,

  // ── Sports match preview / fixture guide articles ─────────────────────────────
  // "Man Utd XI vs Chelsea: Predicted lineup, confirmed team news, TV, live stream"
  // These are preview/guide pages, not news — common on Evening Standard, ESPN etc.
  /\bpredicted (lineup|line.?up|starting (xi|eleven))\b/i,
  /\bkick.?off time\b.*\b(tv|live stream|odds)\b/i,
  /\bh2h results\b/i,
  /\bodds today\b/i,

  // ── Daily cartoon / illustration entries ─────────────────────────────────────
  // The New Yorker publishes a "Daily Cartoon: [Day], [Date]" entry every day
  /^Daily Cartoon:/i,

  // ── Puzzles, games & daily digest fillers ─────────────────────────────────────
  // Slate Pears Game, SoundBites, NYT Connections etc.
  /\bPears Game\b/i,
  /\bSoundBites?\b.*\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})\b/i,
  /\bConnections (puzzle|game|hints?)\b/i,
  /\bWordle\b/i,
  /\bQuordle\b/i,

  // ── Poll pages ────────────────────────────────────────────────────────────────
  /^POLL:/i,

  // ── Live traffic & travel disruption blogs (not news) ────────────────────────
  /\b(M\d+|motorway|A\d+ road)\b.{0,30}\blive\b.*\b(blocked|delays?|crash|closure)\b/i,

  // ── Personal narrative lifestyle pieces (BI, Mirror, tabloids) ───────────────
  // "I lost a third of my bodyweight after..." / "I was convinced my mother-in-law..."
  // Distinct from "I visited" (already caught) — broader personal confession/journey openers
  /^I (lost|gained|had|have|spent|quit|left|gave|told|couldn't|didn't|never|asked|found|tried to|woke up|grew up|moved|retired|survived)\b/i,
  /^My (mother.in.law|husband|wife|partner|mum|dad|boss|doctor|neighbour|neighbor)\b/i,

  // ── Section / category homepage links mistakenly pulled as articles ───────────
  // The Times and similar outlets' RSS sometimes includes nav/section landing pages
  /^(Business|Life( & Style)?|Style|Culture|Sport|Health|Travel|Food|Money|Technology|Opinion|Entertainment)\s*[:\-–]\s*(Latest news|News and analysis|Today's|This week)/i,

  // ── Weekly digest / roundup entries ──────────────────────────────────────────
  /^Stories (that caught|we think|we found|of the week)\b/i,
  /\bweekly (digest|roundup|wrap.?up|briefing)\b/i,

  // ── Car and product reviews ───────────────────────────────────────────────────
  /\b(bang for your buck|test drive|road test)\b.*\b(car|suv|truck|van|bike)\b/i,
  /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z].+:\s*(Review|Test|First drive|Long.?term)\b/i,

  // ── Deals, promo codes and product best-of roundups (Wired Gear, etc.) ───────
  // Wired's Gear section publishes these constantly — not journalism
  /\bPromo Codes?\b/i,
  /^Top .+ Deals? for\b/i,
  /^(The Best|Top \d+) .+\(\d{4}\)$/i,    // "The Best Gaming Controllers (2026)"
  /\bDeals?:? Up to \$?\d+/i,              // "Deals: Up to $100 off"

  // ── Newsletter / digest entries ────────────────────────────────────────────────
  // MIT Technology Review's daily digest, Economist newsletter etc.
  /^The Download:/i,
  /^Cover Story newsletter:/i,
  /^(Morning|Evening|Daily|Weekly) (Briefing|Digest|Edition|Newsletter|Wrap|Roundup):/i,

  // ── Syndicated wire bylines pulled as main outlet articles ────────────────────
  // USA Today's Google News feed pulls in Gannett wire articles (Patriots Wire etc.)
  /- [A-Z][a-z]+ Wire$/,

  // ── Weekend culture guides ─────────────────────────────────────────────────────
  /\bfor the weekend\b/i,
  /^(What's (on|to do)|Things to do) this (weekend|week)\b/i,

  // ── Numbered health / lifestyle listicles ──────────────────────────────────────
  /^\d+ (cancer|weight.?loss|anti.?aging|sleep|gut.?health|longevity).*(habit|tip|food|sign|way|thing)/i,
  /^How to (manage|deal with|cope with) your (health )?(anxiety|stress|worry)\b/i,

  // ── Personal finance clickbait ────────────────────────────────────────────────
  // "How nearly half of women are cheating themselves out of free money"
  /\bcheating (themselves|yourself|himself|herself) out of\b/i,
  /\bone extra (dollar|pound|penny) (on|in|triggers?)\b/i,
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

// ── Title cleanup ─────────────────────────────────────────────────────────────
// Google News RSS appends "- Outlet Name" to every title.
// Strip it so we don't store "Story headline - Hindustan Times" in the DB.
function cleanTitle(title, outletName) {
  return title
    // Decode common HTML entities that some feeds fail to unescape
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Strip "- Outlet Name" suffix added by Google News RSS
    .replace(new RegExp(`\\s*[|\\-–]\\s*${outletName}\\s*$`, 'i'), '')
    .trim()
}

// ── Per-outlet title length limits ────────────────────────────────────────────
// Tabloids routinely use very long headlines for lifestyle/clickbait content.
// Legitimate news headlines rarely exceed 120 chars — anything longer from
// these outlets is almost always celebrity gossip, sex advice, or sponsored fluff.
const OUTLET_MAX_TITLE_LENGTH = {
  'Daily Mail': 125,
  'The Sun':    110,  // tighter — sub-125 lifestyle/consumer junk still slipping through
}

function isTitleTooLong(title, outletName) {
  const limit = OUTLET_MAX_TITLE_LENGTH[outletName]
  return limit != null && title.length > limit
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
    const title = cleanTitle(item.title?.trim() ?? '', outlet.name)
    if (!url || !title) continue
    if (isTooOld(item.pubDate))              { skipped++; continue }
    if (isTooShort(title))                   { skipped++; continue }
    if (isLikelyNonEnglish(title))           { skipped++; continue }
    if (isJunk(title))                       { skipped++; continue }
    if (isTitleTooLong(title, outlet.name))  { skipped++; continue }
    if (existingUrls.has(url) || existingTitles.has(title)) { skipped++; continue }

    const { error } = await supabase.from('articles').insert({
      outlet_id:    outlet.id,
      title,
      url,
      summary:      extractSummary(item),
      published_at: (() => { const p = item.pubDate ? new Date(item.pubDate) : null; return (p && !isNaN(p) && p <= new Date()) ? p.toISOString() : new Date().toISOString() })(),
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

  // Write output for GitHub Actions conditional steps
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `inserted=${totalInserted}\n`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
