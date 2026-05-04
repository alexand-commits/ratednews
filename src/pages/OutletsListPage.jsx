import React, { useState } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'

const BIAS_COLORS = {
  left:   'var(--blue, #3b82f6)',
  centre: 'var(--text3)',
  right:  'var(--red)',
}
const BIAS_LABELS = {
  left:   '← Left',
  centre: '◉ Centre',
  right:  '→ Right',
}

const REGIONS = [
  { value: 'all', label: 'Global' },
  { value: 'US',  label: '🇺🇸 US' },
  { value: 'UK',  label: '🇬🇧 UK' },
  { value: 'International', label: '🌍 International' },
]

const BIAS_FILTERS = [
  { value: 'all',    label: 'All' },
  { value: 'left',   label: '← Left' },
  { value: 'centre', label: '◉ Centre' },
  { value: 'right',  label: '→ Right' },
]

const SORTS = [
  { value: 'overall_score',   label: 'Trust score' },
  { value: 'accuracy_score',  label: 'Most accurate' },
  { value: 'total_ratings',   label: 'Most rated' },
]

function getRegion(outlet) {
  const c = outlet.country || ''
  if (c === 'US') return 'US'
  if (c === 'UK') return 'UK'
  return 'International'
}

export default function OutletsListPage({ outlets, navigate, goBack }) {
  const [search,  setSearch]  = useState('')
  const [region,  setRegion]  = useState('all')
  const [bias,    setBias]    = useState('all')
  const [sort,    setSort]    = useState('overall_score')

  const filtered = outlets
    .filter(o => region === 'all' || getRegion(o) === region)
    .filter(o => bias === 'all' || o.bias_direction === bias)
    .filter(o =>
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.country || '').toLowerCase().includes(search.toLowerCase())
    )
    .slice()
    .sort((a, b) => (b[sort] || 0) - (a[sort] || 0))

  return (
    <div className="page-content">
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            News Outlets
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} of {outlets.length} outlets · rated by AI analysis and community
          </p>
        </div>

        {/* Search */}
        <div className="search-bar" style={{ marginBottom: 14 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search outlets or countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Region filter */}
        <div className="filter-bar" style={{ marginBottom: 10 }}>
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

        {/* Bias filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bias</span>
          {BIAS_FILTERS.map(b => (
            <button
              key={b.value}
              onClick={() => setBias(b.value)}
              style={{
                fontSize: 11, padding: '3px 12px', borderRadius: 20, border: '1px solid var(--border)',
                background: bias === b.value ? 'var(--coral)' : 'var(--surface)',
                color: bias === b.value ? '#fff' : 'var(--text2)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {b.label}
            </button>
          ))}

          {/* Sort — pushed right */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort</span>
            {SORTS.map(s => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                style={{
                  fontSize: 11, padding: '3px 12px', borderRadius: 20, border: '1px solid var(--border)',
                  background: sort === s.value ? 'var(--text)' : 'var(--surface)',
                  color: sort === s.value ? 'var(--surface)' : 'var(--text2)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No outlets match your filters.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
            {filtered.map(o => {
              const score    = o.overall_score  || 0
              const accuracy = o.accuracy_score || 0
              const ratings  = o.total_ratings  || 0

              return (
                <div
                  key={o.id}
                  onClick={() => navigate('outlet', { outletId: o.id })}
                  style={{
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '14px 16px',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {/* Top row: logo + name + score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <OutletLogo name={o.name} size={40} borderRadius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{o.name}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.country || 'International'}</span>
                        {o.bias_direction && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: BIAS_COLORS[o.bias_direction] }}>
                            {BIAS_LABELS[o.bias_direction]}
                          </span>
                        )}
                        {ratings > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {ratings} {ratings === 1 ? 'rating' : 'ratings'}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>TRUST</div>
                    </div>
                  </div>

                  {/* Accuracy bar */}
                  <div className="score-bar-row" style={{ margin: 0 }}>
                    <span className="sbl" style={{ width: 70, fontSize: 11 }}>Accuracy</span>
                    <div className="sb-bg">
                      <div className="sb-fill" style={{ width: `${accuracy}%`, background: scoreColor(accuracy) }} />
                    </div>
                    <span className="sbv" style={{ fontSize: 11 }}>{accuracy}</span>
                  </div>

                  {/* Community score bar — only if rated */}
                  {o.community_score > 0 && (
                    <div className="score-bar-row" style={{ margin: 0 }}>
                      <span className="sbl" style={{ width: 70, fontSize: 11 }}>Community</span>
                      <div className="sb-bg">
                        <div className="sb-fill" style={{ width: `${o.community_score}%`, background: 'var(--amber)' }} />
                      </div>
                      <span className="sbv" style={{ fontSize: 11, color: 'var(--amber)' }}>
                        {(o.community_score / 20).toFixed(1)}★
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
