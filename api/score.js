/**
 * Vercel Cron Job — AI Scoring
 * Runs on schedule defined in vercel.json (10 mins after ingest)
 * Called by Vercel with Authorization: Bearer <CRON_SECRET>
 */

const Anthropic = require('@anthropic-ai/sdk')
const { createClient } = require('@supabase/supabase-js')

const BATCH_SIZE = 50

const CATEGORIES    = ['Politics', 'Business', 'Sport', 'Tech', 'Science', 'Health', 'Environment', 'Entertainment', 'Crime', 'Travel', 'Education', 'Conflict', 'World']
const ARTICLE_TYPES = ['news', 'opinion', 'analysis', 'live_blog', 'pr']

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

- "accuracy_score": integer 0–100. How factually reliable does this article appears based on its title and summary?
  Adjust scoring approach based on article_type:
  — "opinion": focus only on whether factual claims made are internally consistent. Do NOT penalise
    for opinionated or partisan framing — that is the purpose of the format. Score 65–80.
  — "live_blog": hedging language is expected for live coverage. Score 60–78.
  — "pr": promotional content lacks independent verification. Score 45–62.
  — "news" and "analysis": apply the banding below.

  Score banding for "news" and "analysis":
  85–100 Strong sourcing — named sources, specific verifiable data, clear attribution, direct quotes.
  70–84  Solid reporting — factually presented, internally consistent, no red flags.
  55–69  Some concerns — vague sourcing, speculative framing, or minor headline/summary tension.
  35–54  Notable issues — unsupported assertions, or headline meaningfully overstates the summary.
  0–34   Serious concerns — fabricated-looking claims, clear factual contradictions, or misinformation.

  When the summary is absent or very short (under 15 words): score within 65–72 — do not assign
  extreme scores on minimal information.

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
  IMPORTANT — sports preview and anticipation journalism: forward-looking language ("set to", "expected
  to", "preparing to", "poised to", "due to announce", "likely to", "tipped to") is standard sports
  reporting convention. Score these 70–85 if the factual content is internally consistent.
  IMPORTANT — sport victory, celebration and reaction articles: treat the result as confirmed fact
  even if the summary hedges. Score these 75–90 and do NOT flag the headline as misleading.

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
  For "opinion": high bias_score is expected and correct — do not artificially lower it.

- "headline_vote": string, one of: "fair", "misleading", "clickbait".
  "fair" = headline accurately reflects the content.
  "misleading" = headline implies something not supported by the summary.
  "clickbait" = headline uses emotional bait, exaggeration, or withholds key info to drive clicks.
  For "opinion": provocative headlines are expected — only flag as "misleading" if the headline
  claims a factual outcome the piece does not support.
  IMPORTANT — sport headlines: colourful language and player-focused framing are conventions, not
  inaccuracies. Only mark "misleading" if the headline states a fact the summary directly contradicts.
  IMPORTANT — sport victory/celebration articles: headlines with winner quotes or celebration
  language are fair even if the summary hedges. Celebrations only happen after confirmed results.
  Do NOT mark these as misleading or clickbait.

- "category": string, one of: "Politics", "Business", "Sport", "Tech", "Science", "Health", "Environment", "Entertainment", "Crime", "Travel", "Education", "Conflict", "World".
  Pick the single best-fitting category for this article's subject matter.
  Use "Conflict" for stories about armed conflict, wars, military operations, airstrikes, battles, casualties in war zones, or geopolitical tensions involving military force.
  Use "Tech" for stories about technology companies, AI, software, hardware, cybersecurity, social media platforms, and the tech industry.
  Use "Entertainment" for arts, music, film, TV, celebrity, fashion, food, culture, and lifestyle stories.
  Use "World" for international news or stories that don't fit another category.

- "ai_summary": string. A 1–2 sentence neutral summary of what the article is about.
  Write as if summarising for someone who hasn't read it. Do not editoralise.

Respond with ONLY the JSON object — no markdown, no explanation, no code fences.`

async function scoreArticle(anthropic, article) {
  const userContent = `Title: ${article.title}
Summary: ${article.summary || '(no summary available)'}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 350,
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

  const { article_type, accuracy_score, bias_score, bias_direction, headline_vote, category, ai_summary } = parsed
  if (
    typeof accuracy_score !== 'number' ||
    typeof bias_score !== 'number' ||
    !['left', 'centre', 'right'].includes(bias_direction) ||
    !['fair', 'misleading', 'clickbait'].includes(headline_vote) ||
    !CATEGORIES.includes(category)
  ) {
    throw new Error(`Unexpected response shape: ${raw.slice(0, 200)}`)
  }

  const validatedType = ARTICLE_TYPES.includes(article_type) ? article_type : 'news'
  return { article_type: validatedType, accuracy_score, bias_score, bias_direction, headline_vote, category, ai_summary: ai_summary || null }
}

module.exports = async function handler(req, res) {
  // Verify this request came from Vercel's cron scheduler
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase  = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, summary, outlets(name)')
    .is('accuracy_score', null)
    .order('published_at', { ascending: false })
    .limit(BATCH_SIZE)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (!articles || articles.length === 0) {
    return res.status(200).json({ ok: true, scored: 0, message: 'No unscored articles' })
  }

  let scored = 0, failed = 0

  // Process in parallel batches of 5 — Haiku handles concurrency fine
  const CONCURRENCY = 5
  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    const batch = articles.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async article => {
      try {
        const scores = await scoreArticle(anthropic, article)

        const { error: updateError } = await supabase
          .from('articles')
          .update({
            article_type:    scores.article_type,
            accuracy_score:  scores.accuracy_score,
            bias_score:      scores.bias_score,
            bias_direction:  scores.bias_direction,
            headline_vote:   scores.headline_vote,
            category:        scores.category,
            ai_summary:      scores.ai_summary,
          })
          .eq('id', article.id)

        if (updateError) { failed++; return }
        scored++
      } catch {
        failed++
      }
    }))
  }

  return res.status(200).json({ ok: true, scored, failed })
}

module.exports.config = { maxDuration: 300 }
