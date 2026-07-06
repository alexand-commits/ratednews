import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import OutletLogo from '../components/OutletLogo'
import { OutletTrustRateInline } from '../components/OutletTrustRate'
import { articleSlug, timeAgo, outletColor } from '../utils/helpers'
import { db } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

// Full-coverage view of a single story — every outlet covering it, side by side.
// The differentiator surfaced as a first-class, shareable page: "this story,
// N sources, here's each one — and rate the ones you trust in one tap."
export default function StoryPage({ story, navigate, goBack, user, onLoginClick, showToast, outlets = [] }) {
  const members = story?.members || []
  const count   = members.length
  const [myRatings, setMyRatings] = useState({})

  // Load the user's existing trust ratings for the covering outlets
  useEffect(() => {
    if (!user) { setMyRatings({}); return }
    const ids = [...new Set(members.map(m => m.outlet_id).filter(Boolean))]
    if (!ids.length) return
    db.from('outlet_ratings').select('outlet_id, overall_stars').eq('user_id', user.id).in('outlet_id', ids)
      .then(({ data }) => {
        const m = {}
        ;(data || []).forEach(r => { m[r.outlet_id] = r.overall_stars })
        setMyRatings(m)
      })
  }, [user, story?.anchorId])

  function share() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) { navigator.share({ title: story.title, url }).catch(() => {}) }
    else if (navigator.clipboard) { navigator.clipboard.writeText(url); showToast?.('Link copied') }
  }

  return (
    <div className="page-content">
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral)', background: 'rgba(216,90,48,0.08)', border: '0.5px solid rgba(216,90,48,0.25)', borderRadius: 20, padding: '4px 12px' }}>
              📰 {count} {count === 1 ? 'source' : 'sources'} covering this story
            </span>
            <button onClick={share} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '5px 14px', cursor: 'pointer' }}>
              ↗ Share
            </button>
          </div>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 27, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>
            {story.title}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Compare how each outlet is covering it — and rate the sources you trust.
          </p>
        </div>

        <div className="grid">
        <div>

        {/* Coverage list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map(m => {
            const o = m.outlets || {}
            const slug = articleSlug(m.title, m.id)
            const com = m.community_score || 0
            return (
              <div key={m.id} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <OutletLogo name={o.name || 'X'} size={26} borderRadius={6} />
                  <span
                    onClick={() => navigate('outlet', { outletId: m.outlet_id })}
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
                  >
                    {o.name || 'Unknown'}
                  </span>
                  {com > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-dark)' }}>{(com / 20).toFixed(1)}★ trust</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{timeAgo(m.published_at)}</span>
                </div>

                <Link href={`/article/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="news-headline" style={{ fontSize: 16, marginBottom: 10 }}>{m.title}</div>
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '0.5px solid var(--divider)', paddingTop: 10 }}>
                  <span style={{ fontSize: 11, color: myRatings[m.outlet_id] ? 'var(--green-dark)' : 'var(--text3)', fontWeight: 500 }}>
                    {myRatings[m.outlet_id] ? 'Your trust' : 'Trust?'}
                  </span>
                  <OutletTrustRateInline
                    outlet={{ id: m.outlet_id }}
                    user={user}
                    onLoginClick={onLoginClick}
                    showToast={showToast}
                    initialStars={myRatings[m.outlet_id] || 0}
                    onRated={n => setMyRatings(prev => ({ ...prev, [m.outlet_id]: n }))}
                    size={17}
                  />
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--coral)', textDecoration: 'none' }}>
                      Read on {o.name || 'source'} ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ height: 24 }} />
        </div>

        <Sidebar outlets={outlets} navigate={navigate} />
        </div>
      </div>
    </div>
  )
}
