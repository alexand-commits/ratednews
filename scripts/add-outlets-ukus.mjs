#!/usr/bin/env node
// UK + US density push — 47 verified outlets to deepen clustering and coverage.
// Every rss_url was confirmed parsing with fresh items before inclusion.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  // ── UK nationals ──
  { name: 'The Scotsman',       country: 'UK', type: 'Newspaper', rss_url: 'https://www.scotsman.com/news/rss', description: "Scotland's national newspaper, covering Scottish and UK news." },
  { name: 'The Herald',         country: 'UK', type: 'Newspaper', rss_url: 'https://www.heraldscotland.com/news/rss/', description: "Glasgow-based Scottish national daily, one of the world's oldest newspapers." },
  { name: 'The National',       country: 'UK', type: 'Newspaper', rss_url: 'https://www.thenational.scot/news/rss/', description: 'Scottish pro-independence daily newspaper.' },
  { name: 'Daily Record',       country: 'UK', type: 'Newspaper', rss_url: 'https://www.dailyrecord.co.uk/?service=rss', description: "Scotland's biggest-selling tabloid newspaper." },
  { name: 'Daily Star',         country: 'UK', type: 'Newspaper', rss_url: 'https://www.dailystar.co.uk/?service=rss', description: 'UK tabloid covering news, showbiz and sport.' },
  { name: 'Belfast Telegraph',  country: 'UK', type: 'Newspaper', rss_url: 'https://www.belfasttelegraph.co.uk/rss/', description: "Northern Ireland's biggest-selling daily newspaper." },
  { name: 'City AM',            country: 'UK', type: 'Business',  rss_url: 'https://www.cityam.com/feed/', description: "London's business and financial free daily." },
  { name: 'This is Money',      country: 'UK', type: 'Business',  rss_url: 'https://www.thisismoney.co.uk/money/index.rss', description: 'UK personal finance and money news (Daily Mail group).' },
  // ── UK digital / political ──
  { name: 'UnHerd',             country: 'UK', type: 'Digital',  rss_url: 'https://unherd.com/feed/', description: 'UK current-affairs site publishing heterodox commentary and analysis.' },
  { name: 'The Critic',         country: 'UK', type: 'Magazine', rss_url: 'https://thecritic.co.uk/feed/', description: 'British monthly political and cultural magazine.' },
  { name: 'Byline Times',       country: 'UK', type: 'Digital',  rss_url: 'https://bylinetimes.com/feed/', description: 'Independent UK investigative journalism outlet.' },
  { name: 'ConservativeHome',   country: 'UK', type: 'Digital',  rss_url: 'https://conservativehome.com/feed/', description: 'Grassroots website for the UK Conservative Party.' },
  { name: 'LabourList',         country: 'UK', type: 'Digital',  rss_url: 'https://labourlist.org/feed/', description: "Independent news site for the UK Labour movement." },
  { name: 'Novara Media',       country: 'UK', type: 'Digital',  rss_url: 'https://novaramedia.com/feed/', description: 'Left-wing UK independent media organisation.' },
  { name: 'indy100',            country: 'UK', type: 'Digital',  rss_url: 'https://www.indy100.com/rss', description: "The Independent's viral news and trends offshoot." },
  // ── UK regional (Reach plc) ──
  { name: 'Manchester Evening News', country: 'UK', type: 'Newspaper', rss_url: 'https://www.manchestereveningnews.co.uk/?service=rss', description: 'Greater Manchester news, one of the UK\'s largest regional titles.' },
  { name: 'Liverpool Echo',     country: 'UK', type: 'Newspaper', rss_url: 'https://www.liverpoolecho.co.uk/?service=rss', description: 'Merseyside daily news.' },
  { name: 'Birmingham Live',    country: 'UK', type: 'Newspaper', rss_url: 'https://www.birminghammail.co.uk/?service=rss', description: 'Birmingham and West Midlands news.' },
  { name: 'Chronicle Live',     country: 'UK', type: 'Newspaper', rss_url: 'https://www.chroniclelive.co.uk/?service=rss', description: 'North East England news (Newcastle Chronicle).' },
  { name: 'Yorkshire Post',     country: 'UK', type: 'Newspaper', rss_url: 'https://www.yorkshirepost.co.uk/news/rss', description: "Yorkshire's national newspaper." },
  { name: 'Wales Online',       country: 'UK', type: 'Digital',   rss_url: 'https://www.walesonline.co.uk/?service=rss', description: 'Wales news, from Media Wales.' },
  // ── US nationals / digital ──
  { name: 'PBS NewsHour',       country: 'US', type: 'Public broadcaster', rss_url: 'https://www.pbs.org/newshour/feeds/rss/headlines', description: 'US public television nightly news programme.' },
  { name: 'The New Republic',   country: 'US', type: 'Magazine',  rss_url: 'https://newrepublic.com/rss.xml', description: 'US magazine of politics and culture, left-liberal perspective.' },
  { name: 'Jacobin',            country: 'US', type: 'Magazine',  rss_url: 'https://jacobin.com/feed/', description: 'US socialist quarterly and website.' },
  { name: 'Salon',              country: 'US', type: 'Digital',   rss_url: 'https://www.salon.com/feed/', description: 'US progressive news and opinion site.' },
  { name: 'Vanity Fair',        country: 'US', type: 'Magazine',  rss_url: 'https://www.vanityfair.com/feed/rss', description: 'US culture, politics and style magazine.' },
  { name: 'Rolling Stone',      country: 'US', type: 'Magazine',  rss_url: 'https://www.rollingstone.com/feed/', description: 'US music, culture and politics magazine.' },
  { name: 'Reason',             country: 'US', type: 'Magazine',  rss_url: 'https://reason.com/feed/', description: 'US libertarian magazine covering politics and culture.' },
  { name: 'The American Conservative', country: 'US', type: 'Magazine', rss_url: 'https://www.theamericanconservative.com/feed/', description: 'US paleoconservative magazine.' },
  { name: 'The Washington Times', country: 'US', type: 'Newspaper', rss_url: 'https://www.washingtontimes.com/rss/headlines/news/', description: 'Conservative Washington DC daily newspaper.' },
  { name: 'The Daily Caller',   country: 'US', type: 'Digital',   rss_url: 'https://dailycaller.com/feed/', description: 'US conservative news and opinion website.' },
  { name: 'RealClearPolitics',  country: 'US', type: 'Digital',   rss_url: 'https://www.realclearpolitics.com/index.xml', description: 'US political news and polling aggregator.' },
  { name: 'Fortune',            country: 'US', type: 'Business',  rss_url: 'https://fortune.com/feed/', description: 'US global business magazine.' },
  { name: 'Fast Company',       country: 'US', type: 'Business',  rss_url: 'https://www.fastcompany.com/latest/rss', description: 'US business media on tech, design and innovation.' },
  { name: 'Quartz',             country: 'US', type: 'Business',  rss_url: 'https://qz.com/rss', description: 'US digital business news outlet.' },
  { name: 'Vice',               country: 'US', type: 'Digital',   rss_url: 'https://www.vice.com/en/rss', description: 'US youth-focused digital media and news.' },
  // ── US tech ──
  { name: 'Engadget',           country: 'US', type: 'Digital',   rss_url: 'https://www.engadget.com/rss.xml', description: 'Consumer technology and gadgets news.' },
  { name: 'Gizmodo',            country: 'US', type: 'Digital',   rss_url: 'https://gizmodo.com/rss', description: 'Technology, science and pop-culture news.' },
  { name: 'Mashable',           country: 'US', type: 'Digital',   rss_url: 'https://mashable.com/feeds/rss/all', description: 'Tech, digital culture and entertainment news.' },
  { name: 'CNET',               country: 'US', type: 'Digital',   rss_url: 'https://www.cnet.com/rss/news/', description: 'Consumer technology reviews and news.' },
  { name: '9to5Mac',            country: 'US', type: 'Digital',   rss_url: 'https://9to5mac.com/feed/', description: 'Apple news and rumours.' },
  // ── US entertainment ──
  { name: 'Variety',            country: 'US', type: 'Digital',   rss_url: 'https://variety.com/feed/', description: 'US entertainment industry news.' },
  { name: 'The Hollywood Reporter', country: 'US', type: 'Digital', rss_url: 'https://www.hollywoodreporter.com/feed/', description: 'US entertainment and film industry news.' },
  { name: 'Deadline',           country: 'US', type: 'Digital',   rss_url: 'https://deadline.com/feed/', description: 'Hollywood and entertainment breaking news.' },
  // ── US regional ──
  { name: 'The Seattle Times',  country: 'US', type: 'Newspaper', rss_url: 'https://www.seattletimes.com/feed/', description: 'Pacific Northwest daily newspaper.' },
  { name: 'Chicago Sun-Times',  country: 'US', type: 'Newspaper', rss_url: 'https://chicago.suntimes.com/rss/index.xml', description: 'Chicago metropolitan daily newspaper.' },
  { name: 'Las Vegas Review-Journal', country: 'US', type: 'Newspaper', rss_url: 'https://www.reviewjournal.com/feed/', description: 'Nevada\'s largest daily newspaper.' },
]

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
const { count: uk } = await db.from('outlets').select('*', { count: 'exact', head: true }).eq('country', 'UK')
const { count: us } = await db.from('outlets').select('*', { count: 'exact', head: true }).eq('country', 'US')
console.log(`Top-level outlets: ${count} | UK: ${uk} | US: ${us}`)
