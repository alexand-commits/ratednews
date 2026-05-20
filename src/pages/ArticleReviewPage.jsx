import { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/supabase'

const ISSUE_LABELS = {
  no_image:            { label: 'No image',          color: '#f59e0b' },
  no_summary:          { label: 'No summary',         color: '#f59e0b' },
  summary_equals_title:{ label: 'Summary = title',    color: '#f97316' },
  title_has_suffix:    { label: 'Title has suffix',   color: '#8b5cf6' },
  no_category:         { label: 'No category',        color: '#6b7280' },
  affiliate_signal:    { label: 'Affiliate signal',   color: '#ef4444' },
}

function IssueBadge({ issue }) {
  const cfg = ISSUE_LABELS[issue] || { label: issue, color: '#6b7280' }
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 99,
      background: cfg.color + '22', color: cfg.color,
      border: `1px solid ${cfg.color}44`, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

function ArticleRow({ article, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const outletName = article.outlets?.name || '—'
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    : '—'

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    const { data: { session } } = await db.auth.getSession()
    const res = await fetch('/api/admin/articles', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id: article.id }),
    })
    if (res.ok) {
      onDelete(article.id)
    } else {
      setDeleting(false)
      setConfirming(false)
      alert('Delete failed')
    }
  }

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '0.5px solid var(--border)',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 12,
      alignItems: 'start',
    }}>
      <div style={{ minWidth: 0 }}>
        {/* Title */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, display: 'block', marginBottom: 4, wordBreak: 'break-word' }}
        >
          {article.title}
        </a>

        {/* Matched keyword for affiliate */}
        {article.matched_keyword && (
          <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 6, fontStyle: 'italic' }}>
            Matched: "{article.matched_keyword}"
          </div>
        )}

        {/* Summary preview */}
        {article.summary && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
            {article.summary.slice(0, 120)}{article.summary.length > 120 ? '…' : ''}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{outletName}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{date}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{article.view_count ?? 0} views</span>
          {article.issues?.map(issue => <IssueBadge key={issue} issue={issue} />)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {confirming ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', background: 'var(--red, #ef4444)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            >
              {deleting ? '…' : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={handleDelete}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default function ArticleReviewPage({ goBack }) {
  const [tab, setTab]         = useState('bad_meta')
  const [articles, setArticles] = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [deleted, setDeleted] = useState(new Set())

  const fetchArticles = useCallback(async (type, pg) => {
    setLoading(true)
    const { data: { session } } = await db.auth.getSession()
    const res = await fetch(`/api/admin/articles?type=${type}&page=${pg}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    const json = await res.json()
    setArticles(json.articles || [])
    setTotal(json.total || 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    setPage(0)
    setDeleted(new Set())
    fetchArticles(tab, 0)
  }, [tab, fetchArticles])

  function handleDelete(id) {
    setDeleted(prev => new Set([...prev, id]))
  }

  const visible = articles.filter(a => !deleted.has(a.id))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '0.5px solid var(--border)',
        padding: '0 16px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text2)', fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Article Review</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {loading ? 'Loading…' : `${total - deleted.size} articles`}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', padding: '0 16px' }}>
        {[
          { key: 'bad_meta',   label: 'Bad metadata' },
          { key: 'affiliate',  label: 'Affiliate / sales' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              fontSize: 13, padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--coral)' : '2px solid transparent',
              color: tab === t.key ? 'var(--coral)' : 'var(--text2)',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>All clear</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>No articles flagged in this category</div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', margin: 16, borderRadius: 12, overflow: 'hidden' }}>
            {visible.map(article => (
              <ArticleRow key={article.id} article={article} onDelete={handleDelete} />
            ))}
          </div>

          {/* Pagination */}
          {tab === 'bad_meta' && total > 50 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 16px 24px' }}>
              <button
                disabled={page === 0}
                onClick={() => { const p = page - 1; setPage(p); fetchArticles(tab, p) }}
                style={{ fontSize: 12, padding: '6px 16px', borderRadius: 20, border: '0.5px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
              >← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text3)', lineHeight: '30px' }}>Page {page + 1}</span>
              <button
                disabled={(page + 1) * 50 >= total}
                onClick={() => { const p = page + 1; setPage(p); fetchArticles(tab, p) }}
                style={{ fontSize: 12, padding: '6px 16px', borderRadius: 20, border: '0.5px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: (page + 1) * 50 >= total ? 'default' : 'pointer', opacity: (page + 1) * 50 >= total ? 0.4 : 1 }}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
