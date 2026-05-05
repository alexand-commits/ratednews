import React, { useState, useEffect } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import { db } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

const OUTLET_TABS = [
  { id: 'credibility', label: 'Trust',        key: 'overall_score',   desc: 'Overall trust score'         },
  { id: 'accuracy',    label: 'Most Accurate', key: 'accuracy_score',  desc: 'AI accuracy score'           },
  { id: 'community',   label: 'Community',     key: 'community_score', desc: 'Avg community star rating'   },
  { id: 'rated',       label: 'Most Rated',    key: 'total_ratings',   desc: 'Number of community ratings' },
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

export default function RankingsPage({ outlets, navigate, goBack, user, onRefresh }) {
  const [section, setSection] = useState('outlets')  // 'outlets' | 'leaderboard'
  const [tab, setTab]         = useState('credibility')
  const [region, setRegion]   = useState('all')
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

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
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
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
            {/* Summary chips */}
            {topOutlet && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top outlet</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{topOutlet.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{topOutlet[activeTab.key] || 0} {activeTab.desc}</div>
                </div>
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Average</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: tab === 'rated' ? 'var(--text)' : scoreColor(avgScore) }}>{avgScore}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>across {ratedOutlets.length} rated outlets</div>
                </div>
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total ratings</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{outlets.reduce((s, o) => s + (o.total_ratings || 0), 0)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>community ratings</div>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="tabs" style={{ marginBottom: 16 }}>
              {OUTLET_TABS.map(t => (
                <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </div>
              ))}
            </div>

            {/* Region filter */}
            <div className="filter-bar" style={{ marginBottom: 16 }}>
              {['all', 'UK', 'US'].map(r => (
                <button key={r} className={`pill${region === r ? ' active' : ''}`} onClick={() => setRegion(r)}>
                  {r === 'all' ? 'Global' : r}
                </button>
              ))}
            </div>

            {/* List */}
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
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < sorted.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => navigate('outlet', { outletId: o.id })}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseOut={e => e.currentTarget.style.background = ''}
                    >
                      <span style={{ fontSize: isTop3 ? 15 : 13, fontWeight: isTop3 ? 700 : 400, color: i === 0 ? '#b8860b' : i === 1 ? '#888' : i === 2 ? '#a0522d' : 'var(--text3)', width: 26, flexShrink: 0, textAlign: 'center' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
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
                      onClick={() => navigate('publicProfile', { userId: l.userId })}
                      onMouseOver={e => { if (!isYou) e.currentTarget.style.background = 'var(--bg)' }}
                      onMouseOut={e => { if (!isYou) e.currentTarget.style.background = 'var(--surface)' }}
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
