import React, { useState } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import { db } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

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

function SuggestModal({ onClose, user, onLoginClick, showToast }) {
  const [name,    setName]    = useState('')
  const [website, setWebsite] = useState('')
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { error } = await db.from('outlet_suggestions').insert({
      user_id:     user.id,
      outlet_name: name.trim(),
      website_url: website.trim() || null,
      reason:      reason.trim() || null,
    })
    setLoading(false)
    if (error) {
      showToast('Something went wrong — please try again')
    } else {
      setDone(true)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.2s ease',
      }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 8 }}>Thanks for the suggestion!</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              We'll review <strong>{name}</strong> and add it if it meets our quality criteria.
            </p>
            <button
              onClick={onClose}
              style={{
                background: 'var(--coral)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 28px', fontWeight: 600,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700 }}>
                  Suggest an outlet
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Know a news source we're missing?
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 18, color: 'var(--text3)', lineHeight: 1, padding: 4,
                }}
              >✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>
                  Outlet name <span style={{ color: 'var(--coral)' }}>*</span>
                </label>
                <input
                  className="compose-input"
                  type="text"
                  placeholder="e.g. The Guardian"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{ width: '100%', borderRadius: 10 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>
                  Website URL
                </label>
                <input
                  className="compose-input"
                  type="text"
                  placeholder="theguardian.com"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  style={{ width: '100%', borderRadius: 10 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>
                  Why should we add it?
                </label>
                <textarea
                  className="compose-input"
                  placeholder="Tell us why this outlet deserves a place on RatedNews..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  style={{ width: '100%', borderRadius: 10, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                style={{
                  background: loading || !name.trim() ? 'var(--border)' : 'var(--coral)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  padding: '11px 0', fontWeight: 600, fontSize: 14,
                  cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s', marginTop: 4,
                }}
              >
                {loading ? 'Submitting…' : 'Submit suggestion'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function OutletsListPage({ outlets, navigate, goBack, showToast, user, onLoginClick, onRefresh }) {
  const [search,  setSearch]  = useState('')
  const [region,  setRegion]  = useState('all')
  const [bias,    setBias]    = useState('all')
  const [sort,    setSort]    = useState('overall_score')
  const [showSuggest, setShowSuggest] = useState(false)
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

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

  function handleSuggestClick() {
    if (!user) { onLoginClick(); return }
    setShowSuggest(true)
  }

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                News Outlets
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                {filtered.length} of {outlets.length} outlets · rated by AI analysis and community
              </p>
            </div>
            <button
              onClick={handleSuggestClick}
              style={{
                flexShrink: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--coral)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              ➕ Suggest
            </button>
          </div>
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

        {/* Suggest CTA at bottom */}
        <div style={{
          marginTop: 32, textAlign: 'center', padding: '20px',
          border: '1px dashed var(--border)', borderRadius: 12,
        }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>
            Don't see an outlet you trust?
          </p>
          <button
            onClick={handleSuggestClick}
            style={{
              background: 'none', border: '1px solid var(--coral)',
              color: 'var(--coral)', borderRadius: 10, padding: '8px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ➕ Suggest an outlet
          </button>
        </div>

      </div>

      {showSuggest && (
        <SuggestModal
          user={user}
          onLoginClick={onLoginClick}
          showToast={showToast}
          onClose={() => setShowSuggest(false)}
        />
      )}
    </div>
  )
}
