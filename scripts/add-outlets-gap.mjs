#!/usr/bin/env node
// Gap-analysis expansion — English-language outlets across UK, US and Europe.
// Every rss_url verified parsing with fresh items; duplicates of existing
// outlets and non-news/satire sites excluded.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  // ── UK ──
  { name: 'The Register',       country: 'UK', type: 'Digital',   rss_url: 'https://www.theregister.com/headlines.atom', description: 'British technology news site with a sharp, sceptical take on the industry.' },
  { name: 'Computer Weekly',    country: 'UK', type: 'Digital',   rss_url: 'https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml', description: 'UK enterprise technology and IT news.' },
  { name: 'PinkNews',           country: 'UK', type: 'Digital',   rss_url: 'https://www.thepinknews.com/feed/', description: 'UK LGBTQ+ news and current affairs.' },
  { name: 'Morning Star',       country: 'UK', type: 'Newspaper', rss_url: 'https://morningstaronline.co.uk/rss.xml', description: 'British socialist daily newspaper.' },
  { name: 'The Canary',         country: 'UK', type: 'Digital',   rss_url: 'https://www.thecanary.co/feed/', description: 'Left-wing UK independent news site.' },
  { name: 'Nation Cymru',       country: 'UK', type: 'Digital',   rss_url: 'https://nation.cymru/feed/', description: 'Welsh national news in English.' },
  { name: 'Glasgow Evening Times', country: 'UK', type: 'Newspaper', rss_url: 'https://www.eveningtimes.co.uk/news/rss/', description: 'Glasgow city daily news.' },
  // ── Europe (English-language) ──
  { name: 'TheJournal.ie',      country: 'Europe', type: 'Digital',   rss_url: 'https://www.thejournal.ie/feed/', description: "One of Ireland's most-read digital news outlets." },
  { name: 'The Portugal News',  country: 'Europe', type: 'Newspaper', rss_url: 'https://www.theportugalnews.com/rss', description: "Portugal's largest English-language newspaper." },
  { name: 'Dutch News',         country: 'Europe', type: 'Digital',   rss_url: 'https://www.dutchnews.nl/feed/', description: 'English-language news from the Netherlands.' },
  { name: 'The Local France',   country: 'Europe', type: 'Digital',   rss_url: 'https://www.thelocal.fr/feeds/rss.php', description: 'English-language news from France.' },
  { name: 'The Local Germany',  country: 'Europe', type: 'Digital',   rss_url: 'https://www.thelocal.de/feeds/rss.php', description: 'English-language news from Germany.' },
  { name: 'The Local Italy',    country: 'Europe', type: 'Digital',   rss_url: 'https://www.thelocal.it/feeds/rss.php', description: 'English-language news from Italy.' },
  { name: 'Emerging Europe',    country: 'Europe', type: 'Digital',   rss_url: 'https://emerging-europe.com/feed/', description: 'News and analysis on Central and Eastern Europe.' },
  // ── US ──
  { name: 'Semafor',            country: 'US', type: 'Digital',   rss_url: 'https://www.semafor.com/rss.xml', description: 'Global news outlet founded by former BuzzFeed and NYT editors.' },
  { name: 'The Bulwark',        country: 'US', type: 'Digital',   rss_url: 'https://www.thebulwark.com/feed', description: 'Centre-right, anti-Trump US politics and commentary.' },
  { name: 'The Dispatch',       country: 'US', type: 'Digital',   rss_url: 'https://thedispatch.com/feed/', description: 'US conservative news and analysis.' },
  { name: 'The Free Press',     country: 'US', type: 'Digital',   rss_url: 'https://www.thefp.com/feed', description: "Bari Weiss's independent US news and opinion outlet." },
  { name: 'The 19th',           country: 'US', type: 'Digital',   rss_url: 'https://19thnews.org/feed/', description: 'US nonprofit newsroom on gender, politics and policy.' },
  { name: 'The Texas Tribune',  country: 'US', type: 'Digital',   rss_url: 'https://www.texastribune.org/feeds/main/', description: 'Nonprofit Texas politics and public-policy newsroom.' },
  { name: 'The Markup',         country: 'US', type: 'Digital',   rss_url: 'https://themarkup.org/feeds/rss.xml', description: 'US nonprofit investigating technology and its effect on society.' },
  { name: 'STAT News',          country: 'US', type: 'Digital',   rss_url: 'https://www.statnews.com/feed/', description: 'US health, medicine and life-sciences news.' },
  { name: 'Grist',              country: 'US', type: 'Digital',   rss_url: 'https://grist.org/feed/', description: 'US climate and environmental justice newsroom.' },
  { name: 'Military Times',     country: 'US', type: 'Digital',   rss_url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml', description: 'US military and defense news.' },
  { name: 'The Oregonian',      country: 'US', type: 'Newspaper', rss_url: 'https://www.oregonlive.com/arc/outboundfeeds/rss/', description: 'Portland, Oregon daily newspaper.' },
  { name: 'Minnesota Star Tribune', country: 'US', type: 'Newspaper', rss_url: 'https://www.startribune.com/rss/', description: 'Minneapolis daily newspaper.' },
]

// Own-domain map for the icon lookup (added to OutletLogo separately)
const { data: existing } = await db.from('outlets').select('name')
const have = new Set(existing.map(o => o.name.toLowerCase()))
let added = 0, skipped = 0
for (const o of OUTLETS) {
  if (have.has(o.name.toLowerCase())) { console.log(`⏭  ${o.name} — exists`); skipped++; continue }
  const { error } = await db.from('outlets').insert(o)
  if (error) console.error(`❌ ${o.name} — ${error.message}`)
  else { console.log(`✅ [${o.country}] ${o.name}`); added++ }
}
console.log(`\nDone: ${added} added, ${skipped} skipped`)
const { count } = await db.from('outlets').select('*', { count: 'exact', head: true }).is('parent_outlet_id', null)
console.log(`Top-level outlets now: ${count}`)
