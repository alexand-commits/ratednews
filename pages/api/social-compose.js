/**
 * POST /api/social-compose  (owner-only)
 * On-demand social post generator. Two modes:
 *   { headlines: string, steer?: string } — compose from pasted headlines.
 *   { trending: true, steer?: string }    — server picks the 3 most-covered
 *     stories from the last 36h (cross-outlet clusters) and drafts posts per
 *     story, timed to ride what's hot on X/Bluesky right now.
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
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
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
  const clusters = new Map()
  for (const a of data || []) {
    const name = a.outlets?.name
    if (!name) continue
    if (!clusters.has(a.cluster_id)) clusters.set(a.cluster_id, { headlines: [], outlets: new Set(), category: a.category, newest: a.published_at, storyUrl: `${URL}/story/${articleSlug(a.title, a.id)}` })
    const c = clusters.get(a.cluster_id)
    if (!c.outlets.has(name)) { c.outlets.add(name); c.headlines.push({ outlet: name, title: a.title, summary: (a.summary || '').slice(0, 220) }) }
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
  const sorted = [...clusters.values()]
    .filter(c => c.outlets.size >= 3)
    .sort((x, y) => y.outlets.size - x.outlets.size || new Date(y.newest) - new Date(x.newest))
  const selected = []
  const tokenSets = []
  for (const c of sorted) {
    const t = sig(c)
    const isSameSaga = tokenSets.some(prev => {
      let shared = 0
      for (const w of t) if (prev.has(w)) { shared++; if (shared >= 3) return true }
      return false
    })
    if (isSameSaga) continue
    selected.push(c)
    tokenSets.push(t)
    if (selected.length === 3) break
  }
  return selected
}

function trendingPrompt(stories) {
  const blocks = stories.map((c, i) => {
    const lines = c.headlines.slice(0, 6).map(h => `  - ${h.outlet}: "${h.title}"${h.summary ? `\n    detail: ${h.summary}` : ''}`).join('\n')
    return `STORY ${i + 1}${c.category ? ` (${c.category})` : ''} — covered by exactly ${c.outlets.size} outlets (the ONLY source count you may quote):\n${lines}\n  Coverage page (Bluesky "short" variant ONLY — never in the X text): ${c.storyUrl}`
  }).join('\n\n')
  return `These are the 3 most cross-covered stories on RatedNews RIGHT NOW — they're what the news cycle (and the X/Bluesky timeline) is on today:

${blocks}

Draft 4 posts:
- One "news" post per story: report the story itself the way a top breaking-news account would — lead with what happened, concrete details from the headlines and summaries, short lines. NO link in the X text (the coverage-page link goes only in the Bluesky "short").
- One "poll" post for whichever story has the most genuinely split coverage: ONE line, instantly voteable, no recap, no link (poll_options = two outlet names from that story).
Use "coverage_contrast" INSTEAD of "news" for at most one story, and only if two of its verbatim headlines clash so hard a stranger would stop scrolling. Never force it.

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
      max_tokens: 3000,
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
