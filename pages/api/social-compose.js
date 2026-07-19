/**
 * POST /api/social-compose  (owner-only)
 * On-demand social post generator. Two modes:
 *   { headlines: string, steer?: string } — compose from pasted headlines.
 *   { trending: true, steer?: string }    — server picks the 5 hottest (velocity-ranked)
 *     stories from the last 12h (cross-outlet clusters, recent-coverage velocity
 *     with freshness decay + a breaking tier) and drafts posts per story.
 * Non-streaming JSON.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { articleSlug } from '../../src/utils/helpers'

const OWNER = 'alexandchow@gmail.com'
const MODEL = 'claude-sonnet-4-6'
const URL   = 'https://www.ratednews.com'

const SYSTEM = `You are the social content desk for RatedNews (${URL}) — a community-rated news aggregator.

WHAT WE DO
- Show the same story across many outlets so readers can compare how it's framed.
- Let signed-in readers rate how much they TRUST each outlet.
- Trust is community-driven. There is NO AI scoring and NO editorial verdict from us.
- Early product: not enough ratings yet to show scores. NEVER invent, cite, or imply a trust score, percentage, or ranking. The rating is the call-to-action, not the payload.

THE JOB — the story is the content
- Write posts the way the best breaking-news accounts do: lead with WHAT HAPPENED in plain, confident words, then 2-3 concrete beats — numbers, places, names, quotes — pulled from the provided headlines and summaries. Short sentences. Line breaks between beats. Present tense where natural.
- Model: "Huge roof collapse at BJ's Wholesale Club in Ocean Township, NJ — a 50 ft section came down into the bakery area. Gas leak on scene, crews shutting off power and water. No injuries reported so far." That's the bar: to the point, informative, alive.
- Media-framing commentary is seasoning, not the format. Only contrast coverage when two headlines genuinely clash in a way a stranger would find striking — and then quote both verbatim.

VOICE
- Direct, informative, human. A touch of natural reaction is welcome on light stories ("the footage is wild") — NEVER on death, tragedy or suffering; those get a straight, sober telling.
- No anchor clichés ("developing story", "here's what we know so far"), no hashtag spam, no memes or references that need decoding.
- Don't just stack facts — give the post ONE pulse of energy: a hook line, a beat of tension, or a detail so specific it does the work ("Tickets at $60K" is good; make the reader FEEL the $60K). A list of facts with no angle is a wire feed, not a post.

EMOJIS — energy, deployed with judgment
- Use 1-3 emojis on light and neutral stories: sport, entertainment, business, tech, politics-as-theatre. Lead beat gets one (🚨 breaking, ⚽ football, 🏆 finals, 💰 money, 🔥 heat, 🗳️ polls/elections, 📉📈 markets), and one mid-post where it lands naturally. They mark the beats, not decorate every line.
- ZERO emojis on death, war, tragedy, disaster or suffering — a sober story gets sober typography. (A 🚨 on troops killed reads as monetised grief. Never.)
- Never two emojis adjacent, never one per line as bullet decoration, never replacing a word ("⚽ final" not "the ⚽").
- Poll posts: one emoji max, in the question, only if it sharpens the vote.

BANNED CONSTRUCTIONS — tired templates, never use them
- "X outlets, X angles" / "Five outlets, five headlines" or ANY headcount opener.
- "Same story, different [anything]" openers.
- Aphoristic sign-offs ("One summit. Very different rooms.").
- NEVER state a number of outlets/angles/sources you counted yourself — models miscount. The ONLY source count you may mention is the exact figure provided in the input, used verbatim.

CLARITY — the reader is a stranger scrolling fast with ZERO context
- Name the story explicitly — what happened, who, where — in the first line.
- When you quote a headline, quote it VERBATIM with its outlet name. Never paraphrase into fragments.
- Every post must be postable EXACTLY as written — zero edits, zero ambiguity.

POLLS — one line, instantly voteable
- A poll post is ONE line: a sharp, self-contained question a stranger can vote on in two seconds. The news post carries the story; the poll must NOT re-tell it.
- Fold any needed context into the question itself ("FIFA bent its rules after one Trump call — who do you trust to cover it straight?"). No recap paragraphs, no links, no "rate your sources" boilerplate — the poll IS the engagement.
- poll_options: two outlet names, X caps options at 25 characters.

LENGTH — concise by default
- The account has X Premium, so there is no hard character wall — but short still wins the timeline. Aim for ≤ 280 characters; a tight 180 beats a rambling 400.
- You MAY run past 280 when the content genuinely earns it — typically a coverage spread where quoting 2-3 headlines verbatim is the whole point. Even then: HARD ceiling 600 characters including any link. If a draft runs past, drop a headline or cut your own commentary — never both-and.
- Two or three quoted headlines maximum. Your own words around them: a one-line opener and a two-line-max closer.
- Never pad. Every sentence must be pulling weight.

CTA & links — keep it un-salesy
- The observation IS the post. A rating nudge is OPTIONAL and, when present, must read as a dry aside — never a marketing sign-off.
- X posts ("text") contain NO links, NO URLs, EVER. Not the story link, not the homepage — nothing. X suppresses link posts and charges 13x to publish them; the post must stand entirely on its own. Do NOT end with a call to action or boilerplate like "Rate your sources at ${URL}".
- The story-specific coverage-page link goes ONLY in the Bluesky "short" variant.

BLUESKY VARIANT — every non-poll post also gets a short version
- "short": the same post rewritten for Bluesky's HARD 300-character limit INCLUDING the link. Over 300 will not send — this is a platform rejection, not a style preference.
- The Bluesky variant SHOULD carry the story's coverage-page link (links are welcome on Bluesky) — drop it plainly on its own line, no salesy verb attached. Use the story-specific link, never the bare homepage.
- Do the arithmetic: the story links are ~95-100 characters, plus 2 for spacing. With a link, your WORDS get at most 190 characters. If the post can't work in 190 words-characters, DROP THE LINK — a self-contained 280 beats an over-limit 340.
- Budget shape that fits: one line naming the event, ONE short verbatim headline quote, one clipped observation. That's all 300 allows. Characterise other outlets in 3-4 words or not at all.
- It must stand alone as a complete post, not read like a cut-down.
- Polls are X-only (Bluesky has no polls) — omit "short" for poll posts.

Output STRICT JSON only — no markdown, no prose around it:
{"posts":[
  {"type":"news|coverage_contrast|poll|media_literacy","platform":"x","story":"<2-4 word story label>","text":"<ready-to-post copy>","short":"<Bluesky version ≤300 chars — omit for polls>","poll_options":["A","B"]?,"why":"<one line>"}
]}`

// ── Trending story selection — same cross-outlet signal as the feed ──────────
async function trendingStories() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  // 12h window — yesterday's stories aren't candidates. The old 36h window let
  // day-old stories out-accumulate anything actually breaking.
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, summary, category, published_at, cluster_id, outlets(name)')
    .not('cluster_id', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(600)
  if (error) throw error

  // Group by cluster; one headline per distinct outlet — that's the spread.
  // The first article seen per cluster is the newest → use it for the story link.
  const now = Date.now()
  const clusters = new Map()
  for (const a of data || []) {
    const name = a.outlets?.name
    if (!name) continue
    if (!clusters.has(a.cluster_id)) clusters.set(a.cluster_id, { headlines: [], outlets: new Set(), category: a.category, newest: a.published_at, oldest: a.published_at, storyUrl: `${URL}/story/${articleSlug(a.title, a.id)}` })
    const c = clusters.get(a.cluster_id)
    if (a.published_at < c.oldest) c.oldest = a.published_at
    if (!c.outlets.has(name)) {
      c.outlets.add(name)
      c.headlines.push({ outlet: name, title: a.title, summary: (a.summary || '').slice(0, 220) })
    }
  }

  // Heat = coverage VELOCITY: outlets per hour since first coverage, decayed
  // by the age of the newest article. A 6-outlet story 40 minutes old (~9/hr,
  // accelerating NOW) outranks an 18-outlet story 5 hours old (~3.6/hr,
  // saturated — the timeline has moved on). The floor on firstAgeH stops
  // 10-minute-old stories dividing by ~zero and swamping everything.
  for (const c of clusters.values()) {
    const newestAgeH = Math.max(0, (now - new Date(c.newest)) / 3600000)
    const firstAgeH  = Math.max(0.75, (now - new Date(c.oldest)) / 3600000)
    const firstAgeMin = (now - new Date(c.oldest)) / 60000
    const spreadMin   = (new Date(c.newest) - new Date(c.oldest)) / 60000
    // Breaking: 2+ outlets, first coverage under 60 min old, AND genuine
    // independent pickup. Two outlets publishing the same minute is a
    // syndication pair (SMH/The Age etc), not breaking — real cross-outlet
    // pickup takes minutes to spread. 3+ outlets is inherently independent.
    const independent = c.outlets.size >= 3 || spreadMin >= 10
    c.breaking = independent && c.outlets.size >= 2 && firstAgeMin <= 60
    c.heat = (c.outlets.size / firstAgeH) * 10 / Math.pow(newestAgeH + 1, 1.2)
  }

  // One slot per saga: big running stories fragment into several clusters
  // (the ban, the phone call, the appeal…) and would otherwise fill every
  // slot. Collapse clusters sharing 3+ significant title tokens — the saga
  // keeps one slot (its highest-coverage development), the rest go to
  // genuinely different stories.
  const STOP = new Set(['the','a','an','in','on','at','to','for','of','and','or','is','are','was','were','says','say','said','after','as','with','by','from','over','into','its','his','her','their','will','have','has','had','been','be','but','not','this','that','than','then'])
  const sig = c => {
    const t = new Set()
    for (const h of c.headlines) {
      for (const w of (h.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
        if (w.length > 3 && !STOP.has(w)) t.add(w)
      }
    }
    return t
  }
  const overlaps = (a, b) => {
    let shared = 0
    for (const w of a) if (b.has(w)) { shared++; if (shared >= 3) return true }
    return false
  }

  // ── Run-to-run memory: don't re-serve a story the desk already showed ─────
  // unless it has genuinely developed. Seen stories from the last 24h live in
  // social_drafts as {kind:'seen_stories'} packs (service role bypasses RLS).
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null
  const seen = [] // [{tokens:Set, clusterId, outlets, newest, at}]
  if (svc) {
    const seenSince = new Date(now - 24 * 60 * 60 * 1000).toISOString()
    const { data: packs } = await svc.from('social_drafts')
      .select('created_at, pack').gte('created_at', seenSince)
      .order('created_at', { ascending: false }).limit(40)
    for (const p of packs || []) {
      if (p.pack?.kind !== 'seen_stories') continue
      for (const s of p.pack.stories || []) {
        seen.push({ tokens: new Set(s.tokens || []), clusterId: s.cluster_id, outlets: s.outlets || 0, newest: s.newest, at: p.created_at })
      }
    }
  }

  for (const [clusterId, c] of clusters) {
    c.clusterId = clusterId
    c.tokens = sig(c)
    // Newest-first packs → the first match is this story's latest appearance.
    const prev = seen.find(s => s.clusterId === clusterId || overlaps(c.tokens, s.tokens))
    if (!prev) continue
    const seenAgeH = (now - new Date(prev.at)) / 3600000
    const hasNewCoverage = c.newest > prev.newest
    const grown = c.outlets.size - prev.outlets >= 3 || c.outlets.size >= prev.outlets * 1.5
    if (!hasNewCoverage && seenAgeH < 3) {
      c.heat = -1 // shown recently, nothing new since — drop it
    } else {
      // Story continues: allow it back as an UPDATE. Genuine escalation
      // (coverage jump) keeps full heat; a slow drip gets demoted so fresh
      // stories outrank re-runs.
      if (!grown) c.heat /= 3
      c.update = ago(prev.at)
    }
  }

  // Qualify on 3+ outlets as before, OR the breaking tier (2 outlets, <60 min
  // old). Rank purely by heat — velocity with freshness decay.
  const sorted = [...clusters.values()]
    .filter(c => (c.outlets.size >= 3 || c.breaking) && c.heat > 0)
    .sort((x, y) => y.heat - x.heat)
  const selected = []
  const tokenSets = []
  for (const c of sorted) {
    const isSameSaga = tokenSets.some(prev => overlaps(c.tokens, prev))
    if (isSameSaga) continue
    selected.push(c)
    tokenSets.push(c.tokens)
    if (selected.length === 5) break
  }

  // Log this run's stories so the next run knows what's been served.
  if (svc && selected.length) {
    const stories = selected.map(c => ({ cluster_id: c.clusterId, tokens: [...c.tokens].slice(0, 40), outlets: c.outlets.size, newest: c.newest }))
    svc.from('social_drafts').insert({ pack: { kind: 'seen_stories', stories } }).then(() => {})
    // Opportunistic prune of memory packs older than 48h
    svc.from('social_drafts').delete().eq('pack->>kind', 'seen_stories')
      .lt('created_at', new Date(now - 48 * 60 * 60 * 1000).toISOString()).then(() => {})
  }
  return selected
}

// "2h ago" / "40m ago" — compact age labels for the prompt and desk UI
function ago(ts) {
  const min = Math.max(0, Math.round((Date.now() - new Date(ts)) / 60000))
  return min < 60 ? `${min}m ago` : `${Math.round(min / 60 * 10) / 10}h ago`
}

function trendingPrompt(stories) {
  const blocks = stories.map((c, i) => {
    const lines = c.headlines.slice(0, 6).map(h => `  - ${h.outlet}: "${h.title}"${h.summary ? `\n    detail: ${h.summary}` : ''}`).join('\n')
    const timing = `first covered ${ago(c.oldest)} · latest ${ago(c.newest)}`
    const update = c.update ? ` ↻ UPDATE (this story already ran in a batch ${c.update})` : ''
    return `STORY ${i + 1}${c.category ? ` (${c.category})` : ''}${c.breaking ? ' ⚡ BREAKING' : ''}${update} — covered by exactly ${c.outlets.size} outlets (the ONLY source count you may quote) — ${timing}:\n${lines}\n  Coverage page (Bluesky "short" variant ONLY — never in the X text): ${c.storyUrl}`
  }).join('\n\n')
  const postCount = stories.length + 1
  return `These are the ${stories.length} hottest stories on RatedNews RIGHT NOW, ranked by how fast cross-outlet coverage is accelerating — freshest heat first, not yesterday's totals:

${blocks}

Draft ${postCount} posts:
- One "news" post per story: report the story itself the way a top breaking-news account would — lead with what happened, concrete details from the headlines and summaries, short lines. NO link in the X text (the coverage-page link goes only in the Bluesky "short").
- Stories marked ⚡ BREAKING are minutes old and still developing: frame them accordingly — present tense, "early reports" hedging where facts may still move, NO definitive casualty figures or outcomes unless every headline agrees. Being early is the point; being wrong isn't.
- Stories marked ↻ UPDATE already ran as posts in an earlier batch — the reader has seen the story. Write it as an UPDATE the way a breaking-news account follows up: lead with what's NEW since (new numbers, escalation, resolution, official response), reference the story itself in half a sentence at most. Never re-tell it from the top.
- One "poll" post for whichever story has the most genuinely split coverage: ONE line, instantly voteable, no recap, no link (poll_options = two outlet names from that story).
Use "coverage_contrast" INSTEAD of "news" for at most one story, and only if two of its verbatim headlines clash so hard a stranger would stop scrolling. Never force it.

Order your posts array by story order — STORY 1 first. Stories are ranked by coverage acceleration, so the first post is the one to publish RIGHT NOW while it's still moving; late-batch stories are context plays. The poll goes last.

Label every post's "story" field. Vary structure across the batch — no shared template, no shared closers.

Return the JSON only.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Owner-only auth
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (authErr || !user || user.email !== OWNER) return res.status(403).json({ error: 'Forbidden' })

  const isTrending = req.body?.trending === true
  const headlines  = (req.body?.headlines || '').toString().trim()
  const steer      = (req.body?.steer || '').toString().trim().slice(0, 300)
  if (!isTrending && !headlines) return res.status(400).json({ error: 'Paste at least one headline.' })
  if (headlines.length > 4000) return res.status(400).json({ error: 'Too much text — trim it down.' })

  const steerBlock = steer
    ? `\n\nThe owner wants this specific angle/tone — honour it (while keeping the one hard neutrality line intact): "${steer}"`
    : ''

  try {
    let userPrompt
    if (isTrending) {
      const stories = await trendingStories()
      if (!stories.length) return res.status(200).json({ posts: [], note: 'No strongly cross-covered stories in the last 36h.' })
      userPrompt = trendingPrompt(stories) + steerBlock
    } else {
      userPrompt = `Here is the headline(s) to work from:\n\n${headlines}${steerBlock}\n\nReturn the JSON only.`
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 5000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const start = text.indexOf('{'), end = text.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Bad model output')
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed.posts) || !parsed.posts.length) throw new Error('No posts returned')

    // Deterministic repair: models miscount characters. If a Bluesky short
    // busts the hard 300 limit and ends with a link, drop the link — the long
    // X version carries it, and a linkless post that sends beats one that
    // gets rejected by the platform.
    for (const p of parsed.posts) {
      if (typeof p.short === 'string' && p.short.length > 300) {
        const stripped = p.short.replace(/\s*https?:\/\/\S+\s*$/, '').trim()
        if (stripped.length <= 300) p.short = stripped
      }
    }

    return res.status(200).json({ posts: parsed.posts })
  } catch (err) {
    console.error('[social-compose]', err)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
