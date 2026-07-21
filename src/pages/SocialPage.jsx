import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

const OWNER = 'alexandchow@gmail.com'

const TYPE_META = {
  news:              { label: 'News post',        emoji: '📰', color: 'var(--text2)' },
  coverage_contrast: { label: 'Coverage contrast', emoji: '🪞', color: 'var(--coral)' },
  coverage_spread: { label: 'Coverage spread', emoji: '🪞', color: 'var(--coral)' },
  poll:            { label: 'Poll',            emoji: '🗳️', color: 'var(--blue)' },
  media_literacy:  { label: 'Media literacy',  emoji: '🧠', color: 'var(--green-dark)' },
  roundup:         { label: 'Roundup',         emoji: '📰', color: 'var(--text2)' },
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
      style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, border: '0.5px solid var(--border)', background: copied ? 'var(--green)' : 'var(--surface)', color: copied ? '#fff' : 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// Two-tap publish: first tap arms ("Sure?"), second posts. Disarms after 4s.
// Nothing ships on a single stray click.
function PostButton({ platform, text, pollOptions, imageUrl, imageAlt, label, color }) {
  const [state, setState] = useState('idle') // idle | armed | busy | done | error
  const [url, setUrl]     = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state !== 'armed') return
    const t = setTimeout(() => setState('idle'), 4000)
    return () => clearTimeout(t)
  }, [state])

  async function fire() {
    setState('busy'); setError('')
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ platform, text, pollOptions, imageUrl, imageAlt }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Post failed')
      setUrl(json.url); setState('done')
    } catch (e) {
      setError(e.message); setState('error')
    }
  }

  if (state === 'done') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: 'var(--green)', color: '#fff', textDecoration: 'none', flexShrink: 0 }}>
        ✓ Posted — view
      </a>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {state === 'error' && <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error}>{error}</span>}
      <button
        onClick={() => (state === 'armed' ? fire() : setState('armed'))}
        disabled={state === 'busy'}
        style={{
          fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
          border: `0.5px solid ${state === 'armed' ? color : 'var(--border)'}`,
          background: state === 'armed' ? color : 'var(--surface)',
          color: state === 'armed' ? '#fff' : color,
          cursor: state === 'busy' ? 'default' : 'pointer', flexShrink: 0,
        }}
      >
        {state === 'busy' ? 'Posting…' : state === 'armed' ? 'Sure? Tap to post' : label}
      </button>
    </span>
  )
}

// Slim editorial-context line — coverage size + timing + state flags.
function MetaLine({ post }) {
  if (!post.meta) return null
  return (
    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>
      {post.meta.outlets} outlets · first {post.meta.first}
      {post.meta.breaking ? ' · ⚡ breaking' : ''}
      {post.meta.liveEvent ? ' · 🔴 live event' : ''}
      {post.meta.update ? ' · ↻ update' : ''}
    </div>
  )
}

// Thumbnail of the drawn share card + attach toggle. Default on — the card
// is an upgrade; the toggle exists for the odd bad photo.
function CardPreview({ url, on, setOn }) {
  if (!url) return null
  return (
    <div style={{ marginTop: 10 }}>
      <img src={url} alt="share card preview" style={{ width: '100%', maxWidth: 420, borderRadius: 8, border: '0.5px solid var(--border)', opacity: on ? 1 : 0.35, display: 'block' }} />
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} />
        🎴 attach card to post
      </label>
    </div>
  )
}

function PostCard({ post }) {
  const meta = TYPE_META[post.type] || { label: post.type || 'Post', emoji: '✳️', color: 'var(--text2)' }
  const [withCard, setWithCard] = useState(true)
  const cardUrl = withCard && post.card ? post.card : undefined
  const cardAlt = post.meta?.title || post.story || ''

  const copyText = [
    post.text,
    post.poll_options?.length ? `\n\nPoll options:\n• ${post.poll_options.join('\n• ')}` : '',
  ].join('')

  return (
    <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color }}>
          {meta.emoji} {meta.label}
          {post.story ? <span style={{ color: 'var(--text2)', fontWeight: 600 }}> · {post.story}</span> : null}
          <span style={{ color: 'var(--text3)', fontWeight: 500 }}> · {post.type === 'poll' ? 'X only (no Bluesky polls)' : 'X'}</span>
        </span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <CopyButton text={copyText} />
          {/https?:\/\/|www\./i.test(post.text) ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber, #C98A08)' }} title="X charges 13x for URL posts and buries their reach — links live in the Bluesky variant. Regenerate for linkless X drafts.">
              🔗 has link — X posting off
            </span>
          ) : (
            <PostButton platform="x" text={post.text} pollOptions={post.poll_options} imageUrl={cardUrl} imageAlt={cardAlt} label={post.card ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />
          )}
        </span>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{post.text}</div>

      {typeof post.text === 'string' && (() => {
        const n = post.text.length
        const over = n > 280
        return (
          <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: over ? 'var(--amber, #C98A08)' : 'var(--text3)' }}>
            {n} chars{over ? ' · past 280 (fine on Premium)' : ''}
          </div>
        )
      })()}

      {/* Bluesky short variant — hard 300-char platform limit */}
      {typeof post.short === 'string' && post.short && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2E86EA' }}>🦋 Bluesky</span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <CopyButton text={post.short} />
              {post.short.length <= 300 && (
                <PostButton platform="bluesky" text={post.short} imageUrl={cardUrl} imageAlt={cardAlt} label="Post to Bluesky" color="#2E86EA" />
              )}
            </span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{post.short}</div>
          {(() => {
            const n = post.short.length
            const over = n > 300
            return (
              <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: over ? 'var(--red)' : 'var(--text3)' }}>
                {n} / 300{over ? ` · ${n - 300} over — trim before posting` : ''}
              </div>
            )
          })()}
        </div>
      )}

      {post.poll_options?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {post.poll_options.map((o, i) => (
            <div key={i} style={{ fontSize: 13, padding: '7px 12px', border: '0.5px solid var(--border)', borderRadius: 99, color: 'var(--text2)' }}>{o}</div>
          ))}
        </div>
      )}

      {post.why && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, fontStyle: 'italic' }}>Why: {post.why}</div>
      )}

      <MetaLine post={post} />
      <CardPreview url={post.card} on={withCard} setOn={setWithCard} />
    </div>
  )
}

// ── Post queue (main column) — autopilot scouts and drafts; the owner
// approves with the same two-tap buttons as the generators. Nothing publishes
// itself: the scout's job ends at the draft.
// One queue story: both platform variants, card preview + toggle, actions.
function QueueItem({ q, dismiss }) {
  const [withCard, setWithCard] = useState(true)
  const cardUrl = withCard && q.card ? q.card : undefined
  return (
    <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--coral)' }}>
          {q.live ? '✅ posted' : '🕐 drafted'} {timeAgo(q.at)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>· {q.story}</span>
        {q.url && <a href={q.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--coral)' }}>view →</a>}
        {!q.live && (
          <button
            onClick={() => dismiss(q.story)}
            title="Dismiss — removes this draft from the queue (the story won't be re-drafted)"
            style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'none', border: '0.5px solid var(--border)', borderRadius: 99, padding: '2px 10px', cursor: 'pointer' }}
          >
            ✕ Dismiss
          </button>
        )}
      </div>

      {q.x && (
        <>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{q.x}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{q.x.length} chars</span>
            <CopyButton text={q.x} />
            {!q.live && <PostButton platform="x" text={q.x} imageUrl={cardUrl} imageAlt={q.alt} label={q.card ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />}
          </div>
        </>
      )}

      {q.bluesky && (
        <div style={{ marginTop: q.x ? 12 : 0, paddingTop: q.x ? 12 : 0, borderTop: q.x ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: q.x ? 'var(--text2)' : 'var(--text)' }}>{q.bluesky}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: q.bluesky.length > 300 ? 'var(--red)' : 'var(--text3)' }}>{q.bluesky.length} / 300</span>
            <CopyButton text={q.bluesky} />
            {!q.live && q.bluesky.length <= 300 && <PostButton platform="bluesky" text={q.bluesky} imageUrl={cardUrl} imageAlt={q.alt} label="Post to Bluesky" color="#2E86EA" />}
          </div>
        </div>
      )}

      <CardPreview url={q.card} on={withCard} setOn={setWithCard} />
    </div>
  )
}

// A gated draft awaiting the owner's judgment — full text, reason, card, actions.
function JudgmentItem({ p, dismiss }) {
  const [withCard, setWithCard] = useState(true)
  const cardUrl = withCard && p.card ? p.card : undefined
  return (
    <div style={{ background: 'var(--bg)', border: '0.5px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)' }}>
          {(TYPE_META[p.type] || {}).emoji || '✳️'} {p.story}
        </span>
        <span style={{ fontSize: 10, color: 'var(--amber, #C98A08)', fontWeight: 600 }} title={`X: ${p.x} · Bluesky: ${p.bluesky}`}>
          {p.x === p.bluesky ? p.x : `X: ${p.x}`}
        </span>
        <button
          onClick={() => dismiss(p.story)}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'none', border: '0.5px solid var(--border)', borderRadius: 99, padding: '2px 10px', cursor: 'pointer' }}
        >
          ✕ Dismiss
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{p.text}</div>
      {p.poll_options?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {p.poll_options.map((o, k) => (
            <span key={k} style={{ fontSize: 12, padding: '4px 12px', border: '0.5px solid var(--border)', borderRadius: 99, color: 'var(--text2)' }}>{o}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{(p.text || '').length} chars</span>
        <CopyButton text={p.text} />
        {!/https?:\/\/|www\./i.test(p.text || '') && (
          <PostButton platform="x" text={p.text} pollOptions={p.poll_options || undefined} imageUrl={p.poll_options?.length ? undefined : cardUrl} imageAlt={p.story} label={p.card && !p.poll_options?.length ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />
        )}
      </div>
      {p.short && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>{p.short}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: p.short.length > 300 ? 'var(--red)' : 'var(--text3)' }}>{p.short.length} / 300</span>
            <CopyButton text={p.short} />
            {p.short.length <= 300 && <PostButton platform="bluesky" text={p.short} imageUrl={cardUrl} imageAlt={p.story} label="Post to Bluesky" color="#2E86EA" />}
          </div>
        </div>
      )}
      <CardPreview url={p.card} on={withCard} setOn={setWithCard} />
    </div>
  )
}

function AutopilotFeed({ state }) {
  const [localDismissed, setLocalDismissed] = useState([])

  if (!state || state.error || !state.configured) return null

  async function dismiss(story) {
    setLocalDismissed(prev => [...prev, story]) // optimistic
    try {
      const { data: { session } } = await db.auth.getSession()
      await fetch('/api/social-auto', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ story }),
      })
    } catch {}
  }

  const hidden = new Set([...(state.dismissed || []).map(d => d.story), ...localDismissed])

  // Build the queue: newest drafts first, one card per story, last 12h only.
  const QUEUE_MAX_AGE_H = 24 * 7 // queue persists until dismissed/posted; runs are kept 7 days
  const queue = []
  const seenStories = new Set()
  for (const r of state.runs) { // runs arrive newest-first
    const entries = [...(r.posted || []).map(p => ({ ...p, live: true })), ...(r.wouldPost || [])]
    const byStory = new Map()
    for (const p of entries) {
      if (!byStory.has(p.story)) byStory.set(p.story, { story: p.story, at: r.at, x: null, bluesky: null, url: null, live: false, card: null, alt: '' })
      const g = byStory.get(p.story)
      g[p.platform] = p.text
      if (p.card) { g.card = p.card; g.alt = p.alt || p.story }
      if (p.live) { g.live = true; g.url = p.url || g.url }
    }
    for (const [story, g] of byStory) {
      if (seenStories.has(story)) continue
      seenStories.add(story)
      if (hidden.has(story)) continue
      if ((Date.now() - new Date(g.at)) / 3600000 <= QUEUE_MAX_AGE_H) queue.push(g)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📥 Post queue</div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          the scout drafts, you decide — it never posts itself
        </span>
        {state.heartbeat && (
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }} title={state.heartbeat.last_result || ''}>
            ● last checked {timeAgo(state.heartbeat.at)} · {state.heartbeat.checks_today} check{state.heartbeat.checks_today === 1 ? '' : 's'} today
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        Drafts land here within ~15 min of a story surging and stay until you post or dismiss them. Two taps to publish; ✕ to bin.
      </div>

      {queue.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
          Queue is clear — drafts stay here until you post or dismiss them.
          {state.heartbeat ? ` Last check ${timeAgo(state.heartbeat.at)}: ${state.heartbeat.last_result || 'nothing new'}.` : ' The scout keeps watching.'}
        </div>
      ) : queue.slice(0, 8).map((q, i) => <QueueItem key={q.story + i} q={q} dismiss={dismiss} />)}

      {/* Manual-call drafts — fully written, gated for judgment not hidden. */}
      {(() => {
        const isActed = v => v === 'ok' || v === 'POSTED' || String(v || '').startsWith('WOULD POST')
        const manual = []
        const seen = new Set(seenStories)
        for (const r of state.runs) {
          for (const p of r.posts || []) {
            if (seen.has(p.story) || hidden.has(p.story)) continue
            if (isActed(p.x) || isActed(p.bluesky)) continue
            if ((Date.now() - new Date(r.at)) / 3600000 > QUEUE_MAX_AGE_H) continue
            seen.add(p.story)
            manual.push({ ...p, at: r.at })
          }
        }
        if (!manual.length) return null
        return (
          <div style={{ marginTop: 4, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', margin: '10px 0 8px' }}>
              🖐 Your call — drafted, but gated for judgment
            </div>
            {manual.slice(0, 5).map((p, i) => <JudgmentItem key={p.story + i} p={p} dismiss={dismiss} />)}
          </div>
        )
      })()}

    </div>
  )
}

function TrendingGenerator({ onRun }) {
  const [posts, setPosts] = useState(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [note, setNote]   = useState('')

  async function generate() {
    if (busy) return
    setBusy(true); setError(''); setNote(''); setPosts(null)
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trending: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setPosts(json.posts || [])
      if (json.note) setNote(json.note)
      if (json.posts?.length) onRun?.(json.posts, 'trending')
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>⚡ Generate from trending</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Drafts posts for the 7 hottest stories right now — ranked by how fast coverage is accelerating, so you ride the wave instead of chasing it.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={generate} disabled={busy} className="nav-pill" style={{ opacity: busy ? 0.55 : 1, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Reading the news cycle…' : 'Generate posts'}
        </button>
        {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      </div>

      {posts && posts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {posts.map((post, i) => <PostCard key={i} post={post} />)}
        </div>
      )}
      {posts && posts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12 }}>{note || 'Nothing strongly cross-covered right now — try again after the next news wave.'}</div>
      )}
    </div>
  )
}

function Composer({ onRun }) {
  const [input, setInput]     = useState('')
  const [steer, setSteer]     = useState('')
  const [posts, setPosts]     = useState(null)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  async function generate() {
    if (!input.trim() || busy) return
    setBusy(true); setError(''); setPosts(null)
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ headlines: input, steer }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setPosts(json.posts || [])
      if (json.posts?.length) onRun?.(json.posts, 'compose')
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>✍️ Compose from your own headlines</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Paste a headline, or several from different outlets — one per line (e.g. <em>BBC — Bank holds rates</em>). We'll draft a few post options.
      </div>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={'BBC — Bank holds interest rates at 5%\nTelegraph — Millions face mortgage pain as Bank refuses to cut\nGuardian — Rate hold offers relief but squeeze continues'}
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 13, lineHeight: 1.5, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', marginBottom: 10 }}
      />
      <input
        type="text"
        value={steer}
        onChange={e => setSteer(e.target.value)}
        placeholder="Optional: steer the tone — e.g. “lean into the comedy of the wording”"
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={generate}
          disabled={busy || !input.trim()}
          className="nav-pill"
          style={{ opacity: busy || !input.trim() ? 0.55 : 1, cursor: busy || !input.trim() ? 'default' : 'pointer' }}
        >
          {busy ? 'Generating…' : 'Generate posts'}
        </button>
        {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      </div>

      {posts && posts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {posts.map((post, i) => <PostCard key={i} post={post} />)}
        </div>
      )}
      {posts && posts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12 }}>No posts came back — try rewording or adding another headline.</div>
      )}
    </div>
  )
}

export default function SocialPage({ user, goBack }) {
  const isOwner = user?.email === OWNER

  // Scout + history data — server-side, so it works identically on every
  // device (mobile posting included; localStorage history kept losing runs).
  const [scout, setScout] = useState(null)
  async function loadScout() {
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-auto', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const json = await res.json()
      setScout(res.ok ? json : { error: json.error || 'Failed to load' })
    } catch (e) { setScout({ error: e.message }) }
  }
  useEffect(() => { if (isOwner) loadScout() }, [isOwner])
  // After a manual generation, refetch so the run lands in server history.
  const recordRun = () => setTimeout(loadScout, 1500)

  if (!isOwner) {
    return (
      <div className="page-content">
        <div className="container" style={{ maxWidth: 1240 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div className="empty-state">
            <h3>🔒 Private</h3>
            <p>This page is only available to the site owner.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 860 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
            🚀 Social content desk
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            The scout drafts gate-passing posts into the queue within ~15 min of a story surging — you approve with two taps. Or generate a batch yourself; either way, nothing publishes without you.
          </p>
        </div>

        <AutopilotFeed state={scout} />
        <TrendingGenerator onRun={recordRun} />

        {/* History — recent manual batches, server-side so every device sees
            the same runs. Regenerating never destroys good copy. */}
        {(scout?.manualRuns || []).map((run, ri) => (
          <details key={ri} style={{ marginBottom: ri === (scout.manualRuns.length - 1) ? 24 : 8 }}>
            <summary style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', cursor: 'pointer', padding: '4px 0' }}>
              Previous run · {run.mode === 'trending' ? 'trending' : 'composer'} · {timeAgo(run.at)} · {run.posts.length} posts
            </summary>
            <div style={{ paddingTop: 12 }}>
              {run.posts.map((post, i) => <PostCard key={i} post={post} />)}
            </div>
          </details>
        ))}

        <Composer onRun={recordRun} />
      </div>
    </div>
  )
}
