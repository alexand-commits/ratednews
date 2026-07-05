import React, { useState } from 'react'
import { db } from '../lib/supabase'

const OWNER = 'alexandchow@gmail.com'

const TYPE_META = {
  coverage_spread: { label: 'Coverage spread', emoji: '🪞', color: 'var(--coral)' },
  poll:            { label: 'Poll',            emoji: '🗳️', color: 'var(--blue)' },
  media_literacy:  { label: 'Media literacy',  emoji: '🧠', color: 'var(--green-dark)' },
  roundup:         { label: 'Roundup',         emoji: '📰', color: 'var(--text2)' },
}

function PostCard({ post }) {
  const [copied, setCopied] = useState(false)
  const meta = TYPE_META[post.type] || { label: post.type || 'Post', emoji: '✳️', color: 'var(--text2)' }

  const copyText = [
    post.text,
    post.poll_options?.length ? `\n\nPoll options:\n• ${post.poll_options.join('\n• ')}` : '',
  ].join('')

  function copy() {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color }}>
          {meta.emoji} {meta.label}
          {post.story ? <span style={{ color: 'var(--text2)', fontWeight: 600 }}> · {post.story}</span> : null}
          {post.platform ? <span style={{ color: 'var(--text3)', fontWeight: 500 }}> · {post.platform.toUpperCase()}</span> : null}
        </span>
        <button
          onClick={copy}
          style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, border: '0.5px solid var(--border)', background: copied ? 'var(--green)' : 'var(--surface)', color: copied ? '#fff' : 'var(--text2)', cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
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
    </div>
  )
}

function TrendingGenerator() {
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
        Drafts posts for the 3 most cross-covered stories right now — post while the timeline's still on them.
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

function Composer() {
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

  if (!isOwner) {
    return (
      <div className="page-content">
        <div className="container" style={{ maxWidth: 640 }}>
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
      <div className="container" style={{ maxWidth: 640 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
            🚀 Social content desk
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            Generate posts from what's trending right now, or compose from your own headlines. Review, tweak, post — nothing goes out automatically.
          </p>
        </div>

        <TrendingGenerator />
        <Composer />
      </div>
    </div>
  )
}
