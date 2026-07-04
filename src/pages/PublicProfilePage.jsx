import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import RatingDots from '../components/RatingDots'

// ── Trust level ───────────────────────────────────────────────────────────────
function getTrustLevel(total) {
  if (total >= 50) return { label: 'Expert',           emoji: '🏅', color: '#D85A30' }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: '#639922' }
  if (total >= 10) return { label: 'Contributor',      emoji: '✅', color: '#185FA5' }
  if (total >= 3)  return { label: 'Active Member',    emoji: '📰', color: '#6B6760' }
  return           { label: 'New Member',              emoji: '👋', color: '#9E9B95' }
}

// ── Trusted / distrusted sources — the identity centrepiece ────────────────────
function SourceList({ title, items, tint, navigate }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(r => (
          <div
            key={r.outlet_id}
            onClick={() => navigate('outlet', { outletId: r.outlet_id })}
            className="border-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg)', border: `0.5px solid ${tint}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          >
            <OutletLogo name={r.outlets?.name || 'X'} size={26} borderRadius={6} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.outlets?.name || 'Unknown'}</span>
            <RatingDots value={r.overall_stars || 0} size={8} showValue={false} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PublicProfilePage({ userId, isPublic, navigate, goBack, showToast }) {
  const [profile, setProfile]           = useState(null)
  const [outletRatings, setOutletRatings] = useState([])
  const [following, setFollowing]       = useState([])
  const [comments, setComments]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)

  useEffect(() => {
    if (!userId) { setNotFound(true); setLoading(false); return }
    Promise.all([
      db.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      db.from('outlet_ratings')
        .select('outlet_id, overall_stars, created_at, outlets(name, logo_url, community_score)')
        .eq('user_id', userId)
        .order('overall_stars', { ascending: false }),
      db.from('follows')
        .select('outlet_id, outlets(name, logo_url)')
        .eq('user_id', userId),
      db.from('comments')
        .select('*, articles(id, title)')
        .eq('user_id', userId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(30),
    ]).then(([{ data: prof }, { data: or }, { data: fo }, { data: co }]) => {
      if (!prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof)
      setOutletRatings(or || [])
      setFollowing((fo || []).filter(f => f.outlets))
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
  const totalContrib = outletRatings.length + comments.length
  const trust        = getTrustLevel(totalContrib)

  const stars    = outletRatings.map(r => r.overall_stars || 0).filter(Boolean)
  const avgTrust = stars.length ? (stars.reduce((a, b) => a + b, 0) / stars.length / 1).toFixed(1) : null

  const trusts    = outletRatings.filter(r => (r.overall_stars || 0) >= 4)
  const distrusts = outletRatings.filter(r => (r.overall_stars || 0) > 0 && (r.overall_stars || 0) <= 2)

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

          {/* Stats — reframed around outlet trust */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10 }}>
            {[
              { value: outletRatings.length, label: 'Outlets rated' },
              ...(avgTrust ? [{ value: `${avgTrust}`, label: 'Avg trust', color: 'var(--green-dark)' }] : []),
              { value: following.length,     label: 'Following'     },
              { value: comments.length,      label: 'Comments'      },
            ].map(({ value, label, color }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sources they trust / distrust — the centrepiece */}
        {outletRatings.length > 0 ? (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14 }}>Sources they rate</div>
            <SourceList title="Trusts most" items={trusts} tint="rgba(99,153,34,0.35)" navigate={navigate} />
            <SourceList title="Trusts least" items={distrusts} tint="rgba(226,75,74,0.30)" navigate={navigate} />
            {trusts.length === 0 && distrusts.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Their ratings sit in the middle — no strong trust or distrust yet.</div>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No source ratings yet</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>This member hasn't rated any outlets for trust.</div>
          </div>
        )}

        {/* Following */}
        {following.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Following ({following.length})</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {following.map(f => (
                <div key={f.outlet_id} onClick={() => navigate('outlet', { outletId: f.outlet_id })} title={f.outlets?.name} style={{ cursor: 'pointer' }}>
                  <OutletLogo name={f.outlets?.name || 'X'} size={34} borderRadius={8} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent comments */}
        {comments.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', padding: '14px 18px 6px' }}>Recent comments</div>
            {comments.map((c, i) => (
              <div
                key={c.id}
                style={{ padding: '10px 18px 14px', borderBottom: i < comments.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: c.articles?.id ? 'pointer' : 'default' }}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
