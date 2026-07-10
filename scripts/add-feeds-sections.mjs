#!/usr/bin/env node
// Section-feed expansion — per-section RSS from the majors, plus AP News,
// Le Monde English and El País English. Every rss_url verified parsing with
// 2+ fresh items on 2026-07-06. Feeds land as plain top-level outlets (the
// hierarchy was flattened); global URL dedupe at ingest prevents cross-section
// duplicates from the same publisher.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  { name: 'BBC World', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/world/rss.xml', description: 'World coverage from BBC.' },
  { name: 'BBC Politics', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', description: 'Politics coverage from BBC.' },
  { name: 'BBC Business', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/business/rss.xml', description: 'Business coverage from BBC.' },
  { name: 'BBC Technology', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', description: 'Technology coverage from BBC.' },
  { name: 'BBC Science', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', description: 'Science coverage from BBC.' },
  { name: 'BBC Health', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/health/rss.xml', description: 'Health coverage from BBC.' },
  { name: 'BBC Entertainment', country: 'UK', type: 'Public Broadcaster', rss_url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', description: 'Entertainment coverage from BBC.' },
  { name: 'Guardian World', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/world/rss', description: 'World coverage from Guardian.' },
  { name: 'Guardian Politics', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/politics/rss', description: 'Politics coverage from Guardian.' },
  { name: 'Guardian Business', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/business/rss', description: 'Business coverage from Guardian.' },
  { name: 'Guardian Tech', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/technology/rss', description: 'Tech coverage from Guardian.' },
  { name: 'Guardian Environment', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/environment/rss', description: 'Environment coverage from Guardian.' },
  { name: 'Guardian Science', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/science/rss', description: 'Science coverage from Guardian.' },
  { name: 'Guardian Culture', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/culture/rss', description: 'Culture coverage from Guardian.' },
  { name: 'Guardian US', country: 'UK', type: 'Newspaper', rss_url: 'https://www.theguardian.com/us-news/rss', description: 'US coverage from Guardian.' },
  { name: 'NYT World', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', description: 'World coverage from The New York Times.' },
  { name: 'NYT Politics', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', description: 'Politics coverage from The New York Times.' },
  { name: 'NYT Business', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', description: 'Business coverage from The New York Times.' },
  { name: 'NYT Technology', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', description: 'Technology coverage from The New York Times.' },
  { name: 'NYT Science', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', description: 'Science coverage from The New York Times.' },
  { name: 'NYT Health', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', description: 'Health coverage from The New York Times.' },
  { name: 'NYT Arts', country: 'US', type: 'Newspaper', rss_url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', description: 'Arts coverage from The New York Times.' },
  { name: 'Sky News World', country: 'UK', type: 'Broadcaster', rss_url: 'https://feeds.skynews.com/feeds/rss/world.xml', description: 'World coverage from Sky News.' },
  { name: 'Sky News Business', country: 'UK', type: 'Broadcaster', rss_url: 'https://feeds.skynews.com/feeds/rss/business.xml', description: 'Business coverage from Sky News.' },
  { name: 'Sky News Politics', country: 'UK', type: 'Broadcaster', rss_url: 'https://feeds.skynews.com/feeds/rss/politics.xml', description: 'Politics coverage from Sky News.' },
  { name: 'Sky News Tech', country: 'UK', type: 'Broadcaster', rss_url: 'https://feeds.skynews.com/feeds/rss/technology.xml', description: 'Tech coverage from Sky News.' },
  { name: 'Independent World', country: 'UK', type: 'Newspaper', rss_url: 'https://www.independent.co.uk/news/world/rss', description: 'World coverage from Independent.' },
  { name: 'Independent Business', country: 'UK', type: 'Newspaper', rss_url: 'https://www.independent.co.uk/news/business/rss', description: 'Business coverage from Independent.' },
  { name: 'Independent Tech', country: 'UK', type: 'Newspaper', rss_url: 'https://www.independent.co.uk/tech/rss', description: 'Tech coverage from Independent.' },
  { name: 'NPR World', country: 'US', type: 'Public Broadcaster', rss_url: 'https://feeds.npr.org/1004/rss.xml', description: 'World coverage from NPR.' },
  { name: 'NPR Politics', country: 'US', type: 'Public Broadcaster', rss_url: 'https://feeds.npr.org/1014/rss.xml', description: 'Politics coverage from NPR.' },
  { name: 'Fox News World', country: 'US', type: 'Broadcaster', rss_url: 'https://moxie.foxnews.com/google-publisher/world.xml', description: 'World coverage from Fox News.' },
  { name: 'Fox News Politics', country: 'US', type: 'Broadcaster', rss_url: 'https://moxie.foxnews.com/google-publisher/politics.xml', description: 'Politics coverage from Fox News.' },
  { name: 'AP News', country: 'US', type: 'News Agency', rss_url: 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en', description: 'The Associated Press — nonprofit US news agency and wire service.' },
  { name: 'Le Monde English', country: 'Europe', type: 'Newspaper', rss_url: 'https://www.lemonde.fr/en/rss/une.xml', description: "English edition of France's newspaper of record." },
  { name: 'El País English', country: 'Europe', type: 'Newspaper', rss_url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada', description: "English edition of Spain's leading daily." },
]

const { data: existing } = await db.from('outlets').select('name')
const have = new Set(existing.map(o => o.name.toLowerCase()))
let added = 0
for (const o of OUTLETS) {
  if (have.has(o.name.toLowerCase())) { console.log(`⏭  ${o.name} — exists`); continue }
  const { error } = await db.from('outlets').insert(o)
  if (error) console.error(`❌ ${o.name} — ${error.message}`)
  else { console.log(`✅ [${o.country}] ${o.name}`); added++ }
}
console.log(`\nDone: ${added} added`)
const { count } = await db.from('outlets').select('*', { count: 'exact', head: true })
console.log(`Outlets now: ${count}`)
