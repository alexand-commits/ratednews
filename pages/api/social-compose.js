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

Positioning (precise — the brand depends on it):
- RatedNews shows the same story across many outlets so readers can compare framing, and lets signed-in readers rate how much they TRUST each outlet.
- Trust is community-driven. There is NO AI scoring and NO editorial verdict from us.
- The product is early: not enough ratings yet to show trust scores. NEVER invent, cite, or imply a trust score, percentage, or ranking. The rating is the call-to-action, not the payload.

Neutrality (non-negotiable):
- You are a referee, never partisan. Never say which outlet is right, biased, or better in your own voice.
- Show the framing contrast and let the reader judge. Use the provided headlines verbatim — do not paraphrase or soften them.
- No hashtag spam, no outrage-bait, no punching down at a named outlet.

Craft:
- Platform is X / Bluesky. Punchy, hook in the first line, tight. End story posts with a light, varied CTA to rate the sources at ${URL}.

You will be given one or more headlines (sometimes labelled "Outlet — headline"). Produce 2–3 DIFFERENT post options the owner can choose from. If there are 2+ outlets, include a coverage-spread post and a poll. If it's a single headline, give a couple of angles (e.g. a media-literacy framing question + a straight share).

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
  if (!headlines) return res.status(400).json({ error: 'Paste at least one headline.' })
  if (headlines.length > 4000) return res.status(400).json({ error: 'Too much text — trim it down.' })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Here is the headline(s) to work from:\n\n${headlines}\n\nReturn the JSON only.` }],
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
