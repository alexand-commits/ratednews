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

const BATCH_SIZE      = 20
const MAX_PER_RUN     = 80    // ingest caps mean ~60 new articles/run max; 80 gives headroom
const MIN_TITLE_LEN   = 15    // skip malformed / very short titles
const MIN_CONTENT_LEN = 30    // skip articles with neither a real title nor summary
const MAX_ARTICLE_AGE_HOURS = 36  // skip unscored articles older than this — they'll never appear in feed

// ── System prompt (cached — never changes between articles) ─────────────────
const CATEGORIES = ['Politics', 'Business', 'Sport', 'Tech', 'Science', 'Health', 'Environment', 'Entertainment', 'Crime', 'Travel', 'Education', 'Conflict', 'World']

const SYSTEM_PROMPT = `You are a neutral media analyst. For each news article you receive, return a JSON object with these exact fields:

- "accuracy_score": integer 0–100. How factually reliable does this article appear based on its title and summary?
  100 = highly factual, well-sourced journalism. 0 = clearly false or fabricated.
  Use 70–85 as baseline for mainstream outlets with no obvious issues.
  IMPORTANT — sport match reports: goals, scores, results, and player actions are verifiable facts.
  Do NOT penalise accuracy for dramatic or colourful match-report language ("fires", "nets", "slots home",
  "brilliant", "stunner") — these are standard sports-writing conventions, not inaccuracies.
  A factually correct match report with vivid language should score 75–90.
  Only lower accuracy_score if the reported facts themselves appear wrong (wrong scoreline, wrong scorer, etc.).
  CRITICAL — do NOT use your training-data knowledge of player club affiliations to judge accuracy.
  Player transfers and loan moves happen constantly and your knowledge may be outdated. If an article says
  a player scored for a club, trust the article — do not flag it as inaccurate because you believe the player
  is at a different club. Judge only the internal consistency between title and summary.
  IMPORTANT — tribute, memorial and human interest content: emotional or reverential language in
  articles about deaths, memorials, tributes, retirements, and community stories is appropriate
  writing style, not a sign of inaccuracy. Score these 75–90 if the facts are internally consistent.
  Do NOT penalise for empathetic tone, first-person community framing, or lack of hard data sources.

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
  IMPORTANT — sport headlines: colourful verbs ("fires", "nets", "slots home", "inspires") and
  player-focused framing ("Rashford fires Barca to title") are normal sports-writing conventions.
  Only mark "misleading" if the headline states or strongly implies a fact that the summary contradicts
  (e.g. headline says player scored a hat-trick but summary says he scored once). Sensational but
  accurate sports language should be "fair", not "misleading".
  IMPORTANT — tribute, memorial and human interest content: articles about deaths, memorials,
  tributes, retirements, community stories and human interest pieces naturally use emotional,
  reverential or narrative language. This is appropriate writing style, not inaccuracy or bias.
  Do NOT penalise accuracy_score for empathetic or emotional framing in these contexts — a
  factually correct tribute piece should score 75–90. Only lower accuracy_score if the reported
  facts themselves appear wrong. Similarly do not inflate bias_score for emotional tone alone.

- "category": string, one of: "Politics", "Business", "Sport", "Tech", "Science", "Health", "Environment", "Entertainment", "Crime", "Travel", "Education", "Conflict", "World".
  Pick the single best-fitting category for this article's subject matter.
  Use "Conflict" for stories about armed conflict, wars, military operations, airstrikes, battles, casualties in war zones, or geopolitical tensions involving military force — this includes Ukraine, Gaza, Middle East, Sudan, and any active conflict zone. Do NOT assign these to Politics or World.
  Use "Tech" for stories about technology companies, AI, software, hardware, cybersecurity, social media platforms, and the tech industry — even if they have a business angle. Do NOT assign pure tech stories to Business.
  Use "Entertainment" for arts, music, film, TV, celebrity, fashion, food, culture, and lifestyle stories.
  Use "World" for international news or stories that don't fit another category.

- "geographic_scope": string, one of: "local", "national", "global".
  How broad is the story's relevance to a general reader?
  "local" = primarily about a specific city, town, county, or sub-national region with little wider significance
    (e.g. "Manchester council approves new tram route", "Texas school district bans book", "Leeds hospital waiting times rise").
  "national" = relevant across an entire country (e.g. "UK raises interest rates", "US Congress passes spending bill").
  "global" = clear international significance or spans multiple countries (e.g. "NATO summit agrees new defence targets", "Global inflation hits 40-year high").
  When in doubt between national and global, prefer "national".

- "article_region": string, one of: "UK", "US", "Europe", "MiddleEast", "Africa", "AsiaPac", "Americas", "International".
  The geographic region this article is primarily ABOUT — not where the outlet is based.
  "UK" = stories primarily about the United Kingdom.
  "US" = stories primarily about the United States.
  "Europe" = stories about European countries (excluding UK), the EU, or pan-European topics (France, Germany, Spain, Italy, Russia, Ukraine, etc).
  "MiddleEast" = stories about the Middle East (Israel, Gaza, Iran, Iraq, Saudi Arabia, Turkey, UAE, Yemen, Lebanon, Syria, etc).
  "Africa" = stories about African countries or the African continent.
  "AsiaPac" = stories about Asian or Pacific countries (China, Japan, India, South Korea, Australia, Southeast Asia, etc).
  "Americas" = stories about Latin America, Canada, or the Caribbean.
  "International" = stories spanning multiple regions or with global significance but no single clear geographic focus (e.g. global economy, climate summit, UN resolutions).
  When a US outlet covers a UK story, tag "UK". When a UK outlet covers a US election, tag "US". Follow the story, not the outlet.

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
  const { accuracy_score, bias_score, bias_direction, headline_vote, category, geographic_scope, article_region, ai_summary } = parsed
  const VALID_REGIONS = ['UK', 'US', 'Europe', 'MiddleEast', 'Africa', 'AsiaPac', 'Americas', 'International']
  if (
    typeof accuracy_score !== 'number' ||
    typeof bias_score !== 'number' ||
    !['left', 'centre', 'right'].includes(bias_direction) ||
    !['fair', 'misleading', 'clickbait'].includes(headline_vote) ||
    !CATEGORIES.includes(category) ||
    !['local', 'national', 'global'].includes(geographic_scope) ||
    !VALID_REGIONS.includes(article_region)
  ) {
    throw new Error(`Unexpected response shape: ${raw.slice(0, 200)}`)
  }

  return { accuracy_score, bias_score, bias_direction, headline_vote, category, geographic_scope, article_region, ai_summary: ai_summary || null }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 RatedNews AI Scoring')
  console.log('========================\n')

  let totalScored = 0, totalFailed = 0, totalThin = 0, batch = 1
  const skippedIds = new Set()   // articles that failed — excluded from future fetches

  const stalenessCutoff = new Date(Date.now() - MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000).toISOString()

  while (totalScored + totalFailed < MAX_PER_RUN) {
    let query = supabase
      .from('articles')
      .select('id, title, summary, outlets(name)')
      .is('accuracy_score', null)
      .gte('created_at', stalenessCutoff)   // use created_at (row insert time) not published_at
      .order('published_at', { ascending: false })  // so slow-publishing outlets (Economist, Bellingcat) aren't skipped
      .limit(BATCH_SIZE)

    // Exclude any IDs that have already failed this run to avoid infinite loops
    if (skippedIds.size > 0) {
      query = query.not('id', 'in', `(${[...skippedIds].join(',')})`)
    }

    const { data: articles, error } = await query

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

      // Skip thin-content articles — scoring on just a title produces unreliable results
      const titleLen   = (article.title || '').trim().length
      const summaryLen = (article.summary || '').trim().length
      if (titleLen < MIN_TITLE_LEN || titleLen + summaryLen < MIN_CONTENT_LEN) {
        console.log(`  ⏭  Thin content skipped: "${(article.title || '').slice(0, 50)}"`)
        skippedIds.add(article.id)
        totalThin++
        continue
      }

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
            article_region:    scores.article_region,
            ai_summary:        scores.ai_summary,
          })
          .eq('id', article.id)

        if (updateError) {
          console.log(`❌ DB error: ${updateError.message}`)
          skippedIds.add(article.id)
          failed++
        } else {
          console.log(`✅ acc=${scores.accuracy_score} bias=${scores.bias_direction}(${scores.bias_score}) hl=${scores.headline_vote}`)
          scored++
        }
      } catch (err) {
        console.log(`❌ ${err.message}`)
        skippedIds.add(article.id)
        failed++
      }

      await new Promise(r => setTimeout(r, 200))
    }

    totalScored += scored
    totalFailed += failed
    console.log(`\nBatch ${batch} done — ✅ ${scored}  ❌ ${failed}`)
    batch++
  }

  if (totalScored + totalFailed >= MAX_PER_RUN) {
    console.log(`\n⚠️  Hit MAX_PER_RUN cap (${MAX_PER_RUN}) — remaining articles will be scored next run`)
  }

  console.log(`\n========================`)
  console.log(`✅ Total scored: ${totalScored}  ❌ Failed: ${totalFailed}  ⏭ Thin content skipped: ${totalThin}`)

  // Write output for GitHub Actions conditional steps
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `scored=${totalScored}\n`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
