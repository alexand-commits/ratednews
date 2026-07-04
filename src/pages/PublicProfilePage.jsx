import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo, scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import RatingDots from '../components/RatingDots'

// ── Trust level (same as ProfilePage) ────────────────────────────────────────
function getTrustLevel(total) {
  if (total >= 50) return { label: 'Expert',           emoji: '🏅', color: '#D85A30' }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: '#639922' }
  if (total >= 10) return { label: 'Contributor',      emoji: '✅', color: '#185FA5' }
  if (total >= 3)  return { label: 'Active Member',    emoji: '📰', color: '#6B6760' }
  return           { label: 'New Member',              emoji: '👋', color: '#9E9B95' }
}

// ── Topic breakdown ───────────────────────────────────────────────────────────
const CATEGORY_EMOJIS = {
  Politics: '🏛', Business: '📈', Sport: '⚽', Tech: '💻',
  Science: '🔬', Health: '🏥', Environment: '🌱', Entertainment: '🎬',
  Crime: '⚖️', Travel: '✈️', Education: '🎓', World: '🌍',
}

function TopicBreakdown({ ratings }) {
  const counts = {}
  ratings.forEach(r => {
    const cat = r.articles?.category
    if (cat) counts[cat] = (counts[cat] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  if (entries.length === 0) return null
  const max = entries[0][1]
  const COLORS = ['#D85A30', '#185FA5', '#639922', '#8B5CF6', '#F59E0B', '#EC4899']

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>
        Topics rated
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(([cat, count], i) => {
          const pct = Math.round((count / max) * 100)
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{CATEGORY_EMOJIS[cat] || '📰'}</span>
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 100, flexShrink: 0 }}>{cat}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 32, textAlign: 'right', flexShrink: 0 }}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Media diet ────────────────────────────────────────────────────────────────
function MediaDiet({ ratings }) {
  const outletCounts = {}
  ratings.forEach(r => {
    const name = r.articles?.outlets?.name
    if (name) outletCounts[name] = (outletCounts[name] || 0) + 1
  })
  const mediaDiet = Object.entries(outletCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (mediaDiet.length === 0) return null

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Their media diet</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mediaDiet.map(([name, count]) => {
          const pct = Math.round((count / ratings.length) * 100)
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <OutletLogo name={name} size={26} borderRadius={6} />
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 110, flexShrink: 0 }}>{name}</span>
              <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--coral)', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 40, textAlign: 'right', flexShrink: 0 }}>{count} rated</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PublicProfilePage({ userId, isPublic, navigate, goBack, showToast }) {
  const [profile, setProfile]         = useState(null)
  const [articleRatings, setArticleRatings] = useState([])
  const [comments, setComments]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)
  const [tab, setTab]                 = useState('ratings')

  useEffect(() => {
    if (!userId) { setNotFound(true); setLoading(false); return }

    Promise.all([
      db.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      db.from('ratings')
        .select('*, articles(id, title, category, bias_direction, outlets(name))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('comments')
        .select('*, articles(id, title)')
        .eq('user_id', userId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([{ data: prof }, { data: ar }, { data: co }]) => {
      if (!prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof)
      setArticleRatings(ar || [])
      setComments(co || [])
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return (
      <div className="page-content">
        <div className="container" style={{ maxWidth: 700 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !isPublic) {
    return (
      <div className="page-content">
        <div className="container" style={{ maxWidth: 700 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div className="empty-state">
            <h3>{notFound ? 'Profile not found' : '🔒 Private profile'}</h3>
            <p>{notFound ? "This user doesn't exist." : "This user hasn't made their profile public yet."}</p>
          </div>
        </div>
      </div>
    )
  }

  const displayName  = profile.username || 'Anonymous'
  const initials     = displayName.slice(0, 2).toUpperCase()
  const memberSince  = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const totalContrib = articleRatings.length + comments.length
  const trust        = getTrustLevel(totalContrib)

  const allStars = articleRatings.map(r => r.overall_stars || 0).filter(Boolean)
  const avgStars = allStars.length ? (allStars.reduce((a, b) => a + b, 0) / allStars.length).toFixed(1) : null

  function StarRow({ stars }) {
    return <RatingDots value={stars} size={8} showValue={false} />
  }

  function RatingBadges({ accuracy, bias, headline }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {accuracy && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)', border: '0.5px solid var(--border)' }}>{accuracy.replace(/_/g, ' ')}</span>}
        {bias     && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)', border: '0.5px solid var(--border)' }}>{bias.replace(/_/g, ' ')}</span>}
        {headline && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)', border: '0.5px solid var(--border)' }}>{headline}</span>}
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 700 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        {/* Hero */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--purple, #8B5CF6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {profile.username ? <span><span style={{ color: 'var(--text3)', fontWeight: 400 }}>@</span>{profile.username}</span> : displayName}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--bg)', border: `1.5px solid ${trust.color}`, color: trust.color, whiteSpace: 'nowrap' }}>
                  {trust.emoji} {trust.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Member since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10 }}>
            {[
              { value: articleRatings.length, label: 'Articles rated' },
              { value: comments.length,       label: 'Comments'       },
              { value: totalContrib,           label: 'Contributions'  },
              ...(avgStars ? [{ value: `${avgStars}`, label: 'Avg rating', color: 'var(--green-dark)' }] : []),
            ].map(({ value, label, color }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <TopicBreakdown ratings={articleRatings} />
        <MediaDiet ratings={articleRatings} />

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <div className={`tab${tab === 'ratings' ? ' active' : ''}`} onClick={() => setTab('ratings')}>
            Ratings {articleRatings.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({articleRatings.length})</span>}
          </div>
          <div className={`tab${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
            Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
          </div>
        </div>

        {tab === 'ratings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {articleRatings.length === 0 ? (
              <div className="empty-state">
                <h3>No public ratings yet</h3>
                <p>This user hasn't rated any articles.</p>
              </div>
            ) : (
              articleRatings.map(r => (
                <div
                  key={r.id}
                  style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => r.articles?.id && navigate('article', { articleId: r.articles.id, title: r.articles.title })}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                    {r.articles?.outlets?.name || 'Unknown outlet'} · {timeAgo(r.created_at)}
                  </div>
                  <div style={{ fontSize: 14, fontFamily: 'var(--font-playfair), serif', lineHeight: 1.4, marginBottom: 8 }}>
                    {r.articles?.title || 'Article'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <StarRow stars={r.overall_stars || 0} />
                    <RatingBadges accuracy={r.accuracy_vote} bias={r.bias_vote} headline={r.headline_vote} />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {comments.length === 0 ? (
              <div className="empty-state">
                <h3>No comments yet</h3>
                <p>This user hasn't commented on any articles.</p>
              </div>
            ) : (
              comments.map((c, i) => (
                <div
                  key={c.id}
                  style={{ padding: '14px 18px', borderBottom: i < comments.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => c.articles?.id && navigate('article', { articleId: c.articles.id, title: c.articles.title })}
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
