import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { outletColor, scoreColor, scoreDot, timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import RatingModal from '../components/RatingModal'
import InfoTip from '../components/InfoTip'

export default function ArticlePage({ articleId, allArticles, navigate, goBack, showToast, refreshArticle, user, onLoginClick, isSaved, toggleSave }) {
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [commentSort, setCommentSort] = useState('top')
  const [votedComments, setVotedComments] = useState({})
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [myRating, setMyRating] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null) // comment id being replied to
  const [replyInputs, setReplyInputs] = useState({}) // { [commentId]: text }
  const [replies, setReplies] = useState({}) // { [parentId]: [reply, ...] }
  const [userProfiles, setUserProfiles] = useState({}) // { [user_id]: username }
  const [fetchedArticle, setFetchedArticle] = useState(null)

  const article = allArticles.find(a => a.id === articleId) || fetchedArticle

  useEffect(() => {
    if (!articleId) return

    setAlreadyRated(false)
    setMyRating(null)
    setComments([])
    setReplies({})
    setReplyingTo(null)

    if (user) {
      // Logged in — check DB for prior rating
      db.from('ratings')
        .select('overall_stars, accuracy_vote, bias_vote, headline_vote')
        .eq('article_id', articleId)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAlreadyRated(true)
            setMyRating({
              overallStars: data.overall_stars,
              accuracyVote: data.accuracy_vote,
              biasVote: data.bias_vote,
              headlineVote: data.headline_vote,
            })
          }
        })
    } else {
      // Logged out — fall back to localStorage
      const stored = localStorage.getItem(`rated_${articleId}`)
      if (stored) {
        setAlreadyRated(true)
        try { setMyRating(JSON.parse(stored)) } catch (_) {}
      }
    }

    db.from('comments')
      .select('*')
      .eq('article_id', articleId)
      .is('parent_id', null)
      .order('upvotes', { ascending: false })
      .then(async ({ data }) => {
        const loaded = data || []
        setComments(loaded)
        // Fetch usernames for all commenters
        const ids = [...new Set(loaded.map(c => c.user_id).filter(Boolean))]
        if (ids.length > 0) {
          const { data: profiles } = await db
            .from('profiles')
            .select('user_id, username')
            .in('user_id', ids)
          if (profiles) {
            const map = {}
            profiles.forEach(p => { map[p.user_id] = p.username })
            setUserProfiles(map)
          }
        }
      })

    // Real-time: new comments on this article
    const channel = db
      .channel(`comments-${articleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `article_id=eq.${articleId}`,
      }, payload => {
        if (!payload.new.parent_id) {
          setComments(prev => {
            if (prev.find(c => c.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        }
      })
      .subscribe()

    return () => { db.removeChannel(channel) }
  }, [articleId, user])

  // If article isn't in the local cache (e.g. older than the loaded feed window),
  // fetch it directly from the DB so we never show a blank page
  useEffect(() => {
    if (!articleId) return
    if (allArticles.find(a => a.id === articleId)) { setFetchedArticle(null); return }
    setFetchedArticle(null)
    db.from('articles')
      .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
      .eq('id', articleId)
      .single()
      .then(({ data }) => { if (data) setFetchedArticle(data) })
  }, [articleId])

  if (!article) return null

  const outlet = article.outlets || {}
  const [bg, fg] = outletColor(outlet.name || 'X')
  const acc = article.accuracy_score || 0
  const bias = article.bias_score || 0
  const com = article.community_score || 0

  // Related articles
  const moreFromOutlet = allArticles
    .filter(a => a.id !== articleId && a.outlets?.name === outlet.name)
    .slice(0, 4)

  const sameCategory = article.category
    ? allArticles
        .filter(a => a.id !== articleId && a.category === article.category && a.outlets?.name !== outlet.name)
        .slice(0, 4)
    : []

  const HEADLINE_STYLES = {
    fair:       { bg: 'var(--green-light)', color: 'var(--green-dark)', label: '✓ Fair headline'  },
    misleading: { bg: '#fff3cd',            color: '#856404',           label: '⚠ Misleading'    },
    clickbait:  { bg: '#fde8e8',            color: 'var(--red)',        label: '✗ Clickbait'     },
  }
  const BIAS_INFO = {
    left:   { label: 'Left-leaning',   color: 'var(--blue, #3b82f6)', bar: 20 },
    centre: { label: 'Centre / Neutral', color: 'var(--text2)',       bar: 50 },
    right:  { label: 'Right-leaning',  color: 'var(--red)',           bar: 80 },
  }
  const hlStyle  = article.headline_vote ? HEADLINE_STYLES[article.headline_vote] : null
  const biasInfo = article.bias_direction ? BIAS_INFO[article.bias_direction] : null
  const aiScored = acc > 0

  let hostname = 'source'
  try { hostname = article.url ? new URL(article.url).hostname : 'source' } catch (_) {}

  const sortedComments = [...comments].sort((a, b) => {
    if (commentSort === 'new') return new Date(b.created_at) - new Date(a.created_at)
    if (commentSort === 'controversial') return (b.downvotes || 0) - (a.downvotes || 0)
    return (b.upvotes || 0) - (a.upvotes || 0) // top
  })

  async function postComment() {
    if (!user) { onLoginClick(); return }
    const body = commentInput.trim()
    if (!body) return
    const { data, error } = await db
      .from('comments')
      .insert({ article_id: articleId, body, upvotes: 0, downvotes: 0, user_id: user.id })
      .select()
    if (error) { showToast('Could not post comment'); return }
    setCommentInput('')
    setComments(prev => [data[0], ...prev])
    showToast('Comment posted!')
  }

  async function postReply(parentId) {
    if (!user) { onLoginClick(); return }
    const body = (replyInputs[parentId] || '').trim()
    if (!body) return
    const { data, error } = await db
      .from('comments')
      .insert({ article_id: articleId, parent_id: parentId, body, upvotes: 0, downvotes: 0, ...(user ? { user_id: user.id } : {}) })
      .select()
    if (error) { showToast('Could not post reply'); return }
    setReplyInputs(prev => ({ ...prev, [parentId]: '' }))
    setReplyingTo(null)
    setReplies(prev => ({ ...prev, [parentId]: [...(prev[parentId] || []), data[0]] }))
    showToast('Reply posted!')
  }

  async function loadReplies(parentId) {
    if (replies[parentId]) {
      // Toggle: hide if already loaded
      setReplies(prev => { const n = { ...prev }; delete n[parentId]; return n })
      return
    }
    const { data } = await db
      .from('comments')
      .select('*')
      .eq('article_id', articleId)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
    setReplies(prev => ({ ...prev, [parentId]: data || [] }))
  }

  async function voteComment(commentId, dir) {
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
      // Update in top-level comments or replies
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, [field]: (c[field] || 0) + 1 } : c))
      setReplies(prev => {
        const updated = {}
        for (const [pid, rList] of Object.entries(prev)) {
          updated[pid] = rList.map(r => r.id === commentId ? { ...r, [field]: (r[field] || 0) + 1 } : r)
        }
        return updated
      })
    }
  }

  function CommentRow({ c, isReply = false }) {
    const hasReplies = !isReply
    const replyList = replies[c.id] || []
    const isExpanded = replies[c.id] !== undefined
    const isReplying = replyingTo === c.id
    const username = c.user_id ? (userProfiles[c.user_id] || 'Community member') : 'Community member'
    const initials = username.slice(0, 2).toUpperCase()

    return (
      <div className={isReply ? 'reply' : 'comment'}>
        <div className="comment-header">
          <div className="c-av" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
            {initials}
          </div>
          <span
            className="c-user"
            style={{ cursor: c.user_id ? 'pointer' : 'default' }}
            onClick={() => c.user_id && navigate('publicProfile', { userId: c.user_id })}
            onMouseOver={e => { if (c.user_id) e.currentTarget.style.color = 'var(--coral)' }}
            onMouseOut={e => e.currentTarget.style.color = ''}
          >
            {username}
          </span>
          <span className="c-ts">{timeAgo(c.created_at)}</span>
        </div>
        <div className="c-text">{c.body || ''}</div>
        <div className="c-actions">
          <button
            className={`vote-btn${votedComments[`${c.id}-1`] ? ' voted-up' : ''}`}
            onClick={() => voteComment(c.id, 1)}
          >
            ▲ {c.upvotes || 0}
          </button>
          <button
            className={`vote-btn${votedComments[`${c.id}--1`] ? ' voted-down' : ''}`}
            onClick={() => voteComment(c.id, -1)}
          >
            ▼ {c.downvotes || 0}
          </button>
          {!isReply && (
            <button className="reply-btn" onClick={() => {
              setReplyingTo(isReplying ? null : c.id)
            }}>
              {isReplying ? 'Cancel' : 'Reply'}
            </button>
          )}
          {hasReplies && (
            <button className="reply-btn" style={{ marginLeft: 4, color: 'var(--coral)' }} onClick={() => loadReplies(c.id)}>
              {isExpanded ? `Hide replies` : `Show replies`}
            </button>
          )}
        </div>

        {isReplying && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 4 }}>
            <input
              className="compose-input"
              style={{ fontSize: 12, padding: '6px 10px' }}
              placeholder={`Reply to comment...`}
              value={replyInputs[c.id] || ''}
              onChange={e => setReplyInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && postReply(c.id)}
              autoFocus
            />
            <button
              className="btn-primary"
              style={{ fontSize: 11, padding: '6px 12px', whiteSpace: 'nowrap' }}
              onClick={() => postReply(c.id)}
            >
              Post
            </button>
          </div>
        )}

        {isExpanded && replyList.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {replyList.map(r => <CommentRow key={r.id} c={r} isReply />)}
          </div>
        )}
        {isExpanded && replyList.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 4, marginTop: 8 }}>No replies yet.</div>
        )}
      </div>
    )
  }

  return (
    <>
    <div className="page-content">
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div className="article-preview-card">
          <div className="article-outlet-row">
            <OutletLogo name={outlet.name || ''} size={32} borderRadius={8} />
            <div>
              <div
                style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                onClick={() => navigate('outlet', { outletId: article.outlet_id })}
              >
                {outlet.name || ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{outlet.country || ''} · {timeAgo(article.published_at)}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="ai-tag">AI scored</span>
              <button
                className={`save-btn${isSaved ? ' saved' : ''}`}
                onClick={() => toggleSave(articleId)}
                title={isSaved ? 'Remove from saved' : 'Save article'}
                style={{ fontSize: 20 }}
              >
                🔖
              </button>
            </div>
          </div>

          <div className="article-headline-full">{article.title || ''}</div>

          <div className="article-score-strip">
            <div className="asc"><strong style={{ color: scoreColor(acc) }}>{acc || '—'}</strong><span>Accuracy</span></div>
            <div className="asc"><strong style={{ color: biasInfo?.color || 'var(--text2)' }}>{article.bias_direction || '—'}</strong><span>Bias</span></div>
            {com > 0 && <div className="asc"><strong style={{ color: 'var(--amber)' }}>{(com / 20).toFixed(1)}★</strong><span>Community</span></div>}
            <div className="asc"><strong>{article.total_ratings || 0}</strong><span>Ratings</span></div>
            <div className="asc"><strong style={{ color: 'var(--text2)' }}>💬 {comments.length}</strong><span>Comments</span></div>
          </div>

          {/* AI Analysis panel */}
          {aiScored && (
            <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase' }}>AI Analysis</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Accuracy bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                      Accuracy <InfoTip text="How factually reliable this article appears based on its headline and summary. 100 = well-sourced, credible reporting." />
                    </span>
                    <span style={{ fontWeight: 700, color: scoreColor(acc) }}>{acc}/100</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${acc}%`, background: scoreColor(acc), borderRadius: 3, transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Partisan intensity bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                      Partisan intensity <InfoTip text="How opinionated or one-sided the writing style is — regardless of direction. 0 = objective reporting, 100 = strongly partisan. A calm left-leaning article can score low; a centrist opinion piece can score high." />
                    </span>
                    <span style={{ fontWeight: 700, color: scoreColor(100 - bias) }}>{bias}/100</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${bias}%`, background: scoreColor(100 - bias), borderRadius: 3, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                    <span>Objective</span><span>Partisan</span>
                  </div>
                </div>
              </div>

              {/* Political lean + headline verdict */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {biasInfo && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--bg2, var(--surface))', border: '0.5px solid var(--border)', color: biasInfo.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {biasInfo.label} <InfoTip text="The political direction of this article's framing — left, centre, or right. This is separate from how intensely partisan it is." />
                  </span>
                )}
                {hlStyle && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: hlStyle.bg, color: hlStyle.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {hlStyle.label} <InfoTip text="Whether the headline fairly represents the article. 'Misleading' means the headline implies something not backed by the content. 'Clickbait' uses exaggeration or withholds info to drive clicks." />
                  </span>
                )}
              </div>

              {article.ai_summary && (
                <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                  {article.ai_summary}
                </p>
              )}
            </div>
          )}

          {myRating && (
            <div style={{ background: 'var(--green-light)', border: '0.5px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green-dark)' }}>✓ Your rating</span>
              <span style={{ fontSize: 18, color: 'var(--amber)' }}>{'★'.repeat(myRating.overallStars)}{'☆'.repeat(5 - myRating.overallStars)}</span>
              {myRating.accuracyVote && <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{myRating.accuracyVote.replace('_', ' ')}</span>}
              {myRating.biasVote && <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{myRating.biasVote.replace('_', ' ')}</span>}
              {myRating.headlineVote && <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 20, color: 'var(--text2)' }}>{myRating.headlineVote}</span>}
            </div>
          )}

          <div className="browser-wrap" style={{ marginBottom: 14 }}>
            <div className="browser-chrome">
              <div className="browser-dots">
                <div className="browser-dot" style={{ background: '#FF5F57' }}></div>
                <div className="browser-dot" style={{ background: '#FFBD2E' }}></div>
                <div className="browser-dot" style={{ background: '#28C840' }}></div>
              </div>
              <div className="url-bar">
                <span className="url-lock">🔒</span>
                <span>{hostname}</span>
              </div>
            </div>
            <div className="rn-browser-bar">
              <div className="rn-browser-label">
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>RN</span>
                RatedNews · {outlet.name || ''} · Score: {acc}
              </div>
              <span className="rn-browser-badge">Opens in app</span>
            </div>
            <div className="browser-content">
              <div className="browser-headline">{article.title || ''}</div>
              <div className="browser-byline">{outlet.name || ''} · {timeAgo(article.published_at)}</div>
              <div className="browser-body">
                {article.summary || "Click \"Read full article\" to read the complete story on the publisher's website."}
              </div>
            </div>
            <div className="sticky-rate-bar">
              <div className="srb-label">Reading via RatedNews — rate this article or join the discussion</div>
              <button className="btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => showToast('Discussion below ↓')}>
                💬 {comments.length}
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 14px', opacity: alreadyRated ? 0.6 : 1 }}
                onClick={() => {
                  if (!user) { onLoginClick(); return }
                  if (alreadyRated) { showToast('You\'ve already rated this article'); return }
                  setShowRatingModal(true)
                }}
              >
                {alreadyRated ? '★ Rated' : '★ Rate'}
              </button>
            </div>
          </div>

          <div className="article-actions">
            <button className="btn-primary" onClick={() => article.url && window.open(article.url, '_blank')}>
              Read full article on {outlet.name || 'source'} ↗
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                if (!user) { onLoginClick(); return }
                if (alreadyRated) { showToast('You\'ve already rated this article'); return }
                setShowRatingModal(true)
              }}
            >
              {alreadyRated ? '★ Already rated' : '★ Rate this article'}
            </button>
            <button className="btn-outline" onClick={async () => {
              const shareUrl = `${window.location.origin}${window.location.pathname}?article=${articleId}`
              if (navigator.share) {
                try {
                  await navigator.share({ title: article.title, text: article.ai_summary || article.title, url: shareUrl })
                } catch (_) {}
              } else {
                navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied!')).catch(() => showToast('Could not copy link'))
              }
            }}>↑ Share</button>
          </div>
        </div>

        {/* More from this outlet */}
        {moreFromOutlet.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>More from {outlet.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {moreFromOutlet.map((a, i) => {
                const [abg] = outletColor(a.outlets?.name || '')
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate('article', { articleId: a.id })}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < moreFromOutlet.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: abg, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontFamily: 'Playfair Display, serif', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(a.published_at)}{a.accuracy_score > 0 ? ` · Accuracy ${a.accuracy_score}` : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Same category, different outlets */}
        {sameCategory.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>
              More {article.category} — from other outlets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {sameCategory.map((a, i) => {
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate('article', { articleId: a.id })}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < sameCategory.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={e => e.currentTarget.style.background = ''}
                  >
                    <OutletLogo name={a.outlets?.name || ''} size={28} borderRadius={7} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontFamily: 'Playfair Display, serif', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {a.outlets?.name} · {timeAgo(a.published_at)}
                        {a.bias_direction && <span style={{ color: a.bias_direction === 'left' ? 'var(--blue, #3b82f6)' : a.bias_direction === 'right' ? 'var(--red)' : 'var(--text3)', marginLeft: 4 }}>
                          {a.bias_direction === 'left' ? '← Left' : a.bias_direction === 'right' ? '→ Right' : '◉ Centre'}
                        </span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Comments */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            Discussion <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{comments.length} comments</span>
          </div>
          <div className="sort-row">
            <span className="sort-label">Sort:</span>
            {['top', 'new', 'controversial'].map(s => (
              <button
                key={s}
                className={`sort-pill${commentSort === s ? ' active' : ''}`}
                onClick={() => setCommentSort(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="compose-row">
            <div className="compose-av">{user ? user.email.slice(0, 2).toUpperCase() : '?'}</div>
            <input
              className="compose-input"
              placeholder={user ? 'Add to the discussion...' : 'Sign in to join the discussion...'}
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
          <div>
            {comments.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No comments yet — be the first to start the discussion!</p>
              </div>
            ) : (
              sortedComments.map(c => <CommentRow key={c.id} c={c} />)
            )}
          </div>
        </div>
      </div>
    </div>

    {showRatingModal && (
      <RatingModal
        article={article}
        outlet={outlet}
        onClose={() => setShowRatingModal(false)}
        onRated={(rating) => {
          setAlreadyRated(true)
          setMyRating(rating)
          refreshArticle(articleId)
          // Only persist to localStorage when logged out
          if (!user) localStorage.setItem(`rated_${articleId}`, JSON.stringify(rating))
        }}
        showToast={showToast}
        user={user}
      />
    )}
    </>
  )
}
