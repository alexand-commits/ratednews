import React, { useState } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'

const TABS = [
  { id: 'credibility', label: 'Credibility',    key: 'overall_score',    desc: 'Overall trust score'         },
  { id: 'accuracy',    label: 'Most Accurate',  key: 'accuracy_score',   desc: 'AI accuracy score'           },
  { id: 'community',   label: 'Community',      key: 'community_score',  desc: 'Avg community star rating'   },
  { id: 'rated',       label: 'Most Rated',     key: 'total_ratings',    desc: 'Number of community ratings' },
]

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

export default function RankingsPage({ outlets, navigate }) {
  const [tab, setTab]       = useState('credibility')
  const [region, setRegion] = useState('all')

  const activeTab = TABS.find(t => t.id === tab)

  const sorted = outlets
    .filter(o => region === 'all' || o.country === region)
    .slice()
    .sort((a, b) => (b[activeTab.key] || 0) - (a[activeTab.key] || 0))

  // Summary stats
  const avgScore = sorted.length
    ? Math.round(sorted.reduce((s, o) => s + (o[activeTab.key] || 0), 0) / sorted.length)
    : 0
  const topOutlet = sorted[0]

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 800 }}>
        <button className="back-btn" onClick={() => navigate('feed')}>← Back to feed</button>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
            Outlet Rankings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            Ranked by AI analysis and community ratings across {outlets.length} outlets.
          </p>
        </div>

        {/* Summary chips */}
        {topOutlet && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top outlet</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{topOutlet.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{topOutlet[activeTab.key] || 0} {activeTab.desc}</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Average</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: tab === 'rated' ? 'var(--text)' : scoreColor(avgScore) }}>{avgScore}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>across {sorted.length} outlets</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total ratings</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{outlets.reduce((s, o) => s + (o.total_ratings || 0), 0)}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>community ratings</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          {TABS.map(t => (
            <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Region filter */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          {['all', 'UK', 'US', 'Europe', 'Asia'].map(r => (
            <button key={r} className={`pill${region === r ? ' active' : ''}`} onClick={() => setRegion(r)}>
              {r === 'all' ? 'Global' : r}
            </button>
          ))}
        </div>

        {/* Rankings list */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {sorted.length === 0 ? (
            <div className="empty-state"><p>No outlets for this region yet.</p></div>
          ) : (
            sorted.map((o, i) => {
              const score    = o[activeTab.key] || 0
              const maxScore = tab === 'rated' ? Math.max(...sorted.map(x => x.total_ratings || 0), 1) : 100
              const barWidth = Math.round((score / maxScore) * 100)
              const isTop3   = i < 3

              return (
                <div
                  key={o.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    borderBottom: i < sorted.length - 1 ? '0.5px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    background: isTop3 ? 'var(--surface)' : 'var(--surface)',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => navigate('outlet', { outletId: o.id })}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--surface)'}
                >
                  {/* Rank */}
                  <span style={{
                    fontSize: isTop3 ? 15 : 13,
                    fontWeight: isTop3 ? 700 : 400,
                    color: i === 0 ? '#b8860b' : i === 1 ? '#888' : i === 2 ? '#a0522d' : 'var(--text3)',
                    width: 26, flexShrink: 0, textAlign: 'center',
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>

                  {/* Logo */}
                  <OutletLogo name={o.name} size={38} borderRadius={10} />

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{o.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.country || ''}</span>
                      {o.bias_direction && (
                        <span style={{ fontSize: 11, color: BIAS_COLORS[o.bias_direction] || 'var(--text3)' }}>
                          {BIAS_LABELS[o.bias_direction] || o.bias_direction}
                        </span>
                      )}
                      {o.total_ratings > 0 && tab !== 'rated' && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {o.total_ratings} {o.total_ratings === 1 ? 'rating' : 'ratings'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{ width: 100, flexShrink: 0 }}>
                    <div className="rank-bar-bg">
                      <div className="rank-bar-fill" style={{ width: `${barWidth}%`, background: tab === 'rated' ? 'var(--coral)' : scoreColor(score) }} />
                    </div>
                    <div style={{ fontSize: 11, textAlign: 'right', marginTop: 3, color: tab === 'rated' ? 'var(--coral)' : scoreColor(score), fontWeight: 600 }}>
                      {tab === 'community' && o.community_score > 0
                        ? `${(o.community_score / 20).toFixed(1)}★`
                        : score}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>
          Credibility and accuracy scores are AI-generated based on article analysis. Community scores reflect user ratings.
        </div>
      </div>
    </div>
  )
}
