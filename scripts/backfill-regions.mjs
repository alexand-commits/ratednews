#!/usr/bin/env node
/**
 * RatedNews — Backfill article_region
 *
 * Tags every already-scored article with the geographic region it is ABOUT.
 * Only runs on articles where article_region IS NULL (safe to re-run).
 *
 * Usage: node scripts/backfill-regions.mjs
 * Requires ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Prerequisite — run once in the Supabase SQL editor:
 *   ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_region text;
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing required env vars — check VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const BATCH_SIZE  = 30
const VALID_REGIONS = ['UK', 'US', 'Europe', 'MiddleEast', 'Africa', 'AsiaPac', 'Americas', 'International']

// Lightweight system prompt — only does region classification, nothing else
const SYSTEM_PROMPT = `You are a geographic classifier for news articles. For each article, return a JSON object with one field:

- "article_region": string, one of: "UK", "US", "Europe", "MiddleEast", "Africa", "AsiaPac", "Americas", "International".
  The geographic region this article is primarily ABOUT — not where the outlet is based.
  "UK" = stories primarily about the United Kingdom (England, Scotland, Wales, Northern Ireland).
  "US" = stories primarily about the United States.
  "Europe" = stories about European countries (excluding UK): EU, France, Germany, Spain, Italy, Russia, Ukraine, Netherlands, Poland, etc.
  "MiddleEast" = stories about the Middle East: Israel, Gaza, Palestine, Iran, Iraq, Saudi Arabia, Turkey, UAE, Yemen, Lebanon, Syria, Jordan, Egypt, etc.
  "Africa" = stories about African countries or the African continent.
  "AsiaPac" = stories about Asian or Pacific countries: China, Japan, India, South Korea, Pakistan, Australia, New Zealand, Southeast Asia, etc.
  "Americas" = stories about Latin America, Canada, Mexico, Caribbean, or Central/South America.
  "International" = stories spanning multiple regions, global institutions, or with no single clear geographic focus (e.g. global economy, climate summits, UN, WHO, G7, global trade).

  Follow the story, not the outlet. A US outlet covering a UK story → "UK". A UK outlet covering US elections → "US".
  When a conflict is clearly in one region (e.g. Gaza → "MiddleEast", Ukraine → "Europe"), use that region.

Respond with ONLY the JSON object — no markdown, no explanation, no code fences.`

async function classifyRegion(article) {
  const userContent = `Title: ${article.title}
Outlet: ${article.outlet_name || 'Unknown'}
Summary: ${article.summary || '(no summary)'}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 50,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      }
    ],
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = (response.content[0]?.text?.trim() || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  const parsed = JSON.parse(raw)
  const { article_region } = parsed

  if (!VALID_REGIONS.includes(article_region)) {
    throw new Error(`Invalid region "${article_region}" — raw: ${raw.slice(0, 100)}`)
  }

  return article_region
}

async function main() {
  console.log('🌍 RatedNews — Backfill article_region')
  console.log('=======================================\n')

  // Quick sanity-check: confirm the column exists by trying to select it
  const { error: colCheck } = await supabase
    .from('articles')
    .select('article_region')
    .limit(1)

  if (colCheck) {
    console.error('❌ Column check failed:', colCheck.message)
    console.error('\nRun this SQL in the Supabase dashboard first:')
    console.error('  ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_region text;\n')
    process.exit(1)
  }

  let total = 0, failed = 0, batch = 1
  const skipped = new Set()

  while (true) {
    let query = supabase
      .from('articles')
      .select('id, title, summary, outlets(name)')
      .not('accuracy_score', 'is', null)   // already scored
      .is('article_region', null)           // not yet tagged
      .order('published_at', { ascending: false })
      .limit(BATCH_SIZE)

    if (skipped.size > 0) {
      query = query.not('id', 'in', `(${[...skipped].join(',')})`)
    }

    const { data: articles, error } = await query
    if (error) { console.error('Fetch error:', error.message); process.exit(1) }
    if (!articles || articles.length === 0) {
      console.log('\n✅ All articles tagged!')
      break
    }

    console.log(`Batch ${batch} — ${articles.length} articles`)

    for (const article of articles) {
      const outletName = article.outlets?.name || 'Unknown'
      process.stdout.write(`  "${(article.title || '').slice(0, 55)}..." `)

      try {
        const region = await classifyRegion({ ...article, outlet_name: outletName })

        const { error: upErr } = await supabase
          .from('articles')
          .update({ article_region: region })
          .eq('id', article.id)

        if (upErr) {
          console.log(`❌ DB: ${upErr.message}`)
          skipped.add(article.id)
          failed++
        } else {
          console.log(`✅ ${region}`)
          total++
        }
      } catch (err) {
        console.log(`❌ ${err.message.slice(0, 80)}`)
        skipped.add(article.id)
        failed++
      }

      await new Promise(r => setTimeout(r, 150))
    }

    console.log()
    batch++
  }

  const cost = ((total * 550 / 1_000_000) * 0.10 + (total * 15 / 1_000_000) * 5).toFixed(4)
  console.log(`\n=======================================`)
  console.log(`✅ Tagged: ${total}  ❌ Failed: ${failed}`)
  console.log(`💰 Estimated cost: ~$${cost} (Haiku 4.5 with prompt caching)`)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Fatal:', err); process.exit(1) })
