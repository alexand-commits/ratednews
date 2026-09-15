import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { db } from '../lib/supabase'
import { toSlug } from '../utils/navigate'
import { articleSlug, outletColor, timeAgo } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import TrendingStoriesWidget from '../components/TrendingStoriesWidget'
import OutletTrustRate from '../components/OutletTrustRate'
import { track } from '../utils/track'
import StoryIntelligence from '../components/StoryIntelligence'

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

// Module-scope so its component identity is stable — defining it inside
// ArticlePage made React unmount/remount every comment on any parent state
// change (e.g. a keystroke in a reply box), losing focus and flashing the
// thread. Dependencies are threaded through a single `ctx` bag.
function CommentRow({ c, isReply = false, ctx }) {
  const {
    replies, replyingTo, userProfiles, userLooks, votedComments, replyInputs,
    navigate, voteComment, loadReplies, postReply, setReplyingTo, setReplyInputs,
  } = ctx
  const hasReplies = !isReply
  const replyList = replies[c.id] || []
  const isExpanded = replies[c.id] !== undefined
  const isReplying = replyingTo === c.id
  const username    = c.user_id ? (userProfiles[c.user_id] || 'Community member') : 'Community member'
  const hasHandle   = c.user_id && userProfiles[c.user_id]
  const initials    = getInitials(username)

  return (
    <div className={isReply ? 'reply' : 'comment'}>
      <div className="comment-header">
        <div className="c-av" style={{
          background: (c.user_id && userLooks[c.user_id]?.color) || 'var(--purple-light)',
          color: (c.user_id && userLooks[c.user_id]?.color) ? '#fff' : 'var(--purple)',
        }}>
          {(c.user_id && userLooks[c.user_id]?.emoji) || initials}
        </div>
        <span
          className="c-user"
          style={{ cursor: hasHandle ? 'pointer' : 'default' }}
          onClick={() => hasHandle && navigate('publicProfile', { userId: c.user_id })}
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
          {replyList.map(r => <CommentRow key={r.id} c={r} isReply ctx={ctx} />)}
        </div>
      )}
      {isExpanded && replyList.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 4, marginTop: 8 }}>No replies yet.</div>
      )}
    </div>
  )
}

export default function ArticlePage({ articleId, allArticles, navigate, goBack, showToast, refreshArticle, user, onLoginClick, isSaved, toggleSave, outlets = [] }) {
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [commentSort, setCommentSort] = useState('top')
  const [votedComments, setVotedComments] = useState({})
  const [myOutletTrust, setMyOutletTrust] = useState(0) // user's existing trust rating for this article's outlet
  const [replyingTo, setReplyingTo] = useState(null) // comment id being replied to
  const [replyInputs, setReplyInputs] = useState({}) // { [commentId]: text }
  const [replies, setReplies] = useState({}) // { [parentId]: [reply, ...] }
  const [userProfiles, setUserProfiles] = useState({}) // { [user_id]: username }
  const [userLooks, setUserLooks] = useState({})         // { [user_id]: { color, emoji } }
  const [fetchedArticle, setFetchedArticle] = useState(null)
  const [sameStoryArticles, setSameStoryArticles] = useState([])
  // PREVIEW ONLY. cluster_peers stores at most 8 peers, so a 34-outlet story
  // would produce "3 UK, 2 US" and look like a lie. This pulls the full cluster
  // for the intelligence panel. Cheap now that articles_cluster_id_idx exists —
  // it was a full table scan until 2026-09-13. In production this computes once
  // per story inside cluster.mjs instead; see docs/story-intelligence-spec.md.
  const [clusterMembers, setClusterMembers] = useState([])
  const [peersExpanded, setPeersExpanded] = useState(false)

  const article = allArticles.find(a => a.id === articleId) || fetchedArticle

  useEffect(() => {
    if (!articleId) return

    setComments([])
    setReplies({})
    setReplyingTo(null)
    setVotedComments({})

    // Fire comments + votes in parallel — no sequential waiting
    const commentsPromise = db.from('comments')
      .select('*')
      .eq('article_id', articleId)
      .is('parent_id', null)
      .order('upvotes', { ascending: false })

    const votesPromise = user
      ? db.from('comment_votes').select('comment_id, dir').eq('user_id', user.id)
      : Promise.resolve({ data: [] })

    Promise.all([commentsPromise, votesPromise]).then(
      ([{ data: commentData }, { data: votesData }]) => {
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
            .select('user_id, username, avatar_color, avatar_emoji')
            .in('user_id', ids)
            .then(({ data: profiles }) => {
              if (profiles) {
                const map = {}, looks = {}
                profiles.forEach(p => {
                  map[p.user_id] = p.username
                  looks[p.user_id] = { color: p.avatar_color, emoji: p.avatar_emoji }
                })
                setUserProfiles(map)
                setUserLooks(looks)
              }
            })
        }
      }
    )

    // Defer realtime subscription — set up after initial render, not on mount
    // channel declared in outer scope so the cleanup function can reach it
    let channel = null
    const realtimeTimer = setTimeout(() => {
      channel = db
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
    }, 3000)

    return () => {
      clearTimeout(realtimeTimer)
      if (channel) db.removeChannel(channel)
    }
  }, [articleId, user?.id])

  // Fetch same-story articles — use pre-computed cluster_peers when available,
  // fall back to title keyword search for articles not yet clustered.
  // cluster_peers is a stable snapshot; cluster_id gets reassigned on every
  // cluster.mjs run so querying by it returns only the most recently re-clustered
  // subset — causing the "29 on feed, 2 on article page" mismatch.
  useEffect(() => {
    if (!article) return
    setSameStoryArticles([])
    setClusterMembers([])
    setPeersExpanded(false)

    if (article.cluster_id) {
      db.from('articles')
        .select('id, title, summary, outlet_id, published_at, outlets(name, country)')
        .eq('cluster_id', article.cluster_id)
        .limit(60)
        .then(({ data }) => {
          if (!data?.length) return
          const byOutlet = {}
          for (const a of data) {
            if (!byOutlet[a.outlet_id] || a.published_at > byOutlet[a.outlet_id].published_at) byOutlet[a.outlet_id] = a
          }
          setClusterMembers(Object.values(byOutlet))
        })
        .catch(() => {})
    }

    if (article.cluster_peers?.length) {
      // Fast path: use pre-computed peer IDs — same source as the feed card count
      const peerIds = article.cluster_peers.map(p => p.id).slice(0, 20)
      db.from('articles')
        .select('*, outlets(name, logo_url, country)')
        .in('id', peerIds)
        .order('published_at', { ascending: false })
        .then(({ data }) => {
          if (!data?.length) return
          // Dedupe by outlet — keep most recent per outlet
          const byOutlet = {}
          data.forEach(a => {
            if (!byOutlet[a.outlet_id] || a.published_at > byOutlet[a.outlet_id].published_at) {
              byOutlet[a.outlet_id] = a
            }
          })
          setSameStoryArticles(Object.values(byOutlet).slice(0, 8))
        })
      return
    }

    // Fallback: title keyword search for articles not yet clustered
    if (!article.title) return
    const STOP = new Set([
      'the','a','an','in','on','at','to','for','of','and','or','but','with',
      'from','by','as','is','are','was','were','be','been','has','have','had',
      'its','their','this','that','these','those','how','why','what','who',
      'when','where','says','said','will','can','may','over','after','before',
      'amid','about','into','new','first','second',
    ])
    const sigWords = [...new Set(
      article.title.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w))
    )].slice(0, 5)  // cap at 5 — more OR clauses = wider full-table scan with no benefit
    if (sigWords.length < 2) return
    const orFilter = sigWords.map(k => `title.ilike.%${k}%`).join(',')
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    db.from('articles')
      .select('*, outlets(name, logo_url)')
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
          return aWords.filter(w => titleWords.has(w)).length >= 2
        })
        const byOutlet = {}
        matched.forEach(a => {
          if (!byOutlet[a.outlet_id] || a.published_at > byOutlet[a.outlet_id].published_at) {
            byOutlet[a.outlet_id] = a
          }
        })
        setSameStoryArticles(Object.values(byOutlet).slice(0, 10))
      })
  }, [article?.id])

  // If article isn't in the local cache (e.g. older than the loaded feed window),
  // fetch it directly from the DB so we never show a blank page
  useEffect(() => {
    if (!articleId) return
    if (allArticles.find(a => a.id === articleId)) { setFetchedArticle(null); return }
    setFetchedArticle(null)
    db.from('articles')
      .select('*, outlets(name, country, logo_url)')
      .eq('id', articleId)
      .single()
      .then(({ data }) => { if (data) setFetchedArticle(data) })
  }, [articleId])

  // Load the user's existing trust rating for this article's outlet
  useEffect(() => {
    const oid = article?.outlet_id
    if (!user || !oid) { setMyOutletTrust(0); return }
    db.from('outlet_ratings').select('overall_stars').eq('outlet_id', oid).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setMyOutletTrust(data?.overall_stars || 0))
  }, [user?.id, article?.outlet_id])

  // Rival outlets: show 6, expand in place for the rest.
  //
  // Measured over 2,040 stories in 24h via cluster_size: median 3 outlets,
  // p75 4, p90 7, p95 10, p99 23, max 45. Half have exactly two. So 6 shows the
  // TYPICAL story whole and only the big ones collapse — 11% of stories.
  //
  // Expanding in place rather than linking away. A link to /story made the
  // reader load a page to see two more headlines, which is a poor trade for
  // them even though it drove the story_view event. The story-page link stays
  // below as a secondary route, because that page is more than this list.
  //
  // A proportional rule ("show half") was rejected: it scales up exactly where
  // it hurts, turning a 45-outlet story into 22 cards nobody reads at 12
  // seconds of engagement, while leaving the median 3-outlet story alone.
  const PEER_COLLAPSED = 6
  const PEER_MAX = 30

  // cluster_peers caps at 8 (PEER_STORE_CAP in cluster.mjs) so it cannot feed a
  // full list. The full-cluster query added for StoryIntelligence can — one
  // fetch serving both. Falls back to the snapshot before that query lands, or
  // when the article is unclustered.
  const allPeers = useMemo(() => {
    const fromCluster = clusterMembers.filter(m => m.outlet_id !== article?.outlet_id)
    const src = fromCluster.length >= sameStoryArticles.length ? fromCluster : sameStoryArticles
    return [...src]
      .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
      .slice(0, PEER_MAX)
  }, [clusterMembers, sameStoryArticles, article?.outlet_id])

  const peerList = peersExpanded ? allPeers : allPeers.slice(0, PEER_COLLAPSED)
  const hiddenPeerCount = allPeers.length - peerList.length

  if (!article) return null

  const outlet = article.outlets || {}
  const [bg, fg] = outletColor(outlet.name || 'X')

  // Related articles — fetched client-side in the useEffect above


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
    if (error || !data?.[0]) { showToast('Could not post comment'); return }
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
    if (error || !data?.[0]) { showToast('Could not post reply'); return }
    setReplyInputs(prev => ({ ...prev, [parentId]: '' }))
    setReplyingTo(null)
    setReplies(prev => ({ ...prev, [parentId]: [...(prev[parentId] || []), data[0]] }))
    showToast('Reply posted!')
    // The reply notification is created server-side by the notify_on_reply
    // trigger (sql/10) — deriving recipient and actor name from the comment so
    // neither can be spoofed by the client.
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
      // Atomic DB-side decrement — no read-modify-write race
      await db.rpc('delta_comment_vote', { comment_id: commentId, field_name: field, delta: -1 })
      return
    }

    // Vote: insert into DB — unique constraint prevents duplicates across sessions
    const { error } = await db.from('comment_votes').insert({ user_id: user.id, comment_id: commentId, dir })
    if (error) {
      showToast('Could not register vote — please try again')
      return
    }
    setVotedComments(prev => ({ ...prev, [key]: true }))
    applyDelta(1)
    // Atomic DB-side increment — no read-modify-write race
    await db.rpc('delta_comment_vote', { comment_id: commentId, field_name: field, delta: 1 })
  }

  const commentCtx = {
    replies, replyingTo, userProfiles, userLooks, votedComments, replyInputs,
    navigate, voteComment, loadReplies, postReply, setReplyingTo, setReplyInputs,
  }

  return (
    <>
    <div className="page-content">
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div className="grid">
        <div>
        <div className="article-preview-card">
          <div className="article-outlet-row">
            <OutletLogo name={outlet.name || ''} size={32} borderRadius={8} />
            <div>
              <Link
                href={`/outlet/${toSlug(outlet.name || '')}`}
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'inherit', textDecoration: 'none' }}
              >
                {outlet.name || ''}
              </Link>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{outlet.country || ''} · {timeAgo(article.published_at)}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                className={`save-btn${isSaved ? ' saved' : ''}`}
                onClick={() => toggleSave(articleId)}
              >
                {isSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          </div>

          <h1 className="article-headline-full">{article.title || ''}</h1>

          {/* Summary + primary actions — the read/share moment lives with the headline */}
          {article.summary && (
            <div style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 16 }}>
              {article.summary}
            </div>
          )}
          <StoryIntelligence
            members={clusterMembers}
            totalOutlets={(article.cluster_size || article.cluster_peers?.length || 0) + 1}
          />

          {/* Same story across outlets */}
          {peerList.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8,
              }}>
                📰 Also covered by {(article.cluster_size || article.cluster_peers?.length || peerList.length)} other outlet{(article.cluster_size || article.cluster_peers?.length || peerList.length) !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {peerList.map(a => {
                  const o = a.outlets || {}
                  return (
                    <div
                      key={a.id}
                      onClick={() => {
                        track('peer_click', { from: 'article' })
                        navigate('article', { articleId: a.id, title: a.title })
                      }}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--surface)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 8, cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <OutletLogo name={o.name || 'X'} size={18} borderRadius={5} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.name || 'Unknown'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{timeAgo(a.published_at)}</span>
                      </div>
                      {/* The peer's own headline — the framing contrast is the point */}
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.45, fontFamily: 'var(--font-playfair), serif' }}>
                        {a.title}
                      </div>
                    </div>
                  )
                })}
              </div>
              {hiddenPeerCount > 0 && (
                <button
                  onClick={() => { setPeersExpanded(true); track('peers_expand', { hidden: hiddenPeerCount }) }}
                  style={{
                    width: '100%', marginTop: 8, padding: '9px 12px',
                    background: 'none', border: '0.5px dashed var(--border2)',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 600, color: 'var(--coral)', fontFamily: 'inherit',
                  }}
                >
                  Show {hiddenPeerCount} more {hiddenPeerCount === 1 ? 'outlet' : 'outlets'}
                </button>
              )}
              {/* The story page is the product: every outlet's take side by
                  side. It was grey 12px text sitting under a saturated orange
                  button that sends the reader to another website — the only
                  path that KEEPS them was the quietest thing on the page.
                  Sells what is actually there, and names the number. */}
              {(article.cluster_size || article.cluster_peers?.length || 0) > 0 && (
                <Link
                  href={`/story/${articleSlug(article.title, article.id)}`}
                  onClick={() => track('story_open', { from: 'article' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
                    padding: '12px 14px', borderRadius: 10,
                    border: '1px solid var(--coral)', background: 'rgba(216,90,48,0.07)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--coral)' }}>
                      Compare all {(article.cluster_size || article.cluster_peers.length) + 1} outlets side by side
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                      Every take on this story, on one page
                    </span>
                  </span>
                  <span style={{ fontSize: 15, color: 'var(--coral)', flexShrink: 0 }}>→</span>
                </Link>
              )}
            </div>
          )}

          {/* The source link sits AFTER the coverage, deliberately.
              It used to be the first thing under the headline and the only
              saturated element on the page, so a visitor arriving from search
              saw one obvious action and it was the exit. The comparison — other
              outlets' headlines on the same story — is the reason to be here,
              so it goes first and the door comes after it. */}
          <div className="article-actions" style={{ marginBottom: 20 }}>
            <button className="btn-primary" onClick={() => {
              // Measures the cost side of moving this below the coverage.
              track('source_click', { outlet: outlet.name || null })
              if (article.url) window.open(article.url, '_blank')
            }}>
              Read full article on {outlet.name || 'source'} ↗
            </button>
            <button className="btn-outline" onClick={async () => {
              const shareUrl = `https://www.ratednews.com/article/${articleSlug(article.title, article.id)}`
              if (navigator.share) {
                try { await navigator.share({ title: article.title, text: article.title, url: shareUrl }) } catch (_) {}
              } else {
                navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied!')).catch(() => showToast('Could not copy'))
              }
            }}>↑ Share</button>
          </div>

          {/* Contextual trust prompt — convert the reading moment into an outlet rating */}
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <OutletLogo name={outlet.name || 'X'} size={30} borderRadius={7} />
              <OutletTrustRate
                outlet={{ id: article.outlet_id }}
                user={user}
                onLoginClick={onLoginClick}
                showToast={showToast}
                initialStars={myOutletTrust}
                onRated={n => setMyOutletTrust(n)}
                label={`Do you trust ${outlet.name || 'this source'}?`}
                size={24}
              />
            </div>
          </div>



        </div>

        {/* Comments */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
            Discussion {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>}
          </div>
          {comments.length > 0 && <div className="sort-row">
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
          </div>}
          <div className="compose-row">
            <div className="compose-av">{user ? getInitials(user.email) : '?'}</div>
            <input
              className="compose-input"
              placeholder={user ? 'Add to the discussion...' : 'Sign in to comment...'}
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
              sortedComments.map(c => <CommentRow key={c.id} c={c} ctx={commentCtx} />)
            )}
          </div>
        </div>

        {/* Mobile trending exit-ramp — LAST: the reader has read, rated and
            seen the discussion; only then do we point them onward. The rail's
            trending widget covers desktop. */}
        <div className="hide-desktop" style={{
          marginTop: 20,
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '16px 18px',
        }}>
          {/* Contained. These headlines used to sit bare on the page ground
              with hairline dividers, directly under a page made entirely of
              surface cards — it read as unfinished rather than as a module. */}
          <TrendingStoriesWidget variant="inline" title="🔥 Trending now" />
        </div>
        </div>

        {/* No Sidebar here. It carried "Top rated outlets" — a global ranking
            with no relationship to the article being read — and on mobile it
            landed as an uncontained widget below the discussion with dead
            space under it. The trending module below is the onward path; a
            leaderboard is not. */}
        </div>
      </div>
    </div>
    </>
  )
}
