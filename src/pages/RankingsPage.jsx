import React, { useState, useEffect } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import InfoTip from '../components/InfoTip'
import { db } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

const OUTLET_TABS = [
  {
    id: 'credibility', label: 'Trust', key: 'overall_score',
    desc: 'Overall trust score',
    tip: 'Combined credibility score based on AI accuracy analysis, headline fairness and community ratings. Higher = more trustworthy.',
    chipLabel: 'avg trust score', unit: '',
  },
  {
    id: 'accuracy', label: 'Most Accurate', key: 'accuracy_score',
    desc: 'AI accuracy score',
    tip: 'AI-assessed factual reliability of each article. Outlets are ranked by the average accuracy score across their recent articles.',
    chipLabel: 'avg accuracy', unit: '',
  },
  {
    id: 'community', label: 'Community', key: 'community_score',
    desc: 'Avg community star rating',
    tip: 'Average star rating given by RatedNews users (out of 100). Reflects reader trust and experience, independent of AI analysis.',
    chipLabel: 'avg community score', unit: '',
  },
  {
    id: 'rated', label: 'Most Rated', key: 'total_ratings',
    desc: 'Number of community ratings',
    tip: 'Total number of community ratings submitted for each outlet. More ratings means greater confidence in that outlet\'s score.',
    chipLabel: 'ratings across all outlets', unit: '',
  },
]

const BIAS_COLORS = { left: 'var(--blue, #3b82f6)', centre: 'var(--text3)', right: 'var(--red)' }
const BIAS_LABELS = { left: '← Left', centre: '◉ Centre', right: '→ Right' }

const TRUST_LEVELS = [
  { min: 50, label: 'Expert',           emoji: '🏅', color: '#D85A30' },
  { min: 20, label: 'Trusted Reviewer', emoji: '⭐', color: '#639922' },
  { min: 10, label: 'Contributor',      emoji: '✅', color: '#185FA5' },
  { min: 3,  label: 'Active Member',    emoji: '📰', color: '#6B6760' },
  { min: 0,  label: 'New Member',       emoji: '👋', color: '#9E9B95' },
]
function getTrustLevel(total) {
  return TRUST_LEVELS.find(t => total >= t.min) || TRUST_LEVELS[TRUST_LEVELS.length - 1]
}

const STAT_ROWS = [
  { key: 'overall_score',   label: 'Trust',      max: 100, format: v => v },
  { key: 'accuracy_score',  label: 'Accuracy',   max: 100, format: v => v },
  { key: 'community_score', label: 'Community',  max: 100, format: v => v > 0 ? `${(v / 20).toFixed(1)}★` : '—' },
  { key: 'total_ratings',   label: 'Ratings',    max: null, format: v => v },
]

function ComparePanel({ a, b, navigate, onClear }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '16px', marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
          ⚖ Comparison
        </div>
        <button
          onClick={onClear}
          style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}
        >
          Clear
        </button>
      </div>

      {/* Outlet names */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ textAlign: 'left' }}>
          <OutletLogo name={a.name} size={32} borderRadius={8} />
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>{a.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.country || ''}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', padding: '0 4px' }}>vs</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <OutletLogo name={b.name} size={32} borderRadius={8} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>{b.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.country || ''}</div>
        </div>
      </div>

      {/* Stat rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STAT_ROWS.map(({ key, label, max, format }) => {
          const va = a[key] || 0
          const vb = b[key] || 0
          const peak = max || Math.max(va, vb, 1)
          const aWins = va > vb
          const bWins = vb > va
          return (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                {label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {/* Left */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: aWins ? scoreColor(va) : 'var(--text2)' }}>
                      {format(va) || '—'}
                    </span>
                    {aWins && <span style={{ fontSize: 9, color: scoreColor(va), fontWeight: 700 }}>▲</span>}
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(va / peak) * 100}%`, background: aWins ? scoreColor(va) : 'var(--text3)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                {/* Right */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: 'row-reverse' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: bWins ? scoreColor(vb) : 'var(--text2)' }}>
                      {format(vb) || '—'}
                    </span>
                    {bWins && <span style={{ fontSize: 9, color: scoreColor(vb), fontWeight: 700 }}>▲</span>}
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(vb / peak) * 100}%`, background: bWins ? scoreColor(vb) : 'var(--text3)', borderRadius: 2, marginLeft: 'auto', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Bias row */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
            Bias
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: BIAS_COLORS[a.bias_direction] || 'var(--text3)' }}>
              {BIAS_LABELS[a.bias_direction] || '—'}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BIAS_COLORS[b.bias_direction] || 'var(--text3)', textAlign: 'right' }}>
              {BIAS_LABELS[b.bias_direction] || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* View outlet links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        <button
          onClick={() => navigate('outlet', { outletId: a.id })}
          style={{ fontSize: 12, fontWeight: 600, padding: '8px 0', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text2)' }}
        >
          View {a.name} →
        </button>
        <button
          onClick={() => navigate('outlet', { outletId: b.id })}
          style={{ fontSize: 12, fontWeight: 600, padding: '8px 0', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text2)' }}
        >
          View {b.name} →
        </button>
      </div>
    </div>
  )
}

export default function RankingsPage({ outlets, outletsLoading, navigate, goBack, user, onRefresh }) {
  const [section, setSection]     = useState('outlets')  // 'outlets' | 'leaderboard'
  const [tab, setTab]             = useState('credibility')
  const [region, setRegion]       = useState('all')
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds]   = useState([])
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  function toggleCompareOutlet(id) {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length < 2)  return [...prev, id]
      return [prev[1], id]  // swap out oldest
    })
  }

  function clearCompare() {
    setCompareIds([])
    setCompareMode(false)
  }

  // Leaderboard state
  const [leaders, setLeaders]       = useState([])
  const [lbLoading, setLbLoading]   = useState(false)
  const [lbLoaded, setLbLoaded]     = useState(false)

  useEffect(() => {
    if (section !== 'leaderboard' || lbLoaded) return
    setLbLoading(true)

    Promise.all([
      db.from('ratings').select('user_id'),
      db.from('outlet_ratings').select('user_id'),
      db.from('comments').select('user_id'),
    ]).then(([{ data: ar }, { data: or }, { data: co }]) => {
      // Aggregate total contributions per user
      const counts = {}
      const inc = (rows, type) => (rows || []).forEach(r => {
        if (!r.user_id) return
        if (!counts[r.user_id]) counts[r.user_id] = { userId: r.user_id, articles: 0, outlets: 0, comments: 0 }
        counts[r.user_id][type]++
      })
      inc(ar, 'articles')
      inc(or, 'outlets')
      inc(co, 'comments')

      const sorted = Object.values(counts)
        .map(c => ({ ...c, total: c.articles + c.outlets + c.comments }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 25)

      if (sorted.length === 0) { setLeaders([]); setLbLoading(false); setLbLoaded(true); return }

      // Fetch profiles for those users
      const userIds = sorted.map(c => c.userId)
      db.from('profiles').select('user_id, username').in('user_id', userIds).then(({ data: profiles }) => {
        const profileMap = {}
        ;(profiles || []).forEach(p => { profileMap[p.user_id] = p.username })
        const result = sorted.map((c, i) => ({
          ...c,
          rank: i + 1,
          username: profileMap[c.userId] || 'Anonymous',
          trust: getTrustLevel(c.total),
        }))
        setLeaders(result)
        setLbLoading(false)
        setLbLoaded(true)
      })
    })
  }, [section, lbLoaded])

  const activeTab = OUTLET_TABS.find(t => t.id === tab)
  const sorted = outlets
    .filter(o => region === 'all' || o.country === region)
    .slice()
    .sort((a, b) => (b[activeTab.key] || 0) - (a[activeTab.key] || 0))

  // Only average outlets that have actually been rated — zeros are missing data, not low scores
  const ratedOutlets = sorted.filter(o => o[activeTab.key] > 0)
  const avgScore  = ratedOutlets.length ? Math.round(ratedOutlets.reduce((s, o) => s + o[activeTab.key], 0) / ratedOutlets.length) : 0
  const topOutlet = ratedOutlets[0]

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}
      <div className="container" style={{ maxWidth: 800 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
            Rankings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            Outlet trust scores and top community contributors.
          </p>
        </div>

        {/* Section toggle */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <div className={`tab${section === 'outlets' ? ' active' : ''}`} onClick={() => setSection('outlets')}>
            📡 Outlets
          </div>
          <div className={`tab${section === 'leaderboard' ? ' active' : ''}`} onClick={() => setSection('leaderboard')}>
            🏅 Contributors
          </div>
        </div>

        {/* ── OUTLETS SECTION ── */}
        {section === 'outlets' && (
          <>
            {/* Summary chips — always visible for layout uniformity */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {/* Top outlet */}
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 80 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top outlet</div>
                {topOutlet ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, margin: '6px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🥇 {topOutlet.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {tab === 'community'
                        ? `${((topOutlet.community_score || 0) / 20).toFixed(1)}★ community score`
                        : tab === 'rated'
                          ? `${topOutlet.total_ratings || 0} community ratings`
                          : `${topOutlet[activeTab.key] || 0} ${activeTab.desc}`}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text3)', margin: '6px 0 4px' }}>—</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>No data yet</div>
                  </>
                )}
              </div>

              {/* Average / count */}
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {tab === 'rated' ? 'Total ratings' : 'Average'}
                </div>
                {tab === 'rated' ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--coral)' }}>
                      {outlets.reduce((s, o) => s + (o.total_ratings || 0), 0)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>community ratings total</div>
                  </>
                ) : tab === 'community' ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, color: ratedOutlets.length ? scoreColor(avgScore) : 'var(--text3)' }}>
                      {ratedOutlets.length ? `${(avgScore / 20).toFixed(1)}★` : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {ratedOutlets.length ? `across ${ratedOutlets.length} rated outlets` : 'No community scores yet'}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, color: ratedOutlets.length ? scoreColor(avgScore) : 'var(--text3)' }}>
                      {ratedOutlets.length ? avgScore : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {ratedOutlets.length ? `across ${ratedOutlets.length} rated outlets` : 'No scores yet'}
                    </div>
                  </>
                )}
              </div>

              {/* Third chip — contextual */}
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {tab === 'rated' ? 'Outlets rated' : 'Total ratings'}
                </div>
                {tab === 'rated' ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{outlets.filter(o => (o.total_ratings || 0) > 0).length}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>outlets with ratings</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{outlets.reduce((s, o) => s + (o.total_ratings || 0), 0)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>community ratings</div>
                  </>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="tabs" style={{ marginBottom: 16 }}>
              {OUTLET_TABS.map(t => (
                <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t.label}
                  <InfoTip text={t.tip} />
                </div>
              ))}
            </div>

            {/* Region filter + Compare toggle */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>
                  Filter by region
                </div>
                <div className="filter-bar">
                  {[
                    { value: 'all', label: '🌍 Global' },
                    { value: 'UK',  label: '🇬🇧 UK'    },
                    { value: 'US',  label: '🇺🇸 US'    },
                  ].map(r => (
                    <button key={r.value} className={`pill${region === r.value ? ' active' : ''}`} onClick={() => setRegion(r.value)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setCompareMode(m => !m); if (compareMode) setCompareIds([]) }}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px',
                  background: compareMode ? 'var(--coral)' : 'var(--bg)',
                  color: compareMode ? '#fff' : 'var(--text2)',
                  border: `0.5px solid ${compareMode ? 'var(--coral)' : 'var(--border)'}`,
                  borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                ⚖ {compareMode ? 'Cancel' : 'Compare'}
              </button>
            </div>

            {/* Compare hint */}
            {compareMode && compareIds.length < 2 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 12 }}>
                {compareIds.length === 0 ? 'Select two outlets to compare them.' : 'Now select one more outlet.'}
              </div>
            )}

            {/* Comparison panel */}
            {compareMode && compareIds.length === 2 && (() => {
              const a = outlets.find(o => o.id === compareIds[0])
              const b = outlets.find(o => o.id === compareIds[1])
              return a && b ? <ComparePanel a={a} b={b} navigate={navigate} onClear={clearCompare} /> : null
            })()}

            {/* List */}
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {outletsLoading ? (
                [0,1,2,3,4,5,6,7].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < 7 ? '0.5px solid var(--border)' : 'none' }}>
                    <div className="skeleton-shimmer" style={{ width: 26, height: 14, borderRadius: 4, flexShrink: 0, background: 'var(--border)' }} />
                    <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--border)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="skeleton-line skeleton-shimmer" style={{ width: '55%', height: 13, marginBottom: 6 }} />
                      <div className="skeleton-line skeleton-shimmer" style={{ width: '30%', height: 10 }} />
                    </div>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <div className="skeleton-shimmer" style={{ height: 6, borderRadius: 3, background: 'var(--border)' }} />
                      <div className="skeleton-shimmer" style={{ width: 28, height: 10, borderRadius: 3, background: 'var(--border)', marginTop: 6, marginLeft: 'auto' }} />
                    </div>
                  </div>
                ))
              ) : sorted.length === 0 ? (
                <div className="empty-state"><p>No outlets for this region yet.</p></div>
              ) : (
                sorted.map((o, i) => {
                  const score      = o[activeTab.key] || 0
                  const maxScore   = tab === 'rated' ? Math.max(...sorted.map(x => x.total_ratings || 0), 1) : 100
                  const barWidth   = Math.round((score / maxScore) * 100)
                  const isTop3     = i < 3
                  const isSelected = compareIds.includes(o.id)

                  return (
                    <div
                      key={o.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 18px',
                        borderBottom: i < sorted.length - 1 ? '0.5px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: isSelected ? 'rgba(216,90,48,0.06)' : i === 0 ? 'rgba(184,134,11,0.06)' : i === 1 ? 'rgba(160,160,160,0.05)' : i === 2 ? 'rgba(160,82,45,0.05)' : '',
                      }}
                      className="row-hover"
                      onClick={() => compareMode ? toggleCompareOutlet(o.id) : navigate('outlet', { outletId: o.id })}
                    >
                      {/* Rank or compare circle */}
                      {compareMode ? (
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${isSelected ? 'var(--coral)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--coral)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </div>
                      ) : (
                        <span style={{ fontSize: isTop3 ? 15 : 13, fontWeight: isTop3 ? 700 : 400, color: i === 0 ? '#b8860b' : i === 1 ? '#888' : i === 2 ? '#a0522d' : 'var(--text3)', width: 26, flexShrink: 0, textAlign: 'center' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </span>
                      )}
                      <OutletLogo name={o.name} size={38} borderRadius={10} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{o.name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.country || ''}</span>
                          {o.bias_direction && <span style={{ fontSize: 11, color: BIAS_COLORS[o.bias_direction] || 'var(--text3)' }}>{BIAS_LABELS[o.bias_direction]}</span>}
                          {o.total_ratings > 0 && tab !== 'rated' && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.total_ratings} {o.total_ratings === 1 ? 'rating' : 'ratings'}</span>}
                        </div>
                      </div>
                      <div style={{ width: 100, flexShrink: 0 }}>
                        <div className="rank-bar-bg">
                          <div className="rank-bar-fill" style={{ width: `${barWidth}%`, background: tab === 'rated' ? 'var(--coral)' : scoreColor(score) }} />
                        </div>
                        <div style={{ fontSize: 11, textAlign: 'right', marginTop: 3, color: tab === 'rated' ? 'var(--coral)' : scoreColor(score), fontWeight: 600 }}>
                          {tab === 'community' && o.community_score > 0 ? `${(o.community_score / 20).toFixed(1)}★` : score}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>
              Credibility and accuracy scores are AI-generated. Community scores reflect user ratings.
            </div>
          </>
        )}

        {/* ── LEADERBOARD SECTION ── */}
        {section === 'leaderboard' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
              Top contributors ranked by total ratings and comments. The more you rate, the more influence your scores carry.
            </div>

            {lbLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 64 }} />)}
              </div>
            ) : leaders.length === 0 ? (
              <div className="empty-state">
                <h3>No ratings yet</h3>
                <p>Be the first to rate articles and appear on the leaderboard.</p>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('feed')}>Browse articles →</button>
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {leaders.map((l, i) => {
                  const isYou  = user && l.userId === user.id
                  const isTop3 = i < 3
                  return (
                    <div
                      key={l.userId}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                        borderBottom: i < leaders.length - 1 ? '0.5px solid var(--border)' : 'none',
                        background: isYou ? 'var(--bg2)' : 'var(--surface)',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      className="row-hover"
                      onClick={() => navigate('publicProfile', { userId: l.userId })}
                    >
                      {/* Rank */}
                      <span style={{ fontSize: isTop3 ? 15 : 13, fontWeight: isTop3 ? 700 : 400, color: i === 0 ? '#b8860b' : i === 1 ? '#888' : i === 2 ? '#a0522d' : 'var(--text3)', width: 26, flexShrink: 0, textAlign: 'center' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>

                      {/* Avatar */}
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: isYou ? 'var(--coral)' : 'var(--bg2)', border: `2px solid ${l.trust.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: isYou ? '#fff' : 'var(--text2)', flexShrink: 0 }}>
                        {l.username.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Name + trust */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {l.username}
                          {isYou && <span style={{ fontSize: 10, background: 'var(--coral)', color: '#fff', padding: '1px 7px', borderRadius: 20 }}>You</span>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: l.trust.color }}>
                          {l.trust.emoji} {l.trust.label}
                        </span>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                        {[
                          { value: l.articles,  label: 'articles' },
                          { value: l.outlets,   label: 'outlets'  },
                          { value: l.comments,  label: 'comments' },
                        ].map(({ value, label }) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!lbLoading && leaders.length > 0 && user && !leaders.find(l => l.userId === user.id) && (
              <div style={{ marginTop: 16, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
                You're not in the top 25 yet. Keep rating articles to climb the board!
              </div>
            )}
          </>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  )
}
