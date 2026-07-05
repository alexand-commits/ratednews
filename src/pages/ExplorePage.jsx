import React, { useState, useEffect, useRef, useMemo } from 'react'
import { db } from '../lib/supabase'
import { timeAgo, articleSlug } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'
import NewsCard from '../components/NewsCard'

// Must match scripts/categorise.mjs. 'all' first for the filter pill.
const CATEGORIES = [
  { value: 'all',            slug: '',               emoji: '',    label: 'All'           },
  { value: 'Politics',       slug: 'politics',       emoji: '🏛',  label: 'Politics'      },
  { value: 'World',          slug: 'world',          emoji: '🌍',  label: 'World'         },
  { value: 'Business',       slug: 'business',       emoji: '📈',  label: 'Business'      },
  { value: 'Tech',           slug: 'tech',           emoji: '💻',  label: 'Tech'          },
  { value: 'Science',        slug: 'science',        emoji: '🔬',  label: 'Science'       },
  { value: 'Health',         slug: 'health',         emoji: '🏥',  label: 'Health'        },
  { value: 'Environment',    slug: 'environment',    emoji: '🌱',  label: 'Environment'   },
  { value: 'Sport',          slug: 'sport',          emoji: '⚽',  label: 'Sport'         },
  { value: 'Entertainment',  slug: 'entertainment',  emoji: '🎬',  label: 'Entertainment' },
  { value: 'Culture',        slug: 'culture',        emoji: '🎭',  label: 'Culture'       },
  { value: 'Crime',          slug: 'crime',          emoji: '🔍',  label: 'Crime'         },
  { value: 'Conflict',       slug: 'conflict',       emoji: '⚔️',  label: 'Conflict'      },
  { value: 'Travel',         slug: 'travel',         emoji: '✈️',  label: 'Travel'        },
  { value: 'Education',      slug: 'education',       emoji: '🎓',  label: 'Education'     },
]


export default function ExplorePage({ navigate, outlets = [] }) {
  const [search, setSearch]           = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rn_searchHistory') || '[]') } catch { return [] }
  })
  const [dbResults, setDbResults]       = useState(null)
  const [dbLoading, setDbLoading]       = useState(false)
  const [category, setCategory]         = useState('all')
  const [feedPool, setFeedPool]         = useState([])
  const [feedLoading, setFeedLoading]   = useState(true)
  const searchTimer = useRef(null)
  const inputRef    = useRef(null)

  // Rotating placeholder
  const SEARCH_EXAMPLES = [
    'Search any topic, person or event…',
    "Try 'AI regulation'…",
    "Try 'UK inflation'…",
    "Try 'Ukraine'…",
    "Try 'climate change'…",
    "Try 'Donald Trump'…",
    "Try 'interest rates'…",
    "Try 'healthcare'…",
  ]
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  useEffect(() => {
    if (search) return
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % SEARCH_EXAMPLES.length), 3000)
    return () => clearInterval(id)
  }, [search])

  // Fetch a recent pool to power the browse feed (category filter)
  useEffect(() => {
    setFeedLoading(true)
    db.from('articles')
      .select('id, title, published_at, outlet_id, category, article_region, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, outlets(name, country, logo_url), comments(count)')
      .order('published_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setFeedPool(data || []); setFeedLoading(false) })
  }, [])

  // Browse feed — filter by category, dedupe clustered stories
  const browseFeed = useMemo(() => {
    const seen = new Set()
    return feedPool.filter(a => {
      if (category !== 'all' && (a.category || 'World') !== category) return false
      if (a.cluster_id) { if (seen.has(a.cluster_id)) return false; seen.add(a.cluster_id) }
      return true
    })
  }, [feedPool, category])

  // Trending topics — proper-noun tokens appearing across multiple outlets in
  // the recent pool. Clicking one feeds the full-text search, so topics are a
  // one-tap route into "every story about X".
  const trendingTopics = useMemo(() => {
    const STOP = new Set([
      'the','a','an','in','on','at','to','for','of','and','or','is','are','was','were',
      'says','say','said','after','as','with','by','from','over','into','its','it',
      'his','her','their','how','why','what','who','will','have','has','had','been',
      'be','but','not','this','that','than','then','new','top','first','last','year',
      'old','day','week','time','way','out','up','more','most','just','also','still',
      'even','could','would','should','may','might','amid','back','gets','got',
      'news','report','live','today','tonight','breaking','latest','former',
      'us','uk','about','during','two','three','four','five','watch','video',
    ])
    const freq = {}, outletSets = {}, display = {}
    for (const a of feedPool) {
      const seen = new Set()
      for (const raw of (a.title || '').split(/\s+/)) {
        const clean = raw.replace(/[^a-zA-Z]/g, '')
        if (!clean || clean.length < 3) continue
        const isProper = /^[A-Z][a-z]/.test(clean) || /^[A-Z]{2,5}$/.test(clean)
        const key = clean.toLowerCase()
        if (!isProper || STOP.has(key) || seen.has(key)) continue
        seen.add(key)
        freq[key] = (freq[key] || 0) + 1
        if (!outletSets[key]) outletSets[key] = new Set()
        outletSets[key].add(a.outlet_id)
        if (!display[key]) display[key] = clean
      }
    }
    return Object.entries(freq)
      .filter(([key, count]) => count >= 4 && (outletSets[key]?.size ?? 0) >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([key]) => display[key])
  }, [feedPool])

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (search.trim().length < 2) { setDbResults(null); setDbLoading(false); return }
    setDbLoading(true)
    searchTimer.current = setTimeout(async () => {
      const escaped = search.trim()
        .replace(/[%_\\]/g, '\\$&')
        .replace(/[,()\.:]/g, ' ')
        .trim()
      if (!escaped) { setDbResults([]); setDbLoading(false); return }
      const { data } = await db
        .from('articles')
        .select('id, title, published_at, category, summary, url, outlets(name, logo_url, country)')
        .or(`title.ilike.%${escaped}%,summary.ilike.%${escaped}%`)
        .order('published_at', { ascending: false })
        .limit(30)
      setDbResults(data || [])
      setDbLoading(false)
      // save to history
      const t = search.trim()
      if (t.length >= 2) {
        setSearchHistory(prev => {
          const updated = [t, ...prev.filter(s => s.toLowerCase() !== t.toLowerCase())].slice(0, 6)
          try { localStorage.setItem('rn_searchHistory', JSON.stringify(updated)) } catch {}
          return updated
        })
      }
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  const matchedOutlets = useMemo(() => {
    if (!search || search.trim().length < 2) return []
    const term = search.trim().toLowerCase()
    return outlets.filter(o => o.name?.toLowerCase().includes(term)).slice(0, 3)
  }, [search, outlets])

  const isSearchActive = dbResults !== null

  return (
    <div className="page-content">
      <div className="container" style={{ paddingTop: 16, maxWidth: 1240 }}>

        {/* Page heading */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
            🔍 Explore
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            Search every story, or browse by topic across all outlets
          </p>
        </div>

        {/* Search bar */}
        <div className="search-bar" style={{ marginBottom: 6 }}>
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder={SEARCH_EXAMPLES[placeholderIdx]}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            autoFocus={false}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)', padding: '0 4px', lineHeight: 1 }}
            >✕</button>
          )}
        </div>

        {/* Search history dropdown */}
        {searchFocused && !search && searchHistory.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent</span>
              <button
                onMouseDown={e => { e.preventDefault(); setSearchHistory([]); try { localStorage.removeItem('rn_searchHistory') } catch {} }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', padding: 0 }}
              >Clear</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {searchHistory.map(term => (
                <button key={term} className="pill" onMouseDown={e => { e.preventDefault(); setSearch(term) }} style={{ fontSize: 12 }}>
                  🕒 {term}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid">
        <div>
        {/* ── Search results ── */}
        {isSearchActive && (
          <div style={{ marginTop: 8 }}>
            {/* Outlet matches */}
            {matchedOutlets.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Outlets</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {matchedOutlets.map(o => (
                    <button
                      key={o.id}
                      onClick={() => navigate('outlet', { outletId: o.id })}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
                    >
                      <OutletLogo name={o.name} size={18} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{o.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Article results */}
            {dbLoading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)' }}>Searching…</div>
            ) : dbResults?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>No results for "{search}"</p>
                <p style={{ color: 'var(--text3)', fontSize: 13 }}>Try different keywords</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Articles · {dbResults.length} found
                </div>
                {dbResults.map(a => (
                  <SearchResultRow key={a.id} article={a} navigate={navigate} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Discovery content (no search) ── */}
        {!isSearchActive && (
          <>
            {/* Category filter — mobile only; the sidebar owns categories on desktop */}
            <div className="filter-bar hide-desktop" style={{ marginTop: 20, marginBottom: 16 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`pill${category === c.value ? ' active' : ''}`}
                  onClick={() => setCategory(c.value)}
                >{c.emoji ? `${c.emoji} ` : ''}{c.label}</button>
              ))}
            </div>

            {/* Browse feed */}
            <div className="section-label" style={{ marginBottom: 10 }}>
              {category === 'all' ? 'Latest across all outlets' : category}
            </div>
            {feedLoading ? (
              <div className="feed">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="skeleton-news-card">
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '85%', height: 14, marginBottom: 6 }} />
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '55%', height: 14 }} />
                  </div>
                ))}
              </div>
            ) : browseFeed.length === 0 ? (
              <div className="empty-state"><p>No stories match these filters yet.</p></div>
            ) : (
              <div className="feed feed--grid">
                {browseFeed.map((a, i) => (
                  <NewsCard
                    key={a.id}
                    article={a}
                    index={i}
                    navigate={navigate}
                    onClick={() => navigate('article', { articleId: a.id, title: a.title })}
                    relatedArticles={a.cluster_peers || []}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </div>

        {/* ── Desktop sidebar — categories that all show at once + tappable topics ── */}
        <aside className="sidebar desktop-only">
          <div className="widget">
            <div className="widget-title">Browse categories</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`pill${!isSearchActive && category === c.value ? ' active' : ''}`}
                  onClick={() => { setCategory(c.value); setSearch('') }}
                  style={{ fontSize: 12 }}
                >{c.emoji ? `${c.emoji} ` : ''}{c.label}</button>
              ))}
            </div>
          </div>

          {trendingTopics.length > 0 && (
            <div className="widget">
              <div className="widget-title">🔥 Trending topics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {trendingTopics.map(topic => (
                  <button
                    key={topic}
                    className={`pill${search.trim() === topic ? ' active' : ''}`}
                    onClick={() => setSearch(topic)}
                    style={{ fontSize: 12 }}
                  >{topic}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
                Tap a topic to search every story about it.
              </div>
            </div>
          )}
        </aside>
        </div>
      </div>
    </div>
  )
}

function SearchResultRow({ article, navigate }) {
  const outlet = article.outlets || {}
  return (
    <div
      className="row-hover"
      onClick={() => navigate('article', { articleId: article.id, title: article.title })}
      style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <OutletLogo name={outlet.name} size={14} />
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{outlet.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(article.published_at)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.4 }}>
        {article.title}
      </p>
      {article.summary && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
          {article.summary.slice(0, 120)}{article.summary.length > 120 ? '…' : ''}
        </p>
      )}
    </div>
  )
}
