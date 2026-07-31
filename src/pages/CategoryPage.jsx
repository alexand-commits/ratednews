import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import Sidebar from '../components/Sidebar'
import { CATEGORIES, fetchCategoryOverview } from '../utils/categoryOverview'

const REGIONS = [
  { value: 'all', label: '🌍 Global'          },
  { value: 'US',  label: '🇺🇸 US'            },
  { value: 'UK',  label: '🇬🇧 UK'            },
  { value: 'int', label: '🌐 International'   },
]

export default function CategoryPage({ navigate, goBack, outlets = [], initial = null }) {
  const [region, setRegion] = useState('all')
  const [counts, setCounts] = useState(initial?.counts || {})
  const [previews, setPreviews] = useState(initial?.previews || {}) // category → latest article
  const [loading, setLoading] = useState(!initial)

  // Server-rendered overview covers the 'all' region (ISR, so crawlers see
  // real numbers); region switches fetch fresh via the shared helper.
  const loadCounts = useCallback(async () => {
    setLoading(true)
    const { counts: c, previews: p } = await fetchCategoryOverview(db, region)
    setCounts(c); setPreviews(p); setLoading(false)
  }, [region])

  useEffect(() => {
    if (region === 'all' && initial) { setCounts(initial.counts); setPreviews(initial.previews); setLoading(false); return }
    loadCounts()
  }, [loadCounts, region])

  const handleRefresh = useCallback(async () => {
    setCounts({}); setPreviews({})
    await loadCounts()
  }, [loadCounts])

  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(handleRefresh)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div className="grid">
        <div>

        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            Categories
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            {loading ? 'Loading…' : `${total.toLocaleString()} stories this week across ${CATEGORIES.length} categories`}
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
              <Link
                key={c.value}
                href={`/categories/${c.slug}`}
                style={{
                  display: 'block',
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
                  textDecoration: 'none',
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
                      <span style={{ fontWeight: 600, fontSize: 16 }}>{c.label}</span>
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
              </Link>
            )
          })}
        </div>
        </div>

        <Sidebar outlets={outlets} navigate={navigate} />
        </div>
      </div>
    </div>
  )
}
