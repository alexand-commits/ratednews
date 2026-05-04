#!/usr/bin/env node
/**
 * RatedNews RSS Ingestion Script
 * Usage: node scripts/ingest.mjs
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  console.error('Get your service role key from: Supabase Dashboard → Project Settings → API')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Map outlet names (must match exactly what's in your outlets table) to RSS feed URLs
const RSS_FEEDS = {
  // --- UK ---
  'BBC News':           'https://feeds.bbci.co.uk/news/rss.xml',
  'The Guardian':       'https://www.theguardian.com/world/rss',
  'The Telegraph':      'https://www.telegraph.co.uk/rss.xml',
  'The Independent':    'https://www.independent.co.uk/news/rss',
  'Sky News':           'https://feeds.skynews.com/feeds/rss/home.xml',
  'Daily Mail':         'https://www.dailymail.co.uk/articles.rss',
  'Financial Times':    'https://www.ft.com/rss/home/uk',
  'The Sun':            'https://www.thesun.co.uk/feed/',
  'Metro':              'https://metro.co.uk/news/feed/',
  'Evening Standard':   'https://www.standard.co.uk/rss',
  'The Spectator':      'https://www.spectator.co.uk/feed/',
  'New Statesman':      'https://www.newstatesman.com/feed',

  // --- US ---
  'Reuters':            'https://feeds.reuters.com/reuters/topNews',
  'AP News':            'https://rsshub.app/apnews/topics/ap-top-news',
  'New York Times':     'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'Washington Post':    'https://feeds.washingtonpost.com/rss/national',
  'Fox News':           'https://moxie.foxnews.com/google-publisher/latest.xml',
  'CNN':                'https://rss.cnn.com/rss/edition.rss',
  'NBC News':           'https://feeds.nbcnews.com/nbcnews/public/news',
  'NPR':                'https://feeds.npr.org/1001/rss.xml',
  'The Hill':           'https://thehill.com/feed/',
  'Politico':           'https://rss.politico.com/politics-news.xml',
  'Breitbart':          'https://feeds.feedburner.com/breitbart',
  'Vox':                'https://www.vox.com/rss/index.xml',
  'The Economist':      'https://www.economist.com/latest/rss.xml',
  'The Atlantic':       'https://www.theatlantic.com/feed/all/',
  'Newsweek':           'https://www.newsweek.com/rss',
  'HuffPost':           'https://www.huffpost.com/section/front-page/feed',
  'National Review':    'https://www.nationalreview.com/feed/',
  'Time':               'https://time.com/feed/',
  'USA Today':          'https://rssfeeds.usatoday.com/usatoday-NewsTopStories',
  'The Daily Beast':    'https://www.thedailybeast.com/cheat-sheet.rss',

  // --- International ---
  'Al Jazeera':               'https://www.aljazeera.com/xml/rss/all.xml',
  'Deutsche Welle':           'https://rss.dw.com/rdf/rss-en-all',
  'France 24':                'https://www.france24.com/en/rss',
  'ABC News Australia':       'https://www.abc.net.au/news/feed/45910/rss.xml',
  'CBC News':                 'https://www.cbc.ca/cmlink/rss-topstories',
  'South China Morning Post': 'https://www.scmp.com/rss/91/feed',
  'Times of India':           'https://timesofindia.indiatimes.com/rssfeeds/1221656.cms',
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
  // Try to pull first img src from content
  const html = item.contentEncoded || item.content || ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] || null
}

function extractSummary(item) {
  const raw = item.contentSnippet || item.summary || item.description || ''
  // Strip any leftover HTML tags and trim to 500 chars
  return raw.replace(/<[^>]*>/g, '').trim().slice(0, 500) || null
}

async function ingestOutlet(outlet) {
  const feedUrl = RSS_FEEDS[outlet.name.trim()]
  if (!feedUrl) {
    console.log(`  ⚠️  No RSS feed configured for "${outlet.name}" (hex: ${Buffer.from(outlet.name).toString('hex')}) — skipping`)
    return { inserted: 0, skipped: 0, errors: 0 }
  }

  let feed
  try {
    feed = await parser.parseURL(feedUrl)
  } catch (err) {
    console.error(`  ❌ Failed to fetch feed: ${err.message}`)
    return { inserted: 0, skipped: 0, errors: 1 }
  }

  const items = feed.items.slice(0, 25)
  let inserted = 0, skipped = 0, errors = 0

  // Batch-check existing URLs and titles for this outlet to avoid duplicates.
  // We check both because Google News redirect URLs can change between runs,
  // causing the same article to pass a URL-only check.
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
    if (existingUrls.has(url) || existingTitles.has(title)) { skipped++; continue }

    const { error } = await supabase.from('articles').insert({
      outlet_id: outlet.id,
      title,
      url,
      summary: extractSummary(item),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      image_url: extractImageUrl(item),
    })

    if (error) {
      // Unique constraint violation means it was inserted by a concurrent run — not a real error
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

  const { data: outlets, error } = await supabase.from('outlets').select('id, name')
  if (error) {
    console.error('Failed to fetch outlets:', error.message)
    process.exit(1)
  }

  console.log(`Found ${outlets.length} outlets\n`)

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
