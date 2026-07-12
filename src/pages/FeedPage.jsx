import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import NewsCard from '../components/NewsCard'
import OutletLogo from '../components/OutletLogo'
import Sidebar from '../components/Sidebar'
import LegalModal from '../components/LegalModal'
import { timeAgo } from '../utils/helpers'
import { db } from '../lib/supabase'
import { track } from '../utils/track'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { computeTrendingTopics } from '../utils/topics'
import DigestSignup from '../components/DigestSignup'

// Category taxonomy — must match scripts/categorise.mjs (the server-side source
// of truth that sets article.category at ingest).
const CATEGORIES = [
  { value: 'all',            label: 'All'           },
  { value: 'Politics',       label: 'Politics'      },
  { value: 'World',          label: 'World'         },
  { value: 'Business',       label: 'Business'      },
  { value: 'Tech',           label: 'Tech'          },
  { value: 'Science',        label: 'Science'       },
  { value: 'Health',         label: 'Health'        },
  { value: 'Environment',    label: 'Environment'   },
  { value: 'Sport',          label: 'Sport'         },
  { value: 'Entertainment',  label: 'Entertainment' },
  { value: 'Culture',        label: 'Culture'       },
  { value: 'Crime',          label: 'Crime'         },
  { value: 'Conflict',       label: 'Conflict'      },
  { value: 'Travel',         label: 'Travel'        },
  { value: 'Education',      label: 'Education'     },
]

// Client-side fallback for the rare article with no server category — kept in
// sync (label-for-label) with scripts/categorise.mjs. Order = first match wins.
function guessCategory(article) {
  const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase()
  if (/\b(football|soccer|cricket|tennis|rugby|basketball|golf|olympic|formula ?1|\bf1\b|premier league|champions league|world cup|nba|nfl|athletics|boxing|\bufc\b|wicket|wimbledon|tour de france|cycling|wallabies|all blacks|six nations|nations championship|grand slam|player ratings|test match)\b/.test(text)) return 'Sport'
  if (/\b(war|military|troops|missile|air ?strikes?|bombing|invasion|ceasefire|soldiers?|drone strikes?|front ?line|combat|siege|nato|warfare|armed forces|hostages?|militants?|ukraine|\bkyiv\b|zelensky|\bputin\b|\bgaza\b|\bhamas\b|hezbollah|\bidf\b)\b/.test(text)) return 'Conflict'
  if (/\b(murder|homicide|arrests?|police|court|sentenced|prison|jailed|fraud|theft|robbery|shootings?|stabbings?|trial|guilty|verdict|assault)\b/.test(text)) return 'Crime'
  if (/\b(cancer|diseases?|hospital|doctor|patient|surgery|treatment|vaccine|nhs|mental health|health (risk|warning|crisis)|medicine|clinical|virus|outbreak|obesity|diabetes)\b/.test(text)) return 'Health'
  if (/\b(climate|emission|carbon|pollution|wildlife|biodiversity|ocean|fossil fuel|renewable|net zero|drought|flooding|wildfire|heat ?wave)\b/.test(text)) return 'Environment'
  if (/\b(research|study|space|nasa|scientist|planet|asteroid|discovery|experiment|physics|biology|telescope|quantum|genome)\b/.test(text)) return 'Science'
  if (/\b(artificial intelligence|\bai\b|technolog|cyber|software|silicon valley|data breach|robot|smartphone|social media|chatgpt|openai|semiconductor|crypto|bitcoin|startup|\bapp\b)\b/.test(text)) return 'Tech'
  if (/\b(econom|market|stock|shares|trade|company|bank|investment|gdp|inflation|financ|profit|revenue|earnings|interest rate|budget|recession|\bceo\b|merger|tariff)\b/.test(text)) return 'Business'
  if (/\b(film|movie|music|celebrity|award|oscar|bafta|grammy|tv show|streaming|festival|album|actor|actress|box office|netflix|hollywood|singer)\b/.test(text)) return 'Entertainment'
  if (/\b(\bart\b|culture|museum|gallery|theatre|theater|literature|book|exhibition|heritage|architecture|fashion|design|cuisine|tradition)\b/.test(text)) return 'Culture'
  if (/\b(travel|tourism|flight|hotel|visa|destination|holiday|airport|airline|cruise|passport)\b/.test(text)) return 'Travel'
  if (/\b(school|university|student|teacher|education|exam|degree|tuition|college|campus|ofsted)\b/.test(text)) return 'Education'
  if (/\b(elections?|government|parliament|minister|president|senate|senator|congress|\bmp\b|policy|party|labour|tory|conservative|democrat|republican|trump|chancellor|prime minister|vote|referendum|democracy|governor|lawmaker)\b/.test(text)) return 'Politics'
  return 'World'
}

function getArticleCategory(article) {
  return article.category || guessCategory(article)
}

const SORTS = [
  { value: 'trending',  label: 'Top stories' },
  { value: 'latest',    label: 'Latest'      },
]

const REGIONS = [
  { value: 'all',        label: 'All'          },
  { value: 'US',         label: 'US'           },
  { value: 'UK',         label: 'UK'           },
  { value: 'Europe',     label: 'Europe'       },
  { value: 'MiddleEast', label: 'Middle East'  },
  { value: 'Africa',     label: 'Africa'       },
  { value: 'AsiaPac',    label: 'Asia Pacific' },
  { value: 'Americas',   label: 'Americas'     },
]

function getArticleRegion(article) {
  return article.article_region || article.outlets?.country || 'International'
}

export default function FeedPage({
  articles, trendingArticles = [], trendingTopicsSource,
  outlets, loading, navigate,
  initialCategory = 'all', initialRegion = 'all',
  initialTopic = null, initialTab = 'all',
  totalArticleCount, user, followedOutletIds = new Set(), toggleFollow,
  onLoginClick, loadMoreArticles, hasMoreArticles, loadingMore,
  savedArticleIds = new Set(), toggleSave, onRefresh,
  fetchError = false,
}) {
  // trendingTopicsSource: 300 minimal rows (title+outlet_id) for topic computation.
  // Falls back to trendingArticles so categories page still works without the prop.
  const topicsSource = trendingTopicsSource || trendingArticles
  const [category, setCategory] = useState(initialCategory)
  const [region, setRegion]     = useState(initialRegion)
  const [search, setSearch]     = useState('')
  const [sort, setSort]         = useState('trending')
  const [feedTab, setFeedTab]         = useState(initialTab) // 'all' | 'following'
  const [legalDoc, setLegalDoc]       = useState(null)  // 'privacy' | 'terms' | 'guidelines'
  const [followingArticles, setFollowingArticles] = useState([])
  const [followingLoading, setFollowingLoading]   = useState(false)

  // DB search state
  const [dbResults, setDbResults]       = useState(null)   // null = search not active
  const [dbLoading, setDbLoading]       = useState(false)
  const [activeTopic, setActiveTopic]   = useState(initialTopic) // trending topic filter
  const [topicArticles, setTopicArticles] = useState([])    // live query results for active topic
  const [topicLoading, setTopicLoading]   = useState(false)
  const searchTimer                 = useRef(null)
  const searchInputRef              = useRef(null)

  // Sync activeTopic + feedTab into the URL so back-navigation restores them
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (activeTopic) params.set('topic', activeTopic); else params.delete('topic')
    if (feedTab !== 'all') params.set('tab', feedTab); else params.delete('tab')
    const newSearch = params.toString() ? `?${params}` : ''
    if (window.location.search !== newSearch) {
      window.history.replaceState({ ...window.history.state }, '', window.location.pathname + newSearch)
    }
  }, [activeTopic, feedTab])

  // Live query when a trending topic is selected — searches the full 24h window
  // so topics like "Strait of Hormuz" that spiked earlier in the day still show articles.
  useEffect(() => {
    if (!activeTopic) { setTopicArticles([]); return }
    setTopicLoading(true)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    // Escape LIKE metacharacters and PostgREST syntax chars
    const escaped = activeTopic.replace(/[%_\\]/g, '\\$&').replace(/[,()\.:]/g, ' ').trim()
    db.from('articles')
      .select('id, title, published_at, outlet_id, category, geographic_scope, article_region, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, outlets(name, country, logo_url), comments(count)')
      .ilike('title', `%${escaped}%`)
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setTopicArticles(data || [])
        setTopicLoading(false)
      })
  }, [activeTopic])

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
    "Try 'healthcare'…",
  ]
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  useEffect(() => {
    if (search) return
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % SEARCH_EXAMPLES.length), 3000)
    return () => clearInterval(id)
  }, [search])

  // Infinite scroll sentinel
  const sentinelRef = useRef(null)

  // "New articles" background poll — checks every 2 minutes for articles
  // newer than the most recent one currently in the feed
  const [newArticleCount, setNewArticleCount] = useState(0)
  const latestPublishedAtRef = useRef(null)

  // Keep latestPublishedAtRef in sync whenever articles change
  useEffect(() => {
    if (!articles.length) return
    const latest = articles.reduce((max, a) =>
      a.published_at > max ? a.published_at : max, articles[0].published_at)
    latestPublishedAtRef.current = latest
    setNewArticleCount(0) // clear banner when feed refreshes
  }, [articles])

  useEffect(() => {
    // Don't poll when a search or topic filter is active — banner would be confusing
    if (search || activeTopic || feedTab === 'following') return
    const poll = async () => {
      if (!latestPublishedAtRef.current) return
      if (document.visibilityState !== 'visible') return // don't poll backgrounded tabs
      const { count } = await db
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .gt('published_at', latestPublishedAtRef.current)
      if (count > 0) setNewArticleCount(count)
    }
    const id = setInterval(poll, 2 * 60 * 1000) // every 2 minutes
    const onVis = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [search, activeTopic, feedTab])

  function handleNewArticlesBanner() {
    setNewArticleCount(0)
    onRefresh?.()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Pull-to-refresh
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  // Debounced full-text DB search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (search.trim().length >= 2) setActiveTopic(null) // clear topic filter when searching
    if (search.trim().length < 2) {
      setDbResults(null)
      setDbLoading(false)
      track('search', { source: 'feed' })
      return
    }
    setDbLoading(true)
    searchTimer.current = setTimeout(async () => {
      const term = search.trim()
      // Escape LIKE metacharacters, then strip PostgREST filter syntax characters
      // (comma, parentheses, colon) which could break the .or() filter string if present
      const escaped = term
        .replace(/[%_\\]/g, '\\$&')   // LIKE metacharacters
        .replace(/[,()\.:]/g, ' ')     // PostgREST syntax chars — replace with space, not dropped
        .trim()
      if (!escaped) { setDbResults([]); setDbLoading(false); return }
      const { data } = await db
        .from('articles')
        .select('id, title, published_at, outlet_id, category, geographic_scope, article_region, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, outlets(name, country, logo_url), comments(count)')
        .or(`title.ilike.%${escaped}%,summary.ilike.%${escaped}%`)
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

  // Dedicated query for "My feed" tab — fetches directly from DB filtered by
  // followed outlet IDs so we're not limited to whatever's in the main feed batch
  useEffect(() => {
    if (feedTab !== 'following') return
    if (followedOutletIds.size === 0) { setFollowingArticles([]); setFollowingLoading(false); return }

    // Clear stale articles immediately so user sees spinner not old results on re-entry
    setFollowingArticles([])
    setFollowingLoading(true)
    const ids = [...followedOutletIds]
    db.from('articles')
      .select('id, title, published_at, outlet_id, category, geographic_scope, article_region, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, outlets(name, logo_url, country), comments(count)')
      .in('outlet_id', ids)
      .order('published_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error && process.env.NODE_ENV !== 'production') console.error('[MyFeed] query failed:', error)
        setFollowingArticles(data || [])
        setFollowingLoading(false)
      })
  }, [feedTab, followedOutletIds])

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
        if (sort === 'trending') {
          const trendScore = a => {
            // cluster_peers is a JSONB array — use .length for the outlet coverage count
            const coverage  = a.cluster_peers?.length || 0
            const comments  = a.comments?.[0]?.count || 0
            // Gravity decay: score / (age + 2)^1.8
            // Stories need cross-outlet coverage or engagement to hold their rank;
            // age pushes them down even if covered — keeps the list feeling fresh.
            const hoursAgo  = Math.max(0.1, (Date.now() - new Date(a.published_at)) / 3600000)
            const numerator = coverage * 12 + comments * 5 + 1
            return numerator / Math.pow(hoursAgo + 2, 1.8)
          }
          return trendScore(b) - trendScore(a)
        }
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
  // Only applied on the 'latest' sort — 'Top stories' has its own ranking.
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
  // Trending topics — shared extraction (src/utils/topics.js), also used by Explore
  const trendingTopics = useMemo(() => computeTrendingTopics(topicsSource), [topicsSource])

  // Topic insights — count uses topicsSource (300 rows) for accurate frequency
  const topicInsights = useMemo(() => {
    if (!trendingTopics.length) return []
    return trendingTopics.slice(0, 8).map(topic => {
      const key = topic.toLowerCase()
      const count = topicsSource.filter(a =>
        (a.title || '').toLowerCase().includes(key)
      ).length
      return { topic, count }
    })
    .filter(t => t.count >= 2)
    .sort((a, b) => b.count - a.count)
  }, [trendingTopics, topicsSource])

  // Which list to display — DB results when search active, interleaved otherwise
  const isSearchActive = dbResults !== null
  const baseList = isSearchActive ? dbResults : interleaved
  const rawList = activeTopic ? topicArticles : baseList

  // Story-grouping: collapse clustered articles so each story shows once. When
  // several loaded articles share a cluster_id (same story, different outlets),
  // keep only the first — its card shows "N sources covering this". cluster_peers
  // is pre-computed server-side by scripts/cluster.mjs.
  const displayList = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const a of rawList) {
      if (a.cluster_id) {
        if (seen.has(a.cluster_id)) continue
        seen.add(a.cluster_id)
      }
      out.push(a)
    }
    return out
  }, [rawList])


  // Hero slot needs an image — a text-only hero reads flat. On the default
  // trending view, promote the first imaged story to the front (order of the
  // rest unchanged). Search/topic/latest views keep pure order.
  const heroList = useMemo(() => {
    if (isSearchActive || activeTopic || sort !== 'trending' || feedTab !== 'all') return displayList
    if (!displayList.length || displayList[0].image_url) return displayList
    const idx = displayList.slice(0, 6).findIndex(a => a.image_url)
    if (idx <= 0) return displayList
    const next = displayList.slice()
    const [hero] = next.splice(idx, 1)
    next.unshift(hero)
    return next
  }, [displayList, isSearchActive, activeTopic, sort, feedTab])

  // Outlet search — match search term against outlet names
  const matchedOutlets = useMemo(() => {
    if (!isSearchActive || search.trim().length < 2) return []
    const term = search.trim().toLowerCase()
    return (outlets || []).filter(o => o.name?.toLowerCase().includes(term)).slice(0, 3)
  }, [isSearchActive, search, outlets])

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}

      {/* Wider shell on desktop so the two-column story grid + sidebar breathe;
          max-width is irrelevant below 1024px so mobile is untouched. */}
      <div className="container" style={{ maxWidth: 1240, paddingTop: 14 }}>

        {/* SEO/a11y page heading — the feed itself is the visible UI. */}
        <h1 className="sr-only">RatedNews — community-rated news from 200+ outlets</h1>

        {/* Feed views — one row: Top stories / Latest / My feed.
            'Top stories' and 'Latest' are the all-outlets feed with the two
            sorts; 'My feed' is followed outlets. Replaces the old
            All-stories/My-feed tabs + separate sort pill row. */}
        <div className="tabs" style={{ marginBottom: 14 }}>
          <div
            className={`tab${feedTab === 'all' && sort === 'trending' ? ' active' : ''}`}
            onClick={() => { setFeedTab('all'); setSort('trending') }}
          >
            Top stories
          </div>
          <div
            className={`tab${feedTab === 'all' && sort === 'latest' ? ' active' : ''}`}
            onClick={() => { setFeedTab('all'); setSort('latest') }}
          >
            Latest
          </div>
          <div
            className={`tab${feedTab === 'following' ? ' active' : ''}`}
            onClick={() => {
              if (!user) { onLoginClick(); return }
              setFeedTab('following')
            }}
          >
            My feed
            {user && followedOutletIds.size > 0
              ? <span style={{ color: 'var(--text3)', fontWeight: 400 }}> ({followedOutletIds.size})</span>
              : <span style={{ fontSize: 10, color: 'var(--coral)', fontWeight: 500, marginLeft: 5, background: 'rgba(255,99,71,0.1)', padding: '1px 6px', borderRadius: 10 }}>Follow outlets</span>
            }
          </div>
        </div>

        {/* My feed context strip */}
        {feedTab === 'following' && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            {followedOutletIds.size === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>Follow outlets to build your personalised feed</span>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, flex: 1, overflow: 'hidden', flexWrap: 'nowrap' }}>
                  {(outlets || []).filter(o => followedOutletIds.has(o.id)).slice(0, 8).map(o => (
                    <OutletLogo key={o.id} name={o.name} size={26} borderRadius={6} />
                  ))}
                  {followedOutletIds.size > 8 && (
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg2)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text3)', fontWeight: 600, flexShrink: 0 }}>
                      +{followedOutletIds.size - 8}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{followedOutletIds.size} outlet{followedOutletIds.size !== 1 ? 's' : ''}</span>
              </>
            )}
            <button
              onClick={() => navigate('profile')}
              style={{ fontSize: 11, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0, fontFamily: 'inherit' }}
            >
              Manage →
            </button>
          </div>
        )}

        {/* Search — desktop only; mobile users use the Explore tab */}
        <div className="feed-search-desktop-only">
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

          {/* Hint text — only while the search is focused and empty; idle state
              stays chrome-free so stories start higher on the page */}
          {searchFocused && !search && searchHistory.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 10, paddingLeft: 2 }}>
              Searches every story across all outlets — not just headlines
            </p>
          )}
        </div>

        {/* Topic insight cards — inline on mobile; ≥1024px these live in the sidebar */}
        {topicInsights.length > 0 && (
          <div className="trending-inline" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              🔥 Trending · 24h
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
              {topicInsights.map(({ topic }) => {
                const isActive = activeTopic === topic
                return (
                  <div
                    key={topic}
                    onClick={() => setActiveTopic(isActive ? null : topic)}
                    style={{
                      flexShrink: 0, cursor: 'pointer',
                      background: isActive ? 'var(--coral)' : 'var(--surface)',
                      border: `0.5px solid ${isActive ? 'var(--coral)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', padding: '8px 14px',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--coral)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: isActive ? '#fff' : 'inherit' }}>
                      {topic}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid">
          <div>
            {/* Contextual header — only rendered when it says something the
                tabs don't already (search count, category/region filter). */}
            {(isSearchActive || category !== 'all' || region !== 'all') && (
              <div className="section-label" style={{ marginBottom: 10 }}>
                {isSearchActive
                  ? dbLoading
                    ? 'Searching…'
                    : `${displayList.length} result${displayList.length !== 1 ? 's' : ''} for "${search}"`
                  : <>
                      {category !== 'all' && <span>{category}</span>}
                      {region !== 'all' && <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{category !== 'all' ? ' · ' : ''}{REGIONS.find(r => r.value === region)?.label}</span>}
                    </>
                }
              </div>
            )}

            {/* Outlet matches — pinned above article results when search active */}
            {isSearchActive && matchedOutlets.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Outlets</div>
                {matchedOutlets.map(outlet => (
                  <div
                    key={outlet.id}
                    onClick={() => navigate('outlet', { outletId: outlet.id, name: outlet.name })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', marginBottom: 6,
                      background: 'var(--surface)', border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--coral)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <OutletLogo name={outlet.name} size={36} borderRadius={8} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{outlet.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
                        {outlet.country || 'Outlet'}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>→</span>
                  </div>
                ))}
                {displayList.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 8px' }}>Articles</div>
                )}
              </div>
            )}

            {/* New articles banner */}
            {newArticleCount > 0 && !search && !activeTopic && feedTab === 'all' && (
              <div
                onClick={handleNewArticlesBanner}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, cursor: 'pointer',
                  background: 'var(--accent, #ef4444)', color: '#fff',
                  borderRadius: 999, padding: '8px 18px',
                  fontSize: 13, fontWeight: 600, letterSpacing: '0.01em',
                  margin: '0 auto 12px', width: 'fit-content',
                  boxShadow: '0 2px 12px rgba(239,68,68,0.35)',
                  animation: 'fadeSlideDown 0.25s ease',
                }}
              >
                ↑ {newArticleCount} new article{newArticleCount !== 1 ? 's' : ''} — tap to refresh
              </div>
            )}

            {/* feed--home enables the desktop grid (≥1024px, CSS-only — mobile
                unaffected). Suppressed during search/topic views where a hero
                treatment on the first result would be wrong. */}
            <div className={`feed${!isSearchActive && !activeTopic ? ' feed--home' : ''}`}>
              {fetchError ? (
                <div style={{
                  textAlign: 'center', padding: '40px 20px',
                  background: 'var(--surface)', border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>📡</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Having trouble loading stories
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
                    We're having difficulty connecting to our data source. This is usually brief — try refreshing in a moment.
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      fontSize: 13, fontWeight: 600,
                      padding: '8px 20px',
                      background: 'var(--coral)', color: '#fff',
                      border: 'none', borderRadius: 20, cursor: 'pointer',
                    }}
                  >
                    Refresh
                  </button>
                </div>
              ) : loading || (isSearchActive && dbLoading) ? (
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
              ) : followingLoading && feedTab === 'following' ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--text3)' }}>
                  Loading your feed…
                </div>
              ) : displayList.length === 0 && feedTab === 'following' && followedOutletIds.size === 0 ? (
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>Build your feed</h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Follow a few outlets and this tab becomes your personal front page. Tap to follow:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {(outlets || []).filter(o => !o.parent_outlet_id).slice(0, 12).map(o => {
                      const following = followedOutletIds.has(o.id)
                      return (
                        <button
                          key={o.id}
                          onClick={() => { if (!user) { onLoginClick(); return } toggleFollow?.(o.id) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                            padding: '9px 11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: following ? 'var(--green-light)' : 'var(--bg)',
                            border: `0.5px solid ${following ? 'var(--green)' : 'var(--border)'}`,
                          }}
                        >
                          <OutletLogo name={o.name} size={24} borderRadius={6} />
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: following ? 'var(--green-dark)' : 'var(--coral)', flexShrink: 0 }}>{following ? '✓ Following' : '+ Follow'}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button className="btn-outline" style={{ marginTop: 14, fontSize: 13 }} onClick={() => navigate('outlets')}>
                    See all outlets →
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
              ) : topicLoading ? (
                <div className="empty-state">
                  <p style={{ color: 'var(--text3)' }}>Loading articles on {activeTopic}…</p>
                </div>
              ) : displayList.length === 0 && activeTopic ? (
                <div className="empty-state">
                  <h3>No stories on "{activeTopic}" in the last 24h</h3>
                  <p>This topic may have trended earlier. Check back after the next update.</p>
                  <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => setActiveTopic(null)}>
                    Back to all stories
                  </button>
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
                heroList.map((a, i) => (
                  <React.Fragment key={a.id}>
                    <NewsCard
                      article={a}
                      index={i}
                      onClick={() => {
                        searchInputRef.current?.blur()
                        navigate('article', { articleId: a.id, title: a.title })
                      }}
                      navigate={navigate}
                      relatedArticles={a.cluster_peers || []}
                    />
                    {/* Mobile: the sidebar (and its signup) is unreachable below an
                        infinite feed — surface the digest capture in-feed instead */}
                    {i === 9 && (
                      <div className="mobile-block">
                        <DigestSignup />
                      </div>
                    )}
                  </React.Fragment>
                ))
              )}

              {/* Infinite scroll sentinel — hidden when topic filter or search active */}
              {!isSearchActive && !activeTopic && feedTab === 'all' && hasMoreArticles && (
                <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0', minHeight: 56 }}>
                  {loadingMore && (
                    <div style={{
                      width: 20, height: 20,
                      border: '2px solid var(--border)',
                      borderTopColor: 'var(--text3)',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                  )}
                </div>
              )}

              {/* Topic filter end-of-list */}
              {activeTopic && displayList.length > 0 && (
                <div style={{ textAlign: 'center', padding: '28px 16px', borderTop: '1px solid var(--divider)', marginTop: 8 }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>📰</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 3 }}>
                    {displayList.length} {displayList.length !== 1 ? 'stories' : 'story'} on {activeTopic} in the last 24h
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>That's everything — updates hourly</div>
                  <button
                    className="btn-outline"
                    style={{ fontSize: 12 }}
                    onClick={() => setActiveTopic(null)}
                  >
                    Back to all stories
                  </button>
                </div>
              )}

              {/* Regular feed end-of-list */}
              {!isSearchActive && !activeTopic && feedTab === 'all' && !hasMoreArticles && displayList.length > 0 && (
                <div style={{ textAlign: 'center', padding: '28px 16px', borderTop: '1px solid var(--divider)', marginTop: 8 }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>✓</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 3 }}>You're all caught up</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{displayList.length} stories loaded · updates hourly</div>
                </div>
              )}

              {/* Subtle legal footer — desktop only, below last article */}
              {!isSearchActive && !hasMoreArticles && displayList.length > 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '12px 0 24px',
                  fontSize: 11,
                  color: 'var(--text3)',
                  display: 'none',
                  // shown via CSS on desktop only
                }} className="legal-footer">
                  © {new Date().getFullYear()} RatedNews
                  {' · '}
                  <button onClick={() => setLegalDoc('privacy')} className="legal-link">Privacy</button>
                  {' · '}
                  <button onClick={() => setLegalDoc('terms')} className="legal-link">Terms</button>
                  {' · '}
                  <button onClick={() => setLegalDoc('guidelines')} className="legal-link">Guidelines</button>
                </div>
              )}
            </div>
          </div>
          <Sidebar
            outlets={outlets}
            navigate={navigate}
            trendingTopics={topicInsights.map(t => t.topic)}
            activeTopic={activeTopic}
            onTopic={topic => setActiveTopic(activeTopic === topic ? null : topic)}
          />
        </div>
      </div>

      {/* Legal modal */}
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}
