/**
 * Vercel Cron Job — RSS Ingestion
 * Runs on schedule defined in vercel.json
 * Called by Vercel with Authorization: Bearer <CRON_SECRET>
 */

const { createClient } = require('@supabase/supabase-js')
const Parser = require('rss-parser')

const RSS_FEEDS = {
  'BBC':              'https://feeds.bbci.co.uk/news/rss.xml',
  'BBC News':         'https://feeds.bbci.co.uk/news/rss.xml',
  'Reuters':          'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en',
  'The Guardian':     'https://www.theguardian.com/world/rss',
  'AP News':          'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en',
  'AP New':           'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en',
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

async function ingestOutlet(supabase, outlet) {
  const feedUrl = RSS_FEEDS[outlet.name]
  if (!feedUrl) return { inserted: 0, skipped: 0, errors: 0 }

  let feed
  try {
    feed = await parser.parseURL(feedUrl)
  } catch {
    return { inserted: 0, skipped: 0, errors: 1 }
  }

  const items = feed.items.slice(0, 25)
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
    if (existingUrls.has(url)) { skipped++; continue }

    const { error } = await supabase.from('articles').insert({
      outlet_id:    outlet.id,
      title:        item.title.trim(),
      url,
      summary:      extractSummary(item),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
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
