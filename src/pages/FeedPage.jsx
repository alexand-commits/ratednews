import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import NewsCard from '../components/NewsCard'
import Sidebar from '../components/Sidebar'
import { timeAgo } from '../utils/helpers'
import { db } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

const CATEGORIES = [
  { value: 'all',            label: 'All'               },
  { value: 'Politics',       label: '🏛 Politics'        },
  { value: 'Business',       label: '📈 Business'        },
  { value: 'Sport',          label: '⚽ Sport'            },
  { value: 'Tech',           label: '💻 Tech'             },
  { value: 'Science',        label: '🔬 Science'          },
  { value: 'Health',         label: '🏥 Health'           },
  { value: 'Environment',    label: '🌱 Environment'      },
  { value: 'Entertainment',  label: '🎬 Entertainment'    },
  { value: 'Crime',          label: '🔍 Crime'            },
  { value: 'Travel',         label: '✈️ Travel'           },
  { value: 'Education',      label: '🎓 Education'        },
  { value: 'War & Conflict', label: '⚔️ War'               },
  { value: 'Culture',        label: '🎨 Culture'          },
  { value: 'World',          label: '🌍 World'            },
]

// Keyword fallback for articles not yet AI-categorised
function guessCategory(article) {
  const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase()
  if (/\b(sport|football|soccer|cricket|tennis|rugby|basketball|golf|olympic|formula|f1|match|league|player|team|coach|tournament|cup|championship|wicket|transfer|premier)\b/.test(text)) return 'Sport'
  if (/\b(election|government|parliament|minister|president|vote|policy|senate|congress|\bmp\b|political|party|labour|tory|conservative|democrat|republican|trump|chancellor)\b/.test(text)) return 'Politics'
  if (/\b(economy|market|stock|trade|company|bank|investment|gdp|inflation|financial|shares|profit|revenue|startup|business|earnings|interest rate|budget|recession)\b/.test(text)) return 'Business'
  if (/\b(\bai\b|artificial intelligence|technology|digital|cyber|\bapp\b|software|silicon|data breach|robot|computer|smartphone|social media|chatgpt|openai)\b/.test(text)) return 'Tech'
  if (/\b(cancer|disease|hospital|doctor|patient|surgery|treatment|vaccine|nhs|mental health|drug|medicine|clinical)\b/.test(text)) return 'Health'
  if (/\b(climate|environment|emission|carbon|pollution|wildlife|species|ocean|fossil fuel|renewable|net zero)\b/.test(text)) return 'Environment'
  if (/\b(research|study|space|nasa|science|planet|asteroid|discovery|experiment|physics|biology)\b/.test(text)) return 'Science'
  if (/\b(film|movie|music|celebrity|award|oscar|bafta|tv show|streaming|festival|album|actor|actress)\b/.test(text)) return 'Entertainment'
  if (/\b(war|conflict|military|troops|missile|bomb|battle|invasion|ceasefire|soldier|drone|strike|frontline|combat|siege|nato|warfare|armed forces)\b/.test(text)) return 'War & Conflict'
  if (/\b(crime|murder|arrest|police|court|sentence|prison|fraud|theft|shooting|trial)\b/.test(text)) return 'Crime'
  if (/\b(travel|tourism|flight|hotel|visa|destination|holiday|airport|airline)\b/.test(text)) return 'Travel'
  if (/\b(school|university|student|teacher|education|exam|degree|tuition|college|campus)\b/.test(text)) return 'Education'
  if (/\b(art|culture|museum|gallery|theatre|theater|literature|book|exhibition|heritage|architecture|fashion|design|cuisine|tradition)\b/.test(text)) return 'Culture'
  return 'World'
}

function getArticleCategory(article) {
  return article.category || guessCategory(article)
}

const SORTS = [
  { value: 'latest',    label: '🕒 Latest'     },
  { value: 'trending',  label: '🔥 Trending'   },
  { value: 'top-rated', label: '⭐ Top Rated'  },
]

const REGIONS = [
  { value: 'all', label: '🌍 All'           },
  { value: 'UK',  label: '🇬🇧 UK'           },
  { value: 'US',  label: '🇺🇸 US'           },
  { value: 'int', label: '🌐 International' },
]

function getArticleRegion(article) {
  const country = article.outlets?.country || ''
  if (country === 'UK') return 'UK'
  if (country === 'US') return 'US'
  return 'int'
}

export default function FeedPage({
  articles, outlets, loading, navigate,
  initialCategory = 'all', initialRegion = 'all',
  totalArticleCount, user, followedOutletIds = new Set(),
  onLoginClick, loadMoreArticles, hasMoreArticles, loadingMore,
  savedArticleIds = new Set(), toggleSave, onRefresh,
}) {
  const [category, setCategory] = useState(initialCategory)
  const [region, setRegion]     = useState(initialRegion)
  const [search, setSearch]     = useState('')
  const [sort, setSort]         = useState('latest')
  const [feedTab, setFeedTab]   = useState('all') // 'all' | 'following'

  // DB search state
  const [dbResults, setDbResults]   = useState(null)   // null = search not active
  const [dbLoading, setDbLoading]   = useState(false)
  const searchTimer                 = useRef(null)
  const searchInputRef              = useRef(null)

  // Search history (localStorage-persisted)
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rn_searchHistory') || '[]') } catch { return [] }
  })
  const [searchFocused, setSearchFocused] = useState(false)

  function addToHistory(term) {
    const t = term.trim()
    if (!t || t.length < 2) return
    setSearchHistory(prev => {
      const updated = [t, ...prev.filter(s => s.toLowerCase() !== t.toLowerCase())].slice(0, 6)
      try { localStorage.setItem('rn_searchHistory', JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  function clearHistory() {
    setSearchHistory([])
    try { localStorage.removeItem('rn_searchHistory') } catch {}
  }

  // Rotating placeholder to show topic-search power
  const SEARCH_EXAMPLES = [
    'Search any topic, person or event…',
    "Try 'AI regulation'…",
    "Try 'UK inflation'…",
    "Try 'Ukraine'…",
    "Try 'climate change'…",
    "Try 'Donald Trump'…",
    "Try 'interest rates'…",
    "Try 'NHS'…",
  ]
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  useEffect(() => {
    if (search) return
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % SEARCH_EXAMPLES.length), 3000)
    return () => clearInterval(id)
  }, [search])

  // Infinite scroll sentinel
  const sentinelRef = useRef(null)

  // Pull-to-refresh
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  // Debounced full-text DB search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (search.trim().length < 2) {
      setDbResults(null)
      setDbLoading(false)
      return
    }
    setDbLoading(true)
    searchTimer.current = setTimeout(async () => {
      const term = search.trim()
      const { data } = await db
        .from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
        .or(`title.ilike.%${term}%,ai_summary.ilike.%${term}%,summary.ilike.%${term}%`)
        .order('published_at', { ascending: false })
        .limit(50)
      setDbResults(data || [])
      setDbLoading(false)
      if (term.length >= 2) addToHistory(term)
    }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  // Infinite scroll — fires loadMoreArticles when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreArticles && !loadingMore) {
          loadMoreArticles()
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMoreArticles, loadingMore, loadMoreArticles])

  const followingArticles = articles.filter(a => followedOutletIds.has(a.outlet_id))

  // Deduplicate similar stories from the same outlet — keeps the most recent,
  // hides older articles that share 3+ significant words in their title
  function dedupeRelated(list) {
    const kept = []
    for (const article of list) {
      const words = new Set(
        article.title.toLowerCase().split(/\W+/).filter(w => w.length > 4)
      )
      const hasSimilar = kept.some(k => {
        if (k.outlet_id !== article.outlet_id) return false
        const overlap = k.title.toLowerCase().split(/\W+/)
          .filter(w => w.length > 4 && words.has(w)).length
        return overlap >= 3
      })
      if (!hasSimilar) kept.push(article)
    }
    return kept
  }

  const filtered = dedupeRelated(
    (feedTab === 'following' ? followingArticles : articles)
      .filter(a => category === 'all' || getArticleCategory(a) === category)
      .filter(a => region === 'all' || getArticleRegion(a) === region)
      // In the global 'All' view, hide hyper-local stories so a reader in
      // Las Vegas doesn't see "Sheffield council approves parking changes".
      // When a specific region is selected the reader has opted in, so show
      // everything from that region including local stories.
      .filter(a => region !== 'all' || a.geographic_scope !== 'local')
      .slice()
      .sort((a, b) => {
        if (sort === 'trending')  return (b.comments?.[0]?.count || 0) - (a.comments?.[0]?.count || 0)
        if (sort === 'top-rated') return (b.accuracy_score || 0) - (a.accuracy_score || 0)
        // Push future-dated articles to the bottom — treat them as epoch (oldest)
        const now = Date.now()
        const ta = new Date(a.published_at).getTime()
        const tb = new Date(b.published_at).getTime()
        const sa = ta > now ? 0 : ta
        const sb = tb > now ? 0 : tb
        return sb - sa
      })
  )

  // Round-robin interleave by outlet so the feed isn't 25 BBCs then 25 CNNs.
  // Only applied on the 'latest' sort — trending/top-rated have their own logic.
  const interleaved = useMemo(() => {
    if (sort !== 'latest') return filtered
    const byOutlet = {}
    for (const a of filtered) {
      const key = a.outlet_id || 'unknown'
      if (!byOutlet[key]) byOutlet[key] = []
      byOutlet[key].push(a)
    }
    const queues = Object.values(byOutlet)
    const result = []
    let i = 0
    while (result.length < filtered.length) {
      const q = queues[i % queues.length]
      if (q && q.length) result.push(q.shift())
      i++
      // Safety: if all queues empty, break
      if (queues.every(q => !q.length)) break
    }
    return result
  }, [filtered, sort])

  // Trending topics — top keywords from recent article titles
  const STOP_WORDS = useMemo(() => new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
    'as','is','was','are','were','been','be','have','has','had','do','does','did',
    'will','would','could','should','may','might','that','this','these','those',
    'it','its','he','she','they','we','you','i','his','her','their','our','your','my',
    'what','who','how','when','where','why','which','about','after','before','between',
    'into','through','over','under','up','out','off','down','if','than','then','so',
    'because','while','although','though','however','says','said','say','new','first',
    'last','more','most','also','just','now','like','one','two','three','us','uk',
    'year','years','per','cent','after','back','says','amid','amid','report','reports',
    'warns','calls','hits','gets','makes','takes','gives','sees','shows','faces',
    'amid','plans','set','told','tell','here','there','they','their','being','its',
  ]), [])

  const trendingTopics = useMemo(() => {
    const freq = {}
    for (const article of articles.slice(0, 300)) {
      const words = (article.title || '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      for (const word of words) {
        freq[word] = (freq[word] || 0) + 1
      }
    }
    return Object.entries(freq)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1))
  }, [articles, STOP_WORDS])

  // Which list to display — DB results when search active, interleaved otherwise
  const isSearchActive = dbResults !== null
  const displayList    = isSearchActive ? dbResults : interleaved

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}

      <div className="container">

        {/* Stats bar */}
        {(() => {
          const latest = articles.length ? articles.slice().sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0] : null
          return (
            <div className="stats-bar">
              <div className="stat-chip" style={{ cursor: 'pointer' }} onClick={() => navigate('outlets')}>
                <strong>{outlets.length || '—'}</strong>
                <span>Outlets tracked ↗</span>
              </div>
              <div className="stat-chip">
                <strong>{totalArticleCount != null ? totalArticleCount.toLocaleString() : (articles.length ? articles.length.toLocaleString() : '—')}</strong>
                <span>Articles</span>
              </div>
              {latest && (
                <div className="stat-chip">
                  <strong>{timeAgo(latest.published_at)}</strong>
                  <span>Last updated</span>
                </div>
              )}
            </div>
          )
        })()}

        {/* Feed tabs — All / My Feed */}
        <div className="tabs" style={{ marginBottom: 14 }}>
          <div className={`tab${feedTab === 'all' ? ' active' : ''}`} onClick={() => setFeedTab('all')}>
            All stories
          </div>
          <div
            className={`tab${feedTab === 'following' ? ' active' : ''}`}
            onClick={() => {
              if (!user) { onLoginClick(); return }
              setFeedTab('following')
            }}
          >
            My feed {user && followedOutletIds.size > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({followedOutletIds.size})</span>}
          </div>
        </div>

        {/* Search */}
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={SEARCH_EXAMPLES[placeholderIdx]}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)', padding: '0 4px', lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Search history — shown when focused with no active query */}
        {searchFocused && !search && searchHistory.length > 0 && (
          <div style={{ marginTop: 4, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent searches</span>
              <button
                onMouseDown={e => { e.preventDefault(); clearHistory() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', padding: 0 }}
              >Clear</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {searchHistory.map(term => (
                <button
                  key={term}
                  className="pill"
                  onMouseDown={e => { e.preventDefault(); setSearch(term) }}
                  style={{ fontSize: 12 }}
                >
                  🕒 {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hint text — shown when not searching and no history dropdown */}
        {!search && !(searchFocused && searchHistory.length > 0) && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 10, paddingLeft: 2 }}>
            Searches every story across all outlets — not just headlines
          </p>
        )}

        {/* Trending topics */}
        {!isSearchActive && trendingTopics.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>🔥 Trending</span>
              {trendingTopics.map(topic => (
                <button
                  key={topic}
                  className="pill"
                  onClick={() => { setSearch(topic); searchInputRef.current?.focus() }}
                  style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Region filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {REGIONS.map(r => (
            <button
              key={r.value}
              className={`pill${region === r.value ? ' active' : ''}`}
              onClick={() => setRegion(r.value)}
            >{r.label}</button>
          ))}
        </div>

        {/* Category filter */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`pill${category === c.value ? ' active' : ''}`}
              onClick={() => setCategory(c.value)}
            >{c.label}</button>
          ))}
        </div>

        <div className="grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div className="section-label" style={{ margin: 0 }}>
                {isSearchActive
                  ? dbLoading
                    ? 'Searching…'
                    : `${displayList.length} result${displayList.length !== 1 ? 's' : ''} for "${search}"`
                  : <>
                      {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}
                      {category !== 'all' && <span style={{ fontWeight: 400, color: 'var(--text3)' }}> in {category}</span>}
                      {region !== 'all' && <span style={{ fontWeight: 400, color: 'var(--text3)' }}> · {REGIONS.find(r => r.value === region)?.label}</span>}
                    </>
                }
              </div>
              {!isSearchActive && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {SORTS.map(s => (
                    <button
                      key={s.value}
                      className={`sort-pill${sort === s.value ? ' active' : ''}`}
                      onClick={() => setSort(s.value)}
                    >{s.label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="feed">
              {loading || (isSearchActive && dbLoading) ? (
                [0, 1, 2].map(i => (
                  <div key={i} className="skeleton-news-card">
                    {/* Outlet row */}
                    <div className="skeleton-row">
                      <div className="skeleton-dot skeleton-shimmer" />
                      <div className="skeleton-line skeleton-shimmer" style={{ width: 80, height: 10 }} />
                      <div className="skeleton-line skeleton-shimmer" style={{ width: 40, height: 10, marginLeft: 'auto' }} />
                    </div>
                    {/* Headline — two lines */}
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '92%', height: 14 }} />
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '68%', height: 14 }} />
                    {/* Summary line */}
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '100%', height: 10 }} />
                    {/* Badge row */}
                    <div className="skeleton-row">
                      <div className="skeleton-line skeleton-shimmer" style={{ width: 44, height: 20, borderRadius: 20 }} />
                      <div className="skeleton-line skeleton-shimmer" style={{ width: 56, height: 20, borderRadius: 20 }} />
                    </div>
                  </div>
                ))
              ) : displayList.length === 0 && feedTab === 'following' && followedOutletIds.size === 0 ? (
                <div className="empty-state">
                  <h3>You're not following anyone yet</h3>
                  <p>Follow outlets you trust to build your personal feed.</p>
                  <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('outlets')}>
                    Browse outlets →
                  </button>
                </div>
              ) : displayList.length === 0 && feedTab === 'following' && followedOutletIds.size > 0 ? (
                <div className="empty-state">
                  <h3>No recent stories from your outlets</h3>
                  <p>The {followedOutletIds.size} outlet{followedOutletIds.size !== 1 ? 's' : ''} you follow haven't published recently. Check back soon.</p>
                  <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setFeedTab('all')}>
                    Browse all stories
                  </button>
                </div>
              ) : displayList.length === 0 && isSearchActive ? (
                <div className="empty-state">
                  <h3>No results for "{search}"</h3>
                  <p>Try different keywords or clear the search to browse all stories.</p>
                </div>
              ) : displayList.length === 0 ? (
                <div className="empty-state">
                  <h3>No {category} articles yet</h3>
                  <p>Try a different category or check back after the next update.</p>
                  <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setCategory('all')}>
                    Show all
                  </button>
                </div>
              ) : (
                displayList.map((a, i) => (
                  <NewsCard
                    key={a.id}
                    article={a}
                    index={i}
                    onClick={() => {
                      searchInputRef.current?.blur()
                      navigate('article', { articleId: a.id })
                    }}
                    navigate={navigate}
                  />
                ))
              )}

              {/* Fallback load more button — visible when sentinel scroll doesn't fire */}
              {!isSearchActive && feedTab === 'all' && hasMoreArticles && !loadingMore && (
                <button
                  onClick={loadMoreArticles}
                  style={{
                    width: '100%', padding: '11px', marginTop: 4,
                    background: 'var(--surface)', border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                    color: 'var(--text2)', cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  Load more stories ↓
                </button>
              )}
              {/* Infinite scroll sentinel — invisible div at bottom of feed */}
              {!isSearchActive && feedTab === 'all' && (
                <div ref={sentinelRef} style={{ height: 1 }} />
              )}
              {!isSearchActive && feedTab === 'all' && loadingMore && (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--text3)' }}>
                  Loading more…
                </div>
              )}
              {!isSearchActive && feedTab === 'all' && !hasMoreArticles && displayList.length > 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--text3)' }}>
                  You've reached the end · {displayList.length} stories loaded
                </div>
              )}
            </div>
          </div>
          <Sidebar outlets={outlets} navigate={navigate} />
        </div>
      </div>
    </div>
  )
}
