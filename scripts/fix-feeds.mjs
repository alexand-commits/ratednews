/**
 * Fix broken RSS feed URLs — tests replacements and updates the DB
 */
import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const parser = new Parser({ timeout: 12000 })

// Replacement URLs to try for broken feeds
const REPLACEMENTS = {
  'The Spectator':    'https://news.google.com/rss/search?q=site:spectator.co.uk&hl=en-GB&gl=GB&ceid=GB:en',
  'USA Today':        'https://news.google.com/rss/search?q=site:usatoday.com&hl=en-US&gl=US&ceid=US:en',
  'The Daily Beast':  'https://feeds.feedburner.com/thedailybeast/articles',
  'Haaretz':          'https://news.google.com/rss/search?q=site:haaretz.com&hl=en-US&gl=US&ceid=US:en',
  'NHK World':        'https://www3.nhk.or.jp/nhkworld/en/news/feeds/rss/',
  'Kyiv Independent': 'https://news.google.com/rss/search?q=site:kyivindependent.com&hl=en-US&gl=US&ceid=US:en',
  'Channel 4 News':   'https://news.google.com/rss/search?q=site:channel4.com/news&hl=en-GB&gl=GB&ceid=GB:en',
  'MSNBC':            'https://news.google.com/rss/search?q=site:msnbc.com&hl=en-US&gl=US&ceid=US:en',
  'GB News':          'https://news.google.com/rss/search?q=site:gbnews.com&hl=en-GB&gl=GB&ceid=GB:en',
  'Daily Express':    'https://news.google.com/rss/search?q=site:express.co.uk&hl=en-GB&gl=GB&ceid=GB:en',
  'The Times':        'https://news.google.com/rss/search?q=site:thetimes.com&hl=en-GB&gl=GB&ceid=GB:en',
  'Voice of America': 'https://feeds.voanews.com/en/news/rss.xml',
  'LBC News':         'https://news.google.com/rss/search?q=site:lbc.co.uk&hl=en-GB&gl=GB&ceid=GB:en',
  'New York Magazine':'https://feeds.feedburner.com/nymag/all',
  'HuffPost':         'https://www.huffpost.com/news/feed',
  // Re-fix existing outlets also erroring
  'AP News':          'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en',
  'The Telegraph':    'https://news.google.com/rss/search?q=site:telegraph.co.uk&hl=en-GB&gl=GB&ceid=GB:en',
  'Washington Post':  'https://news.google.com/rss/search?q=site:washingtonpost.com&hl=en-US&gl=US&ceid=US:en',
  'CNN':              'https://news.google.com/rss/search?q=site:cnn.com&hl=en-US&gl=US&ceid=US:en',
  'Reuters':          'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en',
}

async function testFeed(url) {
  try {
    const feed = await parser.parseURL(url)
    return feed.items?.length > 0
  } catch {
    return false
  }
}

async function main() {
  console.log('🔧 Testing replacement RSS feeds...\n')

  const { data: outlets } = await db.from('outlets').select('id, name, rss_url')
  const outletMap = Object.fromEntries(outlets.map(o => [o.name, o]))

  const fixed = [], failed = [], skipped = []

  for (const [name, newUrl] of Object.entries(REPLACEMENTS)) {
    const outlet = outletMap[name]
    if (!outlet) { skipped.push(name); continue }

    process.stdout.write(`  Testing ${name}… `)
    const works = await testFeed(newUrl)

    if (works) {
      const { error } = await db.from('outlets').update({ rss_url: newUrl }).eq('id', outlet.id)
      if (error) {
        console.log(`❌ DB update failed: ${error.message}`)
        failed.push(name)
      } else {
        console.log(`✅ updated`)
        fixed.push(name)
      }
    } else {
      console.log(`❌ feed not working`)
      failed.push(name)
    }
  }

  console.log(`\n===========================`)
  console.log(`✅ Fixed (${fixed.length}): ${fixed.join(', ') || 'none'}`)
  console.log(`❌ Still broken (${failed.length}): ${failed.join(', ') || 'none'}`)
  if (skipped.length) console.log(`⚠️  Not found in DB: ${skipped.join(', ')}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
