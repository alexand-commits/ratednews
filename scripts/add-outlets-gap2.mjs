#!/usr/bin/env node
// Gap round 2 (24 Jul 2026) — every feed verified live with fresh items.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OUTLETS = [
  { name: 'Indian Express',          country: 'India',         type: 'Newspaper',   rss_url: 'https://indianexpress.com/feed/', description: 'Major Indian English-language daily.' },
  { name: 'SBS News',                country: 'Australia',     type: 'TV',          rss_url: 'https://www.sbs.com.au/news/feed', description: "Australia's multicultural public broadcaster." },
  { name: 'Guardian Australia',      country: 'Australia',     type: 'Digital',     rss_url: 'https://www.theguardian.com/australia-news/rss', description: "The Guardian's Australian edition." },
  { name: 'Yahoo News',              country: 'US',            type: 'Digital',     rss_url: 'https://news.yahoo.com/rss/', description: 'High-volume US news aggregation and original reporting.' },
  { name: 'Philadelphia Inquirer',   country: 'US',            type: 'Newspaper',   rss_url: 'https://www.inquirer.com/arc/outboundfeeds/rss/?outputType=xml', description: 'Philadelphia metro daily, oldest US daily newspaper.' },
  { name: 'UPI',                     country: 'US',            type: 'News Agency', rss_url: 'https://rss.upi.com/news/news.rss', description: 'United Press International — US wire service.' },
  { name: 'The Nation',              country: 'US',            type: 'Magazine',    rss_url: 'https://www.thenation.com/feed/?post_type=article', description: 'Progressive US politics and culture magazine.' },
  { name: 'Democracy Now',           country: 'US',            type: 'Digital',     rss_url: 'https://www.democracynow.org/democracynow.rss', description: 'Independent left US news programme.' },
  { name: 'Washington Free Beacon',  country: 'US',            type: 'Digital',     rss_url: 'https://freebeacon.com/feed/', description: 'Conservative US political news site.' },
  { name: 'The Local Sweden',        country: 'Europe',        type: 'Digital',     rss_url: 'https://www.thelocal.se/feeds/rss.php', description: 'English-language news from Sweden.' },
  { name: 'The National Scotland',   country: 'UK',            type: 'Newspaper',   rss_url: 'https://www.thenational.scot/news/rss/', description: 'Scottish daily supporting independence.' },
  { name: 'Nature',                  country: 'International', type: 'Magazine',    rss_url: 'https://www.nature.com/nature.rss', description: 'News from the leading international science journal.' },
  { name: 'Irish News',              country: 'UK',            type: 'Newspaper',   rss_url: 'https://www.irishnews.com/arc/outboundfeeds/rss/?outputType=xml', description: 'Belfast-based daily covering Northern Ireland.' },
]
const { data: existing } = await db.from('outlets').select('name')
const names = new Set(existing.map(o => o.name))
for (const o of OUTLETS) {
  if (names.has(o.name)) { console.log(`SKIP ${o.name}`); continue }
  const { error } = await db.from('outlets').insert(o)
  console.log(error ? `ERR  ${o.name}: ${error.message}` : `ADD  ${o.name}`)
}
console.log('done')
