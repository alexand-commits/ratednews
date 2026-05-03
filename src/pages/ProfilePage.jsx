import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

export default function ProfilePage({ user, navigate, showToast }) {
  const [articleRatings, setArticleRatings]   = useState([])
  const [outletRatings, setOutletRatings]     = useState([])
  const [comments, setComments]               = useState([])
  const [loadingRatings, setLoadingRatings]   = useState(true)
  const [loadingComments, setLoadingComments] = useState(true)
  const [tab, setTab] = useState('ratings')

  useEffect(() => {
    if (!user) return

    // Article ratings
    db.from('ratings')
      .select('*, articles(id, title, outlets(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setArticleRatings(data || [])
        setLoadingRatings(false)
      })

    // Outlet ratings
    db.from('outlet_ratings')
      .select('*, outlets(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOutletRatings(data || []))

    // Comments (articles + outlets)
    db.from('comments')
      .select('*, articles(id, title), outlets(id, name)')
      .eq('user_id', user.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setComments(data || []); setLoadingComments(false) })
  }, [user])

  async function handleSignOut() {
    await db.auth.signOut()
    showToast('Signed out')
    navigate('feed')
  }

  if (!user) { navigate('feed'); return null }

  const initials    = user.email ? user.email.slice(0, 2).toUpperCase() : '??'
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalRatings = articleRatings.length + outletRatings.length
  const allStars = [...articleRatings, ...outletRatings].map(r => r.overall_stars || 0).filter(Boolean)
  const avgStars = allStars.length ? (allStars.reduce((a, b) => a + b, 0) / allStars.length).toFixed(1) : null

  function RatingBadges({ accuracy, bias, headline }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {accuracy && <span style={{ fontSize: 11, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{accuracy.replace(/_/g, ' ')}</span>}
        {bias     && <span style={{ fontSize: 11, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{bias.replace(/_/g, ' ')}</span>}
        {headline && <span style={{ fontSize: 11, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{headline}</span>}
      </div>
    )
  }

  function StarRow({ stars }) {
    return (
      <span style={{ fontSize: 16, color: 'var(--amber)' }}>
        {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </span>
    )
  }

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 700 }}>
        <button className="back-btn" onClick={() => navigate('feed')}>← Back to feed</button>

        {/* Hero */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{user.email}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Member since {memberSince}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              <div><strong style={{ fontSize: 18 }}>{articleRatings.length}</strong><span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 5 }}>Article ratings</span></div>
              <div><strong style={{ fontSize: 18 }}>{outletRatings.length}</strong><span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 5 }}>Outlet ratings</span></div>
              <div><strong style={{ fontSize: 18 }}>{comments.length}</strong><span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 5 }}>Comments</span></div>
              {avgStars && <div><strong style={{ fontSize: 18, color: 'var(--amber)' }}>{avgStars}★</strong><span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 5 }}>Avg rating</span></div>}
            </div>
          </div>
          <button className="btn-outline" style={{ fontSize: 12, padding: '7px 14px', color: 'var(--red)', borderColor: 'var(--red)', flexShrink: 0 }} onClick={handleSignOut}>
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <div className={`tab${tab === 'ratings' ? ' active' : ''}`} onClick={() => setTab('ratings')}>
            Ratings {totalRatings > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({totalRatings})</span>}
          </div>
          <div className={`tab${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
            Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
          </div>
        </div>

        {/* Ratings tab */}
        {tab === 'ratings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingRatings ? (
              <div className="loading">{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}</div>
            ) : totalRatings === 0 ? (
              <div className="empty-state">
                <h3>No ratings yet</h3>
                <p>Rate articles and outlets to see your history here.</p>
              </div>
            ) : (
              <>
                {/* Article ratings */}
                {articleRatings.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginBottom: 6 }}>Article ratings</div>
                    {articleRatings.map(r => (
                      <div
                        key={r.id}
                        style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onClick={() => r.articles?.id && navigate('article', { articleId: r.articles.id })}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                          📰 {r.articles?.outlets?.name || 'Unknown outlet'} · {timeAgo(r.created_at)}
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

                {/* Outlet ratings */}
                {outletRatings.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginBottom: 6, marginTop: articleRatings.length > 0 ? 10 : 0 }}>Outlet ratings</div>
                    {outletRatings.map(r => (
                      <div
                        key={r.id}
                        style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onClick={() => r.outlets?.id && navigate('outlet', { outletId: r.outlets.id })}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                          🏢 Outlet · {timeAgo(r.created_at)}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                          {r.outlets?.name || 'Unknown outlet'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <StarRow stars={r.overall_stars || 0} />
                          <RatingBadges accuracy={r.accuracy_vote} bias={r.bias_vote} />
                        </div>
                        {r.review_text && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
                            "{r.review_text}"
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Comments tab */}
        {tab === 'comments' && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {loadingComments ? (
              <div className="loading" style={{ padding: 20 }}>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}</div>
            ) : comments.length === 0 ? (
              <div className="empty-state">
                <h3>No comments yet</h3>
                <p>Join the discussion on any article or outlet.</p>
              </div>
            ) : (
              comments.map((c, i) => {
                const isOutletComment = !!c.outlet_id
                return (
                  <div
                    key={c.id}
                    style={{ padding: '14px 18px', borderBottom: i < comments.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                    onClick={() => {
                      if (isOutletComment && c.outlets?.id) navigate('outlet', { outletId: c.outlets.id })
                      else if (c.articles?.id) navigate('article', { articleId: c.articles.id })
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--surface)'}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                      {isOutletComment ? '🏢' : '📰'} On: <span style={{ color: 'var(--text2)' }}>
                        {isOutletComment ? (c.outlets?.name || 'Outlet') : (c.articles?.title || 'Article')}
                      </span> · {timeAgo(c.created_at)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>{c.body}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                      <span>▲ {c.upvotes || 0}</span>
                      <span>▼ {c.downvotes || 0}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
