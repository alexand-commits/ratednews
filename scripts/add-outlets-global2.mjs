#!/usr/bin/env node
// Global coverage expansion, round 2 — fills the thinnest regions (Middle East,
// Africa, Americas, Europe policy/expat, Asia-Pacific analysis). Every rss_url
// verified parsing with fresh items on 2026-07-05.
// Also repairs two outlets whose feeds died: VOA and Mail & Guardian get
// Google News site-search proxies (reliable again now ingest date-sorts items).
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  // ── Middle East ──
  { name: 'Al-Monitor',      country: 'MiddleEast', type: 'Digital', rss_url: 'https://www.al-monitor.com/rss.xml', description: 'Independent coverage and analysis of the Middle East.' },
  // ── Africa ──
  { name: 'AllAfrica',       country: 'Africa',     type: 'Digital', rss_url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', description: 'Aggregated reporting from 100+ African news organisations.' },
  // ── Asia-Pacific ──
  { name: 'The Diplomat',    country: 'AsiaPac',    type: 'Digital', rss_url: 'https://thediplomat.com/feed/', description: 'Current affairs and geopolitics of the Asia-Pacific.' },
  // ── Americas ──
  { name: 'Havana Times',    country: 'Americas',   type: 'Digital', rss_url: 'https://havanatimes.org/feed/', description: 'Independent English-language news from Cuba and Latin America.' },
  // ── Europe ──
  { name: 'Euractiv',        country: 'Europe',     type: 'Digital', rss_url: 'https://www.euractiv.com/feed/', description: 'EU policy news and analysis from Brussels.' },
  { name: 'The Local Spain', country: 'Europe',     type: 'Digital', rss_url: 'https://feeds.thelocal.com/rss/es', description: 'English-language news from Spain.' },
  { name: 'Swissinfo',       country: 'Europe',     type: 'Digital', rss_url: 'https://www.swissinfo.ch/service/eng/rssxml/top-news/rss', description: 'Swiss news in English from the national broadcaster.' },
  { name: 'Romania Insider', country: 'Europe',     type: 'Digital', rss_url: 'https://www.romania-insider.com/feed', description: 'English-language news from Romania.' },
]

// Feed repairs — outlets whose own RSS died; Google News site-search proxies
const REPAIRS = [
  { name: 'Voice of America', rss_url: 'https://news.google.com/rss/search?q=site:voanews.com&hl=en-US&gl=US&ceid=US:en' },
  { name: 'Mail & Guardian',  rss_url: 'https://news.google.com/rss/search?q=site:mg.co.za&hl=en-US&gl=US&ceid=US:en' },
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

for (const r of REPAIRS) {
  const { error } = await db.from('outlets').update({ rss_url: r.rss_url }).eq('name', r.name)
  console.log(error ? `❌ repair ${r.name} — ${error.message}` : `🔧 repaired feed: ${r.name}`)
}

console.log(`\nDone: ${added} added, ${REPAIRS.length} repaired`)
const { count } = await db.from('outlets').select('*', { count: 'exact', head: true }).is('parent_outlet_id', null)
console.log(`Top-level outlets now: ${count}`)
