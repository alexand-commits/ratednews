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
function PostButton({ platform, text, pollOptions, label, color }) {
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
        body: JSON.stringify({ platform, text, pollOptions }),
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

function PostCard({ post }) {
  const meta = TYPE_META[post.type] || { label: post.type || 'Post', emoji: '✳️', color: 'var(--text2)' }

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
            <PostButton platform="x" text={post.text} pollOptions={post.poll_options} label="Post to X · 1.5¢" color="var(--coral)" />
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
                <PostButton platform="bluesky" text={post.short} label="Post to Bluesky" color="#2E86EA" />
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
    </div>
  )
}

// ── Post queue (main column) — autopilot scouts and drafts; the owner
// approves with the same two-tap buttons as the generators. Nothing publishes
// itself: the scout's job ends at the draft.
function AutopilotFeed() {
  const [state, setState] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data: { session } } = await db.auth.getSession()
        const res = await fetch('/api/social-auto', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const json = await res.json()
        if (mounted) setState(res.ok ? json : { error: json.error || 'Failed to load' })
      } catch (e) { if (mounted) setState({ error: e.message }) }
    }
    load()
    return () => { mounted = false }
  }, [])

  if (!state || state.error || !state.configured || !state.runs?.length) return null

  // Build the queue: newest drafts first, one card per story, last 12h only.
  const QUEUE_MAX_AGE_H = 12
  const queue = []
  const seenStories = new Set()
  for (const r of state.runs) { // runs arrive newest-first
    const entries = [...(r.posted || []).map(p => ({ ...p, live: true })), ...(r.wouldPost || [])]
    const byStory = new Map()
    for (const p of entries) {
      if (!byStory.has(p.story)) byStory.set(p.story, { story: p.story, at: r.at, x: null, bluesky: null, url: null, live: false })
      const g = byStory.get(p.story)
      g[p.platform] = p.text
      if (p.live) { g.live = true; g.url = p.url || g.url }
    }
    for (const [story, g] of byStory) {
      if (seenStories.has(story)) continue
      seenStories.add(story)
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
        Gate-passing drafts land here within ~15 min of a story surging. Two taps to publish; skip anything that doesn't feel right — silence is free.
      </div>

      {queue.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
          Queue is clear.
          {state.heartbeat ? ` Last check ${timeAgo(state.heartbeat.at)}: ${state.heartbeat.last_result || 'nothing new'}.` : ' The scout keeps watching.'}
        </div>
      ) : queue.slice(0, 6).map((q, i) => (
        <div key={i} style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--coral)' }}>
              {q.live ? '✅ posted' : '🕐 drafted'} {timeAgo(q.at)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>· {q.story}</span>
            {q.url && <a href={q.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--coral)', marginLeft: 'auto' }}>view →</a>}
          </div>

          {q.x && (
            <>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{q.x}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{q.x.length} chars</span>
                <CopyButton text={q.x} />
                {!q.live && <PostButton platform="x" text={q.x} label="Post to X · 1.5¢" color="var(--coral)" />}
              </div>
            </>
          )}

          {q.bluesky && (
            <div style={{ marginTop: q.x ? 12 : 0, paddingTop: q.x ? 12 : 0, borderTop: q.x ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: q.x ? 'var(--text2)' : 'var(--text)' }}>{q.bluesky}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: q.bluesky.length > 300 ? 'var(--red)' : 'var(--text3)' }}>{q.bluesky.length} / 300</span>
                <CopyButton text={q.bluesky} />
                {!q.live && q.bluesky.length <= 300 && <PostButton platform="bluesky" text={q.bluesky} label="Post to Bluesky" color="#2E86EA" />}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Decision log — everything the scout declined, and why. Collapsed by default. */}
      <details style={{ marginTop: 6 }}>
        <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer' }}>
          Scout decisions — what was skipped and why
        </summary>
        <div style={{ paddingTop: 8 }}>
          {state.runs.slice(0, 6).map((r, i) => {
            const gated = (r.decisions || []).filter(d =>
              d.x !== 'ok' && !String(d.x).startsWith('WOULD POST') && d.x !== 'POSTED' &&
              d.bluesky !== 'ok' && !String(d.bluesky).startsWith('WOULD POST') && d.bluesky !== 'POSTED')
            if (!gated.length && !r.error && !r.note) return null
            return (
              <div key={i} style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7, borderTop: '0.5px solid var(--border)', padding: '6px 0' }}>
                <div style={{ fontWeight: 600 }}>{timeAgo(r.at)}{r.error ? ' · ⚠️ run failed' : ''}{r.note ? ` · ${r.note}` : ''}</div>
                {gated.map((d, j) => (
                  <div key={j}>🖐 {d.story} <span style={{ opacity: 0.8 }}>({d.type})</span> — {d.x === d.bluesky ? d.x : `X: ${d.x} · Bluesky: ${d.bluesky}`}</div>
                ))}
              </div>
            )
          })}
        </div>
      </details>
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
        Drafts posts for the 5 hottest stories right now — ranked by how fast coverage is accelerating, so you ride the wave instead of chasing it.
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

  // Keep exactly one previous run: the main column shows what you just
  // generated; the rail shows the batch before it (persisted, so it also
  // survives a reload). Not a history — one slot.
  const [railRun, setRailRun] = useState(null)
  useEffect(() => {
    try { setRailRun(JSON.parse(localStorage.getItem('rn_social_lastrun') || 'null')) } catch {}
  }, [])
  function recordRun(posts, kind) {
    try {
      const prev = JSON.parse(localStorage.getItem('rn_social_lastrun') || 'null')
      if (prev) setRailRun(prev)
      localStorage.setItem('rn_social_lastrun', JSON.stringify({ posts, kind, at: Date.now() }))
    } catch {}
  }

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

        <AutopilotFeed />
        <TrendingGenerator onRun={recordRun} />

        {/* History — the previous batch, so regenerating never destroys good copy */}
        {railRun?.posts?.length > 0 && (
          <details style={{ marginBottom: 24 }}>
            <summary style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', cursor: 'pointer', padding: '4px 0' }}>
              Previous run · {railRun.kind === 'trending' ? 'trending' : 'composer'} · {timeAgo(new Date(railRun.at).toISOString())}
            </summary>
            <div style={{ paddingTop: 12 }}>
              {railRun.posts.map((post, i) => <PostCard key={i} post={post} />)}
            </div>
          </details>
        )}

        <Composer onRun={recordRun} />
      </div>
    </div>
  )
}
