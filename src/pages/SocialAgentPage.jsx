import { useState, useRef, useEffect } from 'react'
import { db } from '../lib/supabase'

const QUICK_PROMPTS = [
  { label: '🔥 Trending now', prompt: 'Draft a Twitter/X post and a LinkedIn post about what\'s trending on RatedNews right now. Pull the actual data first.' },
  { label: '📊 Bias insight', prompt: 'Create an insight post about media bias patterns on our platform. Use the real bias stats to make it data-driven. Draft versions for Twitter/X and LinkedIn.' },
  { label: '📅 Weekly content', prompt: 'Draft a 5-post Twitter/X content calendar for this week. Mix platform promotion, bias education, and trending articles. Make each post standalone.' },
  { label: '🎯 Instagram caption', prompt: 'Write an Instagram caption that highlights what RatedNews does and why it matters. Should be visually descriptive, 3–5 hashtags, inspire curiosity.' },
  { label: '🗞️ Recent articles', prompt: 'Pull 5 recent articles from RatedNews and write a Twitter/X thread (numbered tweets) connecting them with a media literacy angle.' },
]

function ToolCallBadge({ tools }) {
  if (!tools?.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {tools.map(t => (
        <span key={t} style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 99,
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          color: 'var(--text3)', fontFamily: 'monospace',
        }}>
          ⚙ {t.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  )
}

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{
          maxWidth: '70%', background: 'var(--coral)', color: '#fff',
          borderRadius: '18px 18px 4px 18px', padding: '10px 14px',
          fontSize: 14, lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <div style={{ maxWidth: '85%' }}>
        <ToolCallBadge tools={msg.toolCalls} />
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: '18px 18px 18px 4px', padding: '12px 16px',
          fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
          color: 'var(--text)',
        }}>
          {msg.content || (
            <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>
              ✦ thinking…
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SocialAgentPage({ navigate, goBack }) {
  const [messages, setMessages] = useState([])   // {role, content, toolCalls?}
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return

    const newUserMsg = { role: 'user', content: userText }

    // Optimistically add user message + placeholder for assistant
    setMessages(prev => [...prev, newUserMsg, { role: 'assistant', content: '', toolCalls: [] }])
    setInput('')
    setLoading(true)

    // Build messages array for API (exclude the placeholder)
    const apiMessages = [
      ...messages,
      newUserMsg,
    ].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() // incomplete last line

        let eventType = null
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6))

              if (eventType === 'text') {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = { ...updated[updated.length - 1] }
                  last.content = (last.content || '') + payload.delta
                  updated[updated.length - 1] = last
                  return updated
                })
              }

              if (eventType === 'tool_call') {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = { ...updated[updated.length - 1] }
                  last.toolCalls = [...(last.toolCalls || []), ...payload.tools]
                  updated[updated.length - 1] = last
                  return updated
                })
              }

            } catch { /* ignore parse errors */ }
            eventType = null
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        const last = { ...updated[updated.length - 1] }
        last.content = '⚠ Something went wrong. Try again.'
        updated[updated.length - 1] = last
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '0.5px solid var(--border)',
        padding: '0 16px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text2)', fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Social Agent</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Powered by Claude · RatedNews</div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        {isEmpty ? (
          <div style={{ paddingTop: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Your marketing agent
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
                Ask me to draft posts, write a content calendar, or pull trending articles for social content.
              </div>
            </div>

            {/* Quick prompt chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, margin: '0 auto' }}>
              {QUICK_PROMPTS.map(qp => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  style={{
                    textAlign: 'left', padding: '10px 14px',
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                    borderRadius: 12, cursor: 'pointer', fontSize: 13,
                    color: 'var(--text)', fontWeight: 500,
                    transition: 'border-color 0.15s',
                  }}
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        <div ref={bottomRef} style={{ height: 16 }} />
      </div>

      {/* Input bar */}
      <div style={{
        position: 'sticky', bottom: 0,
        background: 'var(--bg)', borderTop: '0.5px solid var(--border)',
        padding: '10px 16px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '8px 8px 8px 14px',
        }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Draft a tweet about media bias trends…"
            disabled={loading}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              background: 'transparent', fontSize: 14, color: 'var(--text)',
              lineHeight: 1.5, fontFamily: 'inherit', overflow: 'hidden',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: !input.trim() || loading ? 'var(--border)' : 'var(--coral)',
              border: 'none', cursor: !input.trim() || loading ? 'default' : 'pointer',
              color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>
          Pulls live data from RatedNews · Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
