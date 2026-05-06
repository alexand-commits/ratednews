/**
 * Vercel Cron Job — AI Scoring
 * Runs on schedule defined in vercel.json (10 mins after ingest)
 * Called by Vercel with Authorization: Bearer <CRON_SECRET>
 */

const Anthropic = require('@anthropic-ai/sdk')
const { createClient } = require('@supabase/supabase-js')

const BATCH_SIZE = 50

const CATEGORIES = ['Politics', 'Business', 'Sport', 'Tech', 'Science', 'Health', 'Environment', 'Entertainment', 'Crime', 'Travel', 'Education', 'World']

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

- "category": string, one of: "Politics", "Business", "Sport", "Tech", "Science", "Health", "Environment", "Entertainment", "Crime", "Travel", "Education", "World".
  Pick the single best-fitting category for this article's subject matter.
  Use "World" for international news or stories that don't fit another category.

- "ai_summary": string. A 1–2 sentence neutral summary of what the article is about.
  Write as if summarising for someone who hasn't read it. Do not editoralise.

Respond with ONLY the JSON object — no markdown, no explanation, no code fences.`

async function scoreArticle(anthropic, article) {
  const userContent = `Title: ${article.title}
Outlet: ${article.outlet_name || 'Unknown'}
Summary: ${article.summary || '(no summary available)'}`

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 300,
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

  const { accuracy_score, bias_score, bias_direction, headline_vote, category, ai_summary } = parsed
  if (
    typeof accuracy_score !== 'number' ||
    typeof bias_score !== 'number' ||
    !['left', 'centre', 'right'].includes(bias_direction) ||
    !['fair', 'misleading', 'clickbait'].includes(headline_vote) ||
    !CATEGORIES.includes(category)
  ) {
    throw new Error(`Unexpected response shape: ${raw.slice(0, 200)}`)
  }

  return { accuracy_score, bias_score, bias_direction, headline_vote, category, ai_summary: ai_summary || null }
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
        const scores = await scoreArticle(anthropic, {
          ...article,
          outlet_name: article.outlets?.name,
        })

        const { error: updateError } = await supabase
          .from('articles')
          .update({
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
