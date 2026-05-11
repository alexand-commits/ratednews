import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '../lib/supabase'
import { articleSlug, outletColor, scoreColor, scoreDot, timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import RatingModal from '../components/RatingModal'
import InfoTip from '../components/InfoTip'

// Extract meaningful initials from a username or email — avoids numbers/symbols
function getInitials(str) {
  if (!str) return '?'
  // If it looks like an email, use first letter of local part + first letter of domain
  if (str.includes('@')) {
    const [local, domain] = str.split('@')
    const a = local.replace(/[^a-zA-Z]/g, '')[0] || '?'
    const b = (domain || '').replace(/[^a-zA-Z]/g, '')[0] || ''
    return (a + b).toUpperCase()
  }
  // Otherwise take first letter of first two words
  const words = str.trim().split(/\s+/)
  return words.slice(0, 2).map(w => w.replace(/[^a-zA-Z]/g, '')[0] || '').join('').toUpperCase() || '?'
}

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
  const [relatedArticles, setRelatedArticles] = useState([])
  const [sameStoryArticles, setSameStoryArticles] = useState([])

  const article = allArticles.find(a => a.id === articleId) || fetchedArticle

  useEffect(() => {
    if (!articleId) return

    setAlreadyRated(false)
    setMyRating(null)
    setComments([])
    setReplies({})
    setReplyingTo(null)
    setVotedComments({})

    // Logged out — check localStorage immediately (no network needed)
    if (!user) {
      const stored = localStorage.getItem(`rated_${articleId}`)
      if (stored) {
        setAlreadyRated(true)
        try { setMyRating(JSON.parse(stored)) } catch (_) {}
      }
    }

    // Fire ratings + comments + votes in parallel — no sequential waiting
    const ratingsPromise = user
      ? db.from('ratings')
          .select('overall_stars, accuracy_vote, bias_vote, headline_vote')
          .eq('article_id', articleId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null })

    const commentsPromise = db.from('comments')
      .select('*')
      .eq('article_id', articleId)
      .is('parent_id', null)
      .order('upvotes', { ascending: false })

    const votesPromise = user
      ? db.from('comment_votes').select('comment_id, dir').eq('user_id', user.id)
      : Promise.resolve({ data: [] })

    Promise.all([ratingsPromise, commentsPromise, votesPromise]).then(
      ([{ data: ratingData }, { data: commentData }, { data: votesData }]) => {
        // Apply ratings
        if (ratingData) {
          setAlreadyRated(true)
          setMyRating({
            overallStars: ratingData.overall_stars,
            accuracyVote: ratingData.accuracy_vote,
            biasVote:     ratingData.bias_vote,
            headlineVote: ratingData.headline_vote,
          })
        }

        // Apply comments
        const loaded = commentData || []
        setComments(loaded)

        // Restore persisted vote state from DB
        if (votesData && votesData.length > 0) {
          const map = {}
          votesData.forEach(v => { map[`${v.comment_id}-${v.dir}`] = true })
          setVotedComments(map)
        }

        // Fetch profiles in parallel once we have comment user IDs
        const ids = [...new Set(loaded.map(c => c.user_id).filter(Boolean))]
        if (ids.length > 0) {
          db.from('profiles')
            .select('user_id, username')
            .in('user_id', ids)
            .then(({ data: profiles }) => {
              if (profiles) {
                const map = {}
                profiles.forEach(p => { map[p.user_id] = p.username })
                setUserProfiles(map)
              }
            })
        }
      }
    )

    // Defer realtime subscription — set up after initial render, not on mount
    const realtimeTimer = setTimeout(() => {
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
    }, 3000)

    return () => { clearTimeout(realtimeTimer) }
  }, [articleId, user])

  // Fetch same-story articles from other outlets using title keyword search
  useEffect(() => {
    if (!article?.title) return
    setSameStoryArticles([])

    const STOP = new Set([
      'the','a','an','in','on','at','to','for','of','and','or','but','with',
      'from','by','as','is','are','was','were','be','been','has','have','had',
      'its','their','this','that','these','those','how','why','what','who',
      'when','where','says','said','will','can','may','over','after','before',
      'amid','about','into','new','first','second',
    ])
    const sigWords = [...new Set(
      article.title.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w))
    )]
    if (sigWords.length < 2) return

    // OR across ALL significant keywords so we catch outlets that cover the same
    // story with different wording (e.g. "Clasico" articles that don't mention
    // "Rashford" and vice versa). The DB net is wide; the client-side 3-word
    // overlap filter below keeps quality high.
    const orFilter = sigWords.map(k => `title.ilike.%${k}%`).join(',')
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    db.from('articles')
      .select('*, outlets(name, bias_direction, logo_url)')
      .neq('outlet_id', article.outlet_id)
      .neq('id', article.id)
      .or(orFilter)
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data) return
        const titleWords = new Set(sigWords)
        const matched = data.filter(a => {
          const aWords = (a.title || '').toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w))
          const overlap = aWords.filter(w => titleWords.has(w)).length
          // Use 2-word threshold (not 3) because the article page can't do the
          // transitive cluster walk that FeedPage does. Cluster members may share
          // only 2 words with the current article but clearly cover the same story.
          // The OR filter + 72h window + 2-word overlap is a strong enough signal.
          return overlap >= 2
        })
        // Dedupe by outlet — keep most recent per outlet
        const byOutlet = {}
        matched.forEach(a => {
          if (!byOutlet[a.outlet_id] || a.published_at > byOutlet[a.outlet_id].published_at) {
            byOutlet[a.outlet_id] = a
          }
        })
        setSameStoryArticles(Object.values(byOutlet).slice(0, 5))
      })
  }, [article?.id])

  // Fetch related articles once the current article is known
  useEffect(() => {
    if (!article) return
    setRelatedArticles([])
    const { outlet_id, category, id, bias_score } = article
    const isFactualArticle = (article.accuracy_score || 0) > 0 && (bias_score || 0) < 25

    // Always fetch more from the same outlet
    const outletPromise = db.from('articles')
      .select('*, outlets(name, logo_url, country, bias_direction)')
      .eq('outlet_id', outlet_id)
      .neq('id', id)
      .gt('accuracy_score', 0)
      .order('published_at', { ascending: false })
      .limit(4)

    // Only fetch same-category for non-factual articles
    const categoryPromise = (!isFactualArticle && category)
      ? db.from('articles')
          .select('*, outlets(name, logo_url, country, bias_direction)')
          .eq('category', category)
          .neq('outlet_id', outlet_id)
          .neq('id', id)
          .gt('accuracy_score', 0)
          .order('published_at', { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] })

    Promise.all([outletPromise, categoryPromise]).then(
      ([{ data: outletData }, { data: categoryData }]) => {
        setRelatedArticles({ outlet: outletData || [], category: categoryData || [] })
      }
    )
  }, [article?.id])

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
  const isFactual = acc > 0 && bias < 25

  // Related articles — fetched client-side in the useEffect above
  const moreFromOutlet = relatedArticles.outlet || []
  const sameCategory   = relatedArticles.category || []

  const HEADLINE_STYLES = {
    fair:       { bg: 'var(--green-light)', color: 'var(--green-dark)', label: '✓ Fair headline'  },
    misleading: { bg: 'var(--amber-light)', color: 'var(--amber)', label: '⚠ Misleading' },
    clickbait:  { bg: 'var(--red-light)',   color: 'var(--red)',   label: '✗ Clickbait'  },
  }
  const BIAS_INFO = {
    left:   { label: '← Left',   color: 'var(--blue, #3b82f6)', bar: 20 },
    centre: { label: '◉ Centre', color: 'var(--text2)',         bar: 50 },
    right:  { label: '→ Right',  color: 'var(--red)',           bar: 80 },
  }
  const hlStyle  = article.headline_vote ? HEADLINE_STYLES[article.headline_vote] : null
  const biasInfo = article.bias_direction ? BIAS_INFO[article.bias_direction] : null
  const aiScored = acc > 0

  function credLabel(score) {
    if (score >= 70) return { cls: 'score-badge score-badge-green',  label: '✓ Reliable' }
    if (score >= 50) return { cls: 'score-badge score-badge-amber',  label: '≈ Mixed'    }
    return                   { cls: 'score-badge score-badge-red',   label: '⚠ Flagged'  }
  }
  function credWord(score) {
    if (score >= 70) return 'Reliable'
    if (score >= 50) return 'Mixed'
    return 'Flagged'
  }

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
    if (body.length > 1000) { showToast('Comment must be under 1,000 characters'); return }
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
    if (body.length > 1000) { showToast('Reply must be under 1,000 characters'); return }
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
    if (!user) { onLoginClick(); return }
    const key = `${commentId}-${dir}`
    const field = dir === 1 ? 'upvotes' : 'downvotes'

    function applyDelta(delta) {
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, [field]: Math.max(0, (c[field] || 0) + delta) } : c
      ))
      setReplies(prev => {
        const updated = {}
        for (const [pid, rList] of Object.entries(prev)) {
          updated[pid] = rList.map(r =>
            r.id === commentId ? { ...r, [field]: Math.max(0, (r[field] || 0) + delta) } : r
          )
        }
        return updated
      })
    }

    if (votedComments[key]) {
      // Un-vote: remove from DB, decrement count optimistically
      setVotedComments(prev => { const n = { ...prev }; delete n[key]; return n })
      applyDelta(-1)
      const { error: delError } = await db.from('comment_votes').delete().eq('user_id', user.id).eq('comment_id', commentId)
      if (delError) {
        // Revert optimistic update
        setVotedComments(prev => ({ ...prev, [key]: true }))
        applyDelta(1)
        showToast('Could not remove vote — please try again')
        return
      }
      const { data } = await db.from('comments').select(field).eq('id', commentId).single()
      if (data) await db.from('comments').update({ [field]: Math.max(0, (data[field] || 0) - 1) }).eq('id', commentId)
      return
    }

    // Vote: insert into DB — unique constraint prevents duplicates across sessions
    const { error } = await db.from('comment_votes').insert({ user_id: user.id, comment_id: commentId, dir })
    if (error) {
      // Revert optimistic state and inform user
      showToast('Could not register vote — please try again')
      return
    }
    setVotedComments(prev => ({ ...prev, [key]: true }))
    applyDelta(1)
    const { data } = await db.from('comments').select(field).eq('id', commentId).single()
    if (data) await db.from('comments').update({ [field]: (data[field] || 0) + 1 }).eq('id', commentId)
  }

  function CommentRow({ c, isReply = false }) {
    const hasReplies = !isReply
    const replyList = replies[c.id] || []
    const isExpanded = replies[c.id] !== undefined
    const isReplying = replyingTo === c.id
    const username = c.user_id ? (userProfiles[c.user_id] || 'Community member') : 'Community member'
    const initials = getInitials(username)

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
              style={{ padding: '6px 10px' }}
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {aiScored && (
                <span className={credLabel(acc).cls}>
                  {credLabel(acc).label}
                </span>
              )}
              {aiScored && (
                isFactual
                  ? <span className="score-badge score-badge-bias-centre">◉ Balanced</span>
                  : biasInfo && <span className={`score-badge score-badge-bias-${article.bias_direction}`}>
                      {{ left: '← Left', centre: '◉ Centre', right: '→ Right' }[article.bias_direction]}
                    </span>
              )}
              <button
                className={`save-btn${isSaved ? ' saved' : ''}`}
                onClick={() => toggleSave(articleId)}
              >
                {isSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          </div>

          <div className="article-headline-full">{article.title || ''}</div>

          <div className="article-score-strip">
            <div className="asc"><strong style={{ color: scoreColor(acc) }}>{acc > 0 ? credWord(acc) : '—'}</strong><span>Credibility</span></div>
            {com > 0 && <div className="asc"><strong style={{ color: 'var(--amber)' }}>{(com / 20).toFixed(1)}★</strong><span>Community</span></div>}
            <div className="asc"><strong>{article.total_ratings || 0}</strong><span>Ratings</span></div>
            <div className="asc"><strong style={{ color: 'var(--text2)' }}>{comments.length}</strong><span>Comments</span></div>
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
                      Credibility <InfoTip text="How credible this article appears based on its headline and summary — does it look like reliable, well-sourced journalism?" />
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
                {isFactual ? (
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                    Low partisan intensity — consistent with factual reporting
                  </span>
                ) : biasInfo && (
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

          {/* Same story across outlets */}
          {sameStoryArticles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8,
              }}>
                📰 Also covered by {sameStoryArticles.length} other outlet{sameStoryArticles.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sameStoryArticles.map(a => {
                  const o = a.outlets || {}
                  const [oBg] = outletColor(o.name || 'X')
                  const BIAS_DOTS = { left: '#4a90d9', centre: '#5cb85c', right: '#d9534f' }
                  const biasColor = BIAS_DOTS[o.bias_direction]
                  const BIAS_LABEL = { left: 'Left', centre: 'Centre', right: 'Right' }
                  const oAcc = a.accuracy_score || 0
                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate('article', { articleId: a.id, title: a.title })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', minHeight: 44,
                        background: 'var(--surface)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 8, cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: oBg, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.name || 'Unknown'}
                      </span>
                      {biasColor && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: biasColor, flexShrink: 0 }}>
                          {BIAS_LABEL[o.bias_direction]}
                        </span>
                      )}
                      {oAcc > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, flexShrink: 0,
                          color: oAcc >= 70 ? 'var(--green)' : oAcc >= 50 ? 'var(--amber)' : 'var(--red)',
                        }}>
                          {credWord(oAcc)}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>→</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="browser-wrap" style={{ marginBottom: 14 }}>
            <div className="rn-browser-bar">
              <div className="rn-browser-label">
                <span className="url-lock">🔒</span>
                <span style={{ opacity: 0.85 }}>{hostname}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {acc > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{credWord(acc)}</span>}
                <span className="rn-browser-badge">Opens in app</span>
              </div>
            </div>
            <div className="browser-content">
              <div className="browser-headline">{article.title || ''}</div>
              <div className="browser-byline">{outlet.name || ''} · {timeAgo(article.published_at)}</div>
              <div className="browser-body">
                {article.summary || "Click \"Read full article\" to read the complete story on the publisher's website."}
              </div>
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
              const shareUrl = `https://ratednews.com/article/${articleSlug(article.title, article.id)}`
              const biasMap = { left: '← Left', centre: '◉ Centre', right: '→ Right' }
              const scoreParts = [
                acc ? `🎯 ${credWord(acc)}` : null,
                article.bias_direction ? biasMap[article.bias_direction] : null,
                article.headline_vote && article.headline_vote !== 'fair' ? `📰 ${article.headline_vote}` : null,
              ].filter(Boolean).join(' · ')
              const shareText = scoreParts ? `${scoreParts}\n\n${article.title}` : article.title
              if (navigator.share) {
                try { await navigator.share({ title: article.title, text: shareText, url: shareUrl }) } catch (_) {}
              } else {
                navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied!')).catch(() => showToast('Could not copy'))
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
                    onClick={e => { if (e.target.closest('a')) return; navigate('article', { articleId: a.id, title: a.title }) }}
                    className="row-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < moreFromOutlet.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                  >
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: abg, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/article/${articleSlug(a.title, a.id)}`} style={{ fontSize: 13, fontFamily: 'var(--font-playfair), serif', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>{a.title}</Link>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{timeAgo(a.published_at)}</span>
                        {a.accuracy_score > 0 && <span className={credLabel(a.accuracy_score).cls} style={{ fontSize: 10, padding: '1px 5px' }}>{credLabel(a.accuracy_score).label}</span>}
                        {a.bias_direction && <span className={`score-badge score-badge-bias-${a.bias_direction}`} style={{ fontSize: 10, padding: '1px 5px' }}>{{ left: '← Left', centre: '◉ Centre', right: '→ Right' }[a.bias_direction]}</span>}
                      </div>
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
                    onClick={e => { if (e.target.closest('a')) return; navigate('article', { articleId: a.id, title: a.title }) }}
                    className="row-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < sameCategory.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}
                  >
                    <OutletLogo name={a.outlets?.name || ''} size={28} borderRadius={7} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/article/${articleSlug(a.title, a.id)}`} style={{ fontSize: 13, fontFamily: 'var(--font-playfair), serif', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>{a.title}</Link>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{a.outlets?.name} · {timeAgo(a.published_at)}</span>
                        {a.accuracy_score > 0 && <span className={credLabel(a.accuracy_score).cls} style={{ fontSize: 10, padding: '1px 5px' }}>{credLabel(a.accuracy_score).label}</span>}
                        {a.bias_direction && <span className={`score-badge score-badge-bias-${a.bias_direction}`} style={{ fontSize: 10, padding: '1px 5px' }}>{{ left: '← Left', centre: '◉ Centre', right: '→ Right' }[a.bias_direction]}</span>}
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
            <div className="compose-av">{user ? getInitials(user.email) : '?'}</div>
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
          refreshArticle?.(articleId)
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
