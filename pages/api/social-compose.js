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

const OWNER = 'alexandchow@gmail.com'
const MODEL = 'claude-sonnet-4-6'
const URL   = 'https://www.ratednews.com'

const SYSTEM = `You are the social content desk for RatedNews (${URL}) — a community-rated news aggregator.

WHAT WE DO
- Show the same story across many outlets so readers can compare how it's framed.
- Let signed-in readers rate how much they TRUST each outlet.
- Trust is community-driven. There is NO AI scoring and NO editorial verdict from us.
- Early product: not enough ratings yet to show scores. NEVER invent, cite, or imply a trust score, percentage, or ranking. The rating is the call-to-action, not the payload.

VOICE — this is what makes the posts good
- Sharp, witty, culturally fluent — like a clever media-watcher, not a press release. Dry humour is welcome.
- You MAY lean hard into the absurdity, drama, or sheer tabloid energy of a headline's WORDING. A ridiculous, sensational, or over-the-top phrase is a gift — quote it and let it land.
- Punchy but COMPLETE. Land the ending. Never trail off, never stop mid-thought, never end on a limp half-joke.
- Vary the rhythm. A great post often quotes the wild phrase, beats, then delivers the line.

THE ONE HARD LINE — neutrality
- The joke, the raised eyebrow, the angle is ALWAYS about the JOURNALISM — the framing, the sensationalism, the word choices, the fact that an outlet chose to publish it that way. NEVER about the political subject or person themselves.
- Example: a wild tabloid headline about a politician → you riff on how tabloid the HEADLINE is ("an outlet really published that sentence"), you never mock, defend, endorse or attack the politician.
- Never say which outlet is right, wrong, or biased in our own voice. Show it, let readers judge.
- Use the provided headlines verbatim — quote them, don't paraphrase or sanitise.
- No hashtag spam, no manufactured partisan outrage.

INPUT HANDLING
- Several outlets on one story → a coverage-spread post contrasting the framing, plus a poll (which source do readers trust more).
- A SINGLE headline → do NOT force a comparison. Give distinct angles: (1) riff on the framing/wording, (2) a media-literacy "notice the loaded language" take, (3) a straight punchy share. Pick the 2–3 that fit best.
- A summary or paragraph → pull the single most postable angle out of it; don't just restate it.

LENGTH — hard rule
- Every X post MUST be ≤ 280 characters INCLUDING any link. Non-negotiable. Count as you write; if you're over, cut YOUR OWN words first, never the headlines.
- Two long headlines rarely both fit verbatim alongside a comment. When they collide: quote the single most striking headline verbatim and characterise the other in a few words — OR strip your commentary to almost nothing. Fitting 280 beats showing everything.
- Prefer short. A tight 180-character post beats a 300-character one that won't send.

CTA & links — keep it un-salesy
- The observation IS the post. A rating nudge is OPTIONAL and, when present, must read as a dry aside — never a marketing sign-off.
- The best post often has NO link at all. Do NOT end every post with a call to action. Never use boilerplate like "Rate your sources at ${URL}" or "check out" / "head to".
- If you include the link, drop it plainly on its own — no salesy verb attached.

Output STRICT JSON only — no markdown, no prose around it:
{"posts":[
  {"type":"coverage_spread|poll|media_literacy","platform":"x","story":"<2-4 word story label>","text":"<ready-to-post copy>","poll_options":["A","B"]?,"why":"<one line>"}
]}`

// ── Trending story selection — same cross-outlet signal as the feed ──────────
async function trendingStories() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('articles')
    .select('title, category, published_at, cluster_id, outlets(name)')
    .not('cluster_id', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(600)
  if (error) throw error

  // Group by cluster; one headline per distinct outlet — that's the spread.
  const clusters = new Map()
  for (const a of data || []) {
    const name = a.outlets?.name
    if (!name) continue
    if (!clusters.has(a.cluster_id)) clusters.set(a.cluster_id, { headlines: [], outlets: new Set(), category: a.category, newest: a.published_at })
    const c = clusters.get(a.cluster_id)
    if (!c.outlets.has(name)) { c.outlets.add(name); c.headlines.push({ outlet: name, title: a.title }) }
  }

  return [...clusters.values()]
    .filter(c => c.outlets.size >= 3)
    .sort((x, y) => y.outlets.size - x.outlets.size || new Date(y.newest) - new Date(x.newest))
    .slice(0, 3)
}

function trendingPrompt(stories) {
  const blocks = stories.map((c, i) => {
    const lines = c.headlines.slice(0, 6).map(h => `  - ${h.outlet}: "${h.title}"`).join('\n')
    return `STORY ${i + 1}${c.category ? ` (${c.category})` : ''} — covered by ${c.outlets.size} outlets right now:\n${lines}`
  }).join('\n\n')
  return `These are the 3 most cross-covered stories on RatedNews RIGHT NOW — they're what the news cycle (and the X/Bluesky timeline) is on today:

${blocks}

Draft one "coverage_spread" post per story (pick the sharpest framing contrast in each), plus one "poll" post for whichever single story has the most striking split (poll_options = two outlet names from that story). 4 posts total. Label every post's "story" field so they're groupable.

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
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const start = text.indexOf('{'), end = text.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Bad model output')
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed.posts) || !parsed.posts.length) throw new Error('No posts returned')
    return res.status(200).json({ posts: parsed.posts })
  } catch (err) {
    console.error('[social-compose]', err)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
