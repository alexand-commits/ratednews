/**
 * Vercel Cron Job — RSS Ingestion
 * Runs on schedule defined in vercel.json
 * Called by Vercel with Authorization: Bearer <CRON_SECRET>
 */

const { createClient } = require('@supabase/supabase-js')
const Parser = require('rss-parser')

const RSS_FEEDS = {
  'BBC News':         'https://feeds.bbci.co.uk/news/rss.xml',
  'Reuters':          'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en',
  'The Guardian':     'https://www.theguardian.com/rss',
  'AP News':          'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en',
  'The Economist':    'https://www.economist.com/latest/rss.xml',
  'New York Times':   'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'Washington Post':  'https://news.google.com/rss/search?q=site:washingtonpost.com&hl=en-US&gl=US&ceid=US:en',
  'Fox News':         'https://moxie.foxnews.com/google-publisher/latest.xml',
  'Al Jazeera':       'https://www.aljazeera.com/xml/rss/all.xml',
  'The Hill':         'https://thehill.com/feed/',
  'Politico':         'https://rss.politico.com/politics-news.xml',
  'Sky News':         'https://feeds.skynews.com/feeds/rss/home.xml',
  'Daily Mail':       'https://www.dailymail.co.uk/articles.rss',
  'CNN':              'https://news.google.com/rss/search?q=site:cnn.com&hl=en-US&gl=US&ceid=US:en',
  'NBC News':         'https://feeds.nbcnews.com/nbcnews/public/news',
  'NPR':              'https://feeds.npr.org/1001/rss.xml',
  'The Independent':  'https://www.independent.co.uk/news/rss',
  'The Telegraph':    'https://news.google.com/rss/search?q=site:telegraph.co.uk&hl=en-GB&gl=GB&ceid=GB:en',
  'Breitbart':        'https://feeds.feedburner.com/breitbart',
  'Vox':              'https://www.vox.com/rss/index.xml',
  'Financial Times':  'https://news.google.com/rss/search?q=site:ft.com&hl=en-US&gl=US&ceid=US:en',
  'Wall Street Journal': 'https://news.google.com/rss/search?q=site:wsj.com&hl=en-US&gl=US&ceid=US:en',
  // US political
  'The Intercept':         'https://theintercept.com/feed/?rss',
  'Mother Jones':          'https://www.motherjones.com/feed/',
  'The Federalist':        'https://thefederalist.com/feed/',
  // Canada
  'National Post':         'https://news.google.com/rss/search?q=site:nationalpost.com&hl=en-CA&gl=CA&ceid=CA:en',
  'Toronto Star':          'https://news.google.com/rss/search?q=site:thestar.com&hl=en-CA&gl=CA&ceid=CA:en',
  // Science
  'New Scientist':         'https://www.newscientist.com/feed/home/',
  // Tech outlets
  'The Verge':             'https://www.theverge.com/rss/index.xml',
  'Wired':                 'https://www.wired.com/feed/rss',
  'Ars Technica':          'https://feeds.arstechnica.com/arstechnica/index',
  'TechCrunch':            'https://techcrunch.com/feed/',
  'MIT Technology Review': 'https://www.technologyreview.com/feed/',
  // Africa & LATAM
  'Mail & Guardian':       'https://mg.co.za/feed/',
  'Africa News':           'https://www.africanews.com/feed/rss',
  'Buenos Aires Times':    'https://batimes.com.ar/feed',
  // New general outlets
  'Channel NewsAsia':     'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml',
  'Hindustan Times':      'https://news.google.com/rss/search?q=site:hindustantimes.com&hl=en-IN&gl=IN&ceid=IN:en',
  'The Age':              'https://www.theage.com.au/rss/feed.xml',
  'The Conversation':     'https://theconversation.com/articles.atom',
  'Washington Examiner':  'https://www.washingtonexaminer.com/feed',
  // Sports outlets
  'BBC Sport':        'https://feeds.bbci.co.uk/sport/rss.xml',
  'Sky Sports':       'https://www.skysports.com/rss/12040',
  'ESPN':             'https://www.espn.com/espn/rss/news',
  'Sports Illustrated': 'https://news.google.com/rss/search?q=site:si.com&hl=en-US&gl=US&ceid=US:en',
}

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

// ── Junk filter ────────────────────────────────────────────────────────────────
// Returns true for non-news content that should be dropped before insert/scoring.
// Catches crosswords, podcasts, recipes, quizzes, sponsored posts, live blogs etc.

const JUNK_TITLE_RE    = /\b(crossword|wordsearch|word.?search|word.?game|sudoku)\b|\bpuzzle\b/i
const PODCAST_TITLE_RE = /\bpodcast\b|\blistens?\s*:|^listen\s*:|\b(ep|episode)\s*\.?\s*\d+\b|\baudio\s+(story|tour|guide)\b/i
const VIDEO_TITLE_RE   = /^(watch|video)\s*:/i  // catches "Watch:", "WATCH:", "Video:"
const LIFESTYLE_TITLE_RE = /\b(recipe|horoscope|star.?sign|your.?week|meal.?plan|fashion|style.?edit|quiz|crossword)\b/i
const PROMO_TITLE_RE   = /\b(sponsored|advertisement|advertorial|paid.?post|subscribe|sign.?up|newsletter|giveaway|competition|win a|enter now|terms and conditions)\b/i
// Live score/match update pages — "Bayern vs PSG LIVE:", "LIVE: match updates"
const LIVE_BLOG_RE     = /^LIVE\s*:/i|\bLIVE\b.{0,40}\b(score|updates?|stream|blog|latest)\b/i

const JUNK_URL_RE      = /\/(crossword|puzzle|games?|podcast|podcasts|audio|video|videos|sponsored|newsletter|quiz|quizzes|recipe|recipes|horoscope|horoscopes|terms|live-blog|liveblog)\b/i

// Titles over 200 chars are almost always live blog aggregates, not articles
const MAX_TITLE_LENGTH = 200

function isJunk(item) {
  const title = item.title || ''
  const url   = item.link  || item.guid || ''
  if (title.length > MAX_TITLE_LENGTH)   return true
  if (JUNK_TITLE_RE.test(title))         return true
  if (PODCAST_TITLE_RE.test(title))      return true
  if (VIDEO_TITLE_RE.test(title))        return true
  if (LIFESTYLE_TITLE_RE.test(title))    return true
  if (PROMO_TITLE_RE.test(title))        return true
  if (LIVE_BLOG_RE.test(title))          return true
  if (JUNK_URL_RE.test(url))             return true
  return false
}

async function ingestOutlet(supabase, outlet) {
  const feedUrl = RSS_FEEDS[outlet.name]
  if (!feedUrl) return { inserted: 0, skipped: 0, errors: 0 }

  let feed
  try {
    feed = await parser.parseURL(feedUrl)
  } catch {
    return { inserted: 0, skipped: 0, errors: 1 }
  }

  const items = feed.items.slice(0, 10)
  let inserted = 0, skipped = 0, errors = 0

  const urls = items.map(i => i.link || i.guid).filter(Boolean)
  const { data: existing } = await supabase
    .from('articles')
    .select('url')
    .in('url', urls)

  const existingUrls = new Set((existing || []).map(r => r.url))

  for (const item of items) {
    const url = item.link || item.guid
    if (!url || !item.title) continue
    if (isJunk(item))             { skipped++; continue }
    if (existingUrls.has(url))    { skipped++; continue }

    // Parse publish date — cap to now if future-dated (e.g. JP uses local time as UTC)
    const parsedPubDate = item.pubDate ? new Date(item.pubDate) : null
    const pubDate = (parsedPubDate && !isNaN(parsedPubDate) && parsedPubDate <= new Date())
      ? parsedPubDate.toISOString()
      : new Date().toISOString()

    const { error } = await supabase.from('articles').insert({
      outlet_id:    outlet.id,
      title:        item.title.trim(),
      url,
      summary:      extractSummary(item),
      published_at: pubDate,
      image_url:    extractImageUrl(item),
    })

    if (error) {
      if (error.code === '23505') { skipped++; continue }
      errors++
    } else {
      inserted++
    }
  }

  return { inserted, skipped, errors }
}

module.exports = async function handler(req, res) {
  // Verify this request came from Vercel's cron scheduler
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: outlets, error } = await supabase
    .from('outlets')
    .select('id, name')

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const results = {}
  let totalInserted = 0

  for (const outlet of outlets) {
    const { inserted, skipped, errors } = await ingestOutlet(supabase, outlet)
    results[outlet.name] = { inserted, skipped, errors }
    totalInserted += inserted
  }

  return res.status(200).json({ ok: true, totalInserted, results })
}

module.exports.config = { maxDuration: 300 }
