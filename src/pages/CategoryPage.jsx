import React, { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

const CATEGORIES = [
  { value: 'Politics',       slug: 'politics',       emoji: '🏛',  label: 'Politics',       color: '#4B6FBF' },
  { value: 'Business',       slug: 'business',       emoji: '📈',  label: 'Business',       color: '#2E8B57' },
  { value: 'Sport',          slug: 'sport',          emoji: '⚽',  label: 'Sport',          color: '#E84B4B' },
  { value: 'Tech',           slug: 'tech',           emoji: '💻',  label: 'Tech',           color: '#7C5CBF' },
  { value: 'Science',        slug: 'science',        emoji: '🔬',  label: 'Science',        color: '#2196F3' },
  { value: 'Health',         slug: 'health',         emoji: '🏥',  label: 'Health',         color: '#D84B8A' },
  { value: 'Environment',    slug: 'environment',    emoji: '🌱',  label: 'Environment',    color: '#4CAF50' },
  { value: 'Entertainment',  slug: 'entertainment',  emoji: '🎬',  label: 'Entertainment',  color: '#FF9800' },
  { value: 'Crime',          slug: 'crime',          emoji: '🔍',  label: 'Crime',          color: '#795548' },
  { value: 'Travel',         slug: 'travel',         emoji: '✈️',  label: 'Travel',         color: '#00ACC1' },
  { value: 'Education',      slug: 'education',      emoji: '🎓',  label: 'Education',      color: '#D85A30' },
  { value: 'Conflict',       slug: 'conflict',       emoji: '⚔️',  label: 'Conflict',       color: '#757575' },
  { value: 'World',          slug: 'world',          emoji: '🌍',  label: 'World',          color: '#009688' },
]

const REGIONS = [
  { value: 'all', label: '🌍 Global'          },
  { value: 'US',  label: '🇺🇸 US'            },
  { value: 'UK',  label: '🇬🇧 UK'            },
  { value: 'int', label: '🌐 International'   },
]

export default function CategoryPage({ navigate, goBack }) {
  const [region, setRegion] = useState('all')
  const [counts, setCounts] = useState({})
  const [previews, setPreviews] = useState({}) // category → latest article
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Fetch all categorised articles with outlet country for region filter
      const { data } = await db
        .from('articles')
        .select('id, title, category, published_at, outlets(country)')
        .not('category', 'is', null)
        .order('published_at', { ascending: false })

      if (!data) { setLoading(false); return }

      // Apply region filter
      const filtered = region === 'all' ? data : data.filter(a => {
        const c = a.outlets?.country || ''
        if (region === 'UK') return c === 'UK'
        if (region === 'US') return c === 'US'
        return c !== 'UK' && c !== 'US'
      })

      // Build counts + pick latest article per category as preview
      const newCounts = {}
      const newPreviews = {}
      for (const a of filtered) {
        const cat = a.category
        newCounts[cat] = (newCounts[cat] || 0) + 1
        if (!newPreviews[cat]) newPreviews[cat] = a // already sorted newest first
      }

      setCounts(newCounts)
      setPreviews(newPreviews)
      setLoading(false)
    }
    load()
  }, [region])

  const handleRefresh = useCallback(async () => {
    setCounts({})
    setPreviews({})
    setLoading(true)
    // Toggling region triggers the useEffect — use a small hack to force re-run
    setRegion(r => r) // same value, but we need a different approach
    // Directly re-fetch instead
    const { data } = await db.from('articles').select('id, title, category, published_at, outlets(country)').not('category', 'is', null).order('published_at', { ascending: false })
    if (data) {
      const filtered = region === 'all' ? data : data.filter(a => {
        const c = a.outlets?.country || ''
        if (region === 'UK') return c === 'UK'
        if (region === 'US') return c === 'US'
        return c !== 'UK' && c !== 'US'
      })
      const newCounts = {}; const newPreviews = {}
      for (const a of filtered) { const cat = a.category; newCounts[cat] = (newCounts[cat] || 0) + 1; if (!newPreviews[cat]) newPreviews[cat] = a }
      setCounts(newCounts); setPreviews(newPreviews)
    }
    setLoading(false)
  }, [region])

  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(handleRefresh)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Categories
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            {loading ? 'Loading…' : `${total.toLocaleString()} stories across ${CATEGORIES.length} categories`}
          </p>
        </div>

        {/* Region filter */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          {REGIONS.map(r => (
            <button
              key={r.value}
              className={`pill${region === r.value ? ' active' : ''}`}
              onClick={() => setRegion(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Category cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CATEGORIES.map(c => {
            const count   = counts[c.value] || 0
            const preview = previews[c.value]
            const pct     = total > 0 ? Math.round((count / total) * 100) : 0

            return (
              <button
                key={c.value}
                onClick={() => navigate('category', { slug: c.slug })}
                style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--border)',
                  borderLeft: `3px solid ${c.color}`,
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'opacity 0.15s',
                  width: '100%',
                  color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: preview ? 10 : 0 }}>
                  <span style={{
                    fontSize: 18, lineHeight: 1, width: 36, height: 36, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${c.color}18`, borderRadius: 10,
                  }}>{c.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{c.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
                        {loading ? '—' : `${count.toLocaleString()} stories`}
                      </span>
                    </div>
                    {/* Progress bar showing share of total */}
                    {!loading && total > 0 && (
                      <div style={{ marginTop: 6, background: 'var(--bg2)', borderRadius: 4, height: 4 }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: c.color, borderRadius: 4,
                          transition: 'width 0.4s ease',
                          minWidth: count > 0 ? 4 : 0,
                        }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Latest article preview */}
                {preview && (
                  <div style={{
                    fontSize: 12, color: 'var(--text2)', lineHeight: 1.4,
                    paddingLeft: 34,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    <span style={{ color: 'var(--text3)', marginRight: 6 }}>
                      {timeAgo(preview.published_at)}
                    </span>
                    {preview.title}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
