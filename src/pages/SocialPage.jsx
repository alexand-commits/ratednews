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

// Per-post autopilot verdict chips — shows exactly what the bot would do with
// this post if a scheduled run picked it up.
function AutoBadges({ post }) {
  if (!post.auto) return null
  const chip = (label, verdict) => {
    const ok = verdict === 'ok'
    return (
      <span
        title={ok ? `${label}: autopilot may publish this` : `${label}: ${verdict}`}
        style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
          background: ok ? 'var(--green-light)' : 'var(--bg)',
          color: ok ? 'var(--green-dark)' : 'var(--text3)',
          border: `0.5px solid ${ok ? 'transparent' : 'var(--border)'}`,
        }}
      >
        {ok ? `🤖 ${label} auto ✓` : `🖐 ${label}: ${verdict}`}
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
      {chip('X', post.auto.x)}
      {chip('Bluesky', post.auto.bluesky)}
      {post.meta && (
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          {post.meta.outlets} outlets · first {post.meta.first}
          {post.meta.breaking ? ' · ⚡ breaking' : ''}{post.meta.update ? ' · ↻ update' : ''}
        </span>
      )}
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

      <AutoBadges post={post} />
    </div>
  )
}

// ── Autopilot activity feed (main column) — the full picture per run: what it
// posted / would post (complete text) and everything it refused, with reasons.
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

  const platformChip = (platform) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: platform === 'x' ? 'rgba(216,90,48,0.1)' : 'rgba(46,134,234,0.1)', color: platform === 'x' ? 'var(--coral)' : '#2E86EA' }}>
      {platform === 'x' ? 'X' : '🦋 Bluesky'}
    </span>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🤖 Autopilot activity</div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          X {state.mode.x === 'live' ? 'LIVE' : 'dry-run'} · Bluesky {state.mode.bluesky === 'live' ? 'LIVE' : 'dry-run'} · checks every 15 min
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        Dry-run simulates live behaviour honestly — rate limits and the 6h story cool-down apply to "would posts" too, so this is what the bot would really do.
      </div>

      {state.runs.slice(0, 6).map((r, i) => {
        const gated = (r.decisions || []).filter(d =>
          d.x !== 'ok' && !String(d.x).startsWith('WOULD POST') && d.x !== 'POSTED' &&
          d.bluesky !== 'ok' && !String(d.bluesky).startsWith('WOULD POST') && d.bluesky !== 'POSTED')
        return (
          <div key={i} style={{ borderTop: '0.5px solid var(--border)', padding: '12px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>
              {timeAgo(r.at)}{r.error ? ' · ⚠️ run failed' : ''}{r.note ? ` · ${r.note}` : ''}
            </div>

            {(() => {
              // Group X + Bluesky actions on the same story into ONE card —
              // two near-identical variants rendered separately read like
              // duplicate posts.
              const entries = [...(r.posted || []).map(p => ({ ...p, live: true })), ...(r.wouldPost || [])]
              const byStory = new Map()
              for (const p of entries) {
                if (!byStory.has(p.story)) byStory.set(p.story, [])
                byStory.get(p.story).push(p)
              }
              return [...byStory.entries()].map(([story, group], j) => {
                const primary = group.find(p => p.platform === 'x') || group[0]
                const secondary = group.find(p => p !== primary)
                const anyLive = group.some(p => p.live)
                return (
                  <div key={j} style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      {group.map((p, k) => <span key={k}>{platformChip(p.platform)}</span>)}
                      <span style={{ fontSize: 11, fontWeight: 700, color: anyLive ? 'var(--green-dark)' : 'var(--text2)' }}>
                        {anyLive ? '✅ POSTED' : '🔍 would have posted'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {story}</span>
                      {group.filter(p => p.url).map((p, k) => (
                        <a key={'u' + k} href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--coral)', marginLeft: 'auto' }}>view on {p.platform} →</a>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{primary.text}</div>
                    {secondary && secondary.text !== primary.text && (
                      <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text3)', marginTop: 8, paddingTop: 8, borderTop: '0.5px dashed var(--border)' }}>
                        {secondary.platform === 'bluesky' ? '🦋 variant: ' : 'X variant: '}{secondary.text}
                      </div>
                    )}
                  </div>
                )
              })
            })()}

            {gated.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
                {gated.map((d, j) => (
                  <div key={j}>🖐 {d.story} <span style={{ opacity: 0.8 }}>({d.type})</span> — {d.x === d.bluesky ? d.x : `X: ${d.x} · Bluesky: ${d.bluesky}`}</div>
                ))}
              </div>
            )}
            {!(r.posted || []).length && !(r.wouldPost || []).length && !gated.length && !r.error && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>🚫 nothing eligible this run</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Autopilot panel — mode + recent scheduled runs ───────────────────────────
function AutopilotPanel() {
  const [state, setState] = useState(null) // {configured, mode, runs} | {error}

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data: { session } } = await db.auth.getSession()
        const res = await fetch('/api/social-auto', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        const json = await res.json()
        if (mounted) setState(res.ok ? json : { error: json.error || 'Failed to load' })
      } catch (e) {
        if (mounted) setState({ error: e.message })
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const modeChip = (label, mode) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: mode === 'live' ? 'var(--green-light)' : 'var(--bg)',
      color: mode === 'live' ? 'var(--green-dark)' : 'var(--text3)',
      border: '0.5px solid var(--border)',
    }}>
      {label}: {mode === 'live' ? 'LIVE' : 'dry-run'}
    </span>
  )

  return (
    <div className="widget">
      <div className="widget-title">🤖 Autopilot</div>
      {!state ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</div>
      ) : state.error ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{state.error}</div>
      ) : !state.configured ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          Not configured yet — add <code>SOCIAL_AUTO_SECRET</code> in Vercel and as a GitHub secret to enable scheduled runs.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {modeChip('X', state.mode.x)}
            {modeChip('Bluesky', state.mode.bluesky)}
            <span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>checks every 15 min</span>
          </div>
          {state.runs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>No runs in the last 24h yet.</div>
          ) : state.runs.slice(0, 5).map((r, i) => (
            <div key={i} style={{ borderTop: i ? '0.5px solid var(--border)' : 'none', padding: '8px 0', fontSize: 12 }}>
              <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 3 }}>{timeAgo(r.at)}{r.error ? ' · ⚠️ run failed' : ''}</div>
              {(() => {
                const groups = new Map()
                for (const p of [...(r.posted || []).map(x => ({ ...x, live: true })), ...(r.wouldPost || [])]) {
                  if (!groups.has(p.story)) groups.set(p.story, { platforms: [], live: false, url: null })
                  const g = groups.get(p.story)
                  g.platforms.push(p.platform === 'x' ? 'X' : 'Bluesky')
                  if (p.live) g.live = true
                  if (p.url) g.url = p.url
                }
                return [...groups.entries()].map(([story, g], j) => (
                  <div key={j} style={{ color: g.live ? 'var(--green-dark)' : 'var(--text2)' }}>
                    {g.live ? '✅ posted' : '🔍 would post'} ({g.platforms.join(' + ')}): {g.url
                      ? <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{story}</a>
                      : story}
                  </div>
                ))
              })()}
              {!(r.posted || []).length && !(r.wouldPost || []).length && !r.error && (
                <div style={{ color: 'var(--text3)' }}>🚫 nothing eligible ({r.note || 'all posts gated'})</div>
              )}
            </div>
          ))}
        </>
      )}
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
      <div className="container" style={{ maxWidth: 1240 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
            🚀 Social content desk
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            Generate posts from what's trending right now, or compose from your own headlines. Autopilot publishes only gate-passing posts on schedule — everything grave, breaking-thin, polls and contrasts stay yours.
          </p>
        </div>

        <div className="grid">
        <div>
        <AutopilotFeed />
        <TrendingGenerator onRun={recordRun} />
        <Composer onRun={recordRun} />
        </div>

        {/* Rail — the previous run, so regenerating never destroys good copy */}
        <aside className="sidebar desktop-only">
          <AutopilotPanel />
          {railRun?.posts?.length ? (
            <div className="widget">
              <div className="widget-title">
                Previous run · {railRun.kind === 'trending' ? 'trending' : 'composer'} · {timeAgo(new Date(railRun.at).toISOString())}
              </div>
              {railRun.posts.map((post, i) => <PostCard key={i} post={post} />)}
            </div>
          ) : (
            <div className="widget">
              <div className="widget-title">Previous run</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                Your last batch will appear here when you generate a new one — regenerating never loses the previous copy.
              </div>
            </div>
          )}
        </aside>
        </div>
      </div>
    </div>
  )
}
