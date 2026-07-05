#!/usr/bin/env node
/**
 * Social content desk — runs on a schedule (every 8h via GitHub Actions).
 *
 * Pulls the real clustered stories from the last ~36h (events where several
 * outlets covered the same story), picks the most-covered ones, and asks Claude
 * to draft neutral, ready-to-post social content grounded in those actual
 * headlines. Also produces evergreen media-literacy posts that need no data, so
 * a quiet news window still yields a usable pack.
 *
 * Output is stored as one row in `social_drafts` (jsonb `pack`) and shown on the
 * private /social page. Nothing is auto-posted — every post is human-reviewed.
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL       = 'claude-sonnet-4-6' // strong copywriting, cheap enough for 3×/day
const KEEP_DRAFTS = 60                    // ~20 days of history at 3 packs/day
const WINDOW_MS   = 36 * 60 * 60 * 1000
const OUTLET_URL  = 'https://www.ratednews.com'

// ── 1. Gather the most-covered stories ───────────────────────────────────────
async function topClusters() {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data, error } = await db
    .from('articles')
    .select('title, category, published_at, cluster_id, outlets(name)')
    .not('cluster_id', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(500)
  if (error) throw error

  // Group by cluster; keep one headline per distinct outlet (that's the spread).
  const clusters = new Map()
  for (const a of data || []) {
    const name = a.outlets?.name
    if (!name) continue
    if (!clusters.has(a.cluster_id)) clusters.set(a.cluster_id, { headlines: [], outlets: new Set(), category: a.category })
    const c = clusters.get(a.cluster_id)
    if (!c.outlets.has(name)) { c.outlets.add(name); c.headlines.push({ outlet: name, title: a.title }) }
  }

  return [...clusters.values()]
    .filter(c => c.outlets.size >= 3)            // need genuine cross-outlet spread
    .sort((x, y) => y.outlets.size - x.outlets.size)
    .slice(0, 3)
    .map(c => ({ category: c.category, headlines: c.headlines.slice(0, 6) }))
}

// ── 2. Draft the pack ─────────────────────────────────────────────────────────
const SYSTEM = `You are the social content desk for RatedNews (${OUTLET_URL}) — a community-rated news aggregator.

Positioning (be precise, this brand lives or dies on it):
- RatedNews shows the same story across many outlets so readers can compare framing, and lets signed-in readers rate how much they TRUST each outlet.
- Trust is community-driven. There is NO AI scoring and NO editorial verdict from us.
- The product is early: there are not yet enough ratings to show trust scores. So NEVER invent, cite, or imply a trust score, percentage, or ranking. The rating is the call-to-action, not the payload.

Neutrality rules (non-negotiable):
- You are a referee, never a partisan. Never say which outlet is right, biased, or better in your own voice.
- Show the framing contrast and let the reader judge. The outlets did their own framing — you just hold up the mirror.
- No hashtag spam, no engagement-bait outrage, no punching down at a named outlet.

Craft:
- Platform is X / Bluesky. Punchy, hook in the first line, tight. Coverage-spread posts may run a bit longer to fit the headlines.
- Use the REAL headlines provided verbatim. Do not paraphrase or soften them.
- End story posts with a light CTA to rate the sources at ${OUTLET_URL} (vary the wording).

Output STRICT JSON only — no markdown, no prose around it — matching:
{"posts":[
  {"type":"coverage_spread","platform":"x","text":"<full ready-to-post copy incl. the real headlines>","why":"<one line: why this works>"},
  {"type":"poll","platform":"x","text":"<poll question copy + CTA>","poll_options":["<opt A>","<opt B>"],"why":"..."},
  {"type":"media_literacy","platform":"x","text":"<evergreen tip, no data needed>","why":"..."}
]}`

function buildUserPrompt(clusters) {
  if (!clusters.length) {
    return `There were no strongly cross-covered stories in the last day. Draft a pack of 4 evergreen media-literacy posts only (type "media_literacy") — the kind that builds authority and needs no live data (spotting loaded headlines, how the same fact gets framed differently, questions to ask before trusting a story, etc.). Return the JSON.`
  }
  const blocks = clusters.map((c, i) => {
    const lines = c.headlines.map(h => `  - ${h.outlet}: "${h.title}"`).join('\n')
    return `STORY ${i + 1}${c.category ? ` (${c.category})` : ''} — covered by ${c.headlines.length} outlets:\n${lines}`
  }).join('\n\n')

  return `Here are today's most cross-covered stories on RatedNews (same event, different outlets):

${blocks}

Draft a social pack of ~6 posts:
- One "coverage_spread" post for STORY 1 and one for STORY 2 (use the real headlines verbatim, show the framing contrast).
- One "poll" post built from any of the stories, asking which outlet readers trust more on it (poll_options = two outlet names from that story).
- Two "media_literacy" evergreen posts (no data needed).

Return the JSON only.`
}

function parsePack(text) {
  // Be defensive: pull the first {...} block in case the model adds stray text.
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in model output')
  return JSON.parse(text.slice(start, end + 1))
}

async function draft(clusters) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildUserPrompt(clusters) }],
  })
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const parsed = parsePack(text)
  if (!Array.isArray(parsed.posts) || !parsed.posts.length) throw new Error('Model returned no posts')
  return parsed.posts
}

// ── 3. Store + prune ──────────────────────────────────────────────────────────
async function main() {
  const clusters = await topClusters()
  console.log(`Found ${clusters.length} well-covered stories to work from.`)

  const posts = await draft(clusters)
  const pack = {
    generated_at: new Date().toISOString(),
    story_count: clusters.length,
    sources: clusters.map(c => c.headlines.map(h => h.outlet)),
    posts,
  }

  const { error } = await db.from('social_drafts').insert({ pack })
  if (error) throw error
  console.log(`✅ Saved a pack of ${posts.length} posts.`)

  // Keep history bounded.
  const { data: old } = await db
    .from('social_drafts')
    .select('id')
    .order('created_at', { ascending: false })
    .range(KEEP_DRAFTS, KEEP_DRAFTS + 500)
  if (old?.length) {
    await db.from('social_drafts').delete().in('id', old.map(r => r.id))
    console.log(`🧹 Pruned ${old.length} old packs.`)
  }
}

main().catch(err => { console.error('[social]', err); process.exit(1) })
