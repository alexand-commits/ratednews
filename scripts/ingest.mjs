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
  /\b(horoscope|star sign|crossword|wordle answer|quiz)\b/i,
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
  /\bLIVE[!:]\s/,                        // "Celtic vs Rangers LIVE: …" / "Wardley vs Dubois LIVE! …"
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

  // ── Travel booking packages & event hospitality deals ────────────────────────
  // "Book luxury Austrian Grand Prix for under £900 with F1 package including flights..."
  /^Book (your |the |a |luxury |cheap |an? )?(trip|holiday|stay|seat|package|place|tickets?|break|getaway)\b/i,
  /\bpackage including (flights?|transfers?|accommodation|hotel)\b/i,
  /\b\d+ nights? (at|in) (a |the )?\d+-star\b/i,      // "5 nights at 4-star hotel"
  /\b(flights?|accommodation|hotel) (included?|included)\b/i,
  /\bhospitality (package|deal|ticket)\b/i,
  /\b(vip|luxury|hospitality) package\b/i,
  /\bincluding flights? and\b/i,                       // "including flights and hotel"
  // Price-led travel offers: "for under £900", "from £299 including flights"
  /\b(from|for|under|just) [£$€]\d{2,}.{0,40}(flight|hotel|night|package|stay)\b/i,

  // ── Sun / tabloid travel & consumer puff ─────────────────────────────────────
  // "I visited the foodie city..." personal travel pieces used as destination ads
  /^I (visited|tried|tested|went to|stayed at|ate at)\b/i,
  // Shopping product recommendations disguised as news
  /\b(tumble dryer|clothes airer|air fryer|heated airer)\b/i,
  /\b(half.?price|£\d+ (deal|saving|off))\b.*\b(airer|dryer|gadget|device)\b/i,

  // ── Tabloid lifestyle / celebrity clickbait (Daily Mail, The Sun, etc.) ──────
  // ALL-CAPS "YOUR" is the Daily Mail's signature engagement trigger — narrowed to
  // domestic/personal nouns to avoid catching legitimate news ("YOUR MP voted for X")
  /\bYOUR (home|house|bathroom|kitchen|garden|wardrobe|diet|body|face|hair|skin|gut|partner|relationship|finances?|money|savings?|pension|mortgage|inbox)\b/,
  // Question-opener personal lifestyle titles — narrowed to avoid catching
  // legitimate health/safety journalism ("Should you be worried about the variant?")
  /^(should|are|do|would|could) you (eat|drink|take|buy|wear|try|use|avoid|stop|start|switch|follow|join|get|book|order|install|download)\b/i,
  // "What your X says/reveals about you" — classic DM formula
  /\bwhat your [a-z ]+ (says?|reveals?|means?|shows?)\b/i,
  // Celebrity reaction / body / outfit clickbait
  // Removed "critics" — "shocks critics" appears in legitimate political coverage
  /\b(wows?|stuns?|shocks?|dazzles?) (fans?|followers?|the internet|viewers?|crowds?)\b/i,
  /\b(fans?|viewers?) (go wild|react|are (stunned|shocked|baffled|divided|furious))\b/i,
  /\b(shows? off|flaunts?|puts on a display|steps out)\b/i,
  /\blooks (incredible|stunning|unrecognisable|amazing) (as she|in|at)\b/i,
  // Health anxiety bait — no clinical value
  // "warning signs?" narrowed — bare form catches "warning signs of a recession" (legitimate)
  /\bsigns? you (may|might|could) have\b/i,
  /\bwarning signs?.{0,40}(you (have|may have|might have)|your (body|health|relationship|partner|skin|gut))\b/i,
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
  /\b\w+ XI vs\b/,                          // "Man City XI vs Brentford: Starting lineup…"
  /\bstarting lineup,?\s*confirmed\b/i,     // "Starting lineup, confirmed team news…"
  /\bkick.?off time\b.*\b(tv|live stream|odds)\b/i,
  /\bh2h results\b/i,
  /\bodds today\b/i,
  // How/where-to-watch event guides (NYP, sports outlets)
  /^(how|where) to watch\b/i,              // "How to watch..." / "Where to watch..."
  /:\s*(how|where) to watch\b/i,           // "WWE Backlash: Where To Watch, Start Time..."
  /\bhow to watch\b/i,                     // "What to know and how to watch" mid-title
  // WWE / pro wrestling — entertainment product, not news
  /^WWE\b/i,
  // Sports betting picks dressed as previews
  /\bprediction:.*\b(picks?|best bets?)\b/i, // "Game 4 prediction: NHL picks, best bets"

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

  // ── Daily diary / engagements listings (The Hindu, broadsheets) ───────────────
  /^today's engagements\b/i,              // "Today's engagements" diary column
  /^engagements for\b/i,                  // "Engagements for [date]"

  // ── Live traffic & travel disruption blogs (not news) ────────────────────────
  /\b(M\d+|motorway|A\d+ road)\b.{0,30}\blive\b.*\b(blocked|delays?|crash|closure)\b/i,

  // ── Personal narrative lifestyle pieces (BI, Mirror, tabloids) ───────────────
  // "I lost a third of my bodyweight after..." / "I was convinced my mother-in-law..."
  // Distinct from "I visited" (already caught) — broader personal confession/journey openers
  // Narrowed: removed "survived/fled/escaped" — these appear in legitimate first-person
  // news accounts ("I survived the attack", "I fled Ukraine")
  /^I (lost|gained|spent|quit|gave up|tried to|woke up|grew up|moved|retired)\b/i,
  /^My (mother.in.law|husband|wife|partner|mum|dad|boss|doctor|neighbour|neighbor)\b/i,

  // ── Section / category homepage links mistakenly pulled as articles ───────────
  // The Times and similar outlets' RSS sometimes includes nav/section landing pages
  /^(Business|Life( & Style)?|Style|Culture|Sport|Health|Travel|Food|Money|Technology|Opinion|Entertainment)\s*[:\-–]\s*(Latest news|News and analysis|Today's|This week)/i,

  // ── Weekly digest / roundup entries ──────────────────────────────────────────
  /^Stories (that caught|we think|we found|of the week)\b/i,
  /\bweekly (digest|roundup|wrap.?up|briefing)\b/i,
  /\bwhat you missed this week\b/i,              // "News of the World: What you missed this week"
  /\b(wild|key|big|best|top) moments?.{0,25}this week\b/i, // "Wild moments in Trumpworld this week"
  /^this week on\b/i,                            // "This week on Sunday Morning"
  /^win (a copy of|tickets? to)\b/i,             // competition giveaways
  /^(looking for something|something) to watch\b/i,
  /^add to cart:/i,                              // shopping round-up columns
  /\bnew (shows?|movies?|films?) to watch this (week|weekend)\b/i,

  // ── Car and product reviews ───────────────────────────────────────────────────
  /\b(bang for your buck|test drive|road test)\b.*\b(car|suv|truck|van|bike)\b/i,
  /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z].+:\s*(Review|Test|First drive|Long.?term)\b/i,

  // ── Deals, promo codes and product best-of roundups (Wired Gear, The Verge, etc.) ──
  // Wired's Gear section and The Verge publish these constantly — not journalism
  /\bPromo Codes?\b/i,
  /^Top .+ Deals? for\b/i,
  /^(The Best|Top \d+) .+\(\d{4}\)$/i,    // "The Best Gaming Controllers (2026)"
  /\bDeals?:? Up to \$?\d+/i,             // "Deals: Up to $100 off"
  /\bis (now )?down to \$[\d,.]+/i,        // "Dyson robovac is down to $279.99"
  /\bon sale for \d+ ?(% |percent )off\b/i, // "already on sale for 20 percent off"
  /\bfor a limited time\b/i,               // promotional urgency language
  /\bpreorders? (come|start|open) with\b/i, // "preorders come with a free band"

  // ── Newsletter / digest entries ────────────────────────────────────────────────
  // MIT Technology Review's daily digest, Economist newsletter etc.
  /^The Download:/i,
  /^Cover Story newsletter:/i,
  /^(Morning|Evening|Daily|Weekly) (Briefing|Digest|Edition|Newsletter|Wrap|Roundup):/i,
  // Sports Illustrated newsletter digest promos ("SI:AM |", "SI:CYMI |")
  /^SI:(AM|PM|CYMI)\b/i,

  // ── Sports transfer gossip columns & rumour roundups ─────────────────────────
  // Sky Sports "Papers:" column, BBC "Saturday's gossip", SI "Transfer Rumors:"
  /^Papers:/i,
  /^Transfer Rum(our|or)s?:/i,
  /\b(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Today|Tonight)'s (gossip|papers|rumours?|rumors?)\b/i,
  /- (Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)'s gossip$/i,

  // ── Sports mock trades ────────────────────────────────────────────────────────
  /\bMock Trade\b/i,

  // ── Recruiting / college commitments ─────────────────────────────────────────
  // "2027 QB Andre Phillip II Commits to West Virginia" / "Offers Scholarship to"
  // "commits to" removed — too broad, catches "Government commits to X" (legitimate news)
  /\b20\d{2} (recruit|prospect|commit|class)\b/i,
  /\bannounces? (college )?commitment\b/i,
  /\b(official|campus) visit to\b/i,

  // ── Minicamp / practice observation filler ───────────────────────────────────
  // SI's rookie minicamp live notes, OTA observations, practice takeaways
  /\b(rookie|mandatory|OTA|offseason|training camp|minicamp)\b.{0,40}\b(observations?|notes?|updates?|impressions?|takeaways?|report)\b/i,
  /\bdepth chart\b/i,
  /\bundrafted (free agents?|rookies?|class|picks?|signee?s?)\b/i,
  /\bundrafted rookie\b/i,
  /\bjersey numbers?\b.*\b(rookie|class|draft|assign)\b/i,

  // ── TV highlights shows (BBC Sport, Sky Sports) ───────────────────────────────
  // "Bolton 1-0 Bradford highlights", "Match of the Day", "Sportscene highlights"
  /\bhighlights?\s*$/i,
  /^Match of the Day\b/i,
  /^Sportscene\b/i,

  // ── Commercial / merchandise promos in sports feeds ──────────────────────────
  /\bSwimsuit Issue\b/i,

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

  // ── Chicago Tribune specific ──────────────────────────────────────────────────
  // Jumble — daily puzzle (appears as "Jumble Daily" or "Jumble for [date]")
  /\bJumble\b/i,
  // "Asking Eric" — syndicated advice column
  /^Asking [A-Z][a-z]+:/i,
  // "Today in Chicago History" / "Today in History" — nostalgia filler
  /^Today in [A-Z].{0,30} History\b/i,
  // Entertainment and restaurant reviews (Tribune format: "Review: …" or "Restaurant review: …")
  /^(Restaurant|Film|Movie|Theater|Theatre|Concert|Album|Book|Art) [Rr]eview:/,

  // ── Los Angeles Times specific ────────────────────────────────────────────────
  // "LA Times Insights" / "LA Times Media Group Streaming" — product/promo artifacts
  /\bLA Times (Insights?|Media Group|Streaming)\b/i,
  // Subscription / login nav artifacts that slip through on some feeds
  /\bSubscription (Center|Hub|Page)\b/i,
  /^Log [Ii]n\b.*\bsubscri/i,

  // ── Miami Herald specific ─────────────────────────────────────────────────────
  // Reader crowdsourcing callouts ("Did you lose your job… Reach out to us")
  /\breach out to us\b/i,
  /^Did you (lose|leave|quit|work at|work for)\b.{0,60}\?$/i,
  // Somatic / wellness trend pieces out of place in a news feed
  /\bsomatic (exercises?|therapy|practice)\b/i,

  // ── Score / rating format titles ("5/10: Sunday Morning", "8/10: Album Name") ──
  /^\d+\/\d+:\s/,

  // ── Bare TV / podcast show titles with no news content ───────────────────────
  /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) Morning$/i,
  /^(Meet the Press|Face the Nation|State of the Union|This Week with|Good Morning America|Sunday Morning|Morning Joe)(\s*[-–:].*)?$/i,

  // ── Podcast episode entries ───────────────────────────────────────────────────
  // "Ep. 23: Interview with X" / "Episode 12 — What we learned"
  /^Ep\.?\s*\d+\b/i,
  /^Episode \d+\b/i,
  /^#\d+[:\s–-]/,                          // "#234: Guest Name" format

  // ── First-person expert / professional lifestyle ──────────────────────────────
  // "I'm a nutritionist and here's what I eat" — BI, HuffPost, DM staple
  /^I'?m (a|an) [a-z].{0,60}(and |here'?s |this is |so )/i,
  // "As a [profession], I…" — same format, different opener
  /^As (a|an) [a-z].{0,40}, I\b/i,
  // "I'm [age] years old and…"
  /^I'?m \d+ (years? old|and)\b/i,

  // ── Salary / money confession pieces ─────────────────────────────────────────
  // "I earn £60k a year, here's how I budget" — BI, HuffPost, Metro
  /\bI (earn|make|save|spend|invest|budget|live on|survive on).{0,40}(salary|income|a year|per year|a month|per month|a week|paycheck|take.?home)\b/i,
  /\b(my salary|my income|my wage|my paycheck|my finances|my money|my debt)\b.{0,40}(revealed?|exposed?|confession|diary|breakdown|challenge)\b/i,

  // ── Confession / diary format ─────────────────────────────────────────────────
  /^Confessions? of (a|an)\b/i,            // "Confessions of a stay-at-home mum"
  /\b(money|sex|love|dating|diet|fitness) diary\b/i,  // "My money diary: week 3"

  // ── Viral content writeups ────────────────────────────────────────────────────
  // Thin articles that are just "this video is going around"
  /\b(video|clip|photo|post|tweet|thread|reel|tiktok) (goes?|went|is) viral\b/i,
  /\bviral (video|clip|moment|photo|post|tweet|thread|reel)\b/i,
  /\binternet (reacts?|divided|can't stop|loses? it|is obsessed)\b/i,

  // ── SEO evergreen guides ──────────────────────────────────────────────────────
  /\b(ultimate|complete|definitive|comprehensive|essential|beginners?'?) guide (to|for)\b/i,
  // Narrowed: "things to know about X" catches context journalism (Gaza ceasefire, election guides)
  // Only block when preceded by a number or "key" — pure listicle framing
  /\b\d+ things (to know|you should know|worth knowing) (about|before)\b/i,
  /\bkey things (to know|you need to know) (about|before)\b/i,

  // ── Ranked: / Best X of year listicles ───────────────────────────────────────
  /^Ranked:\s/i,
  /\bwe ranked (every|all|the)\b/i,

  // ── Award show / red carpet fashion ──────────────────────────────────────────
  /\b(red carpet|best dressed|worst dressed|who wore (it best|what))\b/i,
  /\b(Oscars?|BAFTAs?|Grammys?|Emmys?|Golden Globes?|Met Gala).{0,40}(looks?|outfits?|dresses?|fashion|style|gowns?|wore)\b/i,

  // ── Relationship red-flag / sign bait ────────────────────────────────────────
  /\b(signs?|red flags?|warnings?) (your|that your) (partner|relationship|boyfriend|girlfriend|husband|wife|boss|friend|ex)\b/i,
  /\bhow to (know|tell|spot) if (your|you're|he'?s|she'?s)\b/i,

  // ── "I asked AI to…" novelty pieces ──────────────────────────────────────────
  /\bI (asked|used|got|had|made|tried) (AI|ChatGPT|Claude|Gemini|Copilot|Grok|an? AI|the AI)\b/i,
  /\b(AI|ChatGPT|Gemini|Copilot) (told|said|thinks?|rates?|ranks?|picks?|chose|designed|wrote|created|predicted|reveals?)\b.{0,40}\b(best|worst|top|winner|answer|result)\b/i,

  // ── Net worth / celebrity biography SEO ───────────────────────────────────────
  // "X's net worth: how rich is [celebrity]" — pure SEO, no news value
  // Narrowed: bare "net worth" is too broad (catches legitimate financial news)
  /\bnet worth[:\s–-].{0,30}how rich\b/i,
  /\bnet worth (revealed|explored|explained|ranked|estimated|calculated)\b/i,
  /\b(what is|how much is).{0,30}net worth\b/i,
  // "Who is X? Age, height, partner, career" — biography SEO roundups
  /^Who is [A-Z].{0,60}\? (Age|Height|Career|Wife|Husband|Partner|Family|Net worth|Everything)/i,
  /\bage,? height,? (and )?(partner|wife|husband|net worth|career|children|kids)\b/i,
  // "X's wiki: age, height, net worth" — tabloid bio format
  /\b(wiki|bio(graphy)?)[:\s].{0,30}(age|height|net worth|born|nationality)\b/i,

  // ── "You've been doing X wrong" revelation bait ────────────────────────────────
  /\byou'?ve been (doing|making|eating|cooking|cleaning|washing|using|wearing|storing|saying|reading|sleeping|breathing|sitting|standing) .{0,40} (all )?wrong\b/i,
  /\bthe (right|correct|proper) way to (do|make|eat|cook|clean|wash|use|fold|store)\b/i,
  /\byou'?re (doing|making|eating|cooking|using|wearing) (it|this|that|them|these) (all )?wrong\b/i,

  // ── Career / job advice listicles ─────────────────────────────────────────────
  // Business Insider's core content type — not journalism
  /\b(things?|habits?|rules?|traits?) (of )?(highly |truly |insanely |incredibly )?(successful|rich|happy|productive|effective|confident) (people|leaders?|executives?|entrepreneurs?|women|men)\b/i,
  /\b(highest|best|top).?paying (jobs?|careers?|professions?|roles?|positions?)\b/i,
  /\b(jobs?|careers?|professions?) (that (pay|earn)|with (the )?highest|you can do from home|you didn't know)\b/i,
  /\bthings (never|always) (do|say|ask) (in|at|during|before|after) (a job interview|work|the office|your boss)\b/i,
  /\b(interview|workplace|office|career|job) (tips?|hacks?|advice|mistakes?|red flags?|secrets?|dos? and don'?ts?)\b/i,

  // ── Sleep / wellness / daily routine ──────────────────────────────────────────
  /\b(morning|night|bedtime|evening|daily|weekly) routine\b/i,
  /\bwhat I eat in a day\b/i,
  /\b(how to|tips? (for|to)) (fall asleep|sleep (better|faster|deeper|longer)|get (better|more|enough) sleep)\b/i,
  /\b(sleep (tips?|hacks?|tricks?|advice|hygiene|schedule|routine))\b/i,
  /\b(gut health|sleep quality|cortisol|inflammation|longevity|lifespan).{0,40}(tips?|hacks?|foods?|habits?|routine|boost|improve)\b/i,
  /\bself.?care (routine|tips?|ideas?|Sunday|day|practice)\b/i,

  // ── "Where are they now?" nostalgia ───────────────────────────────────────────
  /\bwhere (are|is) (they|he|she|the cast|the stars?) now\b/i,
  /\b(then and now|then vs\.? now)\b.{0,40}(cast|stars?|celebrit|look|transform)/i,
  /\b\d+ years? (on|later|after)[:\s].{0,40}(where|what|how|who|cast|star|remember|look)\b/i,
  /\bdo you remember\b/i,

  // ── Social media reaction / celebrity post pieces ─────────────────────────────
  // Thin articles that are just "X posted this on Instagram"
  // Narrowed: removed "announced/confirmed/revealed" — those appear in legitimate breaking news
  /\b(just|has just|have just) (posted|shared|clapped back|hit back|fired back)\b/i,
  /\b(responds?|claps? back|hits? back|fires? back|slams?|shuts? down|denies?) (to |after |amid |claims?|criticism|backlash|rumours?|reports?|speculation|trolls?)\b/i,
  /\btakes? (to|on) (instagram|twitter|tiktok|x|social media) (to|after|amid)\b/i,

  // ── ICYMI / throwback / "on this day" ────────────────────────────────────────
  /^ICYMI\b/i,
  /^Throwback\b/i,
  /\bthrowback (thursday|friday|to when|photo|post|moment)\b/i,
  /^On [Tt]his [Dd]ay\b/,                   // "On This Day: May 11, 1969…"
  /\b\d+ years? ago (today|this week|this month|this year)\b/i,

  // ── Baby names listicles ──────────────────────────────────────────────────────
  /\bbaby (names?|name (ideas?|inspiration|trends?|list|meaning))\b/i,
  /\b(most popular|trending|unique|rare|unusual|old.?fashioned|classic) (baby |girl |boy )names?\b/i,
  /\bnames? (that mean|inspired by|for (boys?|girls?|babies?|twins?))\b/i,

  // ── Budget lifestyle content ──────────────────────────────────────────────────
  /\bbudget (meal|recipe|dinner|lunch|breakfast|makeover|holiday|travel|wedding|decor|fashion|outfit|renovation|hack)\b/i,
  /\b(cheap|affordable|inexpensive).{0,30}(meals?|recipes?|outfits?|looks?|decor|holiday|getaway|ways? to)\b/i,
  /\bhow to (eat|travel|live|look good|dress well|decorate).{0,30}(on a budget|for less|cheaply|without spending)\b/i,

  // ── Breitbart opinion / commentary filler ─────────────────────────────────────
  // Breitbart publishes high volumes of opinion columns and wire rewrites
  // with inflammatory framing — mostly caught by accuracy scoring but filter early
  // Narrowed: these terms appear in legitimate political reporting as subjects being covered
  // Only block when used as editorial framing, not when quoted or reported on
  /\b(mainstream media|fake news|legacy media|corporate media) (lies?|hides?|ignores?|refuses?|covers? up)\b/i,

  // ── Fox News lifestyle & non-news filler ──────────────────────────────────────
  // Fox publishes high volumes of "faith & values", lifestyle, and entertainment
  /\b(faith|prayer|miracle|blessing|god's? (plan|will|grace))\b.{0,40}\b(story|moment|message|sign)\b/i,
  /\bhow (one|a) (man|woman|family|couple|teen|mom|dad|pastor|veteran)\b.{0,60}\b(changed|transformed|overcame|survived|inspired)\b/i,
  // Fox crime/missing persons local filler — narrowed: "Police search for" alone
  // catches major national crime stories. Require local geography markers instead.
  /^(Police|Cops?|Deputies|Authorities) (search|seek|look) (for|to identify).{0,60}(county|township|parish|borough|suburb|neighborhood|neighbourhood)\b/i,
  /\bremains? (found|identified|discovered) (in|near|at)\b/i,

  // ── The Telegraph lifestyle / culture bleed ───────────────────────────────────
  // Telegraph's culture/travel/food sections pull in via their main RSS
  /\b(best|top) (hotels?|restaurants?|beaches?|villages?|towns?|cities|destinations?) (in|for|to visit)\b/i,
  /\b(where to (stay|eat|drink|visit|go)) (in|near|for)\b/i,
  /\b(travel|food|wine|interiors?) (guide|edit|special|supplement)\b/i,
  /\bTelegraph (Travel|Food|Property|Gardens?|Luxury|Motoring)\b/i,
  // Property porn — Telegraph runs heavy property coverage
  /\b(for sale|on the market|asking price|guide price|offers over)\b.{0,40}\b(home|house|flat|cottage|manor|estate)\b/i,
  /\binside (the|a|this) (stunning|incredible|beautiful|charming|magnificent).{0,30}(home|house|flat|cottage|barn|farmhouse)\b/i,

  // ── Daily Mail / tabloid celebrity & lifestyle filler ─────────────────────────
  // "X's transformation" — before/after celebrity body clickbait
  // Adjective now required — bare "transformation" catches legitimate news ("Ukraine's transformation")
  /\b(dramatic|incredible|stunning|unbelievable|shocking|remarkable) transformation\b/i,
  // "X, Y" celeb couple appearance pieces with no news value
  /\b(cuddles?|kisses?|embraces?|holds? hands?|packs? on the PDA)\b/i,
  // "X debuts new look / shows off X" appearance pieces
  /\b(debuts? (new|a|her|his) (look|hairstyle|hair|figure|baby bump|bump|bikini body))\b/i,
  /\bshows? off (her|his|their|a) (figure|curves?|abs?|legs?|baby bump|bump|bikini body|new look)\b/i,
  // "Is X the new Y?" substitution clickbait
  /\bis [a-z ]+ the new [a-z ]+\?/i,
  // "X opens up about Y" — interview-derived lifestyle fluff
  // Narrowed: politicians/officials legitimately "break silence" and "speak out" on issues
  // Only block when followed by personal/health topics, not political ones
  /\b(opens? up|breaks? silence|speaks? out) (about|on) (her|his|their) (weight|body|marriage|divorce|split|baby|pregnancy|health battle|mental health|addiction|affair|cheating|feud)\b/i,
  // "Everything you need to know about X" — SEO evergreen, not news
  /\beverything you need to know\b/i,
  // Countdown listicles with no news hook
  /^\d+ (things?|ways?|reasons?) (you|to|that|why)\b/i,
  // "We tried X so you don't have to" — product/lifestyle
  /\bso you don't have to\b/i,
  // "Spotted: X leaving/arriving at Y" — paparazzi log entries
  /\b(spotted|seen|pictured|photographed) (leaving|arriving|heading|out and about)\b/i,
  // Femail / body image columns — DM's dedicated lifestyle section
  /\bFemail\b/i,
  // "Readers share their X" — UGC aggregation, not journalism
  /\breaders? (share|reveal|confess|admit|react)\b/i,
  // "What the X says about you" personality quiz bait (catches remaining variants)
  /\bsays? (a lot )?about (your|you)\b/i,
  // "As seen on TV / social media / TikTok" — product promotion
  /\bas seen on (tv|social media|tiktok|instagram|youtube)\b/i,
  // Generic "X is back" / "X is here" trend announcements with no news value
  /\b(summer|spring|winter|autumn|fall) is (here|back|coming)\b.*\b(style|fashion|beauty|diet|body|fitness)\b/i,
]

const MAX_ARTICLE_AGE_DAYS = 1  // default: skip articles older than 1 day

// Slow-publishing outlets produce fewer articles per week — give them a wider window
const OUTLET_MAX_AGE_DAYS = {
  'Quanta Magazine': 7,
  'Rest of World':   5,
  'The Economist':   7,
  'New Statesman':   7,
  'Foreign Policy':  5,
  'ProPublica':      5,
  'Bellingcat':      14,
  'InSight Crime':   7,
}

function isTooOld(pubDate, outletName) {
  if (!pubDate) return false  // no date = allow through (date will default to now)
  const published = new Date(pubDate)
  if (isNaN(published)) return false
  const maxDays = OUTLET_MAX_AGE_DAYS[outletName] ?? MAX_ARTICLE_AGE_DAYS
  const ageMs = Date.now() - published.getTime()
  return ageMs > maxDays * 24 * 60 * 60 * 1000
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
  'Daily Mail':    110,  // tightened from 125 — DM's junk rate is 62%, cap aggressively
  'The Sun':       100,  // tightened from 110
  'The Telegraph': 115,  // lifestyle/culture section bleeds in with long descriptive titles
}

// ── Per-outlet per-run article caps ──────────────────────────────────────────
// Limits how many articles we take from a single outlet per ingest run.
// High-volume tabloids with poor signal/noise ratios burn API scoring budget;
// cap them so quality outlets aren't crowded out.
const OUTLET_MAX_PER_RUN = {
  'Daily Mail':    8,   // was ingesting 15–20/run at 62% junk; cap saves ~7 AI calls/run
  'The Sun':       6,   // tiny RSS footprint but very high junk rate
  'The Telegraph': 10,  // 46.7% junk rate — cap to reduce scoring waste
  'Fox News':      10,  // 30.4% junk, high volume (69 articles/month)
  'Breitbart':     6,   // 41.3% junk + worst accuracy score (28.3% low) — tight cap
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

  const runCap = OUTLET_MAX_PER_RUN[outlet.name] ?? 25
  const items = feed.items.slice(0, runCap)
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
    if (isTooOld(item.pubDate, outlet.name)) { skipped++; continue }
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
