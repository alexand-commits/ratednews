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
  const feedUrl = RSS_FEEDS[outlet.name]
  if (!feedUrl) {
    console.log(`  ⚠️  No RSS feed configured for "${outlet.name}" — skipping`)
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

  // Batch-check existing URLs to avoid N+1 queries
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
      outlet_id: outlet.id,
      title: item.title.trim(),
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

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
