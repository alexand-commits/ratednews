import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import NewsCard from '../components/NewsCard'
import Sidebar from '../components/Sidebar'
import LegalModal from '../components/LegalModal'
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
  { value: 'Conflict',       label: '⚔️ Conflict'          },
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
  const [feedTab, setFeedTab]         = useState('all') // 'all' | 'following'
  const [legalDoc, setLegalDoc]       = useState(null)  // 'privacy' | 'terms' | 'guidelines'
  const [followingArticles, setFollowingArticles] = useState([])
  const [followingLoading, setFollowingLoading]   = useState(false)

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

  // Dedicated query for "My feed" tab — fetches directly from DB filtered by
  // followed outlet IDs so we're not limited to whatever's in the main feed batch
  useEffect(() => {
    if (feedTab !== 'following') return
    if (followedOutletIds.size === 0) { setFollowingArticles([]); return }

    setFollowingLoading(true)
    const ids = [...followedOutletIds]
    db.from('articles')
      .select('*, outlets(name, slug, logo_url, country, overall_score, bias_direction)')
      .in('outlet_id', ids)
      .not('accuracy_score', 'is', null)
      .order('published_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
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

  // Trending topics — multi-word phrase extraction + acronyms
  //
  // Strategy: news headlines often use Title Case, so single capitalised words
  // like "New", "Prize", "Party" are noisy. We instead prioritise consecutive
  // capitalised-word PHRASES ("Donald Trump", "Supreme Court", "Gaza Strip")
  // which are almost always genuine named entities. Single words are only shown
  // when they're unambiguously proper (i.e. not in the common-word blocklist)
  // and appear frequently enough to matter.

  const COMMON_WORDS = useMemo(() => new Set([
    // Generic adjectives / determiners common in title-case headlines
    'new','old','big','small','great','major','key','top','full','long','short',
    'high','low','good','bad','best','worst','next','last','first','second','third',
    'final','early','late','real','true','false','main','chief','senior','junior',
    'former','young','recent','latest','another','other','more','less','many','few',
    'free','open','public','private','national','local','global','international',
    'further','several','same','own','right','left','both','such','certain',
    // Generic nouns that appear everywhere in title-case news
    'prize','award','deal','plan','move','push','call','sign','vote','ban','bid',
    'plea','plea','warning','threat','pledge','claim','claims','concerns','fears',
    'hopes','doubts','talks','talks','crisis','issue','issues','case','cases',
    'step','steps','way','ways','time','times','year','years','day','days',
    'week','weeks','month','months','hour','hours','home','homes','world',
    'nation','nations','state','states','city','cities','town','towns',
    'area','areas','region','regions','group','groups','party','parties',
    'people','man','woman','men','women','child','children','family','families',
    'leader','leaders','head','boss','official','officials','minister','ministers',
    'government','governments','court','courts','law','laws','rule','rules',
    'war','peace','fight','battle','battle','death','deaths','life','lives',
    'money','cash','fund','funds','cost','costs','price','prices','tax','taxes',
    'shot','shots','fire','fires','attack','attacks','strike','strikes',
    // Common verbs in title-case (mid-headline)
    'win','wins','won','lose','loses','lost','hit','hits','face','faces','back',
    'set','get','make','take','give','come','rise','fall','drop','cut','end',
    'start','begin','grow','reach','help','lead','leave','use','see','run',
    'hold','keep','bring','turn','say','says','said','show','shows','told',
    'call','calls','called','called','push','pushed','seek','seeks','sought',
    'join','joins','joined','open','opens','opened','close','closes','closed',
    'launch','launches','launched','announce','announces','announced',
    'reveal','reveals','revealed','confirm','confirms','confirmed',
    'deny','denies','denied','condemn','condemns','condemns','defend','defends',
    // Sensitive standalone group/identity terms
    'jews','jewish','muslims','christians','catholics','protestants',
    'blacks','whites','latinos','hispanics','asians','arabs',
    'immigrants','migrants','refugees','foreigners','natives',
    'gays','lesbians','trans','queer',
    // Common first names
    'john','james','mary','peter','paul','david','sarah','michael','george','robert',
    'william','richard','charles','donald','boris','tony','mark','chris','kevin','gary',
    'alan','nick','kate','emma','anna','lisa','jane','helen','laura','sophie','joe',
    'jack','harry','henry','oliver','emily','grace','alice','thomas','daniel','matthew',
    'andrew','joshua','ryan','adam','luke','alex','sam','ben','tom','tim','jim','bob',
    'bill','mike','phil','andy','dave','steve','sean','jake','liam','owen','evan',
    'neil','eric','carl','dean','rose','ruth','anne','june','dawn','amy','eva','mia',
    // Generic news format words
    'analysis','opinion','comment','review','interview','exclusive','special','breaking',
    'update','report','reports','live','watch','listen','read','podcast','inside',
    'why','how','what','who','when','where','says','think','could','would','should',
  ]), [])

  // Stop-words allowed to sit *inside* a phrase but not start/end one
  const PHRASE_CONNECTORS = new Set(['of','the','and','in','on','at','to','for','by','with','from','over','into','as','a'])

  const trendingTopics = useMemo(() => {
    const phraseFreq   = {}  // key → count  (multi-word phrases)
    const singleFreq   = {}  // key → count  (single proper nouns / acronyms)
    const displayForm  = {}  // key → display string

    for (const article of articles.slice(0, 300)) {
      const title = (article.title || '').trim()
      if (!title) continue
      const rawWords = title.split(/\s+/)

      // ── Pass 1: collect phrases (2+ consecutive proper/acronym tokens) ──
      let buffer = []   // [{word, key}]

      const flushBuffer = () => {
        // Trim trailing connectors from buffer
        while (buffer.length && PHRASE_CONNECTORS.has(buffer[buffer.length - 1].key)) buffer.pop()
        if (buffer.length >= 2) {
          const phrase   = buffer.map(t => t.word).join(' ')
          const phraseKey = phrase.toLowerCase()
          phraseFreq[phraseKey] = (phraseFreq[phraseKey] || 0) + 1
          displayForm[phraseKey] = phrase
        }
        buffer = []
      }

      rawWords.forEach((raw, idx) => {
        const clean = raw.replace(/[^a-zA-Z'-]/g, '').replace(/^'+|'+$/g, '')
        if (!clean) { flushBuffer(); return }

        const isAcronym    = /^[A-Z]{2,6}$/.test(clean)
        const isProperNoun = idx > 0 && /^[A-Z][a-z]{1,}$/.test(clean)
        const isConnector  = PHRASE_CONNECTORS.has(clean.toLowerCase())

        if (isAcronym || isProperNoun) {
          buffer.push({ word: isAcronym ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(), key: clean.toLowerCase() })
        } else if (isConnector && buffer.length > 0) {
          // Allow connectors mid-phrase ("Secretary of State", "Isle of Man")
          buffer.push({ word: clean.toLowerCase(), key: clean.toLowerCase() })
        } else {
          flushBuffer()
        }
      })
      flushBuffer()

      // ── Pass 2: single proper nouns & acronyms ──
      rawWords.forEach((raw, idx) => {
        const clean = raw.replace(/[^a-zA-Z]/g, '')
        if (!clean) return

        const isAcronym    = /^[A-Z]{2,6}$/.test(clean)
        const isProperNoun = idx > 0 && /^[A-Z][a-z]{1,}$/.test(clean)
        if (!isAcronym && !isProperNoun) return

        const key = clean.toLowerCase()
        if (key.length < 3) return
        if (COMMON_WORDS.has(key)) return

        singleFreq[key] = (singleFreq[key] || 0) + 1
        if (!displayForm[key]) {
          displayForm[key] = isAcronym ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
        }
      })
    }

    // ── Score & merge ──
    // Phrases get 3× weight so they surface above ambiguous singles.
    // Singles require freq ≥ 3 (stricter than phrases) to reduce noise.
    const scored = {}
    for (const [key, count] of Object.entries(phraseFreq)) {
      if (count >= 2) scored[key] = count * 3
    }
    for (const [key, count] of Object.entries(singleFreq)) {
      if (count >= 3 && !scored[key]) scored[key] = count
    }

    return Object.entries(scored)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key]) => displayForm[key] || key.charAt(0).toUpperCase() + key.slice(1))
  }, [articles, COMMON_WORDS, PHRASE_CONNECTORS])

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
                <span>Articles rated</span>
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
                  : (category !== 'all' || region !== 'all')
                    ? <>
                        {category !== 'all' && <span>{category}</span>}
                        {region !== 'all' && <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{category !== 'all' ? ' · ' : ''}{REGIONS.find(r => r.value === region)?.label}</span>}
                      </>
                    : null
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
              ) : followingLoading && feedTab === 'following' ? (
                <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--text3)' }}>
                  Loading your feed…
                </div>
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
                      navigate('article', { articleId: a.id, title: a.title })
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
          <Sidebar outlets={outlets} navigate={navigate} />
        </div>
      </div>

      {/* Legal modal */}
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}
