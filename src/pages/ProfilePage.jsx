import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'

// ── Trust level ───────────────────────────────────────────────────────────────
function getTrustLevel(total) {
  if (total >= 50) return { label: 'Expert',           emoji: '🏅', color: '#D85A30', next: null,  nextAt: null }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: '#639922', next: 'Expert',           nextAt: 50 }
  if (total >= 10) return { label: 'Contributor',      emoji: '✅', color: '#185FA5', next: 'Trusted Reviewer', nextAt: 20 }
  if (total >= 3)  return { label: 'Active Member',    emoji: '📰', color: '#6B6760', next: 'Contributor',      nextAt: 10 }
  return           { label: 'New Member',              emoji: '👋', color: '#9E9B95', next: 'Active Member',    nextAt: 3  }
}

function calcDaysActive(ratings, comments) {
  const days = new Set()
  ;[...ratings, ...comments].forEach(r => { if (r.created_at) days.add(r.created_at.slice(0, 10)) })
  return days.size
}

// ── Activity chart — last 30 days ─────────────────────────────────────────────
function ActivityChart({ ratings, outletRatings, comments }) {
  const days = 30
  const counts = {}
  const today = new Date()

  // Build date keys for last 30 days
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    counts[d.toISOString().slice(0, 10)] = 0
  }

  // Count all activity by day
  ;[...ratings, ...outletRatings, ...comments].forEach(r => {
    const day = (r.created_at || '').slice(0, 10)
    if (counts[day] !== undefined) counts[day]++
  })

  const entries = Object.entries(counts) // [date, count]
  const max = Math.max(1, ...entries.map(([, c]) => c))
  const totalActivity = entries.reduce((s, [, c]) => s + c, 0)

  if (totalActivity === 0) return null

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>Activity — last 30 days</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{totalActivity} actions</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 52 }}>
        {entries.map(([date, count]) => {
          const pct = count / max
          const isToday = date === today.toISOString().slice(0, 10)
          return (
            <div
              key={date}
              title={`${date}: ${count} action${count !== 1 ? 's' : ''}`}
              style={{
                flex: 1,
                height: count === 0 ? 4 : `${Math.max(8, pct * 52)}px`,
                background: count === 0
                  ? 'var(--border)'
                  : isToday
                    ? 'var(--coral)'
                    : `rgba(216, 90, 48, ${0.3 + pct * 0.7})`,
                borderRadius: 3,
                transition: 'height 0.4s ease',
                cursor: count > 0 ? 'pointer' : 'default',
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}

// ── Bias fingerprint ──────────────────────────────────────────────────────────
function BiasFingerprint({ ratings }) {
  const counts = { left: 0, centre: 0, right: 0 }
  ratings.forEach(r => {
    const dir = r.articles?.bias_direction
    if (dir && counts[dir] !== undefined) counts[dir]++
  })
  const total = counts.left + counts.centre + counts.right
  if (total === 0) return null

  const leftPct   = Math.round((counts.left   / total) * 100)
  const centrePct = Math.round((counts.centre / total) * 100)
  const rightPct  = Math.round((counts.right  / total) * 100)

  // Personal lean label
  let leanLabel = 'Balanced reader'
  let leanColor = 'var(--text2)'
  if (leftPct > 50)   { leanLabel = 'Reads mostly left-leaning sources';   leanColor = '#3b82f6' }
  else if (rightPct > 50) { leanLabel = 'Reads mostly right-leaning sources'; leanColor = '#ef4444' }
  else if (centrePct > 50) { leanLabel = 'Favours centrist sources';           leanColor = '#639922' }
  else if (leftPct > rightPct + 15)  { leanLabel = 'Leans left in source choices';   leanColor = '#3b82f6' }
  else if (rightPct > leftPct + 15)  { leanLabel = 'Leans right in source choices';  leanColor = '#ef4444' }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>
        Bias fingerprint
      </div>

      {/* Spectrum bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
          {leftPct > 0   && <div style={{ width: `${leftPct}%`,   background: '#3b82f6', transition: 'width 0.5s ease' }} />}
          {centrePct > 0 && <div style={{ width: `${centrePct}%`, background: '#639922', transition: 'width 0.5s ease' }} />}
          {rightPct > 0  && <div style={{ width: `${rightPct}%`,  background: '#ef4444', transition: 'width 0.5s ease' }} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)' }}>
          <span>← Left</span>
          <span>Centre</span>
          <span>Right →</span>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        {[
          { label: 'Left',   pct: leftPct,   color: '#3b82f6', count: counts.left   },
          { label: 'Centre', pct: centrePct, color: '#639922', count: counts.centre },
          { label: 'Right',  pct: rightPct,  color: '#ef4444', count: counts.right  },
        ].map(({ label, pct, color, count }) => (
          <div key={label} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{pct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label} ({count})</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: leanColor, fontWeight: 500, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
        {leanLabel}
      </div>
    </div>
  )
}

// ── Topic breakdown ───────────────────────────────────────────────────────────
const CATEGORY_EMOJIS = {
  Politics: '🏛', Business: '📈', Sport: '⚽', Tech: '💻',
  Science: '🔬', Health: '🏥', Environment: '🌱', Entertainment: '🎬',
  Crime: '⚖️', Travel: '✈️', Education: '🎓', World: '🌍',
}

function TopicBreakdown({ ratings, noMargin = false }) {
  const counts = {}
  ratings.forEach(r => {
    const cat = r.articles?.category
    if (cat) counts[cat] = (counts[cat] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  if (entries.length === 0) return null
  const max = entries[0][1]

  const COLORS = ['#D85A30', '#185FA5', '#639922', '#8B5CF6']

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: noMargin ? 0 : 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>
        Topics rated
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(([cat, count], i) => {
          const pct = Math.round((count / max) * 100)
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{CATEGORY_EMOJIS[cat] || '📰'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
              <div style={{ width: 48, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', width: 18, textAlign: 'right', flexShrink: 0 }}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage({ user, navigate, goBack, showToast, followedOutletIds = new Set(), allOutlets = [], toggleFollow, savedArticleIds = new Set(), toggleSave }) {
  const [articleRatings, setArticleRatings] = useState([])
  const [outletRatings, setOutletRatings]   = useState([])
  const [comments, setComments]             = useState([])
  const [savedItems, setSavedItems]         = useState([])
  const [loading, setLoading]               = useState(true)
  const [tab, setTab]                       = useState('ratings')
  const [profile, setProfile]               = useState(null)
  const [editingName, setEditingName]       = useState(false)
  const [nameInput, setNameInput]           = useState('')
  const [nameSaving, setNameSaving]         = useState(false)
  const [nameError, setNameError]           = useState('')

  const followedOutlets = allOutlets.filter(o => followedOutletIds.has(o.id))

  useEffect(() => {
    if (!user) return
    Promise.all([
      db.from('profiles').select('username').eq('user_id', user.id).maybeSingle(),
      db.from('ratings')
        .select('*, articles(id, title, category, bias_direction, outlets(name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db.from('outlet_ratings')
        .select('*, outlets(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db.from('comments')
        .select('*, articles(id, title), outlets(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db.from('saved_articles')
        .select('*, articles(id, title, published_at, category, ai_summary, outlets(name, country))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: prof }, { data: ar }, { data: or }, { data: co }, { data: sv }]) => {
      setProfile(prof)
      setArticleRatings(ar || [])
      setOutletRatings(or || [])
      setComments(co || [])
      setSavedItems(sv || [])
      setLoading(false)
    })
  }, [user])

  async function saveUsername() {
    const val = nameInput.trim()
    if (!val) { setNameError('Username cannot be empty'); return }
    if (val.length < 3) { setNameError('At least 3 characters'); return }
    if (val.length > 20) { setNameError('Max 20 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setNameError('Letters, numbers and underscores only'); return }
    setNameSaving(true)
    setNameError('')
    // Uniqueness check
    const { data: existing } = await db
      .from('profiles')
      .select('user_id')
      .eq('username', val)
      .neq('user_id', user.id)
      .maybeSingle()
    if (existing) { setNameError('Username already taken'); setNameSaving(false); return }
    const { error } = await db.from('profiles').update({ username: val }).eq('user_id', user.id)
    if (error) { setNameError('Could not save — try again'); setNameSaving(false); return }
    setProfile(p => ({ ...p, username: val }))
    setEditingName(false)
    setNameSaving(false)
    showToast('Username updated!')
  }

  if (!user) { navigate('feed'); return null }

  const displayName  = profile?.username || 'Reader'
  const initials     = displayName.slice(0, 2).toUpperCase()
  const memberSince  = new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const totalRatings = articleRatings.length + outletRatings.length
  const totalContrib = totalRatings + comments.length
  const trust        = getTrustLevel(totalContrib)
  const daysActive   = calcDaysActive([...articleRatings, ...outletRatings], comments)

  const allStars = [...articleRatings, ...outletRatings].map(r => r.overall_stars || 0).filter(Boolean)
  const avgStars = allStars.length ? (allStars.reduce((a, b) => a + b, 0) / allStars.length).toFixed(1) : null

  // Media diet
  const outletCounts = {}
  articleRatings.forEach(r => {
    const name = r.articles?.outlets?.name
    if (name) outletCounts[name] = (outletCounts[name] || 0) + 1
  })
  const mediaDiet = Object.entries(outletCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)

  function RatingBadges({ accuracy, bias, headline }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {accuracy && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)', border: '0.5px solid var(--border)' }}>{accuracy.replace(/_/g, ' ')}</span>}
        {bias     && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)', border: '0.5px solid var(--border)' }}>{bias.replace(/_/g, ' ')}</span>}
        {headline && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)', border: '0.5px solid var(--border)' }}>{headline}</span>}
      </div>
    )
  }

  function StarRow({ stars }) {
    return <span style={{ fontSize: 16, color: 'var(--amber)' }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
  }

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 700 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        {/* Hero card */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={e => { setNameInput(e.target.value); setNameError('') }}
                      onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingName(false) }}
                      placeholder="Your username"
                      maxLength={20}
                      style={{ fontSize: 15, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${nameError ? 'var(--red)' : 'var(--coral)'}`, background: 'var(--bg)', color: 'var(--text)', outline: 'none', width: 160 }}
                    />
                    <button
                      onClick={saveUsername}
                      disabled={nameSaving}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: 'none', background: 'var(--coral)', color: '#fff', cursor: 'pointer', opacity: nameSaving ? 0.6 : 1 }}
                    >
                      {nameSaving ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameError('') }}
                      style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                  {nameError && <div style={{ fontSize: 11, color: 'var(--red)', marginLeft: 2 }}>{nameError}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>3–20 chars · letters, numbers, underscores</div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{displayName}</div>
                  <button
                    onClick={() => { setNameInput(displayName); setEditingName(true); setNameError('') }}
                    title="Edit username"
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer', lineHeight: 1.4 }}
                  >
                    Edit
                  </button>
                </div>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--bg)', border: `1.5px solid ${trust.color}`, color: trust.color, whiteSpace: 'nowrap' }}>
                {trust.emoji} {trust.label}
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { value: articleRatings.length,   label: 'Articles rated' },
              { value: outletRatings.length,    label: 'Outlets rated'  },
              { value: followedOutletIds.size,  label: 'Following'      },
              { value: savedItems.length,       label: 'Saved'          },
              { value: comments.length,         label: 'Comments'       },
              { value: daysActive,              label: 'Days active'    },
              ...(avgStars ? [{ value: `${avgStars}★`, label: 'Avg rating', color: 'var(--amber)' }] : []),
            ].map(({ value, label, color }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Trust progress */}
          {trust.next ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                <span>{totalContrib} contributions</span>
                <span>{trust.nextAt - totalContrib} more to reach <strong>{trust.next}</strong></span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (totalContrib / trust.nextAt) * 100)}%`, background: trust.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: trust.color, fontWeight: 600 }}>🏅 Maximum trust level reached!</div>
          )}
        </div>

        {/* Insights — only show when there's data */}
        {!loading && (
          <>
            <ActivityChart ratings={articleRatings} outletRatings={outletRatings} comments={comments} />
            <BiasFingerprint ratings={articleRatings} />

            {/* Topics rated + Media diet — side by side */}
            {(articleRatings.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <TopicBreakdown ratings={articleRatings} noMargin />
                {mediaDiet.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Media diet</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {mediaDiet.map(([name, count]) => {
                        const pct = Math.round((count / articleRatings.length) * 100)
                        return (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <OutletLogo name={name} size={22} borderRadius={5} />
                            <span style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                            <div style={{ width: 48, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--coral)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text3)', width: 18, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <div className={`tab${tab === 'ratings' ? ' active' : ''}`} onClick={() => setTab('ratings')}>
            Ratings {totalRatings > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({totalRatings})</span>}
          </div>
          <div className={`tab${tab === 'saved' ? ' active' : ''}`} onClick={() => setTab('saved')}>
            Saved {savedItems.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({savedItems.length})</span>}
          </div>
          <div className={`tab${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
            Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
          </div>
          <div className={`tab${tab === 'following' ? ' active' : ''}`} onClick={() => setTab('following')}>
            Following {followedOutlets.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({followedOutlets.length})</span>}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}
          </div>
        ) : tab === 'ratings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {totalRatings === 0 ? (
              <div className="empty-state">
                <h3>No ratings yet</h3>
                <p>Rate articles and outlets to build your profile.</p>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('feed')}>Browse articles</button>
              </div>
            ) : (
              <>
                {articleRatings.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginBottom: 4 }}>Article ratings</div>
                    {articleRatings.map(r => (
                      <div
                        key={r.id}
                        style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer' }}
                        onClick={() => r.articles?.id && navigate('article', { articleId: r.articles.id })}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                          {r.articles?.outlets?.name || 'Unknown outlet'} · {timeAgo(r.created_at)}
                        </div>
                        <div style={{ fontSize: 14, fontFamily: 'Playfair Display, serif', lineHeight: 1.4, marginBottom: 8 }}>
                          {r.articles?.title || 'Article'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <StarRow stars={r.overall_stars || 0} />
                          <RatingBadges accuracy={r.accuracy_vote} bias={r.bias_vote} headline={r.headline_vote} />
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {outletRatings.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginBottom: 4, marginTop: 8 }}>Outlet ratings</div>
                    {outletRatings.map(r => (
                      <div
                        key={r.id}
                        style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer' }}
                        onClick={() => r.outlets?.id && navigate('outlet', { outletId: r.outlets.id })}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Outlet · {timeAgo(r.created_at)}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{r.outlets?.name || 'Unknown outlet'}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <StarRow stars={r.overall_stars || 0} />
                          <RatingBadges accuracy={r.accuracy_vote} bias={r.bias_vote} />
                        </div>
                        {r.review_text && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>"{r.review_text}"</div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        ) : tab === 'saved' ? (
          /* Saved articles tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedItems.length === 0 ? (
              <div className="empty-state">
                <h3>No saved articles yet</h3>
                <p>Tap 🔖 on any article to save it for later.</p>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('feed')}>Browse articles</button>
              </div>
            ) : (
              savedItems.map(s => {
                const article = s.articles
                if (!article) return null
                return (
                  <div
                    key={s.id}
                    style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer' }}
                    onClick={() => navigate('article', { articleId: article.id })}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                      {article.outlets?.name || 'Unknown outlet'} · saved {timeAgo(s.created_at)}
                    </div>
                    <div style={{ fontSize: 14, fontFamily: 'Playfair Display, serif', lineHeight: 1.4, marginBottom: article.ai_summary ? 6 : 0 }}>
                      {article.title || 'Article'}
                    </div>
                    {article.ai_summary && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 8,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {article.ai_summary}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {article.category && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{article.category}</span>
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          toggleSave(article.id)
                          setSavedItems(prev => prev.filter(x => x.id !== s.id))
                        }}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer', marginLeft: 'auto' }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : tab === 'following' ? (
          /* Following tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {followedOutlets.length === 0 ? (
              <div className="empty-state">
                <h3>Not following anyone yet</h3>
                <p>Follow outlets you trust to keep track of them here.</p>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('outlets')}>
                  Browse outlets →
                </button>
              </div>
            ) : (
              followedOutlets.map(outlet => {
                const score = outlet.overall_score || 0
                return (
                  <div
                    key={outlet.id}
                    style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onClick={() => navigate('outlet', { outletId: outlet.id })}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <OutletLogo name={outlet.name} size={40} borderRadius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{outlet.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {outlet.country || 'Global'} · {outlet.bias_direction ? `${outlet.bias_direction.charAt(0).toUpperCase() + outlet.bias_direction.slice(1)} bias` : 'Centre bias'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: score >= 70 ? 'var(--green-dark)' : score >= 50 ? 'var(--amber)' : 'var(--red)' }}>{score}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Trust score</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFollow(outlet.id) }}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                    >
                      Unfollow
                    </button>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {comments.length === 0 ? (
              <div className="empty-state">
                <h3>No comments yet</h3>
                <p>Join the discussion on any article.</p>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('feed')}>Browse articles</button>
              </div>
            ) : (
              comments.map((c, i) => (
                <div
                  key={c.id}
                  style={{ padding: '14px 18px', borderBottom: i < comments.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => c.articles?.id && navigate('article', { articleId: c.articles.id })}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = ''}
                >
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                    On: <span style={{ color: 'var(--text2)' }}>{c.articles?.title || 'Article'}</span> · {timeAgo(c.created_at)}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{c.body}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                    <span>▲ {c.upvotes || 0}</span>
                    <span>▼ {c.downvotes || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
