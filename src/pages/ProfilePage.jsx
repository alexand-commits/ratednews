import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import UserAvatar, { AVATAR_COLORS } from '../components/UserAvatar'
import RatingDots from '../components/RatingDots'

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

function calcStreak(views) {
  if (!views.length) return 0
  const days = new Set(views.map(v => (v.viewed_at || '').slice(0, 10)))
  const today = new Date()
  const fmt = d => d.toISOString().slice(0, 10)
  let cursor = new Date(today)
  // If today has no views yet, allow streak to start from yesterday
  if (!days.has(fmt(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(fmt(cursor))) return 0
  }
  let streak = 0
  while (days.has(fmt(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
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


// ── Topic breakdown ───────────────────────────────────────────────────────────
const CATEGORY_EMOJIS = {
  Politics: '🏛', Business: '📈', Sport: '⚽', Tech: '💻',
  Science: '🔬', Health: '🏥', Environment: '🌱', Entertainment: '🎬',
  Crime: '🔍', Travel: '✈️', Education: '🎓', World: '🌍',
  Conflict: '⚔️',
}

function TopicBreakdown({ ratings, views, noMargin = false }) {
  const counts = {}
  // Prefer views as primary signal (larger dataset), fall back to ratings
  const source = views.length > 0 ? views : ratings
  source.forEach(r => {
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
  const [votedComments, setVotedComments]   = useState([])
  const [savedItems, setSavedItems]         = useState([])
  const [articleViews, setArticleViews]     = useState([])
  const [loading, setLoading]               = useState(true)
  const [tab, setTab]                       = useState('ratings')
  const [profile, setProfile]               = useState(null)
  const [editingName, setEditingName]       = useState(false)
  const [nameInput, setNameInput]           = useState('')
  const [nameSaving, setNameSaving]         = useState(false)
  const [nameError, setNameError]           = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput]             = useState('')
  const [deleting, setDeleting]                   = useState(false)
  const [showOnboarding, setShowOnboarding]       = useState(false)
  const [editingLook, setEditingLook]             = useState(false)   // avatar + bio editor
  const [bioInput, setBioInput]                   = useState('')
  const [lookColor, setLookColor]                 = useState(null)
  const [lookEmoji, setLookEmoji]                 = useState('')
  const [lookSaving, setLookSaving]               = useState(false)
  const [isPublic,       setIsPublic]             = useState(false)
  const [togglingPublic, setTogglingPublic]       = useState(false)
  const [showProfileInfo, setShowProfileInfo]     = useState(false)
  const [linkCopied,     setLinkCopied]           = useState(false)
  const [voteFilter,     setVoteFilter]           = useState('up')
  const [commentSort,    setCommentSort]          = useState('recent')

  const followedOutlets = allOutlets.filter(o => followedOutletIds.has(o.id))

  // Redirect unauthenticated users — must be in useEffect (never during SSR render)
  useEffect(() => {
    if (!user) navigate('feed')
  }, [user?.id])

  // Onboarding banner — show until explicitly dismissed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('rn_onboarding_dismissed')
      if (!dismissed) setShowOnboarding(true)
    }
  }, [])

  function dismissOnboarding() {
    localStorage.setItem('rn_onboarding_dismissed', '1')
    setShowOnboarding(false)
  }

  useEffect(() => {
    if (!user) return
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    Promise.all([
      db.from('profiles').select('username, public_profile, username_changed_at, bio, avatar_color, avatar_emoji').eq('user_id', user.id).maybeSingle(),
      db.from('ratings')
        .select('*, articles(id, title, category, outlets(name))')
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
      db.from('comment_votes')
        .select('dir, created_at, comments(id, body, created_at, upvotes, downvotes, articles(id, title), outlets(id, name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db.from('saved_articles')
        .select('*, articles(id, title, published_at, category, summary, outlets(name, country))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db.from('article_views')
        .select('viewed_at, articles(id, category, outlets(name))')
        .eq('user_id', user.id)
        .gte('viewed_at', ninetyDaysAgo)
        .order('viewed_at', { ascending: false }),
    ]).then(async ([{ data: prof }, { data: ar }, { data: or }, { data: co }, { data: cv }, { data: sv }, { data: av }]) => {
      setProfile(prof)
      setIsPublic(prof?.public_profile || false)
      setArticleRatings(ar || [])
      setOutletRatings(or || [])
      setComments(co || [])
      setVotedComments(cv || [])
      setArticleViews(av || [])

      // If the embedded join returned rows but article data is null (FK not wired
      // in Supabase schema), fall back to a manual join so saved items still show.
      let savedRows = sv || []
      const missingArticles = savedRows.filter(r => !r.articles)
      if (missingArticles.length > 0) {
        const ids = missingArticles.map(r => r.article_id).filter(Boolean)
        if (ids.length) {
          const { data: fallbackArticles } = await db
            .from('articles')
            .select('id, title, published_at, category, summary, outlets(name, country)')
            .in('id', ids)
          if (fallbackArticles) {
            const articleMap = Object.fromEntries(fallbackArticles.map(a => [a.id, a]))
            savedRows = savedRows.map(r => r.articles ? r : { ...r, articles: articleMap[r.article_id] || null })
          }
        }
      }
      setSavedItems(savedRows)
      setLoading(false)
    })
  }, [user?.id])

  async function saveUsername() {
    const val = nameInput.trim()
    if (!val) { setNameError('Username cannot be empty'); return }
    if (val.length < 3) { setNameError('At least 3 characters'); return }
    if (val.length > 20) { setNameError('Max 20 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setNameError('Letters, numbers and underscores only'); return }
    // 30-day cooldown — only applies after the first time it's been set
    if (profile?.username && profile?.username_changed_at) {
      const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 30) {
        const daysLeft = Math.ceil(30 - daysSince)
        setNameError(`You can change your username again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`)
        return
      }
    }
    setNameSaving(true)
    setNameError('')
    const { data: existing } = await db
      .from('profiles')
      .select('user_id')
      .eq('username', val)
      .neq('user_id', user.id)
      .maybeSingle()
    if (existing) { setNameError('Username already taken'); setNameSaving(false); return }
    const now = new Date().toISOString()
    // Try update first (existing row), fall back to insert for brand-new profiles
    let { error } = await db.from('profiles')
      .update({ username: val, username_changed_at: now })
      .eq('user_id', user.id)
    if (error) {
      ;({ error } = await db.from('profiles')
        .insert({ user_id: user.id, username: val, username_changed_at: now }))
    }
    if (error) { setNameError('Could not save — try again'); setNameSaving(false); return }
    setProfile(p => ({ ...p, username: val, username_changed_at: now }))
    setEditingName(false)
    setNameSaving(false)
    showToast('Username updated!')
  }

  async function saveLook() {
    setLookSaving(true)
    const patch = { bio: bioInput.trim().slice(0, 160) || null, avatar_color: lookColor, avatar_emoji: lookEmoji.trim().slice(0, 4) || null }
    const { error, count } = await db.from('profiles').update(patch, { count: 'exact' }).eq('user_id', user.id)
    if (!error && count === 0) await db.from('profiles').insert({ user_id: user.id, ...patch })
    setLookSaving(false)
    if (error) { showToast('Could not save — try again'); return }
    setProfile(pr => ({ ...pr, ...patch }))
    setEditingLook(false)
    showToast('Profile updated')
  }

  async function togglePublicProfile() {
    setTogglingPublic(true)
    const next = !isPublic
    // Use update() for existing rows — upsert can fail if other required fields are missing
    const { error } = await db.from('profiles')
      .update({ public_profile: next })
      .eq('user_id', user.id)
    if (error) {
      showToast('Could not update — try again')
      console.error('togglePublicProfile error:', error)
    } else {
      setIsPublic(next)
      showToast(next ? 'Profile is now public' : 'Profile set to private')
    }
    setTogglingPublic(false)
  }

  function copyProfileLink() {
    const handle = profile?.username || user.id
    const url = `https://www.ratednews.com/profile/${handle}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  async function deleteAccount() {
    setDeleting(true)
    const { data: { session } } = await db.auth.getSession()
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (!res.ok) {
      const { error } = await res.json()
      showToast(`Could not delete account: ${error}`)
      setDeleting(false)
      return
    }
    await db.auth.signOut()
    navigate('feed')
  }

  if (!user) return null

  const displayName  = profile?.username || 'Reader'
  const initials     = displayName.slice(0, 2).toUpperCase()
  const memberSince  = new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const totalRatings = articleRatings.length + outletRatings.length
  const totalContrib = totalRatings + comments.length
  const trust        = getTrustLevel(totalContrib)
  const daysActive   = calcDaysActive([...articleRatings, ...outletRatings], comments)

  const trustStars = outletRatings.map(r => r.overall_stars || 0).filter(Boolean)
  const avgTrust   = trustStars.length ? (trustStars.reduce((a, b) => a + b, 0) / trustStars.length).toFixed(1) : null
  const trusts     = outletRatings.filter(r => (r.overall_stars || 0) >= 4)
  const distrusts  = outletRatings.filter(r => (r.overall_stars || 0) > 0 && (r.overall_stars || 0) <= 2)

  // Reading week — views in the last 7 days + dominant topic
  const weekViews = articleViews.filter(v => Date.now() - new Date(v.viewed_at) < 7 * 86400000)
  const weekTopicCounts = {}
  weekViews.forEach(v => { const c = v.articles?.category; if (c) weekTopicCounts[c] = (weekTopicCounts[c] || 0) + 1 })
  const weekTopTopic = Object.entries(weekTopicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Media diet — prefer view history (last 90 days), fall back to ratings
  const dietSource = articleViews.length > 0 ? articleViews : articleRatings
  const outletCounts = {}
  dietSource.forEach(r => {
    const name = r.articles?.outlets?.name
    if (name) outletCounts[name] = (outletCounts[name] || 0) + 1
  })
  const mediaDiet = Object.entries(outletCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const dietTotal = dietSource.length

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
    return <RatingDots value={stars} size={8} showValue={false} />
  }

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 1100 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div className="grid">
        <div>

        {/* Onboarding banner */}
        {showOnboarding && (
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            marginBottom: 16,
            border: '0.5px solid var(--border)',
            borderLeftWidth: 3,
            borderLeftColor: 'var(--coral)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Welcome to RatedNews 👋</div>
              <button
                onClick={dismissOnboarding}
                aria-label="Dismiss"
                style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {[
                { emoji: '🟢', title: 'Rate the outlets you trust', action: 'Rate →', onClick: () => navigate('outlets') },
                { emoji: '📰', title: 'Follow outlets to build your feed', action: 'Browse →', onClick: () => navigate('feed') },
                { emoji: '🔖', title: 'Save stories to read later', action: null },
                { emoji: '🏆', title: 'Build your trusted-sources profile', action: null },
              ].map(({ emoji, title, action, onClick }) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{emoji}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{title}</span>
                  {action && (
                    <button onClick={onClick} style={{ fontSize: 11, color: 'var(--coral)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', flexShrink: 0 }}>{action}</button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={dismissOnboarding}
              style={{ fontSize: 11, padding: '5px 16px', borderRadius: 20, border: '1.5px solid var(--coral)', background: 'var(--coral)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600 }}
            >Got it</button>
          </div>
        )}

        {/* Hero card */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <button
              onClick={() => { setEditingLook(v => !v); setBioInput(profile?.bio || ''); setLookColor(profile?.avatar_color || null); setLookEmoji(profile?.avatar_emoji || '') }}
              title="Edit avatar & bio"
              style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
            >
              <UserAvatar name={displayName} emoji={profile?.avatar_emoji} color={profile?.avatar_color} size={52} />
              <span style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border2)', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✎</span>
            </button>
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
                      style={{ fontSize: 16, fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${nameError ? 'var(--red)' : 'var(--coral)'}`, background: 'var(--bg)', color: 'var(--text)', outline: 'none', width: 160 }}
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
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {profile?.username
                      ? <span><span style={{ color: 'var(--text3)', fontWeight: 400 }}>@</span>{profile.username}</span>
                      : displayName}
                  </div>
                  <button
                    onClick={() => { setNameInput(profile?.username || ''); setEditingName(true); setNameError('') }}
                    title="Edit username"
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer', lineHeight: 1.4 }}
                  >
                    Edit
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--bg)', border: `1.5px solid ${trust.color}`, color: trust.color, whiteSpace: 'nowrap' }}>
                  {trust.emoji} {trust.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Member since {memberSince}</span>
              </div>
              {profile?.bio && !editingLook && (
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5 }}>{profile.bio}</div>
              )}
            </div>
          </div>

          {/* Avatar + bio editor */}
          {editingLook && (
            <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 8 }}>Avatar</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setLookColor(c)} aria-label={`Colour ${c}`}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: lookColor === c ? '2.5px solid var(--text)' : '2.5px solid transparent', cursor: 'pointer' }} />
                ))}
                <input
                  value={lookEmoji}
                  onChange={e => setLookEmoji(e.target.value)}
                  placeholder="emoji"
                  maxLength={4}
                  aria-label="Avatar emoji"
                  style={{ width: 64, fontSize: 14, padding: '4px 8px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'center' }}
                />
                <UserAvatar name={displayName} emoji={lookEmoji || null} color={lookColor} size={34} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 6 }}>Bio</div>
              <textarea
                value={bioInput}
                onChange={e => setBioInput(e.target.value)}
                maxLength={160}
                rows={2}
                placeholder="One line about how you read the news…"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', resize: 'none', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{160 - bioInput.length} characters left</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingLook(false)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveLook} disabled={lookSaving} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: 'none', background: 'var(--coral)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: lookSaving ? 0.6 : 1 }}>
                    {lookSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Username nudge — shown when no username set and not currently editing */}
          {!profile?.username && !editingName && !loading && (
            <div
              onClick={() => { setNameInput(''); setEditingName(true); setNameError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px dashed var(--coral)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 16 }}>✨</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Set a username</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Unlock your shareable profile &amp; public URL</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600, flexShrink: 0 }}>Set →</span>
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { value: outletRatings.length,    label: 'Outlets rated' },
              ...(avgTrust ? [{ value: `${avgTrust}`, label: 'Avg trust', color: 'var(--green-dark)' }] : []),
              { value: followedOutletIds.size,  label: 'Following'     },
              { value: comments.length,         label: 'Comments'      },
              ...(weekViews.length ? [{ value: weekViews.length, label: 'Read this week' }] : []),
              ...(weekTopTopic ? [{ value: weekTopTopic, label: 'Top topic · 7d' }] : []),
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

          {/* Public profile toggle — merged into hero card */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {isPublic ? '🌐 Public profile' : '🔒 Private profile'}
                {isPublic && <span style={{ marginLeft: 8, color: 'var(--text3)' }}>· shareable</span>}
              </span>
              <button
                onClick={() => setShowProfileInfo(p => !p)}
                style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit', padding: 0 }}
                aria-label="What is a public profile?"
              >ⓘ</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {isPublic && (
                <>
                  <button onClick={() => navigate('publicProfile', { userId: user.id })} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    View as visitor
                  </button>
                  <button onClick={copyProfileLink} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--coral)', background: 'none', color: 'var(--coral)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {linkCopied ? '✓ Copied!' : 'Copy link'}
                  </button>
                </>
              )}
              <button
                onClick={togglePublicProfile}
                disabled={togglingPublic}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: 'none', background: isPublic ? 'var(--border2)' : 'var(--coral)', color: isPublic ? 'var(--text2)' : '#fff', cursor: togglingPublic ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600, opacity: togglingPublic ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {togglingPublic ? '…' : isPublic ? 'Make private' : 'Make public'}
              </button>
            </div>
            </div>
            {showProfileInfo && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>🌐 Public — </strong>
                The sources you trust and distrust, who you follow, and your activity are visible to anyone with your profile link. Great for sharing your take on the media.
                <strong style={{ color: 'var(--text)', display: 'block', marginTop: 8, marginBottom: 4 }}>🔒 Private — </strong>
                Only you can see your profile. Your data stays personal and won't appear in search engines.
              </div>
            )}
          </div>
        </div>

        {/* Insights — only show when there's data */}
        {!loading && (
          <>
            <ActivityChart ratings={articleRatings} outletRatings={outletRatings} comments={comments} />

            {/* Sources you trust / distrust — the identity centrepiece */}
            {outletRatings.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14 }}>Sources you rate</div>
                {[
                  { title: 'You trust most', items: trusts,    tint: 'rgba(99,153,34,0.35)' },
                  { title: 'You trust least', items: distrusts, tint: 'rgba(226,75,74,0.30)' },
                ].map(({ title, items, tint }) => items.length > 0 && (
                  <div key={title} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 8 }}>{title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {items.map(r => (
                        <div key={r.outlet_id || r.id} onClick={() => navigate('outlet', { outletId: r.outlet_id || r.outlets?.id })} className="border-hover"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg)', border: `0.5px solid ${tint}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                          <OutletLogo name={r.outlets?.name || 'X'} size={26} borderRadius={6} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.outlets?.name || 'Unknown'}</span>
                          <RatingDots value={r.overall_stars || 0} size={8} showValue={false} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {trusts.length === 0 && distrusts.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>Your ratings sit in the middle so far — rate a few sources 4–5★ or 1–2★ to see your trust profile.</div>
                )}
              </div>
            )}

            {/* Following */}
            {followedOutlets.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Following ({followedOutlets.length})</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {followedOutlets.map(o => (
                    <div key={o.id} onClick={() => navigate('outlet', { outletId: o.id })} title={o.name} style={{ cursor: 'pointer' }}>
                      <OutletLogo name={o.name} size={34} borderRadius={8} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <div className={`tab${tab === 'ratings' ? ' active' : ''}`} onClick={() => setTab('ratings')}>
            Ratings {outletRatings.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({outletRatings.length})</span>}
          </div>
          <div className={`tab${tab === 'saved' ? ' active' : ''}`} onClick={() => setTab('saved')}>
            Saved {savedItems.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({savedItems.length})</span>}
          </div>
          <div className={`tab${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
            Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
          </div>
          <div className={`tab${tab === 'votes' ? ' active' : ''}`} onClick={() => setTab('votes')}>
            Votes {votedComments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({votedComments.length})</span>}
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
            {outletRatings.length === 0 ? (
              <div className="empty-state">
                <h3>No trust ratings yet</h3>
                <p>Rate the outlets you trust to build your profile.</p>
                <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('outlets')}>Browse outlets</button>
              </div>
            ) : (
              outletRatings.map(r => (
                <div
                  key={r.id}
                  style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer' }} className="border-hover"
                  onClick={() => (r.outlet_id || r.outlets?.id) && navigate('outlet', { outletId: r.outlet_id || r.outlets.id })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <OutletLogo name={r.outlets?.name || 'X'} size={30} borderRadius={7} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{r.outlets?.name || 'Unknown outlet'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Rated {timeAgo(r.created_at)}</div>
                    </div>
                    <RatingDots value={r.overall_stars || 0} size={9} showValue={false} />
                  </div>
                  {r.review_text && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>"{r.review_text}"</div>
                  )}
                </div>
              ))
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
                    style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer' }} className="border-hover"
                    onClick={() => navigate('article', { articleId: article.id, title: article.title })}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                      {article.outlets?.name || 'Unknown outlet'} · saved {timeAgo(s.created_at)}
                    </div>
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-playfair), serif', lineHeight: 1.4, marginBottom: article.summary ? 6 : 0 }}>
                      {article.title || 'Article'}
                    </div>
                    {article.summary && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {article.summary}
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
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : tab === 'votes' ? (
          /* Votes tab */
          (() => {
            const filtered = votedComments.filter(v => v.dir === (voteFilter === 'up' ? 1 : -1))
            return (
              <div>
                {/* Filter toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[['up', '▲ Upvoted'], ['down', '▼ Downvoted']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setVoteFilter(key)}
                      style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: `1px solid ${voteFilter === key ? (key === 'up' ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`, background: voteFilter === key ? (key === 'up' ? 'var(--green)' : 'var(--red)') : 'none', color: voteFilter === key ? '#fff' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600 }}
                    >{label} ({votedComments.filter(v => v.dir === (key === 'up' ? 1 : -1)).length})</button>
                  ))}
                </div>
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {filtered.length === 0 ? (
                    <div className="empty-state">
                      <h3>No {voteFilter === 'up' ? 'upvoted' : 'downvoted'} comments yet</h3>
                      <p>Comments you {voteFilter === 'up' ? 'upvote' : 'downvote'} will appear here.</p>
                      <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('feed')}>Browse articles</button>
                    </div>
                  ) : (
                    filtered.map((v, i) => {
                      const c = v.comments
                      if (!c) return null
                      const articleTitle = c.articles?.title || c.outlets?.name || 'Article'
                      const articleId    = c.articles?.id
                      const isUp         = v.dir === 1
                      return (
                        <div
                          key={`${v.dir}-${c.id}`}
                          style={{ padding: '14px 18px', borderBottom: i < filtered.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: articleId ? 'pointer' : 'default' }}
                          className={articleId ? 'row-hover' : ''}
                          onClick={() => articleId && navigate('article', { articleId, title: c.articles?.title })}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                            <span style={{ color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 600, marginRight: 6 }}>{isUp ? '▲' : '▼'}</span>
                            On: <span style={{ color: 'var(--text2)' }}>{articleTitle}</span> · {timeAgo(v.created_at || c.created_at)}
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, color: 'var(--text)' }}>{c.body}</div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                            <span>▲ {c.upvotes || 0}</span>
                            <span>▼ {c.downvotes || 0}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })()
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
                const articles30d = outlet.article_count_30d || 0
                const delta = outlet.accuracy_delta_7d
                return (
                  <div
                    key={outlet.id}
                    style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    className="border-hover"
                    onClick={() => navigate('outlet', { outletId: outlet.id })}
                  >
                    <OutletLogo name={outlet.name} size={40} borderRadius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{outlet.name}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{outlet.country || 'Global'}</span>
                        {articles30d > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {articles30d} articles/30d</span>
                        )}
                        {delta !== null && delta !== undefined && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text3)' }}>
                            {delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : '→'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: score >= 70 ? 'var(--green-dark)' : score >= 50 ? 'var(--amber)' : 'var(--red)' }}>{score}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Trust</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFollow(outlet.id) }}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      Unfollow
                    </button>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div>
          {comments.length === 0 ? (
            <div className="empty-state">
              <h3>No comments yet</h3>
              <p>Join the discussion on any article.</p>
              <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('feed')}>Browse articles</button>
            </div>
          ) : (
            <>
              {/* Sort toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[['recent', 'Recent'], ['top', 'Top']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCommentSort(key)}
                    style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: `1px solid ${commentSort === key ? 'var(--coral)' : 'var(--border)'}`, background: commentSort === key ? 'var(--coral)' : 'none', color: commentSort === key ? '#fff' : 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600 }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {[...comments]
                  .sort((a, b) => commentSort === 'top'
                    ? ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0))
                    : 0 /* already ordered by created_at desc from DB */
                  )
                  .map((c, i, arr) => (
                    <div
                      key={c.id}
                      style={{ padding: '14px 18px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }} className="row-hover"
                      onClick={() => c.articles?.id && navigate('article', { articleId: c.articles.id, title: c.articles.title })}
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
                }
              </div>
            </>
          )}
          </div>
        )}

        {/* Admin tools — owner only */}
        {user?.email === 'alexandchow@gmail.com' && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Admin</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('social-agent')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 14px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <span style={{ fontSize: 15 }}>✦</span>
                Social Agent
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 2 }}>→</span>
              </button>
              <button
                onClick={() => navigate('admin-articles')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 14px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <span style={{ fontSize: 15 }}>🗂</span>
                Article Review
                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 2 }}>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Danger zone</div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ fontSize: 12, padding: '7px 16px', borderRadius: 20, border: '1px solid var(--red)', background: 'none', color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              Delete account
            </button>
          ) : (
            <div style={{ background: 'var(--red-light)', border: '0.5px solid var(--red)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 6 }}>This cannot be undone</div>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
                Your account, saved articles, ratings, and follows will be permanently deleted. Type <strong>DELETE</strong> to confirm.
              </p>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Type DELETE to confirm"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--red)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-dm-sans), sans-serif', marginBottom: 10, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                  style={{ flex: 1, fontSize: 12, padding: '7px 0', borderRadius: 20, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  style={{ flex: 2, fontSize: 12, padding: '7px 0', borderRadius: 20, border: 'none', background: deleteInput === 'DELETE' ? 'var(--red)' : 'var(--border)', color: deleteInput === 'DELETE' ? '#fff' : 'var(--text3)', cursor: deleteInput === 'DELETE' ? 'pointer' : 'default', fontFamily: 'var(--font-dm-sans), sans-serif', transition: 'all 0.15s' }}
                >
                  {deleting ? 'Deleting…' : 'Permanently delete'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 32 }} />
        </div>

        {/* Rail — the next outlets to rate: followed-but-unrated first, then
            the most-rated outlets you haven't weighed in on */}
        <aside className="sidebar desktop-only">
          <div className="widget">
            <div className="widget-title">Rate your sources</div>
            {(() => {
              const ratedIds = new Set(outletRatings.map(r => r.outlet_id))
              const followedUnrated = allOutlets.filter(o => followedOutletIds.has(o.id) && !ratedIds.has(o.id))
              const popularUnrated  = allOutlets.filter(o => !o.parent_outlet_id && !ratedIds.has(o.id) && !followedOutletIds.has(o.id))
                .sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0))
              const picks = [...followedUnrated, ...popularUnrated].slice(0, 6)
              if (picks.length === 0) return <div style={{ fontSize: 12, color: 'var(--text3)' }}>You have rated everything you follow — nice.</div>
              return picks.map(o => (
                <div key={o.id} className="outlet-rank-row" onClick={() => navigate('outlet', { outletId: o.id })}>
                  <OutletLogo name={o.name} size={26} borderRadius={6} />
                  <span className="outlet-rank-name" title={o.name}>{o.name}</span>
                  <span style={{ fontSize: 10, color: followedOutletIds.has(o.id) ? 'var(--coral)' : 'var(--text3)', flexShrink: 0 }}>
                    {followedOutletIds.has(o.id) ? 'Following' : 'Rate →'}
                  </span>
                </div>
              ))
            })()}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
              Your ratings shape the community scores.
            </div>
          </div>
        </aside>
        </div>
      </div>
    </div>
  )
}
