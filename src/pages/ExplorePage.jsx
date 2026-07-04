import React, { useState, useEffect, useRef, useMemo } from 'react'
import { db } from '../lib/supabase'
import { timeAgo, articleSlug } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'

const CATEGORIES = [
  { value: 'Politics',       slug: 'politics',       emoji: '🏛',  label: 'Politics',       color: '#4B6FBF' },
  { value: 'Business',       slug: 'business',       emoji: '📈',  label: 'Business',       color: '#2E8B57' },
  { value: 'Tech',           slug: 'tech',           emoji: '💻',  label: 'Tech',           color: '#7C5CBF' },
  { value: 'Science',        slug: 'science',        emoji: '🔬',  label: 'Science',        color: '#2196F3' },
  { value: 'Health',         slug: 'health',         emoji: '🏥',  label: 'Health',         color: '#D84B8A' },
  { value: 'Environment',    slug: 'environment',    emoji: '🌱',  label: 'Environment',    color: '#4CAF50' },
  { value: 'Sport',          slug: 'sport',          emoji: '⚽',  label: 'Sport',          color: '#E84B4B' },
  { value: 'Entertainment',  slug: 'entertainment',  emoji: '🎬',  label: 'Entertainment',  color: '#FF9800' },
  { value: 'Conflict',       slug: 'conflict',       emoji: '⚔️',  label: 'Conflict',       color: '#757575' },
  { value: 'Crime',          slug: 'crime',          emoji: '🔍',  label: 'Crime',          color: '#795548' },
  { value: 'World',          slug: 'world',          emoji: '🌍',  label: 'World',          color: '#009688' },
  { value: 'Education',      slug: 'education',      emoji: '🎓',  label: 'Education',      color: '#D85A30' },
]

const STOP = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','are','was','were',
  'says','say','said','after','as','with','by','from','over','into','its','it',
  'his','her','their','how','why','what','who','will','have','has','had','been',
  'be','but','not','this','that','than','then','new','top','first','last','year',
  'old','day','week','time','way','out','up','more','most','just','also','still',
  'even','could','would','should','may','might','amid','back','gets','got','amid',
  'news','report','live','today','tonight','breaking','latest','after','former',
  'us','uk','about','during','two','three','four','five','six','seven','eight',
])

// Extract proper-noun tokens (capitalised, non-stop words 3+ chars)
function properTokens(title) {
  return (title || '').split(/\s+/).flatMap(raw => {
    const clean = raw.replace(/[^a-zA-Z]/g, '')
    if (!clean || clean.length < 3) return []
    const isProper = /^[A-Z][a-z]/.test(clean) || /^[A-Z]{2,5}$/.test(clean)
    const key = clean.toLowerCase()
    if (!isProper || STOP.has(key)) return []
    return [{ key, display: clean }]
  })
}

function computeTrendingTopics(articles) {
  const freq    = {}
  const outletSets = {}
  const display = {}

  for (const a of articles) {
    const tokens = properTokens(a.title)
    const seen   = new Set()
    for (const { key, display: d } of tokens) {
      freq[key] = (freq[key] || 0) + 1
      if (!outletSets[key]) outletSets[key] = new Set()
      if (!seen.has(key)) { outletSets[key].add(a.outlet_id); seen.add(key) }
      if (!display[key]) display[key] = d
    }
  }

  return Object.entries(freq)
    .filter(([key, count]) => count >= 3 && (outletSets[key]?.size ?? 0) >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key]) => display[key] || key.charAt(0).toUpperCase() + key.slice(1))
}

function accBadgeClass(score) {
  if (score >= 70) return 'score-badge score-badge-green'
  if (score >= 50) return 'score-badge score-badge-amber'
  return 'score-badge score-badge-red'
}

export default function ExplorePage({ navigate, outlets = [] }) {
  const [search, setSearch]           = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rn_searchHistory') || '[]') } catch { return [] }
  })
  const [topicsSource, setTopicsSource] = useState([])
  const [dbResults, setDbResults]       = useState(null)
  const [dbLoading, setDbLoading]       = useState(false)
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

  // Fetch 24h articles for trending topic computation
  useEffect(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    db.from('articles')
      .select('title, outlet_id')
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setTopicsSource(data || []))
  }, [])

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
        .select('id, title, published_at, accuracy_score, bias_direction, category, ai_summary, url, outlets(name, logo_url, bias_direction)')
        .or(`title.ilike.%${escaped}%,ai_summary.ilike.%${escaped}%`)
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

  function goToTopic(topic) {
    navigate('feed', { topic })
  }

  function goToCategory(slug) {
    navigate('category', { slug })
  }

  return (
    <div className="page-content">
      <div className="container" style={{ paddingTop: 16, maxWidth: 680 }}>

        {/* Page heading */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
            🔍 Explore
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            Search every story across all outlets
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
                      <OutletLogo outlet={o} size={18} />
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
            {/* Trending topics */}
            {trendingTopics.length > 0 && (
              <div style={{ marginTop: 24, marginBottom: 28 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  🔥 Trending · 24h
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {trendingTopics.map(topic => (
                    <button
                      key={topic}
                      className="pill"
                      onClick={() => goToTopic(topic)}
                      style={{ fontSize: 13 }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories grid */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Browse Categories
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => goToCategory(cat.slug)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '14px 8px',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      minWidth: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
                  >
                    <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.2 }}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SearchResultRow({ article, navigate }) {
  const outlet = article.outlets || {}
  const score  = article.accuracy_score

  return (
    <div
      className="row-hover"
      onClick={() => navigate('article', { articleId: article.id, title: article.title })}
      style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <OutletLogo outlet={outlet} size={14} />
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{outlet.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(article.published_at)}</span>
        {score != null && (
          <span className={accBadgeClass(score)} style={{ marginLeft: 'auto', flexShrink: 0 }}>✦ {score}</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.4 }}>
        {article.title}
      </p>
      {article.ai_summary && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
          {article.ai_summary.slice(0, 120)}{article.ai_summary.length > 120 ? '…' : ''}
        </p>
      )}
    </div>
  )
}
