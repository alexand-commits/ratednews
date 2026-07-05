import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

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

function PackCard({ pack }) {
  const p = pack.pack || {}
  const posts = p.posts || []
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {posts.length} posts
          {p.story_count ? <span style={{ color: 'var(--text3)', fontWeight: 500 }}> · from {p.story_count} {p.story_count === 1 ? 'story' : 'stories'}</span> : null}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{timeAgo(pack.created_at)}</span>
      </div>
      {posts.map((post, i) => <PostCard key={i} post={post} />)}
    </div>
  )
}

export default function SocialPage({ user, goBack }) {
  const [packs, setPacks]     = useState([])
  const [loading, setLoading] = useState(true)

  const isOwner = user?.email === OWNER

  useEffect(() => {
    if (!isOwner) { setLoading(false); return }
    db.from('social_drafts')
      .select('id, created_at, pack')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setPacks(data || []); setLoading(false) })
  }, [isOwner])

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
            Fresh drafts every 8 hours, built from your real coverage. Review, tweak, post — nothing goes out automatically.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
          </div>
        ) : packs.length === 0 ? (
          <div className="empty-state">
            <h3>No drafts yet</h3>
            <p>The first pack will appear here after the next scheduled run (every 8 hours), or trigger the “Social Content Desk” workflow manually in GitHub Actions.</p>
          </div>
        ) : (
          packs.map(pk => <PackCard key={pk.id} pack={pk} />)
        )}
      </div>
    </div>
  )
}
