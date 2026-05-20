import React, { useState, useEffect } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import InfoTip from '../components/InfoTip'
import { db } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

// ── Constants ────────────────────────────────────────────────────────────────

const SCORE_TABS = [
  {
    id: 'accuracy', label: 'Quality', key: 'overall_score',
    tip: "AI-assessed quality blended with community ratings once 20+ reader ratings are recorded. Ranked by average across recent articles.",
    unit: '',
  },
  {
    id: 'community', label: 'Community', key: 'community_score',
    tip: 'Average star rating given by RatedNews users (out of 100). Reflects reader trust, independent of AI analysis.',
    unit: '',
  },
  {
    id: 'headlines', label: 'Headlines', key: 'fair_rate',
    tip: 'Percentage of headlines tagged fair — not misleading or clickbait.',
    unit: '%',
  },
]

const REGIONS = [
  { value: 'all',           label: 'All'           },
  { value: 'US',            label: 'US'            },
  { value: 'UK',            label: 'UK'            },
  { value: 'Europe',        label: 'Europe'        },
  { value: 'MiddleEast',    label: 'Middle East'   },
  { value: 'Africa',        label: 'Africa'        },
  { value: 'AsiaPac',       label: 'Asia Pacific'  },
  { value: 'Americas',      label: 'Americas'      },
]

const BIAS_FILTERS = [
  { value: 'all',    label: 'All'      },
  { value: 'left',   label: '← Left'   },
  { value: 'centre', label: '◉ Centre' },
  { value: 'right',  label: '→ Right'  },
]

const BIAS_COLORS = { left: 'var(--blue, #3b82f6)', centre: 'var(--text3)', right: 'var(--red)' }
const BIAS_LABELS = { left: '← Left', centre: '◉ Centre', right: '→ Right' }

const COVERAGE_REGIONS = [
  { value: 'US',            label: 'US'            },
  { value: 'UK',            label: 'UK'            },
  { value: 'Europe',        label: 'Europe'        },
  { value: 'MiddleEast',    label: 'Middle East'   },
  { value: 'Africa',        label: 'Africa'        },
  { value: 'AsiaPac',       label: 'Asia Pacific'  },
  { value: 'Americas',      label: 'Americas'      },
  { value: 'International', label: 'International' },
]

const TRUST_LEVELS = [
  { min: 50, label: 'Expert',           emoji: '🏅', color: '#D85A30' },
  { min: 20, label: 'Trusted Reviewer', emoji: '⭐', color: '#639922' },
  { min: 10, label: 'Contributor',      emoji: '✅', color: '#185FA5' },
  { min: 3,  label: 'Active Member',    emoji: '📰', color: '#6B6760' },
  { min: 0,  label: 'New Member',       emoji: '👋', color: '#9E9B95' },
]
function getTrustLevel(t) {
  return TRUST_LEVELS.find(l => t >= l.min) || TRUST_LEVELS[TRUST_LEVELS.length - 1]
}

const STAT_ROWS = [
  { key: 'overall_score',   label: 'Trust',     max: 100, format: v => v },
  { key: 'accuracy_score',  label: 'Quality',   max: 100, format: v => v },
  { key: 'community_score', label: 'Community', max: 100, format: v => v > 0 ? `${(v / 20).toFixed(1)}★` : '—' },
  { key: 'total_ratings',   label: 'Ratings',   max: null, format: v => v },
]

// ── Suggest modal ─────────────────────────────────────────────────────────────

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
      user_id: user.id, outlet_name: name.trim(),
      website_url: website.trim() || null, reason: reason.trim() || null,
    })
    setLoading(false)
    if (error) showToast('Something went wrong — please try again')
    else setDone(true)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'slideUp 0.2s ease' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 20, marginBottom: 8 }}>Thanks for the suggestion!</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>We'll review <strong>{name}</strong> and add it if it meets our criteria.</p>
            <button onClick={onClose} style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 20, fontWeight: 700 }}>Suggest an outlet</h3>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Know a news source we're missing?</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Outlet name <span style={{ color: 'var(--coral)' }}>*</span></label>
                <input className="compose-input" type="text" placeholder="e.g. The Guardian" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', borderRadius: 10 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Website URL</label>
                <input className="compose-input" type="text" placeholder="theguardian.com" value={website} onChange={e => setWebsite(e.target.value)} style={{ width: '100%', borderRadius: 10 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Why should we add it?</label>
                <textarea className="compose-input" placeholder="Tell us why this outlet deserves a place on RatedNews..." value={reason} onChange={e => setReason(e.target.value)} rows={3} style={{ width: '100%', borderRadius: 10, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} />
              </div>
              <button type="submit" disabled={loading || !name.trim()} style={{ background: loading || !name.trim() ? 'var(--border)' : 'var(--coral)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontWeight: 600, fontSize: 14, cursor: loading || !name.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.15s', marginTop: 4 }}>
                {loading ? 'Submitting…' : 'Submit suggestion'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Compare panel ─────────────────────────────────────────────────────────────

function ComparePanel({ a, b, navigate, onClear }) {
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>⚖ Comparison</div>
        <button onClick={onClear} style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}>Clear</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div>
          <OutletLogo name={a.name} size={32} borderRadius={8} />
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>{a.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.country || ''}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', padding: '0 4px' }}>vs</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><OutletLogo name={b.name} size={32} borderRadius={8} /></div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>{b.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.country || ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STAT_ROWS.map(({ key, label, max, format }) => {
          const va = a[key] || 0, vb = b[key] || 0
          const peak = max || Math.max(va, vb, 1)
          const aWins = va > vb, bWins = vb > va
          return (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: aWins ? scoreColor(va) : 'var(--text2)' }}>{format(va) || '—'}</span>
                    {aWins && <span style={{ fontSize: 9, color: scoreColor(va), fontWeight: 700 }}>▲</span>}
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(va / peak) * 100}%`, background: aWins ? scoreColor(va) : 'var(--text3)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: 'row-reverse' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: bWins ? scoreColor(vb) : 'var(--text2)' }}>{format(vb) || '—'}</span>
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
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>Bias</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: BIAS_COLORS[a.bias_direction] || 'var(--text3)' }}>{BIAS_LABELS[a.bias_direction] || '—'}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: BIAS_COLORS[b.bias_direction] || 'var(--text3)', textAlign: 'right' }}>{BIAS_LABELS[b.bias_direction] || '—'}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        <button onClick={() => navigate('outlet', { outletId: a.id })} style={{ fontSize: 12, fontWeight: 600, padding: '8px 0', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text2)' }}>View {a.name} →</button>
        <button onClick={() => navigate('outlet', { outletId: b.id })} style={{ fontSize: 12, fontWeight: 600, padding: '8px 0', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text2)' }}>View {b.name} →</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OutletsRankingsPage({
  outlets, outletsLoading, navigate, goBack, showToast, user, onLoginClick,
  onRefresh, followedOutletIds = new Set(), toggleFollow,
}) {
  const [section,     setSection]     = useState('outlets')
  const [tab,         setTab]         = useState('accuracy')
  const [region,      setRegion]      = useState('all')
  const [bias,        setBias]        = useState('all')
  const [search,      setSearch]      = useState('')
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds,  setCompareIds]  = useState([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [coverage,    setCoverage]    = useState([])
  const [leaders,     setLeaders]     = useState([])
  const [lbLoading,   setLbLoading]   = useState(false)
  const [lbLoaded,    setLbLoaded]    = useState(false)
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  // Coverage data
  useEffect(() => {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all(
      COVERAGE_REGIONS.map(r =>
        db.from('articles')
          .select('*', { count: 'exact', head: true })
          .eq('article_region', r.value)
          .gte('published_at', since7)
          .then(({ count }) => ({ ...r, count: count || 0 }))
      )
    ).then(results => {
      const total = results.reduce((s, r) => s + r.count, 0) || 1
      setCoverage(results.map(r => ({ ...r, pct: Math.round((r.count / total) * 100) })).sort((a, b) => b.count - a.count))
    })
  }, [])

  // Leaderboard data — lazy loaded
  useEffect(() => {
    if (section !== 'leaderboard' || lbLoaded) return
    setLbLoading(true)
    Promise.all([
      db.from('ratings').select('user_id'),
      db.from('outlet_ratings').select('user_id'),
      db.from('comments').select('user_id'),
    ]).then(([{ data: ar }, { data: or }, { data: co }]) => {
      const counts = {}
      const inc = (rows, type) => (rows || []).forEach(r => {
        if (!r.user_id) return
        if (!counts[r.user_id]) counts[r.user_id] = { userId: r.user_id, articles: 0, outlets: 0, comments: 0 }
        counts[r.user_id][type]++
      })
      inc(ar, 'articles'); inc(or, 'outlets'); inc(co, 'comments')
      const sorted = Object.values(counts)
        .map(c => ({ ...c, total: c.articles + c.outlets + c.comments }))
        .sort((a, b) => b.total - a.total).slice(0, 25)
      if (!sorted.length) { setLeaders([]); setLbLoading(false); setLbLoaded(true); return }
      db.from('profiles').select('user_id, username').in('user_id', sorted.map(c => c.userId)).then(({ data: profiles }) => {
        const pm = {}
        ;(profiles || []).forEach(p => { pm[p.user_id] = p.username })
        setLeaders(sorted.map((c, i) => ({ ...c, rank: i + 1, username: pm[c.userId] || 'Anonymous', trust: getTrustLevel(c.total) })))
        setLbLoading(false); setLbLoaded(true)
      })
    })
  }, [section, lbLoaded])

  function toggleCompare(id) {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length < 2)  return [...prev, id]
      return [prev[1], id]
    })
  }
  function clearCompare() { setCompareIds([]); setCompareMode(false) }

  // ── Sorted list ──────────────────────────────────────────────────────────────
  const activeTab = SCORE_TABS.find(t => t.id === tab)

  const sorted = outlets
    .filter(o => !o.parent_outlet_id)
    .filter(o => region === 'all' || (o.country || 'International') === region)
    .filter(o => bias === 'all' || o.bias_direction === bias)
    .filter(o =>
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.country || '').toLowerCase().includes(search.toLowerCase())
    )
    .slice()
    .sort((a, b) => (b[activeTab.key] || 0) - (a[activeTab.key] || 0))

  const ratedSorted = sorted.filter(o => o[activeTab.key] > 0)
  const avgScore  = ratedSorted.length ? Math.round(ratedSorted.reduce((s, o) => s + o[activeTab.key], 0) / ratedSorted.length) : 0
  const topOutlet = ratedSorted[0]

  const parentCount = outlets.filter(o => !o.parent_outlet_id).length

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}
      <div className="container" style={{ maxWidth: 800 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
              Outlets
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 480 }}>
              {parentCount} outlets ranked by <strong style={{ color: 'var(--text)' }}>AI quality score</strong>, <strong style={{ color: 'var(--text)' }}>political bias</strong>, and <strong style={{ color: 'var(--text)' }}>headline fairness</strong> — blended with community ratings over time.{' '}
              <a onClick={() => navigate('about')} style={{ color: 'var(--coral)', cursor: 'pointer', textDecoration: 'none', fontWeight: 500 }}>How scores are built →</a>
            </p>
          </div>
          <button
            onClick={() => { if (!user) { onLoginClick(); return } setShowSuggest(true) }}
            className="border-hover"
            style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: 'var(--coral)', cursor: 'pointer' }}
          >
            ➕ Suggest
          </button>
        </div>

        {/* Section tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <div className={`tab${section === 'outlets' ? ' active' : ''}`} onClick={() => setSection('outlets')}>📡 Outlets</div>
          <div className={`tab${section === 'leaderboard' ? ' active' : ''}`} onClick={() => setSection('leaderboard')}>🏅 Contributors</div>
          <div className={`tab${section === 'coverage' ? ' active' : ''}`} onClick={() => setSection('coverage')}>🗺 Coverage</div>
        </div>

        {/* ── OUTLETS SECTION ─────────────────────────────────────────────── */}
        {section === 'outlets' && (
          <>
            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 80 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top outlet</div>
                {topOutlet ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, margin: '6px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🥇 {topOutlet.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {tab === 'community' ? `${((topOutlet.community_score || 0) / 20).toFixed(1)}★ community` : `${topOutlet[activeTab.key] || 0} ${activeTab.label.toLowerCase()} score`}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text3)', margin: '6px 0 4px' }}>—</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>No data yet</div>
                  </>
                )}
              </div>
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Average</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: ratedSorted.length ? scoreColor(avgScore) : 'var(--text3)' }}>
                  {ratedSorted.length ? (tab === 'community' ? `${(avgScore / 20).toFixed(1)}★` : avgScore) : '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {ratedSorted.length ? `across ${ratedSorted.length} rated outlets` : 'No scores yet'}
                </div>
              </div>
            </div>

            {/* Movers strip */}
            {(() => {
              const withDelta = outlets.filter(o => o.accuracy_delta_7d !== null && o.accuracy_delta_7d !== undefined)
              if (withDelta.length < 2) return null
              const risers  = [...withDelta].sort((a, b) => b.accuracy_delta_7d - a.accuracy_delta_7d).slice(0, 3).filter(o => o.accuracy_delta_7d > 0)
              const fallers = [...withDelta].sort((a, b) => a.accuracy_delta_7d - b.accuracy_delta_7d).slice(0, 3).filter(o => o.accuracy_delta_7d < 0)
              if (!risers.length && !fallers.length) return null
              return (
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 12 }}>Score movers · 7-day quality change</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      {risers.map(o => (
                        <div key={o.id} onClick={() => navigate('outlet', { outletId: o.id })} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, cursor: 'pointer' }}>
                          <OutletLogo name={o.name} size={22} borderRadius={5} />
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>+{o.accuracy_delta_7d}</span>
                        </div>
                      ))}
                      {!risers.length && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No risers yet</div>}
                    </div>
                    <div>
                      {fallers.map(o => (
                        <div key={o.id} onClick={() => navigate('outlet', { outletId: o.id })} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, cursor: 'pointer' }}>
                          <OutletLogo name={o.name} size={22} borderRadius={5} />
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{o.accuracy_delta_7d}</span>
                        </div>
                      ))}
                      {!fallers.length && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No fallers yet</div>}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Score tabs + compare toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="tabs" style={{ flex: 1, marginBottom: 0 }}>
                {SCORE_TABS.map(t => (
                  <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t.label}
                    <InfoTip text={t.tip} />
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setCompareMode(m => !m); if (compareMode) setCompareIds([]) }}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', background: compareMode ? 'var(--coral)' : 'var(--bg)', color: compareMode ? '#fff' : 'var(--text2)', border: `0.5px solid ${compareMode ? 'var(--coral)' : 'var(--border)'}`, borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}
              >
                ⚖ {compareMode ? 'Cancel' : 'Compare'}
              </button>
            </div>

            {/* Search */}
            <div className="search-bar" style={{ marginBottom: 10 }}>
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search outlets or countries..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Region filter */}
            <div className="filter-bar" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, alignSelf: 'center' }}>Region</span>
              {REGIONS.map(r => (
                <button key={r.value} className={`pill${region === r.value ? ' active' : ''}`} onClick={() => setRegion(r.value)}>{r.label}</button>
              ))}
            </div>

            {/* Bias filter */}
            <div className="filter-bar" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, alignSelf: 'center' }}>Bias</span>
              {BIAS_FILTERS.map(b => (
                <button key={b.value} className={`pill${bias === b.value ? ' active' : ''}`} onClick={() => setBias(b.value)}>{b.label}</button>
              ))}
            </div>

            {/* Compare hint */}
            {compareMode && compareIds.length < 2 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', marginBottom: 12 }}>
                {compareIds.length === 0 ? 'Select two outlets to compare them.' : 'Now select one more outlet.'}
              </div>
            )}

            {/* Compare panel */}
            {compareMode && compareIds.length === 2 && (() => {
              const a = outlets.find(o => o.id === compareIds[0])
              const b = outlets.find(o => o.id === compareIds[1])
              return a && b ? <ComparePanel a={a} b={b} navigate={navigate} onClear={clearCompare} /> : null
            })()}

            {/* Headlines tab */}
            {tab === 'headlines' ? (() => {
              const withH = outlets
                .filter(o => !o.parent_outlet_id)
                .filter(o => region === 'all' || (o.country || 'International') === region)
                .filter(o => o.fair_rate != null)
              const fairest    = [...withH].sort((a, b) => (b.fair_rate || 0) - (a.fair_rate || 0)).slice(0, 8)
              const clickbaity = [...withH].sort((a, b) => (b.clickbait_rate || 0) - (a.clickbait_rate || 0)).slice(0, 8)
              if (!withH.length) return <div className="empty-state"><p>Headline data not yet available.</p></div>
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Fairest headlines */}
                  <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>✓</span>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>Fairest headlines</span>
                    </div>
                    {fairest.map((o, i) => (
                      <div key={o.id} onClick={() => navigate('outlet', { outletId: o.id })}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < fairest.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                        className="row-hover"
                      >
                        <span style={{ fontSize: 12, color: 'var(--text3)', width: 20, flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
                        <OutletLogo name={o.name} size={30} borderRadius={7} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{o.fair_rate}% fair</div>
                          {o.clickbait_rate > 0 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{o.clickbait_rate}% clickbait</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Most clickbait */}
                  <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>⚠</span>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>Most clickbait</span>
                    </div>
                    {clickbaity.map((o, i) => (
                      <div key={o.id} onClick={() => navigate('outlet', { outletId: o.id })}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < clickbaity.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                        className="row-hover"
                      >
                        <span style={{ fontSize: 12, color: 'var(--text3)', width: 20, flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
                        <OutletLogo name={o.name} size={30} borderRadius={7} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{o.clickbait_rate}% clickbait</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{o.misleading_rate}% misleading</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })() : (
              /* Standard ranked list */
              <>
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
                        </div>
                      </div>
                    ))
                  ) : sorted.length === 0 ? (
                    <div className="empty-state"><p>No outlets match your filters.</p></div>
                  ) : (
                    sorted.map((o, i) => {
                      const score      = o[activeTab.key] || 0
                      const isTop3     = i < 3 && !search && region === 'all' && bias === 'all'
                      const isSelected = compareIds.includes(o.id)
                      const children   = outlets.filter(c => c.parent_outlet_id === o.id)

                      return (
                        <div key={o.id}
                          style={{
                            borderBottom: i < sorted.length - 1 ? '0.5px solid var(--border)' : 'none',
                            cursor: 'pointer', transition: 'background 0.15s',
                            background: isSelected ? 'rgba(216,90,48,0.06)' : isTop3 && i === 0 ? 'rgba(184,134,11,0.06)' : isTop3 && i === 1 ? 'rgba(160,160,160,0.05)' : isTop3 && i === 2 ? 'rgba(160,82,45,0.05)' : '',
                          }}
                          className="row-hover"
                          onClick={() => compareMode ? toggleCompare(o.id) : navigate('outlet', { outletId: o.id })}
                        >
                          {/* Main row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px' }}>
                            {/* Rank / compare */}
                            {compareMode ? (
                              <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSelected ? 'var(--coral)' : 'var(--border)'}`, background: isSelected ? 'var(--coral)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                              </div>
                            ) : (
                              <span style={{ fontSize: isTop3 ? 15 : 12, fontWeight: isTop3 ? 700 : 400, color: i === 0 ? '#b8860b' : i === 1 ? '#888' : i === 2 ? '#a0522d' : 'var(--text3)', width: 26, flexShrink: 0, textAlign: 'center' }}>
                                {isTop3 && i === 0 ? '🥇' : isTop3 && i === 1 ? '🥈' : isTop3 && i === 2 ? '🥉' : i + 1}
                              </span>
                            )}

                            <OutletLogo name={o.name} size={36} borderRadius={9} />

                            {/* Name + meta */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{o.name}</div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.country || 'International'}</span>
                                {o.bias_direction && <span style={{ fontSize: 11, color: BIAS_COLORS[o.bias_direction] }}>{BIAS_LABELS[o.bias_direction]}</span>}
                                {o.total_ratings > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{o.total_ratings} {o.total_ratings === 1 ? 'rating' : 'ratings'}</span>}
                              </div>
                            </div>

                            {/* Score bar */}
                            <div style={{ width: 90, flexShrink: 0 }}>
                              <div className="rank-bar-bg">
                                <div className="rank-bar-fill" style={{ width: `${Math.round((score / 100) * 100)}%`, background: scoreColor(score) }} />
                              </div>
                              <div style={{ fontSize: 11, textAlign: 'right', marginTop: 3, color: scoreColor(score), fontWeight: 600 }}>
                                {tab === 'community' && o.community_score > 0 ? `${(o.community_score / 20).toFixed(1)}★` : score || '—'}
                              </div>
                            </div>

                            {/* Follow button */}
                            <button
                              onClick={e => { e.stopPropagation(); if (!user) { onLoginClick(); return } toggleFollow(o.id) }}
                              style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: followedOutletIds.has(o.id) ? '1px solid var(--border)' : '1px solid var(--coral)', background: followedOutletIds.has(o.id) ? 'var(--bg)' : 'rgba(216,90,48,0.08)', color: followedOutletIds.has(o.id) ? 'var(--text3)' : 'var(--coral)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                              {followedOutletIds.has(o.id) ? '✓' : '+'}
                            </button>
                          </div>

                          {/* Section chips */}
                          {children.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 18px 10px 62px' }}>
                              <span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center' }}>Sections:</span>
                              {children.map(child => (
                                <button
                                  key={child.id}
                                  onClick={e => { e.stopPropagation(); navigate('outlet', { outletId: child.id }) }}
                                  style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer' }}
                                >
                                  {child.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>
                  Quality scores are AI-generated based on consistent analysis across all outlets. Scores reflect patterns across recent articles, not individual verdicts.
                </div>
              </>
            )}

            {/* Suggest CTA */}
            <div style={{ marginTop: 28, textAlign: 'center', padding: '20px', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>Don't see an outlet you trust?</p>
              <button onClick={() => { if (!user) { onLoginClick(); return } setShowSuggest(true) }} style={{ background: 'none', border: '1px solid var(--coral)', color: 'var(--coral)', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ➕ Suggest an outlet
              </button>
            </div>
          </>
        )}

        {/* ── LEADERBOARD SECTION ─────────────────────────────────────────── */}
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
                  const isYou = user && l.userId === user.id
                  const isTop3 = i < 3
                  return (
                    <div key={l.userId}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < leaders.length - 1 ? '0.5px solid var(--border)' : 'none', background: isYou ? 'var(--bg2)' : 'var(--surface)', cursor: l.username !== 'Anonymous' ? 'pointer' : 'default', transition: 'background 0.15s' }}
                      className={l.username !== 'Anonymous' ? 'row-hover' : ''}
                      onClick={() => l.username !== 'Anonymous' && navigate('publicProfile', { userId: l.userId })}
                    >
                      <span style={{ fontSize: isTop3 ? 15 : 13, fontWeight: isTop3 ? 700 : 400, color: i === 0 ? '#b8860b' : i === 1 ? '#888' : i === 2 ? '#a0522d' : 'var(--text3)', width: 26, flexShrink: 0, textAlign: 'center' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: isYou ? 'var(--coral)' : 'var(--bg2)', border: `2px solid ${l.trust.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: isYou ? '#fff' : 'var(--text2)', flexShrink: 0 }}>
                        {l.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {l.username}
                          {isYou && <span style={{ fontSize: 10, background: 'var(--coral)', color: '#fff', padding: '1px 7px', borderRadius: 20 }}>You</span>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: l.trust.color }}>{l.trust.emoji} {l.trust.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                        {[{ value: l.articles, label: 'articles' }, { value: l.outlets, label: 'outlets' }, { value: l.comments, label: 'comments' }].map(({ value, label }) => (
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

        {/* ── COVERAGE SECTION ────────────────────────────────────────────── */}
        {section === 'coverage' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
              How articles published in the last 7 days are distributed across world regions. Regions under 5% of total coverage are flagged as gaps.
            </div>
            {coverage.length === 0 ? (
              <div className="empty-state"><p>Loading coverage data…</p></div>
            ) : (() => {
              const maxCount = coverage[0].count || 1
              const total    = coverage.reduce((s, r) => s + r.count, 0)
              const gaps     = coverage.filter(r => r.pct < 5)
              return (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total articles</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{total.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>last 7 days</div>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Coverage gaps</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: gaps.length ? 'var(--red)' : 'var(--green)' }}>{gaps.length}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{gaps.length ? gaps.map(g => g.label).join(', ') : 'All regions covered'}</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 16 }}>Regional breakdown</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {coverage.map(r => (
                        <div key={r.value}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: r.pct < 5 ? 'var(--red)' : 'var(--text1)', fontWeight: r.pct < 5 ? 600 : 400 }}>{r.label}{r.pct < 5 ? ' ↓' : ''}</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r.count.toLocaleString()} articles · {r.pct}%</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, borderRadius: 3, background: r.pct < 5 ? 'var(--red)' : r.pct > 30 ? 'var(--coral)' : 'var(--text3)', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {gaps.length > 0 && (
                    <div style={{ marginTop: 16, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text1)' }}>Underrepresented regions:</strong> {gaps.map(g => g.label).join(', ')} each account for less than 5% of recent coverage.
                    </div>
                  )}
                </>
              )
            })()}
          </>
        )}

        <div style={{ height: 16 }} />
      </div>

      {showSuggest && (
        <SuggestModal user={user} onLoginClick={onLoginClick} showToast={showToast} onClose={() => setShowSuggest(false)} />
      )}
    </div>
  )
}
