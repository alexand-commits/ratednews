import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo, scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'

// Trust level based on total contributions
function getTrustLevel(total) {
  if (total >= 50) return { label: 'Expert',           emoji: '🏅', color: '#D85A30', next: null,  nextAt: null }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: '#639922', next: 'Expert',           nextAt: 50 }
  if (total >= 10) return { label: 'Contributor',      emoji: '✅', color: '#185FA5', next: 'Trusted Reviewer', nextAt: 20 }
  if (total >= 3)  return { label: 'Active Member',    emoji: '📰', color: '#6B6760', next: 'Contributor',      nextAt: 10 }
  return           { label: 'New Member',              emoji: '👋', color: '#9E9B95', next: 'Active Member',    nextAt: 3  }
}

// Days active (distinct calendar days with any activity)
function calcDaysActive(ratings, comments) {
  const days = new Set()
  ;[...ratings, ...comments].forEach(r => {
    if (r.created_at) days.add(r.created_at.slice(0, 10))
  })
  return days.size
}

export default function ProfilePage({ user, navigate, showToast }) {
  const [articleRatings, setArticleRatings] = useState([])
  const [outletRatings, setOutletRatings]   = useState([])
  const [comments, setComments]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [tab, setTab]                       = useState('ratings')

  useEffect(() => {
    if (!user) return
    Promise.all([
      db.from('ratings')
        .select('*, articles(id, title, outlets(name))')
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
    ]).then(([{ data: ar }, { data: or }, { data: co }]) => {
      setArticleRatings(ar || [])
      setOutletRatings(or || [])
      setComments(co || [])
      setLoading(false)
    })
  }, [user])

  async function handleSignOut() {
    await db.auth.signOut()
    showToast('Signed out')
    navigate('feed')
  }

  if (!user) { navigate('feed'); return null }

  const displayName  = user.email ? user.email.split('@')[0] : 'User'
  const initials     = displayName.slice(0, 2).toUpperCase()
  const memberSince  = new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const totalRatings = articleRatings.length + outletRatings.length
  const totalContrib = totalRatings + comments.length
  const trust        = getTrustLevel(totalContrib)
  const daysActive   = calcDaysActive([...articleRatings, ...outletRatings], comments)

  const allStars  = [...articleRatings, ...outletRatings].map(r => r.overall_stars || 0).filter(Boolean)
  const avgStars  = allStars.length ? (allStars.reduce((a, b) => a + b, 0) / allStars.length).toFixed(1) : null

  // Media diet — outlets the user has engaged with most
  const outletCounts = {}
  articleRatings.forEach(r => {
    const name = r.articles?.outlets?.name
    if (name) outletCounts[name] = (outletCounts[name] || 0) + 1
  })
  const mediaDiet = Object.entries(outletCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

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
        <button className="back-btn" onClick={() => navigate('feed')}>← Back to feed</button>

        {/* Hero card */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{displayName}</div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: 'var(--bg)', border: `1.5px solid ${trust.color}`, color: trust.color }}>
                  {trust.emoji} {trust.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Member since {memberSince}</div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{articleRatings.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Articles rated</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{outletRatings.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Outlets rated</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{comments.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Comments</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{daysActive}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Days active</div>
                </div>
                {avgStars && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)' }}>{avgStars}★</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Avg rating</div>
                  </div>
                )}
              </div>

              {/* Trust progress bar */}
              {trust.next && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                    <span>{totalContrib} contributions</span>
                    <span>{trust.nextAt - totalContrib} more to {trust.next}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (totalContrib / trust.nextAt) * 100)}%`,
                      background: trust.color,
                      borderRadius: 2,
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>
              )}
              {!trust.next && (
                <div style={{ marginTop: 14, fontSize: 12, color: trust.color, fontWeight: 600 }}>
                  🏅 Maximum trust level reached — thank you for contributing!
                </div>
              )}
            </div>
            <button
              className="btn-outline"
              style={{ fontSize: 12, padding: '7px 14px', color: 'var(--red)', borderColor: 'var(--red)', flexShrink: 0 }}
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Media diet */}
        {mediaDiet.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Your media diet</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mediaDiet.map(([name, count]) => {
                const pct = Math.round((count / articleRatings.length) * 100)
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <OutletLogo name={name} size={26} borderRadius={6} />
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 120 }}>{name}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--coral)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 40, textAlign: 'right' }}>{count} rated</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <div className={`tab${tab === 'ratings' ? ' active' : ''}`} onClick={() => setTab('ratings')}>
            Ratings {totalRatings > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({totalRatings})</span>}
          </div>
          <div className={`tab${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
            Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
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
                <p>Rate articles and outlets to see your history here.</p>
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
        ) : (
          /* Comments tab */
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
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>{c.body}</div>
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
