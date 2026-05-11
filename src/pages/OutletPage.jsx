import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { db } from '../lib/supabase'
import { articleSlug, outletColor, scoreColor, scoreDot, timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import OutletRatingModal from '../components/OutletRatingModal'
import InfoTip from '../components/InfoTip'

function getInitials(str) {
  if (!str) return '?'
  if (str.includes('@')) {
    const [local, domain] = str.split('@')
    const a = local.replace(/[^a-zA-Z]/g, '')[0] || '?'
    const b = (domain || '').replace(/[^a-zA-Z]/g, '')[0] || ''
    return (a + b).toUpperCase()
  }
  const words = str.trim().split(/\s+/)
  return words.slice(0, 2).map(w => w.replace(/[^a-zA-Z]/g, '')[0] || '').join('').toUpperCase() || '?'
}

// ── Article badge helpers (mirrors NewsCard.jsx) ─────────────────────────────
const HEADLINE_BADGES = {
  misleading: { bg: 'var(--amber-light)', color: 'var(--amber)', label: '⚠ Misleading' },
  clickbait:  { bg: 'var(--red-light)',   color: 'var(--red)',   label: '✗ Clickbait' },
}
const BIAS_LABELS = {
  left:   { label: '← Left',   cls: 'score-badge score-badge-bias-left'   },
  centre: { label: '◉ Centre', cls: 'score-badge score-badge-bias-centre' },
  right:  { label: '→ Right',  cls: 'score-badge score-badge-bias-right'  },
}
function accBadgeClass(score) {
  if (score >= 70) return 'score-badge score-badge-green'
  if (score >= 50) return 'score-badge score-badge-amber'
  return 'score-badge score-badge-red'
}

function ArticleCard({ a, onClick }) {
  const [imgFailed, setImgFailed] = useState(false)
  const acc      = a.accuracy_score || 0
  const scored   = acc > 0
  const hlBadge  = a.headline_vote ? HEADLINE_BADGES[a.headline_vote] : null
  const biasLbl  = a.bias_direction ? BIAS_LABELS[a.bias_direction] : null
  const hasImage = a.image_url && !imgFailed
  return (
    <div className="news-card" onClick={e => { if (e.target.closest('a')) return; onClick?.(e) }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/article/${articleSlug(a.title, a.id)}`} className="news-headline" style={{ textDecoration: 'none', color: 'inherit' }}>
            {a.title || ''}
          </Link>
          {hlBadge && (
            <span style={{
              display: 'inline-block', fontSize: 10, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20, marginBottom: 6,
              background: hlBadge.bg, color: hlBadge.color, alignSelf: 'flex-start',
            }}>
              {hlBadge.label}
            </span>
          )}
          {a.ai_summary
            ? <div className="news-summary">{a.ai_summary}</div>
            : a.summary && <div className="news-summary">{a.summary}</div>
          }
        </div>
        {/* Thumbnail */}
        {hasImage && (
          <div style={{
            position: 'relative', width: 80, height: 80, flexShrink: 0,
            borderRadius: 8, overflow: 'hidden', background: 'var(--bg2)',
          }}>
            <Image
              src={a.image_url}
              alt=""
              fill
              sizes="80px"
              style={{ objectFit: 'cover' }}
              onError={() => setImgFailed(true)}
            />
          </div>
        )}
      </div>
      <div className="score-row">
        {scored ? (
          <>
            <span className={accBadgeClass(acc)}>✦ {acc}</span>
            {biasLbl && <span className={biasLbl.cls}>{biasLbl.label}</span>}
          </>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20 }}>
            ⏳ Pending analysis
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{timeAgo(a.published_at)}</span>
      </div>
    </div>
  )
}



export default function OutletPage({ outletId, allOutlets, navigate, goBack, showToast, user, onLoginClick, followedOutletIds = new Set(), toggleFollow }) {
  const [articles, setArticles] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [outletRatings, setOutletRatings] = useState([])
  const [raterProfiles, setRaterProfiles] = useState({})
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [myRating, setMyRating] = useState(null)
  const [liveOutlet, setLiveOutlet] = useState(null)
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [votedComments, setVotedComments] = useState({})
  const [visibleArticles, setVisibleArticles] = useState(10)
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [bestArticles, setBestArticles]         = useState([])

  const outlet = liveOutlet || allOutlets.find(o => o.id === outletId)

  useEffect(() => {
    if (!outletId) return
    setActiveTab('overview')
    setArticles([])
    setOutletRatings([])
    setComments([])
    setCommentInput('')
    setAlreadyRated(false)
    setMyRating(null)
    setLiveOutlet(null)
    setVisibleArticles(10)
    setArticlesLoading(true)
    setBestArticles([])

    // Articles
    db.from('articles')
      .select('*')
      .eq('outlet_id', outletId)
      .order('published_at', { ascending: false })
      .limit(25)
      .then(({ data }) => { setArticles(data || []); setArticlesLoading(false) })

    // Best & worst scored articles (all-time, not just latest 25)
    db.from('articles')
      .select('id, title, accuracy_score, published_at')
      .eq('outlet_id', outletId)
      .gt('accuracy_score', 0)
      .order('accuracy_score', { ascending: false })
      .limit(3)
      .then(({ data }) => setBestArticles(data || []))

    // Community ratings — then fetch usernames so avatars show initials not UUID
    db.from('outlet_ratings')
      .select('*')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const ratings = data || []
        setOutletRatings(ratings)
        const ids = [...new Set(ratings.map(r => r.user_id).filter(Boolean))]
        if (ids.length > 0) {
          db.from('profiles').select('user_id, username').in('user_id', ids)
            .then(({ data: profiles }) => {
              if (profiles) {
                const map = {}
                profiles.forEach(p => { map[p.user_id] = p.username })
                setRaterProfiles(map)
              }
            })
        }
      })

    // Outlet comments
    db.from('comments')
      .select('*')
      .eq('outlet_id', outletId)
      .is('parent_id', null)
      .order('upvotes', { ascending: false })
      .then(({ data }) => setComments(data || []))

    // Already rated?
    if (user) {
      db.from('outlet_ratings')
        .select('overall_stars, accuracy_vote, bias_vote')
        .eq('outlet_id', outletId)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) { setAlreadyRated(true); setMyRating(data) }
        })
    } else {
      const stored = localStorage.getItem(`rated_outlet_${outletId}`)
      if (stored) {
        setAlreadyRated(true)
        try { setMyRating(JSON.parse(stored)) } catch (_) {}
      }
    }
  }, [outletId, user])


  if (!outlet) return null

  const [bg, fg] = outletColor(outlet.name)
  const score = outlet.overall_score || 0
  const biasPos = Math.max(0, Math.min(100, 50 + ((outlet.bias_score || 50) - 50)))
  const similar = allOutlets.filter(o => o.id !== outletId && o.country === outlet?.country).slice(0, 4)
  const websiteUrl = outlet.website_url || (() => {
    if (!outlet.rss_url) return null
    try {
      const u = new URL(outlet.rss_url)
      // Known feed-domain → website mappings (feed host doesn't match the real site)
      const FEED_HOST_MAP = {
        'feeds.bbci.co.uk': 'https://www.bbc.co.uk',
        'feeds.skynews.com': 'https://news.sky.com',
        'feeds.feedburner.com': null, // feedburner can't be reverse-mapped
      }
      if (FEED_HOST_MAP[u.hostname] !== undefined) return FEED_HOST_MAP[u.hostname]
      // Strip common feed subdomains to get the root site
      const host = u.hostname.replace(/^(feeds?|rss|feed)\./i, '')
      return `${u.protocol}//${host}`
    } catch { return null }
  })()


  // AI aggregate scores derived from fetched articles
  const scoredArticles = articles.filter(a => a.accuracy_score > 0)
  const aiCount = scoredArticles.length
  const avgAccuracy = aiCount
    ? Math.round(scoredArticles.reduce((s, a) => s + a.accuracy_score, 0) / aiCount)
    : null
  const avgBiasScore = aiCount
    ? Math.round(scoredArticles.reduce((s, a) => s + (a.bias_score || 50), 0) / aiCount)
    : null
  const biasBreakdown = {
    left:   scoredArticles.filter(a => a.bias_direction === 'left').length,
    centre: scoredArticles.filter(a => a.bias_direction === 'centre').length,
    right:  scoredArticles.filter(a => a.bias_direction === 'right').length,
  }
  const headlineBreakdown = {
    fair:       scoredArticles.filter(a => a.headline_vote === 'fair').length,
    misleading: scoredArticles.filter(a => a.headline_vote === 'misleading').length,
    clickbait:  scoredArticles.filter(a => a.headline_vote === 'clickbait').length,
  }
  const fairRate  = aiCount ? Math.round((headlineBreakdown.fair / aiCount) * 100) : null

  // Category coverage — derived from fetched articles
  const categoryMap = {}
  articles.forEach(a => { if (a.category) categoryMap[a.category] = (categoryMap[a.category] || 0) + 1 })
  const sortedCategories = Object.entries(categoryMap).sort(([, a], [, b]) => b - a).slice(0, 6)
  const totalCategorised = sortedCategories.reduce((s, [, c]) => s + c, 0)

  // Ranking position — overall and within outlet's country
  const rankedAll     = [...allOutlets].filter(o => (o.accuracy_score || 0) > 0).sort((a, b) => (b.accuracy_score || 0) - (a.accuracy_score || 0))
  const rankOverall   = rankedAll.findIndex(o => o.id === outletId) + 1
  const countryPeers  = rankedAll.filter(o => o.country === outlet?.country)
  const rankCountry   = countryPeers.findIndex(o => o.id === outletId) + 1

  const dominantBias = aiCount
    ? (biasBreakdown.left > biasBreakdown.right && biasBreakdown.left > biasBreakdown.centre ? '← Left'
     : biasBreakdown.right > biasBreakdown.left && biasBreakdown.right > biasBreakdown.centre ? '→ Right'
     : '◉ Centre')
    : (outlet.bias_direction || null)

  // Needle position: weighted average of direction counts (left=0, centre=50, right=100)
  // Falls back to outlet.bias_direction when no articles are scored yet
  const dirTotal = biasBreakdown.left + biasBreakdown.centre + biasBreakdown.right
  const needlePos = dirTotal > 0
    ? Math.round((biasBreakdown.left * 0 + biasBreakdown.centre * 50 + biasBreakdown.right * 100) / dirTotal)
    : outlet.bias_direction === 'left' ? 15 : outlet.bias_direction === 'right' ? 85 : 50

  // Community stats
  const totalRatings = outletRatings.length
  const avgStars = totalRatings
    ? outletRatings.reduce((s, r) => s + (r.overall_stars || 0), 0) / totalRatings
    : 0
  const starCounts = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: outletRatings.filter(r => r.overall_stars === s).length,
  }))

  function handleRateClick() {
    if (!user) { onLoginClick(); return }
    if (alreadyRated) { showToast('You\'ve already rated this outlet'); return }
    setShowRatingModal(true)
  }

  async function onRated(rating) {
    if (navigator.vibrate) navigator.vibrate([50, 30, 80])
    setAlreadyRated(true)
    setMyRating(rating)
    // Refresh live outlet data + ratings list
    const { data: updatedOutlet } = await db.from('outlets').select('*').eq('id', outletId).single()
    if (updatedOutlet) setLiveOutlet(updatedOutlet)
    const { data: updatedRatings } = await db.from('outlet_ratings').select('*').eq('outlet_id', outletId).order('created_at', { ascending: false })
    if (updatedRatings) setOutletRatings(updatedRatings)
  }

  async function postComment() {
    if (!user) { onLoginClick(); return }
    const body = commentInput.trim()
    if (!body) return
    if (body.length > 1000) { showToast('Comment must be under 1,000 characters'); return }
    const { data, error } = await db
      .from('comments')
      .insert({ outlet_id: outletId, body, upvotes: 0, downvotes: 0, user_id: user.id })
      .select()
    if (error) { showToast('Could not post comment'); return }
    setCommentInput('')
    setComments(prev => [data[0], ...prev])
    showToast('Comment posted!')
  }

  async function voteComment(commentId, dir) {
    if (!user) { onLoginClick(); return }
    const key = `${commentId}-${dir}`
    if (votedComments[key]) {
      setVotedComments(prev => { const n = { ...prev }; delete n[key]; return n })
      return
    }
    setVotedComments(prev => ({ ...prev, [key]: true }))
    const field = dir === 1 ? 'upvotes' : 'downvotes'
    const { data } = await db.from('comments').select(field).eq('id', commentId).single()
    if (data) {
      await db.from('comments').update({ [field]: (data[field] || 0) + 1 }).eq('id', commentId)
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, [field]: (c[field] || 0) + 1 } : c))
    }
  }

  function ScoreBar({ label, value, tip }) {
    return (
      <div className="score-bar-row">
        <span className="sbl" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {label}{tip && <InfoTip text={tip} />}
        </span>
        <div className="sb-bg"><div className="sb-fill" style={{ width: `${value}%`, background: scoreColor(value) }}></div></div>
        <span className="sbv">{value}</span>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div className="outlet-hero" style={{ borderLeft: '3px solid var(--coral)' }}>
          <OutletLogo name={outlet.name} size={64} borderRadius={14} />
          <div className="outlet-hero-info">
            <div className="outlet-hero-name">{outlet.name}</div>
            <div className="outlet-meta-chips">
              <span className="meta-chip"><span>🌍</span>{outlet.country || 'Unknown'}</span>
              <span className="meta-chip">{outlet.type || 'News outlet'}</span>
              {websiteUrl && (
                <a
                  href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="meta-chip"
                  onClick={e => e.stopPropagation()}
                  style={{ textDecoration: 'none', color: 'var(--coral)', fontWeight: 500 }}
                >
                  ↗ Visit website
                </a>
              )}
            </div>
            <div className="outlet-desc">{outlet.description || ''}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="meta-chip"><span>🤖</span>AI analysed</span>
              <span className="meta-chip"><span>✓</span>Editorially verified</span>
            </div>
          </div>
          <div className="outlet-hero-score-block">
            <div className="outlet-hero-score-text">
              <div className="big-score" style={{ color: score >= 75 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : score > 0 ? 'var(--red)' : 'var(--text3)' }}>{score > 0 ? score : '—'}</div>
              <div className="big-score-label">Overall trust score</div>
              <div style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                marginTop: 6,
                background: score >= 75 ? 'var(--green-light)' : score >= 60 ? 'var(--amber-light)' : score > 0 ? 'var(--red-light)' : 'var(--bg2)',
                color: score >= 75 ? 'var(--green-dark)' : score >= 60 ? 'var(--amber)' : score > 0 ? 'var(--red)' : 'var(--text3)',
              }}>
                {score >= 90 ? '● High credibility' : score >= 75 ? '● Good credibility' : score >= 60 ? '● Mixed credibility' : score > 0 ? '● Low credibility' : 'Not yet rated'}
              </div>
              {rankOverall > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                  {rankCountry > 0 && outlet?.country
                    ? <>Ranked <strong style={{ color: 'var(--text2)' }}>#{rankCountry}</strong> of {countryPeers.length} {outlet.country} outlets · <strong style={{ color: 'var(--text2)' }}>#{rankOverall}</strong> overall</>
                    : <>Ranked <strong style={{ color: 'var(--text2)' }}>#{rankOverall}</strong> of {rankedAll.length} outlets</>
                  }
                </div>
              )}
            </div>
            <div className="outlet-hero-score-divider" />
            <div className="outlet-hero-actions">
              <button
                onClick={() => { if (!user) { onLoginClick(); return } toggleFollow(outletId) }}
                className="outlet-action-btn"
                style={{
                  border: followedOutletIds.has(outletId) ? '1.5px solid var(--border)' : '1.5px solid var(--coral)',
                  background: followedOutletIds.has(outletId) ? 'var(--bg)' : 'var(--coral)',
                  color: followedOutletIds.has(outletId) ? 'var(--text2)' : '#fff',
                }}
              >
                {followedOutletIds.has(outletId) ? '✓ Following' : '+ Follow'}
              </button>
              <button
                onClick={handleRateClick}
                className="outlet-action-btn"
                disabled={alreadyRated}
                style={{
                  border: '1.5px solid var(--border2)',
                  background: alreadyRated ? 'var(--bg)' : 'var(--surface)',
                  color: alreadyRated ? 'var(--text3)' : 'var(--text)',
                  cursor: alreadyRated ? 'default' : 'pointer',
                }}
              >
                {alreadyRated ? '★ Rated' : '★ Rate outlet'}
              </button>
            </div>
          </div>
        </div>


        {/* My rating banner */}
        {myRating && (
          <div style={{ background: 'var(--green-light)', border: '0.5px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green-dark)' }}>✓ Your rating</span>
            <span style={{ fontSize: 18, color: 'var(--amber)' }}>{'★'.repeat(myRating.overallStars || myRating.overall_stars || 0)}{'☆'.repeat(5 - (myRating.overallStars || myRating.overall_stars || 0))}</span>
            {(myRating.accuracyVote || myRating.accuracy_vote) && <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{(myRating.accuracyVote || myRating.accuracy_vote).replace('_', ' ')}</span>}
            {(myRating.biasVote || myRating.bias_vote) && <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{(myRating.biasVote || myRating.bias_vote).replace('_', ' ')}</span>}
          </div>
        )}

        <div className="tabs">
          {[['overview', 'Overview'], ['feed-tab', 'News feed'], ['community', `Community${totalRatings > 0 ? ` (${totalRatings})` : ''}`], ['discussion', `Discussion${comments.length > 0 ? ` (${comments.length})` : ''}`]].map(([id, label]) => (
            <div key={id} className={`tab${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>
              {label}
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid">
            <div>
              <div className="section-label">AI score breakdown {aiCount > 0 && <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(based on last 25 articles)</span>}</div>
              <div className="widget" style={{ marginBottom: 14 }}>
                {avgAccuracy !== null ? (
                  <>
                    <ScoreBar label="Avg article accuracy" value={avgAccuracy} tip="Average factual reliability score across this outlet's recent articles, as assessed by AI." />
                    {fairRate !== null && <ScoreBar label="Fair headline rate" value={fairRate} tip="Percentage of articles where the headline accurately reflects the content — not misleading or clickbait." />}
                    {avgBiasScore !== null && (
                      <div className="score-bar-row">
                        <span className="sbl" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          Partisan intensity <InfoTip text="How opinionated or one-sided this outlet's writing style tends to be — regardless of political direction. Low = objective reporting. High = strongly partisan language." />
                        </span>
                        <div className="sb-bg">
                          <div className="sb-fill" style={{ width: `${avgBiasScore}%`, background: scoreColor(100 - avgBiasScore) }}></div>
                        </div>
                        <span className="sbv" style={{ color: scoreColor(100 - avgBiasScore) }}>{avgBiasScore}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>
                    AI scores will appear once articles have been analysed.
                  </div>
                )}
              </div>

              <div className="section-label">Political bias</div>
              <div className="widget" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                  <span>Lean left</span><span>Centre</span><span>Lean right</span>
                </div>
                <div className="bias-track">
                  <div className="bias-needle" style={{
                    left: `${needlePos}%`,
                    borderColor: needlePos < 38 ? 'var(--blue, #3b82f6)' : needlePos > 62 ? 'var(--red)' : 'var(--text3)',
                  }}></div>
                </div>
                <div className="bias-labels">
                  <span>Far left</span><span>Left</span><span>Centre</span><span>Right</span><span>Far right</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10 }}>
                  Overall lean: <strong style={{ color: 'var(--text)' }}>{dominantBias || 'Unknown'}</strong>
                </div>
                {aiCount > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {[
                      { key: 'left',   label: '← Left',   color: 'var(--blue, #3b82f6)' },
                      { key: 'centre', label: '◉ Centre', color: 'var(--text3)'          },
                      { key: 'right',  label: '→ Right',  color: 'var(--red)'            },
                    ].map(({ key, label, color }) => biasBreakdown[key] > 0 && (
                      <span key={key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg)', border: '0.5px solid var(--border)', color }}>
                        {label} · {biasBreakdown[key]}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Headline verdict breakdown */}
              {aiCount > 0 && (
                <>
                  <div className="section-label">Headline verdicts</div>
                  <div className="widget" style={{ marginBottom: 14 }}>
                    {[
                      { key: 'fair',       label: '✓ Fair',       bg: 'var(--green-light)', color: 'var(--green-dark)' },
                      { key: 'misleading', label: '⚠ Misleading', bg: 'var(--amber-light)', color: 'var(--amber)' },
                      { key: 'clickbait',  label: '✗ Clickbait',  bg: 'var(--red-light)',   color: 'var(--red)'  },
                    ].map(({ key, label, bg, color }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color, minWidth: 90, textAlign: 'center' }}>{label}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${aiCount ? (headlineBreakdown[key] / aiCount) * 100 : 0}%`, background: color === 'var(--green-dark)' ? 'var(--green)' : color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 30, textAlign: 'right' }}>{headlineBreakdown[key]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Category coverage */}
              {sortedCategories.length > 0 && (
                <>
                  <div className="section-label">Coverage focus</div>
                  <div className="widget" style={{ marginBottom: 14 }}>
                    {sortedCategories.map(([cat, count]) => (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 88, fontWeight: 500 }}>{cat}</span>
                        <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round((count / sortedCategories[0][1]) * 100)}%`, background: 'var(--coral)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 28, textAlign: 'right' }}>{Math.round((count / totalCategorised) * 100)}%</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Based on last {articles.length} articles</div>
                  </div>
                </>
              )}

              {articlesLoading ? (
                <>
                  <div className="section-label">Recent articles</div>
                  <div className="feed">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="skeleton-news-card">
                        <div className="skeleton-line skeleton-shimmer" style={{ width: '88%', height: 14 }} />
                        <div className="skeleton-line skeleton-shimmer" style={{ width: '62%', height: 14 }} />
                        <div className="skeleton-row">
                          <div className="skeleton-line skeleton-shimmer" style={{ width: 44, height: 18, borderRadius: 20 }} />
                          <div className="skeleton-line skeleton-shimmer" style={{ width: 40, height: 18, borderRadius: 20 }} />
                          <div className="skeleton-line skeleton-shimmer" style={{ width: 36, height: 12, borderRadius: 20, marginLeft: 'auto' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : articles.length > 0 ? (
                <>
                  <div className="section-label">Recent articles</div>
                  <div className="feed">
                    {articles.slice(0, visibleArticles).map(a => (
                      <ArticleCard key={a.id} a={a} onClick={() => navigate('article', { articleId: a.id, title: a.title })} />
                    ))}
                  </div>
                  {articles.length > visibleArticles && (
                    <button
                      onClick={() => setVisibleArticles(v => v + 10)}
                      style={{
                        width: '100%', marginTop: 10, padding: '10px',
                        background: 'var(--surface)', border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                        color: 'var(--text2)', cursor: 'pointer',
                      }}
                    >
                      Show more articles ({articles.length - visibleArticles} remaining)
                    </button>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
                  <h3>No articles yet</h3>
                  <p>Articles from {outlet.name} will appear here once they're ingested and analysed. Check back after the next hourly update.</p>
                </div>
              )}
            </div>

            <div className="sidebar">
              <div className="widget">
                <div className="widget-title">Community rating</div>
                <div className="community-grid">
                  <div className="comm-chip">
                    <strong>{avgStars > 0 ? avgStars.toFixed(1) : outlet.community_score || 0}</strong>
                    <span>Avg score</span>
                  </div>
                  <div className="comm-chip">
                    <strong>{totalRatings || outlet.total_ratings || 0}</strong>
                    <span>Ratings</span>
                  </div>
                </div>
                <div className="star-row">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={s <= Math.round(avgStars || (outlet.community_score || 0) / 20) ? '' : 'star-empty'}>★</span>
                  ))}
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleRateClick}
                  disabled={alreadyRated}
                >
                  {alreadyRated ? '★ Already rated' : '★ Rate this outlet'}
                </button>
              </div>

              {similar.length > 0 && (
                <div className="widget">
                  <div className="widget-title">Similar outlets</div>
                  {similar.map(o => {
                    return (
                      <div key={o.id} className="similar-row" onClick={() => navigate('outlet', { outletId: o.id })}>
                        <OutletLogo name={o.name} size={30} borderRadius={7} />
                        <span style={{ flex: 1, fontSize: 13 }}>{o.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: scoreColor(o.overall_score || 0) }}>{o.overall_score || 0}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Highest scored articles */}
              {bestArticles.length > 0 && (
                <div className="widget">
                  <div className="widget-title">Highest scored articles</div>
                  {bestArticles.map(a => (
                    <Link key={a.id} href={`/article/${articleSlug(a.title, a.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }} className="border-hover">
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', background: 'var(--green-light)', borderRadius: 20, padding: '1px 7px', flexShrink: 0, marginTop: 1 }}>✦ {a.accuracy_score}</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</span>
                      </div>
                    </Link>
                  ))}
                  <a href="/methodology" style={{ display: 'block', marginTop: 10, fontSize: 11, color: 'var(--text3)', textDecoration: 'none', textAlign: 'right' }}>
                    How scores work →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'feed-tab' && (
          articlesLoading ? (
            <div className="feed">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-news-card">
                  <div className="skeleton-line skeleton-shimmer" style={{ width: '90%', height: 14 }} />
                  <div className="skeleton-line skeleton-shimmer" style={{ width: '65%', height: 14 }} />
                  <div className="skeleton-row">
                    <div className="skeleton-line skeleton-shimmer" style={{ width: 44, height: 18, borderRadius: 20 }} />
                    <div className="skeleton-line skeleton-shimmer" style={{ width: 40, height: 18, borderRadius: 20 }} />
                    <div className="skeleton-line skeleton-shimmer" style={{ width: 36, height: 12, borderRadius: 20, marginLeft: 'auto' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : articles.length > 0 ? (
            <>
              <div className="feed">
                {articles.slice(0, visibleArticles).map(a => (
                  <ArticleCard key={a.id} a={a} onClick={() => navigate('article', { articleId: a.id, title: a.title })} />
                ))}
              </div>
              {articles.length > visibleArticles && (
                <button
                  onClick={() => setVisibleArticles(v => v + 10)}
                  style={{
                    width: '100%', marginTop: 10, padding: '10px',
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                    color: 'var(--text2)', cursor: 'pointer',
                  }}
                >
                  Show more articles ({articles.length - visibleArticles} remaining)
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <h3>No articles yet</h3>
              <p>Articles will appear once your RSS pipeline is set up.</p>
            </div>
          )
        )}

        {activeTab === 'community' && (
          <div className="grid">
            <div>
              {outletRatings.length === 0 ? (
                <div className="empty-state">
                  <h3>No community ratings yet</h3>
                  <p>Be the first to rate {outlet.name}.</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Community ratings shape the outlet's trust score alongside AI analysis — the more people rate, the more weight they carry.
                  </p>
                  <button className="btn-primary" style={{ marginTop: 12 }} onClick={handleRateClick}>
                    ★ Rate this outlet
                  </button>
                </div>
              ) : (
                <>
                  <div className="section-label">{totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {outletRatings.map(r => (
                      <div key={r.id} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--purple-light)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500 }}>
                            {getInitials(raterProfiles[r.user_id] || null)}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>
                            {raterProfiles[r.user_id] || 'Community member'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 18, color: 'var(--amber)', marginBottom: 8 }}>
                          {'★'.repeat(r.overall_stars || 0)}{'☆'.repeat(5 - (r.overall_stars || 0))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: r.review_text ? 8 : 0 }}>
                          {r.accuracy_vote && <span style={{ fontSize: 11, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{r.accuracy_vote.replace('_', ' ')}</span>}
                          {r.bias_vote && <span style={{ fontSize: 11, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{r.bias_vote.replace('_', ' ')}</span>}
                        </div>
                        {r.review_text && (
                          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginTop: 4 }}>{r.review_text}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="sidebar">
              <div className="widget">
                <div className="widget-title">Rating breakdown</div>
                {totalRatings > 0 ? (
                  <>
                    <div style={{ fontSize: 36, fontWeight: 500, color: 'var(--amber)', marginBottom: 4 }}>
                      {avgStars.toFixed(1)}<span style={{ fontSize: 18 }}>★</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>from {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}</div>
                    {starCounts.map(({ star, count }) => (
                      <div key={star} className="rating-bar-row">
                        <span className="rat-label">{star}★</span>
                        <div className="rat-bg">
                          <div className="rat-fill" style={{ width: totalRatings ? `${(count / totalRatings) * 100}%` : '0%' }}></div>
                        </div>
                        <span className="rat-count">{count}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>No ratings yet.</div>
                )}
                <button
                  className="btn-primary"
                  style={{ width: '100%', marginTop: 14 }}
                  onClick={handleRateClick}
                  disabled={alreadyRated}
                >
                  {alreadyRated ? '★ Already rated' : '★ Rate this outlet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'discussion' && (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
              Discussion <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{comments.length} comments</span>
            </div>

            {/* Compose */}
            <div className="compose-row">
              <div className="compose-av">{user ? getInitials(user.email) : '?'}</div>
              <input
                className="compose-input"
                placeholder={user ? `Share your thoughts on ${outlet.name}...` : 'Sign in to join the discussion...'}
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && postComment()}
                onClick={!user ? onLoginClick : undefined}
                readOnly={!user}
                style={{ cursor: !user ? 'pointer' : 'text' }}
              />
              <button className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={postComment}>
                {user ? 'Post' : 'Sign in'}
              </button>
            </div>

            {/* Comments list */}
            {comments.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No comments yet — be the first to discuss {outlet.name}!</p>
              </div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="comment">
                  <div className="comment-header">
                    <div className="c-av" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                      {getInitials(c.user_id || '?')}
                    </div>
                    <span className="c-user">Community member</span>
                    <span className="c-ts">{timeAgo(c.created_at)}</span>
                  </div>
                  <div className="c-text">{c.body}</div>
                  <div className="c-actions">
                    <button
                      className={`vote-btn${votedComments[`${c.id}-1`] ? ' voted-up' : ''}`}
                      onClick={() => voteComment(c.id, 1)}
                    >▲ {c.upvotes || 0}</button>
                    <button
                      className={`vote-btn${votedComments[`${c.id}--1`] ? ' voted-down' : ''}`}
                      onClick={() => voteComment(c.id, -1)}
                    >▼ {c.downvotes || 0}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showRatingModal && (
        <OutletRatingModal
          outlet={outlet}
          onClose={() => setShowRatingModal(false)}
          onRated={onRated}
          showToast={showToast}
          user={user}
        />
      )}
    </div>
  )
}
