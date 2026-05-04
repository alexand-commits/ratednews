import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

const CATEGORIES = [
  { value: 'Politics',       emoji: '🏛',  label: 'Politics'       },
  { value: 'Business',       emoji: '📈',  label: 'Business'       },
  { value: 'Sport',          emoji: '⚽',  label: 'Sport'          },
  { value: 'Tech',           emoji: '💻',  label: 'Tech'           },
  { value: 'Science',        emoji: '🔬',  label: 'Science'        },
  { value: 'Health',         emoji: '🏥',  label: 'Health'         },
  { value: 'Environment',    emoji: '🌱',  label: 'Environment'    },
  { value: 'Entertainment',  emoji: '🎬',  label: 'Entertainment'  },
  { value: 'Crime',          emoji: '🔍',  label: 'Crime'          },
  { value: 'Travel',         emoji: '✈️',  label: 'Travel'         },
  { value: 'Education',      emoji: '🎓',  label: 'Education'      },
  { value: 'War & Conflict', emoji: '⚔️',  label: 'War & Conflict' },
  { value: 'Culture',        emoji: '🎨',  label: 'Culture'        },
  { value: 'World',          emoji: '🌍',  label: 'World'          },
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

  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div className="page-content">
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
                onClick={() => navigate('feed', { category: c.value, region })}
                style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                  width: '100%',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: preview ? 10 : 0 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{c.emoji}</span>
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
                          background: 'var(--coral)', borderRadius: 4,
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
