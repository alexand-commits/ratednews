#!/usr/bin/env node
// Trending-velocity feed upgrade (24 Jul 2026).
// 1. Swap Google News proxies → verified native feeds where alive (direct
//    links + real photos; proxies carry neither).
// 2. Add `when:1d` freshness bias to high-velocity proxies that stay —
//    Google sorts by relevance, so unbounded queries mix in stale items.
// 3. Insert three verified new outlets.
// Every URL verified parsing with fresh items on 24 Jul 2026.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Proxy → native feed swaps (verified: 200, fresh items, images present)
const NATIVE_SWAPS = {
  'The Telegraph':    'https://www.telegraph.co.uk/rss.xml',
  'Washington Post':  'https://feeds.washingtonpost.com/rss/world',
  'Los Angeles Times':'https://www.latimes.com/world-nation/rss2.0.xml',
  'Politico':         'https://rss.politico.com/politics-news.xml',
  'Daily Express':    'https://www.express.co.uk/posts/rss/78/news',
  'National Post':    'https://nationalpost.com/feed',
  'The Hindu':        'https://www.thehindu.com/news/national/feeder/default.rss',
  'Hindustan Times':  'https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml',
}

// High-velocity outlets staying on Google proxies (no native feed exists):
// bias the query to the last 24h so the pool is all-fresh for the ranker.
const FRESHNESS_BIAS = [
  'Reuters', 'AP News', 'CNN', 'USA Today', 'Wall Street Journal',
  'GB News', 'HuffPost', 'The Times', 'Toronto Star', 'Haaretz',
]

const NEW_OUTLETS = [
  { name: 'CTV News',        country: 'Canada',        type: 'TV',      rss_url: 'https://www.ctvnews.ca/arc/outboundfeeds/rss/?outputType=xml', description: "Canada's largest private broadcaster's news division." },
  { name: 'The Daily Beast', country: 'US',            type: 'Digital', rss_url: 'https://www.thedailybeast.com/arc/outboundfeeds/rss/articles/?outputType=xml', description: 'US news and opinion site focused on politics and media.' },
  { name: 'Middle East Eye', country: 'International', type: 'Digital', rss_url: 'https://www.middleeasteye.net/rss', description: 'London-based outlet covering the Middle East and North Africa.' },
]

const { data: existing } = await db.from('outlets').select('id, name, rss_url')
const byName = new Map(existing.map(o => [o.name, o]))

for (const [name, url] of Object.entries(NATIVE_SWAPS)) {
  const o = byName.get(name)
  if (!o) { console.log(`SKIP swap (not found): ${name}`); continue }
  const { error } = await db.from('outlets').update({ rss_url: url }).eq('id', o.id)
  console.log(error ? `ERR  ${name}: ${error.message}` : `SWAP ${name} → native feed`)
}

for (const name of FRESHNESS_BIAS) {
  const o = byName.get(name)
  if (!o) { console.log(`SKIP bias (not found): ${name}`); continue }
  if (!o.rss_url.includes('news.google.com') || o.rss_url.includes('when:')) { console.log(`SKIP bias (n/a): ${name}`); continue }
  const url = o.rss_url.replace(/q=([^&]+)/, (m, q) => `q=${q}+when:1d`)
  const { error } = await db.from('outlets').update({ rss_url: url }).eq('id', o.id)
  console.log(error ? `ERR  ${name}: ${error.message}` : `BIAS ${name} → when:1d`)
}

for (const o of NEW_OUTLETS) {
  if (byName.has(o.name)) { console.log(`SKIP insert (exists): ${o.name}`); continue }
  const { error } = await db.from('outlets').insert(o)
  console.log(error ? `ERR  ${o.name}: ${error.message}` : `ADD  ${o.name}`)
}
console.log('done')
