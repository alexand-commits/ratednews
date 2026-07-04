#!/usr/bin/env node
// Expand sports coverage: dedicated sports outlets + sport-section sub-feeds of
// existing outlets (as children). Every rss_url verified parsing before adding.
// Sports outlets use type='Sports' so ingest forces their articles to Sport.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Parent IDs for sport-section children (nested under their parent brand)
const PARENT = {
  guardian:    '00122d0c-3dfb-4cb1-b90f-6ce97cffc275', // The Guardian
  independent: '04d869b3-8094-4dfb-b6c0-2c23379866b8', // The Independent
  bbcSport:    'ebca42c8-18de-4987-b7a9-a9da96e2131e', // BBC Sport
  skySports:   '4cd5a6ba-fe98-4836-a8dc-071ff0e07e81', // Sky Sports
}

const OUTLETS = [
  // ── Dedicated standalone sports outlets ──
  { name: 'CBS Sports',        country: 'US',            type: 'Sports', rss_url: 'https://www.cbssports.com/rss/headlines/',
    description: 'US sports network covering the NFL, NBA, MLB, NHL, college sports and more.' },
  { name: 'Yahoo Sports',      country: 'US',            type: 'Sports', rss_url: 'https://sports.yahoo.com/rss/',
    description: 'Major US sports outlet with wide coverage across American and world sport.' },
  { name: 'SB Nation',         country: 'US',            type: 'Sports', rss_url: 'https://www.sbnation.com/rss/index.xml',
    description: 'Fan-focused US sports network covering teams across every major league.' },
  { name: 'The Sporting News', country: 'US',            type: 'Sports', rss_url: 'https://www.sportingnews.com/us/rss',
    description: 'One of the oldest US sports publications, covering major American and world sport.' },
  { name: 'Motorsport.com',    country: 'International',  type: 'Sports', rss_url: 'https://www.motorsport.com/rss/all/news/',
    description: 'Global motorsport coverage — Formula 1, MotoGP, IndyCar, WRC and more.' },
  { name: 'Autosport',         country: 'UK',            type: 'Sports', rss_url: 'https://www.autosport.com/rss/feed/all',
    description: 'Long-running motorsport publication with deep Formula 1 and racing coverage.' },
  { name: 'ESPN Cricinfo',     country: 'International',  type: 'Sports', rss_url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    description: "The world's leading cricket website — news, scores and analysis." },
  { name: 'Marca',             country: 'Europe',        type: 'Sports', rss_url: 'https://www.marca.com/en/rss/portada.xml',
    description: "Spain's best-selling sports daily (English edition), strong on football." },
  // ── Sport-section sub-feeds of existing outlets (children) ──
  { name: 'Guardian Sport',      country: 'UK', type: 'Sports', parent_outlet_id: PARENT.guardian,    rss_url: 'https://www.theguardian.com/uk/sport/rss',
    description: "The Guardian's sport desk." },
  { name: 'Independent Sport',   country: 'UK', type: 'Sports', parent_outlet_id: PARENT.independent, rss_url: 'https://www.independent.co.uk/sport/rss',
    description: "The Independent's sport section." },
  { name: 'BBC Sport Football',  country: 'UK', type: 'Sports', parent_outlet_id: PARENT.bbcSport,    rss_url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    description: "BBC Sport's football coverage." },
  { name: 'BBC Sport Cricket',   country: 'UK', type: 'Sports', parent_outlet_id: PARENT.bbcSport,    rss_url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
    description: "BBC Sport's cricket coverage." },
  { name: 'BBC Sport Formula 1', country: 'UK', type: 'Sports', parent_outlet_id: PARENT.bbcSport,    rss_url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',
    description: "BBC Sport's Formula 1 coverage." },
  { name: 'Sky Sports Football', country: 'UK', type: 'Sports', parent_outlet_id: PARENT.skySports,   rss_url: 'https://www.skysports.com/rss/11095',
    description: "Sky Sports' football coverage." },
]

// Existing sports outlets → mark type='Sports' so ingest forces Sport category.
const MARK_SPORTS = ['ESPN', 'Sports Illustrated', 'BBC Sport', 'Sky Sports']

const { data: existing } = await db.from('outlets').select('name')
const have = new Set(existing.map(o => o.name.toLowerCase()))

let added = 0, skipped = 0
for (const o of OUTLETS) {
  if (have.has(o.name.toLowerCase())) { console.log(`⏭  ${o.name} — exists`); skipped++; continue }
  const { error } = await db.from('outlets').insert(o)
  if (error) console.error(`❌ ${o.name} — ${error.message}`)
  else { console.log(`✅ ${o.name}${o.parent_outlet_id ? ' (child)' : ''}`); added++ }
}

for (const name of MARK_SPORTS) {
  const { error } = await db.from('outlets').update({ type: 'Sports' }).eq('name', name)
  console.log(error ? `❌ mark ${name}: ${error.message}` : `🏷  ${name} → type=Sports`)
}

console.log(`\nDone: ${added} added, ${skipped} skipped`)
const { count } = await db.from('outlets').select('*', { count: 'exact', head: true })
const { count: sportsCount } = await db.from('outlets').select('*', { count: 'exact', head: true }).eq('type', 'Sports')
console.log(`Total outlets: ${count} | sports outlets: ${sportsCount}`)
