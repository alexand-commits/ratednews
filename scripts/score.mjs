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
const CONCURRENCY     = 15    // parallel Haiku calls per batch — well within 4000 RPM limit
const MAX_PER_RUN     = 400   // total cap per run (fresh + backlog combined)
const FRESH_CAP       = 200   // max articles from the last 2h scored first — raised to match ~100-110/run ingest volume
const MIN_TITLE_LEN   = 15    // articles shorter than this get a placeholder score, not API-scored
const MIN_SUMMARY_LEN = 60    // articles with no/very short summary get a placeholder — headline-only scoring is too imprecise to be useful
const MAX_ARTICLE_AGE_HOURS = 36  // skip unscored articles older than this — they'll never appear in feed
const FRESH_WINDOW_HOURS = 2  // articles younger than this are scored in the priority pass

// ── System prompt (cached — never changes between articles) ─────────────────
const CATEGORIES     = ['Politics', 'Business', 'Sport', 'Tech', 'Science', 'Health', 'Environment', 'Entertainment', 'Crime', 'Travel', 'Education', 'Conflict', 'World']
const ARTICLE_TYPES  = ['news', 'opinion', 'analysis', 'live_blog', 'pr']

const SYSTEM_PROMPT = `You are a neutral media analyst. For each news article you receive, return a JSON object with these exact fields:

- "article_type": string, one of: "news", "opinion", "analysis", "live_blog", "pr".
  Classify the article first — this affects how other fields are scored.
  "news"     = standard news reporting (use when uncertain).
  "opinion"  = labelled opinion, editorial, column, or personal commentary. Signals: title contains
               [Opinion], [Editorial], [Column], [Comment], or prefixed with "Opinion:", "Comment:";
               first-person argument framing ("Why we must", "The case for", "I believe").
  "analysis" = interpretive piece providing context or expert perspective. Signals: title contains
               [Analysis], "Analysis:", "explained", "in depth", "what it means", "why it matters".
  "live_blog"= developing or live coverage. Signals: title contains "live", "as it happened",
               "rolling updates", "– live", "latest".
  "pr"       = press release or promotional content. Signals: corporate "today announced" framing,
               no independent news hook, purely self-promotional language.

- "accuracy_score": integer 0–100. How factually reliable does this article appear based on its title and summary?
  Adjust scoring approach based on article_type:
  — "opinion": focus only on whether factual claims made are internally consistent. Do NOT penalise
    for opinionated or partisan framing — that is the purpose of the format. Score 65–80 if facts
    check out internally regardless of how strongly argued.
  — "live_blog": hedging language ("reportedly", "developing", "unconfirmed", "sources say") is
    expected and appropriate for live coverage. Score 60–78 and do not penalise for uncertainty language.
  — "pr": promotional content is inherently self-serving and lacks independent verification. Score 45–62.
  — "news" and "analysis": apply the banding below.

  Score banding for "news" and "analysis":
  85–100 Strong sourcing — named sources, specific verifiable data, clear attribution, direct quotes from
         identifiable figures. Headline and summary are tightly consistent.
  70–84  Solid reporting — factually presented, internally consistent between headline and summary, no red flags.
  55–69  Some concerns — vague sourcing ("sources say", "insiders claim"), speculative framing, or
         minor tension between headline and summary.
  35–54  Notable issues — significant unsupported assertions, or headline meaningfully overstates the summary.
  0–34   Serious concerns — fabricated-looking claims, clear factual contradictions, or obvious misinformation.

  When the summary is absent or very short (under 15 words): score within 65–72 to avoid false precision
  on minimal information — do not assign extreme scores from a sparse signal.

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
  IMPORTANT — sports preview and anticipation journalism: articles about upcoming fixtures, squad
  announcements, tournament preparations, transfer windows, and scheduled events routinely use
  forward-looking language ("set to", "expected to", "preparing to", "poised to", "due to announce",
  "likely to", "tipped to"). This is standard sports reporting convention, not a credibility problem.
  Score these 70–85 if the factual content is internally consistent between title and summary.
  IMPORTANT — sport victory, celebration and reaction articles: if an article reports on trophy
  ceremonies, title celebrations, victory parades, medal ceremonies, or winner reactions and quotes,
  treat the underlying result as a confirmed fact — even if the summary uses phrases like "implying",
  "suggesting", or "appears to have won". Celebrations and victory reactions are only published after
  results are confirmed. Score these 75–90 and do NOT flag the headline as misleading.

- "bias_direction": string, one of: "left", "centre", "right".
  The political lean of the article's framing and perspective.
  "left" = progressive or liberal framing. "right" = conservative framing. "centre" = balanced or no clear lean.
  For "opinion": assess the political lean of the argument being made.
  For "pr": default to "centre" unless the content has a clear political angle.

- "bias_score": integer 0–100. Partisan intensity — how opinionated or one-sided is the writing style,
  regardless of which direction it leans?
  0 = completely objective, factual reporting with no editorial voice.
  50 = some framing or perspective detectable but not dominant.
  100 = highly partisan, strongly one-sided language, clear agenda being pushed.
  Important: a calm left-leaning article can score 10. A neutral-topic opinion piece can score 80.
  Direction and intensity are independent.
  For "opinion": high bias_score is expected and correct — do not artificially lower it. A clearly
  argued opinion piece should reflect its genuine partisan intensity.

- "headline_vote": string, one of: "fair", "misleading", "clickbait".
  "fair" = headline accurately reflects the content.
  "misleading" = headline implies something not supported by the summary.
  "clickbait" = headline uses emotional bait, exaggeration, or withholds key info to drive clicks.
  For "opinion": provocative or argumentative headlines are expected convention — only flag as
  "misleading" if the headline claims a factual outcome the piece does not support.
  IMPORTANT — sport headlines: colourful verbs ("fires", "nets", "slots home", "inspires") and
  player-focused framing ("Rashford fires Barca to title") are normal sports-writing conventions.
  Only mark "misleading" if the headline states or strongly implies a fact that the summary contradicts
  (e.g. headline says player scored a hat-trick but summary says he scored once). Sensational but
  accurate sports language should be "fair", not "misleading".
  IMPORTANT — sports preview and anticipation journalism: forward-looking language in the headline
  ("set to", "expected to", "preparing to", "poised to", "due to", "tipped to") that is echoed or
  supported by the summary is NOT misleading — it is standard preview writing. Only mark "misleading"
  if the headline makes a specific factual claim the summary directly contradicts.
  IMPORTANT — sport victory, celebration and reaction articles: headlines reporting trophy lifts,
  title celebrations, victory parades, or winner quotes ("I told you all", "We did it") are fair
  even if the summary hedges with "implying" or "suggesting". The result is confirmed — celebrations
  don't happen before victories. Do NOT mark these as misleading or clickbait.
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
  const { article_type, accuracy_score, bias_score, bias_direction, headline_vote, category, geographic_scope, article_region, ai_summary } = parsed
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

  // article_type is validated loosely — fall back to 'news' if the model returns something unexpected
  const validatedType = ARTICLE_TYPES.includes(article_type) ? article_type : 'news'

  // Hard floor for subjective formats — opinion/analysis can't be graded on the same factual
  // accuracy scale as news reports, so enforce a minimum to prevent unfair low scores.
  const OPINION_FLOOR = 60
  const finalAccuracy = (validatedType === 'opinion' || validatedType === 'analysis')
    ? Math.max(accuracy_score, OPINION_FLOOR)
    : accuracy_score

  return { article_type: validatedType, accuracy_score: finalAccuracy, bias_score, bias_direction, headline_vote, category, geographic_scope, article_region, ai_summary: ai_summary || null }
}

// ── Score a batch of articles from a query ───────────────────────────────────
async function scoreBatch(articles, skippedIds, totalThin) {
  let scored = 0, failed = 0

  // Pre-filter thin content synchronously before any API calls.
  // Articles with a title long enough to score are sent to the API even without a summary —
  // the model handles "(no summary available)" gracefully.
  // Articles with a title too short to be meaningful are stamped with a neutral placeholder
  // score so they leave the pending pool permanently instead of cycling every run.
  const scoreable = []
  const thinStamps = []
  for (const article of articles) {
    const titleLen   = (article.title || '').trim().length
    const summaryLen = (article.summary || '').trim().length
    if (titleLen < MIN_TITLE_LEN) {
      console.log(`  ⏭  Title too short — stamping placeholder: "${(article.title || '').slice(0, 50)}"`)
      thinStamps.push(article.id)
      totalThin.count++
    } else if (summaryLen < MIN_SUMMARY_LEN) {
      console.log(`  ⏭  No/thin summary — stamping placeholder: "${(article.title || '').slice(0, 50)}"`)
      thinStamps.push(article.id)
      totalThin.count++
    } else {
      scoreable.push(article)
    }
  }

  // Stamp truly unscoreable articles so they never re-enter the pending pool
  if (thinStamps.length) {
    await supabase.from('articles').update({
      accuracy_score: 50, bias_score: 50, bias_direction: 'centre',
      headline_vote: 'fair', category: 'World', geographic_scope: 'national',
      article_region: 'International', article_type: 'news',
      ai_summary: null,
    }).in('id', thinStamps)
    thinStamps.forEach(id => skippedIds.add(id))
  }

  // Process in parallel chunks — Haiku handles 4000 RPM, CONCURRENCY=15 is well within limits
  for (let i = 0; i < scoreable.length; i += CONCURRENCY) {
    const chunk = scoreable.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map(async article => {
      const outletName = article.outlets?.name || 'Unknown'
      try {
        const scores = await scoreArticle({ ...article, outlet_name: outletName })
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            article_type:      scores.article_type,
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
          console.log(`  ❌ DB error for "${article.title?.slice(0, 40)}": ${updateError.message}`)
          skippedIds.add(article.id)
          return 'failed'
        }
        console.log(`  ✅ "${article.title?.slice(0, 40)}" acc=${scores.accuracy_score} bias=${scores.bias_direction} hl=${scores.headline_vote}`)
        return 'scored'
      } catch (err) {
        console.log(`  ❌ "${article.title?.slice(0, 40)}": ${err.message}`)
        skippedIds.add(article.id)
        return 'failed'
      }
    }))

    for (const r of results) {
      if (r === 'scored') scored++
      else failed++
    }
  }

  return { scored, failed }
}

// ── Fetch unscored articles ───────────────────────────────────────────────────
async function fetchUnscored({ newerThan, olderThan, limit, skippedIds, ascending }) {
  let query = supabase
    .from('articles')
    .select('id, title, summary, outlets(name)')
    .is('accuracy_score', null)
  if (newerThan) query = query.gte('created_at', newerThan)
  if (olderThan) query = query.lt('created_at', olderThan)
  if (skippedIds.size > 0) query = query.not('id', 'in', `(${[...skippedIds].join(',')})`)
  query = query.order('created_at', { ascending }).limit(limit)
  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch articles: ${error.message}`)
  return data || []
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 RatedNews AI Scoring')
  console.log('========================\n')

  let totalScored = 0, totalFailed = 0
  const totalThin  = { count: 0 }   // mutable counter passed into scoreBatch
  const skippedIds = new Set()

  const now             = new Date()
  const stalenessCutoff = new Date(now - MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000).toISOString()
  const freshCutoff     = new Date(now - FRESH_WINDOW_HOURS   * 60 * 60 * 1000).toISOString()

  // ── Pass 1: Fresh articles (last 2h) — scored newest-first to keep feed current ──
  console.log(`Pass 1 — fresh articles (last ${FRESH_WINDOW_HOURS}h), up to ${FRESH_CAP}\n`)
  let remaining = FRESH_CAP
  while (remaining > 0 && totalScored + totalFailed < MAX_PER_RUN) {
    const articles = await fetchUnscored({
      newerThan: freshCutoff,
      limit:     Math.min(CONCURRENCY * 2, remaining),  // fetch 2 concurrent chunks at a time
      skippedIds,
      ascending: false,   // newest-ingested first
    })
    if (!articles.length) { console.log('  ✅ No fresh articles left\n'); break }

    const { scored, failed } = await scoreBatch(articles, skippedIds, totalThin)
    totalScored += scored
    totalFailed += failed
    remaining   -= articles.length
    console.log(`  Pass 1 batch done — ✅ ${scored}  ❌ ${failed}\n`)
  }

  // ── Pass 2: Backlog (older than 2h) — scored oldest-first to prevent expiry ──
  const backlogBudget = MAX_PER_RUN - totalScored - totalFailed
  if (backlogBudget > 0) {
    console.log(`Pass 2 — backlog (older than ${FRESH_WINDOW_HOURS}h), up to ${backlogBudget}\n`)
    let batchNum = 1
    while (totalScored + totalFailed < MAX_PER_RUN) {
      const articles = await fetchUnscored({
        newerThan: stalenessCutoff,
        olderThan: freshCutoff,
        limit:     BATCH_SIZE,
        skippedIds,
        ascending: true,   // oldest-ingested first — drain backlog before expiry
      })
      if (!articles.length) { console.log('  ✅ Backlog clear\n'); break }

      console.log(`  Backlog batch ${batchNum} — ${articles.length} articles`)
      const { scored, failed } = await scoreBatch(articles, skippedIds, totalThin)
      totalScored += scored
      totalFailed += failed
      console.log(`  Backlog batch ${batchNum} done — ✅ ${scored}  ❌ ${failed}\n`)
      batchNum++
    }
  }

  if (totalScored + totalFailed >= MAX_PER_RUN) {
    console.log(`⚠️  Hit MAX_PER_RUN cap (${MAX_PER_RUN}) — remaining articles will be scored next run`)
  }

  console.log(`\n========================`)
  console.log(`✅ Total scored: ${totalScored}  ❌ Failed: ${totalFailed}  ⏭ Thin content skipped: ${totalThin.count}`)

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
