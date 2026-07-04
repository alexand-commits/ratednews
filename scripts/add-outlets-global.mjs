#!/usr/bin/env node
// One-off: add 42 verified global outlets (July 2026 expansion).
// Every rss_url below was verified to parse with recent items before inclusion.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  // ── Asia-Pacific ──
  { name: 'The Korea Herald', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://www.koreaherald.com/rss/newsAll',
    description: "South Korea's largest English-language daily, covering Korean politics, business, and culture." },
  { name: 'Bangkok Post', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://www.bangkokpost.com/rss/data/topstories.xml',
    description: "Thailand's leading English-language newspaper, covering Thai and Southeast Asian news since 1946." },
  { name: 'Philippine Daily Inquirer', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://newsinfo.inquirer.net/feed',
    description: "One of the Philippines' most widely read broadsheets, known for investigative political coverage." },
  { name: 'Rappler', country: 'AsiaPac', type: 'Digital', rss_url: 'https://www.rappler.com/feed/',
    description: 'Philippine digital news outlet co-founded by Nobel laureate Maria Ressa, focused on accountability journalism.' },
  { name: 'VnExpress International', country: 'AsiaPac', type: 'Digital', rss_url: 'https://e.vnexpress.net/rss/news.rss',
    description: "English edition of Vietnam's most-read online newspaper." },
  { name: 'RNZ', country: 'AsiaPac', type: 'Public broadcaster', rss_url: 'https://www.rnz.co.nz/rss/national.xml',
    description: "New Zealand's public broadcaster, providing independent news across the country and Pacific region." },
  { name: 'NZ Herald', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/curated/78/?outputType=xml',
    description: "New Zealand's largest daily newspaper, based in Auckland." },
  { name: 'Stuff', country: 'AsiaPac', type: 'Digital', rss_url: 'https://www.stuff.co.nz/rss',
    description: "New Zealand's most-visited news website, covering national and regional news." },
  { name: 'Times of India', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    description: "The world's largest-selling English-language daily, covering Indian politics, business, and society." },
  { name: 'NDTV', country: 'AsiaPac', type: 'TV/Cable', rss_url: 'https://feeds.feedburner.com/ndtvnews-top-stories',
    description: 'Major Indian broadcaster covering national news, politics, and current affairs.' },
  { name: 'The Daily Star', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://www.thedailystar.net/top-news/rss.xml',
    description: "Bangladesh's largest-circulating English-language daily newspaper." },
  { name: 'Taipei Times', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://www.taipeitimes.com/xml/index.rss',
    description: "Taiwan's English-language daily, covering cross-strait relations and Taiwanese politics." },
  { name: 'Malay Mail', country: 'AsiaPac', type: 'Digital', rss_url: 'https://www.malaymail.com/feed/rss/malaysia',
    description: 'Malaysian online news outlet covering national politics and current affairs.' },
  { name: 'The Age', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://www.theage.com.au/rss/feed.xml',
    description: 'Melbourne-based daily covering Australian politics, business, and culture since 1854.' },
  { name: 'The Mainichi', country: 'AsiaPac', type: 'Newspaper', rss_url: 'https://mainichi.jp/english/rss/etc/english_latest.rss',
    description: "English edition of one of Japan's oldest and largest national newspapers." },
  // ── Europe ──
  { name: 'ANSA English', country: 'Europe', type: 'Wire', rss_url: 'https://www.ansa.it/english/english_rss.xml',
    description: "Italy's leading wire service, covering Italian and European news in English." },
  { name: 'Politico Europe', country: 'Europe', type: 'Digital', rss_url: 'https://www.politico.eu/feed/',
    description: 'Brussels-based outlet covering EU politics, policy, and the institutions shaping Europe.' },
  { name: 'Daily Sabah', country: 'Europe', type: 'Newspaper', rss_url: 'https://www.dailysabah.com/rssFeed/10',
    description: 'Turkish English-language daily covering Turkey and the surrounding region, generally pro-government in outlook.' },
  { name: 'NL Times', country: 'Europe', type: 'Digital', rss_url: 'https://nltimes.nl/rss',
    description: 'English-language news covering the Netherlands.' },
  { name: 'Notes from Poland', country: 'Europe', type: 'Digital', rss_url: 'https://notesfrompoland.com/feed/',
    description: 'Independent English-language outlet covering Polish politics and society.' },
  { name: 'Balkan Insight', country: 'Europe', type: 'Digital', rss_url: 'https://balkaninsight.com/feed/',
    description: 'Investigative reporting network covering Southeast Europe and the Balkans.' },
  { name: 'Meduza', country: 'Europe', type: 'Digital', rss_url: 'https://meduza.io/rss/en/all',
    description: 'Independent Russian outlet operating in exile from Latvia, covering Russia in English.' },
  { name: 'Kyiv Post', country: 'Europe', type: 'Digital', rss_url: 'https://www.kyivpost.com/feed',
    description: "Ukraine's oldest English-language newspaper, covering the war and Ukrainian politics." },
  { name: 'Irish Independent', country: 'Europe', type: 'Newspaper', rss_url: 'https://www.independent.ie/rss/',
    description: "Ireland's largest-selling daily newspaper." },
  // ── Middle East ──
  { name: 'The Times of Israel', country: 'MiddleEast', type: 'Digital', rss_url: 'https://www.timesofisrael.com/feed/',
    description: 'Jerusalem-based outlet covering Israel, the region, and the Jewish world.' },
  { name: 'Al Arabiya English', country: 'MiddleEast', type: 'TV/Cable', rss_url: 'https://english.alarabiya.net/feed/rss2/en.xml',
    description: 'Saudi-owned pan-Arab broadcaster offering a Gulf perspective on regional and world news.' },
  { name: 'The New Arab', country: 'MiddleEast', type: 'Digital', rss_url: 'https://www.newarab.com/rss',
    description: 'London-based outlet covering the Middle East and North Africa.' },
  { name: 'Egypt Independent', country: 'MiddleEast', type: 'Digital', rss_url: 'https://www.egyptindependent.com/feed/',
    description: 'English-language Egyptian news outlet, sister publication of Al-Masry Al-Youm.' },
  { name: 'Daily News Egypt', country: 'MiddleEast', type: 'Newspaper', rss_url: 'https://dailynewsegypt.com/feed/',
    description: "Egypt's independent English-language daily covering politics and business." },
  // ── Africa ──
  { name: 'The Standard', country: 'Africa', type: 'Newspaper', rss_url: 'https://www.standardmedia.co.ke/rss/headlines.php',
    description: "One of Kenya's oldest newspapers, covering Kenyan politics and East African affairs." },
  { name: 'Punch', country: 'Africa', type: 'Newspaper', rss_url: 'https://punchng.com/feed/',
    description: "Nigeria's most widely read newspaper, covering national politics and society." },
  { name: 'Vanguard', country: 'Africa', type: 'Newspaper', rss_url: 'https://www.vanguardngr.com/feed/',
    description: 'Major Nigerian daily covering politics, business, and current affairs.' },
  { name: 'MyJoyOnline', country: 'Africa', type: 'Digital', rss_url: 'https://www.myjoyonline.com/feed/',
    description: "Ghana's leading online news platform, run by the Multimedia Group." },
  { name: 'The Herald Zimbabwe', country: 'Africa', type: 'Newspaper', rss_url: 'https://www.herald.co.zw/feed/',
    description: "Zimbabwe's largest state-owned daily newspaper." },
  // ── Americas ──
  { name: 'Global News', country: 'Americas', type: 'TV/Cable', rss_url: 'https://globalnews.ca/feed/',
    description: 'Canadian broadcaster covering national and international news.' },
  { name: 'Mexico News Daily', country: 'Americas', type: 'Digital', rss_url: 'https://mexiconewsdaily.com/feed/',
    description: 'English-language coverage of Mexican politics, economy, and society.' },
  { name: 'Agencia Brasil', country: 'Americas', type: 'Wire', rss_url: 'https://agenciabrasil.ebc.com.br/en/rss/ultimasnoticias/feed.xml',
    description: "Brazil's public news agency, covering Brazilian government and current affairs in English." },
  { name: 'The Rio Times', country: 'Americas', type: 'Digital', rss_url: 'https://www.riotimesonline.com/feed/',
    description: 'English-language news covering Brazil and Latin America.' },
  { name: 'Colombia Reports', country: 'Americas', type: 'Digital', rss_url: 'https://colombiareports.com/feed/',
    description: "Independent English-language coverage of Colombian news and politics." },
  { name: 'Jamaica Gleaner', country: 'Americas', type: 'Newspaper', rss_url: 'http://jamaica-gleaner.com/feed/rss.xml',
    description: "Jamaica's oldest newspaper, publishing since 1834, covering the Caribbean." },
  // ── International ──
  { name: 'UN News', country: 'International', type: 'Public broadcaster', rss_url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    description: 'Official news service of the United Nations, covering global development, peace, and humanitarian affairs.' },
  { name: 'Global Voices', country: 'International', type: 'Digital', rss_url: 'https://globalvoices.org/feed/',
    description: 'International community of writers translating and reporting underrepresented stories worldwide.' },
]

const { data: existing } = await db.from('outlets').select('name')
const existingNames = new Set(existing.map(o => o.name.toLowerCase()))

let added = 0, skipped = 0
for (const o of OUTLETS) {
  if (existingNames.has(o.name.toLowerCase())) {
    console.log(`⏭  ${o.name} — already exists`)
    skipped++
    continue
  }
  const { error } = await db.from('outlets').insert(o)
  if (error) console.error(`❌ ${o.name} — ${error.message}`)
  else { console.log(`✅ ${o.name} [${o.country}]`); added++ }
}
console.log(`\nDone: ${added} added, ${skipped} skipped`)
const { count } = await db.from('outlets').select('*', { count: 'exact', head: true }).is('parent_outlet_id', null)
console.log(`Top-level outlets now: ${count}`)
