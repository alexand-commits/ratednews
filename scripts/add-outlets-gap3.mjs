#!/usr/bin/env node
// Gap round 3 (28 Jul 2026) — every feed verified live with fresh items.
// ITV News/Forbes/talkSPORT run through Google proxies (no usable native
// feed); The Athletic's native feed works and ships direct links.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  { name: 'ITV News',            country: 'UK', type: 'TV',       rss_url: 'https://news.google.com/rss/search?q=site:itv.com/news+when:1d&hl=en-GB&gl=GB&ceid=GB:en', description: 'UK commercial broadcaster news.' },
  { name: 'Forbes',              country: 'US', type: 'Magazine', rss_url: 'https://news.google.com/rss/search?q=site:forbes.com+when:1d&hl=en-US&gl=US&ceid=US:en', description: 'US business, finance and entrepreneurship coverage.' },
  { name: 'The Athletic',        country: 'US', type: 'Digital',  rss_url: 'https://theathletic.com/rss/news/', description: 'Subscription sports journalism, owned by the New York Times.' },
  { name: 'talkSPORT',           country: 'UK', type: 'Radio',    rss_url: 'https://news.google.com/rss/search?q=site:talksport.com+when:1d&hl=en-GB&gl=GB&ceid=GB:en', description: 'UK sports radio station and breaking sports news.' },
  { name: 'Billboard',           country: 'US', type: 'Magazine', rss_url: 'https://www.billboard.com/feed/', description: 'Music industry news and charts.' },
  { name: 'Scientific American', country: 'US', type: 'Magazine', rss_url: 'https://www.scientificamerican.com/platform/syndication/rss/', description: 'Long-running US popular science magazine.' },
]
const { data: existing } = await db.from('outlets').select('name')
const names = new Set(existing.map(o => o.name))
for (const o of OUTLETS) {
  if (names.has(o.name)) { console.log(`SKIP ${o.name}`); continue }
  const { error } = await db.from('outlets').insert(o)
  console.log(error ? `ERR  ${o.name}: ${error.message}` : `ADD  ${o.name}`)
}
console.log('done')
