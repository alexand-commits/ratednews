/**
 * POST /api/social-compose  (owner-only)
 * On-demand social post generator. Body: { headlines: string }
 * The owner pastes a headline or several (optionally "Outlet — headline" per
 * line) and gets back a few ready-to-post options. Non-streaming JSON.
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

CTA: end story posts with a light, varied nudge to rate the source at ${URL}. Not every option needs the link — don't make it formulaic.

Output STRICT JSON only — no markdown, no prose around it:
{"posts":[
  {"type":"coverage_spread|poll|media_literacy","platform":"x","text":"<ready-to-post copy>","poll_options":["A","B"]?,"why":"<one line>"}
]}`

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

  const headlines = (req.body?.headlines || '').toString().trim()
  const steer     = (req.body?.steer || '').toString().trim().slice(0, 300)
  if (!headlines) return res.status(400).json({ error: 'Paste at least one headline.' })
  if (headlines.length > 4000) return res.status(400).json({ error: 'Too much text — trim it down.' })

  const steerBlock = steer
    ? `\n\nThe owner wants this specific angle/tone — honour it (while keeping the one hard neutrality line intact): "${steer}"`
    : ''

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Here is the headline(s) to work from:\n\n${headlines}${steerBlock}\n\nReturn the JSON only.` }],
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
