#!/usr/bin/env node
/**
 * Backfill article_type for existing articles that have accuracy_score but no article_type.
 * Uses Claude Haiku with prompt caching — costs ~$0.002 per 1000 articles.
 * Usage: node scripts/backfill-article-types.mjs [--limit N]
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_KEY) {
  console.error('❌  Missing env vars')
  process.exit(1)
}

const limitArg = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : Infinity

const supabase  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

const ARTICLE_TYPES = ['news', 'opinion', 'analysis', 'live_blog', 'pr']

const SYSTEM_PROMPT = `You are a news article classifier. Classify the article type from its title and summary.

Return ONLY a JSON object with one field:
- "article_type": one of "news", "opinion", "analysis", "live_blog", "pr"

Rules:
"news"     = standard reporting (default when uncertain)
"opinion"  = labelled opinion/editorial/column. Signals: title has [Opinion], [Editorial], [Column], [Comment], "Opinion:", "Comment:"; first-person argument ("Why we must", "The case for")
"analysis" = interpretive/context piece. Signals: title has [Analysis], "Analysis:", "explained", "in depth", "what it means", "why it matters"
"live_blog"= developing/live coverage. Signals: title has "live", "as it happened", "rolling updates", "– live", "latest updates"
"pr"       = press release/promotional. Signals: corporate "today announced", no independent news hook, purely self-promotional

Respond with ONLY the JSON object — no markdown, no explanation.`

async function classifyArticle(article) {
  const userContent = `Title: ${article.title}\nSummary: ${article.summary || '(no summary)'}`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 60,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  })

  const raw = (response.content[0]?.text?.trim() || '')
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  const { article_type } = JSON.parse(raw)
  return ARTICLE_TYPES.includes(article_type) ? article_type : 'news'
}

async function run() {
  console.log('🔍  Fetching articles without article_type…')

  // Paginate through all articles missing article_type
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary')
      .not('accuracy_score', 'is', null)
      .is('article_type', null)
      .order('published_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) { console.error('❌  Fetch error:', error.message); process.exit(1) }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }

  const articles = limitArg < Infinity ? all.slice(0, limitArg) : all
  console.log(`   Found ${all.length} articles to classify${limitArg < Infinity ? ` (running first ${articles.length})` : ''}\n`)

  if (articles.length === 0) {
    console.log('✨  Nothing to backfill.')
    return
  }

  let done = 0, failed = 0
  const typeCounts = {}

  // Process in batches of 10 with concurrency
  const CONCURRENCY = 10
  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    const batch = articles.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async article => {
      try {
        const article_type = await classifyArticle(article)
        typeCounts[article_type] = (typeCounts[article_type] || 0) + 1

        const { error } = await supabase
          .from('articles')
          .update({ article_type })
          .eq('id', article.id)

        if (error) { failed++; console.error(`   ❌  ${article.id}: ${error.message}`) }
        else done++
      } catch (err) {
        failed++
        console.error(`   ⚠️  ${article.id}: ${err.message}`)
      }
    }))

    const pct = Math.round((i + batch.length) / articles.length * 100)
    process.stdout.write(`\r   Progress: ${i + batch.length}/${articles.length} (${pct}%)  `)
  }

  console.log(`\n\n✨  Done — classified ${done}, failed ${failed}`)
  console.log('   Type breakdown:', typeCounts)
}

run().catch(err => { console.error(err); process.exit(1) })
