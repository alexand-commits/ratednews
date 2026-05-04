#!/usr/bin/env node
/**
 * RatedNews AI Scoring Script
 * Usage: node scripts/score.mjs
 * Requires ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Fetches articles that haven't been AI-scored yet, sends them to Claude
 * in batches, and writes back:
 *   accuracy_score   (0–100)
 *   bias_score       (0–100 partisan intensity — 0 = objective, 100 = very partisan, independent of direction)
 *   bias_direction   ('left' | 'centre' | 'right')
 *   headline_vote    ('fair' | 'misleading' | 'clickbait')
 *   ai_summary       (1–2 sentence neutral summary)
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env')
  console.error('Get your key from: https://console.anthropic.com/account/keys')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const BATCH_SIZE = 20

// ── System prompt (cached — never changes between articles) ─────────────────
const CATEGORIES = ['Politics', 'Business', 'Sport', 'Tech', 'Science', 'Health', 'Environment', 'Entertainment', 'Crime', 'Travel', 'Education', 'War & Conflict', 'Culture', 'World']

const SYSTEM_PROMPT = `You are a neutral media analyst. For each news article you receive, return a JSON object with these exact fields:

- "accuracy_score": integer 0–100. How factually reliable does this article appears based on its title and summary?
  100 = highly factual, well-sourced journalism. 0 = clearly false or fabricated.
  Use 70–85 as baseline for mainstream outlets with no obvious issues.

- "bias_direction": string, one of: "left", "centre", "right".
  The political lean of the article's framing and perspective.
  "left" = progressive or liberal framing. "right" = conservative framing. "centre" = balanced or no clear lean.

- "bias_score": integer 0–100. Partisan intensity — how opinionated or one-sided is the writing style,
  regardless of which direction it leans?
  0 = completely objective, factual reporting with no editorial voice.
  50 = some framing or perspective detectable but not dominant.
  100 = highly partisan, strongly one-sided language, clear agenda being pushed.
  Important: a calm left-leaning article can score 10. A neutral-topic opinion piece can score 80.
  Direction and intensity are independent.

- "headline_vote": string, one of: "fair", "misleading", "clickbait".
  "fair" = headline accurately reflects the content.
  "misleading" = headline implies something not supported by the summary.
  "clickbait" = headline uses emotional bait, exaggeration, or withholds key info to drive clicks.

- "category": string, one of: "Politics", "Business", "Sport", "Tech", "Science", "Health", "Environment", "Entertainment", "Crime", "Travel", "Education", "War & Conflict", "Culture", "World".
  Pick the single best-fitting category for this article's subject matter.
  Use "War & Conflict" for stories about armed conflict, military operations, wars, or geopolitical tensions involving military force.
  Use "Culture" for arts, music, film, fashion, food, heritage, and lifestyle stories not covered by Entertainment.
  Use "World" for international news or stories that don't fit another category.

- "geographic_scope": string, one of: "local", "national", "global".
  How broad is the story's relevance to a general reader?
  "local" = primarily about a specific city, town, county, or sub-national region with little wider significance
    (e.g. "Manchester council approves new tram route", "Texas school district bans book", "Leeds hospital waiting times rise").
  "national" = relevant across an entire country (e.g. "UK raises interest rates", "US Congress passes spending bill").
  "global" = clear international significance or spans multiple countries (e.g. "NATO summit agrees new defence targets", "Global inflation hits 40-year high").
  When in doubt between national and global, prefer "national".

- "ai_summary": string. A 1–2 sentence neutral summary of what the article is about.
  Write as if summarising for someone who hasn't read it. Do not editoralise.

Respond with ONLY the JSON object — no markdown, no explanation, no code fences.`

// ── Score a single article ───────────────────────────────────────────────────
async function scoreArticle(article) {
  const userContent = `Title: ${article.title}
Outlet: ${article.outlet_name || 'Unknown'}
Summary: ${article.summary || '(no summary available)'}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },   // Cache the system prompt across all articles
      }
    ],
    messages: [
      { role: 'user', content: userContent }
    ],
  })

  // Strip markdown code fences if model wraps response in ```json ... ```
  const raw = (response.content[0]?.text?.trim() || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Claude returned non-JSON: ${raw.slice(0, 200)}`)
  }

  // Validate required fields
  const { accuracy_score, bias_score, bias_direction, headline_vote, category, geographic_scope, ai_summary } = parsed
  if (
    typeof accuracy_score !== 'number' ||
    typeof bias_score !== 'number' ||
    !['left', 'centre', 'right'].includes(bias_direction) ||
    !['fair', 'misleading', 'clickbait'].includes(headline_vote) ||
    !CATEGORIES.includes(category) ||
    !['local', 'national', 'global'].includes(geographic_scope)
  ) {
    throw new Error(`Unexpected response shape: ${raw.slice(0, 200)}`)
  }

  return { accuracy_score, bias_score, bias_direction, headline_vote, category, geographic_scope, ai_summary: ai_summary || null }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 RatedNews AI Scoring')
  console.log('========================\n')

  let totalScored = 0, totalFailed = 0, batch = 1

  while (true) {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, outlets(name)')
      .is('accuracy_score', null)
      .order('published_at', { ascending: false })
      .limit(BATCH_SIZE)

    if (error) {
      console.error('Failed to fetch articles:', error.message)
      process.exit(1)
    }

    if (!articles || articles.length === 0) {
      console.log('\n✅ All articles scored!')
      break
    }

    console.log(`Batch ${batch} — ${articles.length} articles\n`)

    let scored = 0, failed = 0

    for (const article of articles) {
      const outletName = article.outlets?.name || 'Unknown'
      process.stdout.write(`  Scoring: "${article.title.slice(0, 60)}..." `)

      try {
        const scores = await scoreArticle({ ...article, outlet_name: outletName })

        const { error: updateError } = await supabase
          .from('articles')
          .update({
            accuracy_score:    scores.accuracy_score,
            bias_score:        scores.bias_score,
            bias_direction:    scores.bias_direction,
            headline_vote:     scores.headline_vote,
            category:          scores.category,
            geographic_scope:  scores.geographic_scope,
            ai_summary:        scores.ai_summary,
          })
          .eq('id', article.id)

        if (updateError) {
          console.log(`❌ DB error: ${updateError.message}`)
          failed++
        } else {
          console.log(`✅ acc=${scores.accuracy_score} bias=${scores.bias_direction}(${scores.bias_score}) hl=${scores.headline_vote}`)
          scored++
        }
      } catch (err) {
        console.log(`❌ ${err.message}`)
        failed++
      }

      await new Promise(r => setTimeout(r, 200))
    }

    totalScored += scored
    totalFailed += failed
    console.log(`\nBatch ${batch} done — ✅ ${scored}  ❌ ${failed}`)
    batch++
  }

  console.log(`\n========================`)
  console.log(`✅ Total scored: ${totalScored}  ❌ Total failed: ${totalFailed}`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
