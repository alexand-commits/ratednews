/**
 * POST /api/social-agent
 * Streaming Claude-powered social media marketing agent for RatedNews.
 * Uses tool_use to pull live article data from Supabase before drafting posts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  )
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_trending_articles',
    description:
      'Fetch the top trending articles on RatedNews right now, sorted by view count. ' +
      'Returns title, outlet name, bias score, and a short summary.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'How many articles to return (max 10). Default 5.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_recent_articles',
    description:
      'Fetch the most recently published articles on RatedNews. ' +
      'Useful for content about fresh news.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'How many articles to return (max 10). Default 5.',
        },
        category: {
          type: 'string',
          description: 'Optional category filter e.g. "politics", "tech", "sports".',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_bias_stats',
    description:
      'Get aggregate bias statistics across RatedNews — average bias scores by outlet, ' +
      'most left-leaning and most right-leaning outlets, most-read outlets this week. ' +
      'Great for data-driven social posts about media bias.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

// ─── Tool implementations ────────────────────────────────────────────────────

async function executeTool(name, input) {
  const supabase = getSupabase()

  if (name === 'get_trending_articles') {
    const limit = Math.min(input.limit || 5, 10)
    const { data } = await supabase
      .from('articles')
      .select('title, outlet:outlets(name, bias_score), view_count, published_at, category')
      .order('view_count', { ascending: false })
      .limit(limit)
    return data || []
  }

  if (name === 'get_recent_articles') {
    const limit = Math.min(input.limit || 5, 10)
    let query = supabase
      .from('articles')
      .select('title, outlet:outlets(name, bias_score), published_at, category, view_count')
      .order('published_at', { ascending: false })
      .limit(limit)
    if (input.category) {
      query = query.ilike('category', `%${input.category}%`)
    }
    const { data } = await query
    return data || []
  }

  if (name === 'get_bias_stats') {
    const { data } = await supabase
      .from('outlets')
      .select('name, bias_score, article_count')
      .not('bias_score', 'is', null)
      .order('bias_score', { ascending: true })
      .limit(30)

    if (!data || !data.length) return { error: 'No outlet data available' }

    const sorted = [...data].sort((a, b) => (a.bias_score ?? 0) - (b.bias_score ?? 0))
    const avg =
      data.reduce((s, o) => s + (o.bias_score ?? 0), 0) / data.length

    return {
      total_outlets: data.length,
      average_bias_score: Math.round(avg * 10) / 10,
      most_left_leaning: sorted.slice(0, 3).map(o => ({ name: o.name, score: o.bias_score })),
      most_right_leaning: sorted.slice(-3).map(o => ({ name: o.name, score: o.bias_score })),
      center_outlets: sorted
        .filter(o => Math.abs(o.bias_score ?? 0) < 15)
        .slice(0, 5)
        .map(o => ({ name: o.name, score: o.bias_score })),
    }
  }

  return { error: `Unknown tool: ${name}` }
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM = `You are the social media marketing agent for RatedNews — a platform that helps \
people understand media bias and build a more balanced news diet.

Your job is to draft social media posts that are:
• Insightful and data-driven (lean on actual bias scores, article counts, trends)
• Sharply written — punchy, not fluffy
• Platform-appropriate in tone and format
• Honest about what RatedNews does (it rates news sources for bias, not individual articles)

Platform tone guide:
- Twitter/X: Punchy, max 280 chars, hook in the first line, use 1–2 relevant hashtags
- LinkedIn: Professional but conversational, 2–4 short paragraphs, subtle CTA, no excessive hashtags
- Instagram: Visual-first caption, emoji-friendly, 3–5 hashtags at the end, inspire curiosity

Always use the available tools to pull real data before drafting — posts grounded in real numbers \
perform better and build trust. If the user asks for multiple posts, draft all of them.

RatedNews URL: https://www.ratednews.com`

// ─── Handler ─────────────────────────────────────────────────────────────────

const ALLOWED_EMAIL = 'alexandchow@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // ── Auth: verify Supabase session and owner email ──
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const authClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (authErr || !user || user.email !== ALLOWED_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  // ──────────────────────────────────────────────────

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Streaming SSE response
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    let currentMessages = [...messages]
    let iterations = 0
    const MAX_ITERATIONS = 5

    // Agentic loop — Claude may call tools multiple times
    while (iterations++ < MAX_ITERATIONS) {
      const stream = await client.messages.stream({
        model: 'claude-opus-4-7',
        max_tokens: 2048,
        system: SYSTEM,
        tools: TOOLS,
        messages: currentMessages,
      })

      let fullText = ''
      let currentToolUse = null
      let toolUseBlocks = []
      let stopReason = null

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUse = { id: event.content_block.id, name: event.content_block.name, input: '' }
          }
        }

        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullText += event.delta.text
            send('text', { delta: event.delta.text })
          }
          if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.input += event.delta.partial_json
          }
        }

        if (event.type === 'content_block_stop' && currentToolUse) {
          try {
            currentToolUse.input = JSON.parse(currentToolUse.input || '{}')
          } catch {
            currentToolUse.input = {}
          }
          toolUseBlocks.push({ ...currentToolUse })
          currentToolUse = null
        }

        if (event.type === 'message_delta') {
          stopReason = event.delta.stop_reason
        }
      }

      // If Claude wants to use tools, execute them and loop
      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        send('tool_call', { tools: toolUseBlocks.map(t => t.name) })

        // Build assistant message with all content blocks
        const assistantContent = []
        if (fullText) assistantContent.push({ type: 'text', text: fullText })
        for (const t of toolUseBlocks) {
          assistantContent.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input })
        }

        // Execute all tools in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async t => {
            const result = await executeTool(t.name, t.input)
            return {
              type: 'tool_result',
              tool_use_id: t.id,
              content: JSON.stringify(result),
            }
          }),
        )

        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: assistantContent },
          { role: 'user', content: toolResults },
        ]

        toolUseBlocks = []
        continue // loop back to call Claude again with tool results
      }

      // Done — Claude finished with end_turn
      send('done', {})
      break
    }
  } catch (err) {
    console.error('[social-agent]', err)
    send('error', { message: err.message || 'Agent error' })
  } finally {
    res.end()
  }
}
