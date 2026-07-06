import React, { useState, useEffect, useRef, useMemo } from 'react'
import { db } from '../lib/supabase'
import { timeAgo, articleSlug } from '../utils/helpers'
import { computeTrendingTopics } from '../utils/topics'
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


const REGIONS = [
  { value: 'all',        label: 'All regions'  },
  { value: 'US',         label: 'US'           },
  { value: 'UK',         label: 'UK'           },
  { value: 'Europe',     label: 'Europe'       },
  { value: 'MiddleEast', label: 'Middle East'  },
  { value: 'Africa',     label: 'Africa'       },
  { value: 'AsiaPac',    label: 'Asia Pacific' },
  { value: 'Americas',   label: 'Americas'     },
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
  const [region, setRegion]             = useState('all')
  const [feedPool, setFeedPool]         = useState([])
  const [feedLoading, setFeedLoading]   = useState(true)
  const [catCache, setCatCache]         = useState({})   // category → articles (deep fetch)
  const [catLoading, setCatLoading]     = useState(false)
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
      .limit(400)
      .then(({ data }) => { setFeedPool(data || []); setFeedLoading(false) })
  }, [])

  // Lightweight 24h pool for topic extraction — title+outlet_id only
  // (~100 bytes/row), same shape the homepage feeds the shared extractor.
  const [topicsSource, setTopicsSource] = useState([])
  useEffect(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    db.from('articles')
      .select('title, outlet_id')
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(1000)
      .then(({ data }) => setTopicsSource(data || []))
  }, [])

  // Region = the outlet's home region ("UK" means stories from UK outlets —
  // same meaning as the Outlets page). Picking a region fetches a full-depth
  // pool from the DB (400 newest from that region's outlets) instead of
  // thinning the global pool client-side; cached per region.
  const [regionCache, setRegionCache] = useState({})
  useEffect(() => {
    if (region === 'all' || regionCache[region]) return
    db.from('articles')
      .select('id, title, published_at, outlet_id, category, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, outlets!inner(name, country, logo_url), comments(count)')
      .eq('outlets.country', region)
      .order('published_at', { ascending: false })
      .limit(400)
      .then(({ data }) => setRegionCache(prev => ({ ...prev, [region]: data || [] })))
  }, [region, regionCache])

  // Deep per-category fetch — region-aware (cache key category:region) so the
  // category view is a true regional edition, not a client-side thinning of
  // the newest 100 global rows.
  const catKey = `${category}:${region}`
  useEffect(() => {
    if (category === 'all' || catCache[catKey]) return
    setCatLoading(true)
    let q = db.from('articles')
      .select('id, title, published_at, outlet_id, category, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, outlets!inner(name, country, logo_url), comments(count)')
      .eq('category', category)
    if (region !== 'all') q = q.eq('outlets.country', region)
    q.order('published_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setCatCache(prev => ({ ...prev, [catKey]: data || [] }))
        setCatLoading(false)
      })
  }, [catKey, category, region, catCache])

  // Browse feed — the right pool for the view (global, regional, or category
  // edition), clustered stories deduped
  const browseFeed = useMemo(() => {
    const source = category === 'all'
      ? (region === 'all' ? feedPool : (regionCache[region] || []))
      : (catCache[catKey] || [])
    const seen = new Set()
    return source.filter(a => {
      if (a.cluster_id) { if (seen.has(a.cluster_id)) return false; seen.add(a.cluster_id) }
      return true
    })
  }, [feedPool, regionCache, catCache, category, region, catKey])

  // Category switches reset scroll — otherwise 'View all' leaves you anchored
  // mid-page over freshly swapped (older) content.
  function goCategory(v) {
    setCategory(v)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  // Category digest — Explore's desktop default. One section per category with
  // its top stories (trend-scored), so the page answers "what's happening across
  // every section?" rather than duplicating the homepage's Latest stream.
  const digest = useMemo(() => {
    const seen = new Set()
    const basePool = region === 'all' ? feedPool : (regionCache[region] || [])
    const pool = basePool.filter(a => {
      if (a.cluster_id) { if (seen.has(a.cluster_id)) return false; seen.add(a.cluster_id) }
      return true
    })
    const trendScore = a => {
      const coverage = a.cluster_peers?.length || 0
      const comments = a.comments?.[0]?.count || 0
      const hoursAgo = Math.max(0.1, (Date.now() - new Date(a.published_at)) / 3600000)
      return (coverage * 12 + comments * 5 + 1) / Math.pow(hoursAgo + 2, 1.8)
    }
    const byCat = {}
    for (const a of pool) {
      const c = a.category || 'World'
      ;(byCat[c] = byCat[c] || []).push(a)
    }
    return CATEGORIES
      .filter(c => c.value !== 'all' && (byCat[c.value]?.length || 0) >= 3)
      .map(c => ({
        ...c,
        count: byCat[c.value].length,
        items: byCat[c.value].slice().sort((x, y) => trendScore(y) - trendScore(x)).slice(0, 4),
      }))
      .sort((a, b) => b.count - a.count)
  }, [feedPool, regionCache, region])

  // Trending topics — shared phrase-first extraction (same engine as the
  // homepage chips). Clicking one feeds the full-text search, so topics are a
  // one-tap route into "every story about X".
  const trendingTopics = useMemo(() => computeTrendingTopics(topicsSource), [topicsSource])

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
      <div className="container" style={{ paddingTop: 14, maxWidth: 1240 }}>

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
        <div>
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
        </div>

        {/* Region edition switcher — full-width above the grid so the rail
            aligns with content, not controls */}
        {!isSearchActive && (
          <div className="filter-bar desktop-only" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, alignSelf: 'center' }}>Region</span>
            {REGIONS.map(r => (
              <button
                key={r.value}
                className={`pill${region === r.value ? ' active' : ''}`}
                onClick={() => setRegion(r.value)}
              >{r.label}</button>
            ))}
          </div>
        )}

        <div className="grid">
        <div>
        {/* ── Search results ── */}
        {isSearchActive && (
          <div style={{ marginTop: 8 }}>
            {/* Escape hatch back to the browse view */}
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', padding: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ← Back to browse
            </button>

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
            {/* Category filter — mobile only; the hub owns categories on desktop */}
            <div className="filter-bar hide-desktop" style={{ marginTop: 20, marginBottom: 16 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`pill${category === c.value ? ' active' : ''}`}
                  onClick={() => goCategory(c.value)}
                >{c.emoji ? `${c.emoji} ` : ''}{c.label}</button>
              ))}
            </div>

            {(feedLoading || (category === 'all' && region !== 'all' && !regionCache[region]) || (category !== 'all' && catLoading && !catCache[catKey])) ? (
              <div className="feed">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="skeleton-news-card">
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '85%', height: 14, marginBottom: 6 }} />
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '55%', height: 14 }} />
                  </div>
                ))}
              </div>
            ) : category === 'all' ? (
              <>
                {/* Desktop: category digest — the section front */}
                <div className="desktop-only" style={{ flexDirection: 'column', gap: 30 }}>
                  {digest.length === 0 ? (
                    <div className="empty-state"><p>No stories match these filters yet.</p></div>
                  ) : digest.map(sec => (
                    <section key={sec.value}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h2 style={{ margin: 0, fontFamily: 'var(--font-playfair), serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                          {sec.emoji} {sec.label}
                          {region !== 'all' && <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--text3)' }}> · {REGIONS.find(r => r.value === region)?.label}</span>}
                        </h2>
                        <button
                          onClick={() => goCategory(sec.value)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--coral)', padding: 0 }}
                        >View all →</button>
                      </div>
                      <div className="feed feed--grid-plain">
                        {sec.items.map((a, i) => (
                          <NewsCard
                            key={a.id}
                            article={a}
                            index={i}
                            navigate={navigate}
                            onClick={() => navigate('article', { articleId: a.id, title: a.title })}
                            relatedArticles={a.cluster_peers || []}
                            compact
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                {/* Mobile: flat latest list (unchanged behaviour) */}
                <div className="hide-desktop">
                  <div className="section-label" style={{ marginBottom: 10 }}>
                    Latest across all outlets
                    {region !== 'all' && <span style={{ fontWeight: 400, color: 'var(--text3)' }}> · {REGIONS.find(r => r.value === region)?.label}</span>}
                  </div>
                  {browseFeed.length === 0 ? (
                    <div className="empty-state"><p>No stories match these filters yet.</p></div>
                  ) : (
                    <div className="feed">
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
                </div>
              </>
            ) : (
              <>
                {/* Deep category view */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h2 style={{ margin: 0, fontFamily: 'var(--font-playfair), serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                    {CATEGORIES.find(c => c.value === category)?.emoji} {category}
                    {region !== 'all' && <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--text3)' }}> · {REGIONS.find(r => r.value === region)?.label}</span>}
                  </h2>
                  <button
                    onClick={() => goCategory('all')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--coral)', padding: 0 }}
                  >✕ all sections</button>
                </div>
                {browseFeed.length === 0 ? (
                  <div className="empty-state"><p>No stories match these filters yet.</p></div>
                ) : (
                  <div className="feed feed--grid-plain">
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
          </>
        )}
        </div>

        {/* ── Rail — topics lead (like every other page's rail), filters follow ── */}
        <aside className="sidebar desktop-only" style={{ marginTop: 38 }}>
          {trendingTopics.length > 0 && (
            <div className="widget">
              <div className="widget-title">🔥 Trending topics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trendingTopics.slice(0, 8).map(topic => (
                  <button
                    key={topic}
                    className="pill pill-topic"
                    onClick={() => setSearch(topic)}
                    style={{ fontSize: 11.5, padding: '4px 11px' }}
                  >🔍 {topic}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
                Tap a topic to search every story about it.
              </div>
            </div>
          )}

          <div className="widget">
            <div className="widget-title">Browse categories</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`pill${!isSearchActive && category === c.value ? ' active' : ''}`}
                  onClick={() => { goCategory(c.value); setSearch('') }}
                  style={{ fontSize: 11.5, padding: '4px 11px' }}
                >{c.emoji ? `${c.emoji} ` : ''}{c.label}</button>
              ))}
            </div>
          </div>

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
