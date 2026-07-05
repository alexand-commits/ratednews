import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import NewsCard from '../components/NewsCard'
import OutletLogo from '../components/OutletLogo'
import Sidebar from '../components/Sidebar'
import LegalModal from '../components/LegalModal'
import { timeAgo } from '../utils/helpers'
import { db } from '../lib/supabase'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

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
  const [density, setDensity]         = useState('comfortable') // 'comfortable' | 'compact'
  const [legalDoc, setLegalDoc]       = useState(null)  // 'privacy' | 'terms' | 'guidelines'

  // Restore saved density preference on mount
  useEffect(() => {
    try { const d = localStorage.getItem('rn_density'); if (d === 'compact' || d === 'comfortable') setDensity(d) } catch {}
  }, [])
  function toggleDensity() {
    setDensity(d => {
      const next = d === 'compact' ? 'comfortable' : 'compact'
      try { localStorage.setItem('rn_density', next) } catch {}
      return next
    })
  }
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
      const { count } = await db
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .gt('published_at', latestPublishedAtRef.current)
      if (count > 0) setNewArticleCount(count)
    }
    const id = setInterval(poll, 2 * 60 * 1000) // every 2 minutes
    return () => clearInterval(id)
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

  // Trending topics — multi-word phrase extraction + acronyms
  //
  // Strategy: news headlines often use Title Case, so single capitalised words
  // like "New", "Prize", "Party" are noisy. We instead prioritise consecutive
  // capitalised-word PHRASES ("Donald Trump", "Supreme Court", "Gaza Strip")
  // which are almost always genuine named entities. Single words are only shown
  // when they're unambiguously proper (i.e. not in the common-word blocklist)
  // and appear frequently enough to matter.

  const COMMON_WORDS = useMemo(() => new Set([
    // Articles & determiners (also in PHRASE_CONNECTORS but must be here too for isProperNoun guard)
    'the','a','an','this','that','these','those','every','each','any','all','some','no',
    // Pronouns
    'he','she','it','they','we','i','you','him','her','them','us','his','its','our','their',
    // Conjunctions & subordinators (including preposition-style headline starters)
    'but','and','or','nor','yet','so','if','unless','until','since','while','though',
    'although','because','whether','after','before','during','despite','without',
    'amid','following','regarding','concerning','pending','including','excluding',
    'across','beyond','within','between','among','against','along','around',
    // Common sentence-starters / adverbs
    'here','there','now','then','still','just','even','also','too','not','never',
    'always','often','again','already','only','very','quite','rather','more','most',
    // Modal / auxiliary verbs
    'may','might','must','can','will','shall','need','want','able',
    // Generic adjectives / determiners
    'new','old','big','small','great','major','key','top','full','long','short',
    'high','low','good','bad','best','worst','next','last','first','second','third',
    'final','early','late','real','true','false','main','chief','senior','junior',
    'former','young','recent','latest','another','other','less','many','few',
    'free','open','public','private','national','local','global','international',
    'further','several','same','own','right','left','both','such','certain',
    'hard','easy','clear','dark','light','fast','slow','hot','cold','safe',
    'huge','massive','rare','secret','hidden','historic','possible','impossible',
    // Generic nouns
    'prize','award','deal','plan','move','push','call','sign','vote','ban','bid',
    'plea','warning','threat','pledge','claim','claims','concerns','fears',
    'hopes','doubts','talks','crisis','issue','issues','case','cases',
    'step','steps','way','ways','time','times','year','years','day','days',
    'week','weeks','month','months','hour','hours','home','homes','house','houses','world',
    'nation','nations','state','states','city','cities','town','towns',
    'area','areas','region','regions','group','groups','party','parties',
    'street','streets','road','roads','building','buildings','office','offices',
    'people','man','woman','men','women','child','children','family','families',
    'leader','leaders','head','boss','official','officials','minister','ministers',
    'government','governments','court','courts','law','laws','rule','rules',
    'war','peace','fight','battle','death','deaths','life','lives',
    'money','cash','fund','funds','cost','costs','price','prices','tax','taxes',
    'shot','shots','fire','fires','attack','attacks','strike','strikes',
    // Sports event nouns — generic containers, not specific topics
    'cup','cups','league','leagues','trophy','trophies','title','titles',
    'fixture','fixtures','match','matches','game','games','tie','ties',
    'semi','final','finals','round','rounds','leg','legs','stage','stages',
    'season','seasons','tournament','tournaments','championship','championships',
    // Generic event nouns (describe type of event, not a specific named topic)
    'police','officer','officers','cop','cops','detective','detectives','sheriff',
    'hospital','hospitals','clinic','clinics','ambulance',
    'flood','floods','flooding','earthquake','storm','storms','hurricane','wildfire','wildfires',
    'shooting','shootings','stabbing','stabbings','explosion','explosions','blast','blasts',
    'protest','protests','protester','protesters','demonstrator','demonstrators','rally','rallies',
    'investigation','investigations','inquiry','inquiries','hearing','hearings','testimony',
    'rescue','rescued','evacuation','evacuations','emergency','emergencies','disaster','disasters',
    'election','elections','referendum','campaign','campaigns','candidate','candidates',
    'parliament','senate','congress','assembly','council','councils','committee','committees',
    'president','prime','premier','governor','governor','senator','senators','congressman',
    'company','companies','firm','firms','corporation','corporations','industry','sector',
    'market','markets','economy','recession','inflation','tariff','tariffs','sanction','sanctions',
    'school','schools','college','colleges','university','universities','student','students',
    'church','mosque','temple','synagogue','cathedral',
    // Common verbs
    'win','wins','won','lose','loses','lost','hit','hits','face','faces','back',
    'set','get','make','take','give','come','rise','fall','drop','cut','end',
    'stop','stops','stopped','start','begin','grow','reach','help','lead','leave','use','see','run',
    'hold','keep','bring','turn','say','says','said','show','shows','told',
    'call','calls','called','push','pushed','seek','seeks','sought',
    'join','joins','joined','open','opens','opened','close','closes','closed',
    'launch','launches','launched','announce','announces','announced',
    'reveal','reveals','revealed','confirm','confirms','confirmed',
    'deny','denies','denied','condemn','condemns','defend','defends',
    'warn','warns','warned','urge','urges','urged','slam','slams','slammed',
    'blast','blasts','blasted','slam','vow','vows','vowed','pledge','pledged',
    // Identity terms (standalone — too broad to be useful topics)
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
    // UK tabloid tone/narrative words — describe mood, not topic; often start sentence-case headlines
    // e.g. "Fury as minister…", "Chaos in schools…", "Row over budget…", "Probe launched into…"
    'fury','chaos','row','rows','probe','probes','scandal','scandals','outrage','backlash',
    'shame','shock','blunder','blunders','snub','snubs','gaffe','gaffes','feud','feuds',
    'crisis','crises','drama','dramas','farce','fiasco','uproar','furore','furor',
    'fallout','aftermath','impact','impacts','effect','effects','consequence','consequences',
    'number',  // "Number 10" → strips to "Number", not a real topic
    // Overly broad geography — appear in too many headlines to signal a specific topic
    'london','britain','england','scotland','wales','ireland','europe','america',
    'africa','asia','australia','germany','france','italy','spain','canada',
    'china','russia','india','pakistan','ukraine','mexico','brazil','japan',
    'england','britain','uk','gb',  // UK/GB are 2 chars (already blocked by length) but listed for clarity
    // Generic news format words
    'analysis','opinion','comment','review','interview','exclusive','special','breaking',
    'update','report','reports','live','watch','listen','read','podcast','inside',
    'why','how','what','who','when','where','says','think','could','would','should',
    // ── Media / outlet words ──
    'news','network','channel','media','press','outlet','outlets','digital','online',
    'weekly','daily','tonight','today','morning','evening','sunday',
    'monday','tuesday','wednesday','thursday','friday','saturday',
    'reporter','reporters','anchor','correspondent','journalist',
    'editor','editors','spokesperson','spokesman','spokeswoman',
    'source','sources','bulletin','broadcast','programme','program',
  ]), [])

  // Known media outlet acronyms — blocked as both standalone topics and phrase anchors
  const MEDIA_ACRONYMS = useMemo(() => new Set([
    'cbs','nbc','cnn','bbc','abc','pbs','npr','msnbc','cnbc','itv','skynews',
    'afp','ap','upi','nhk','dw','rte','sbs','abc','sky','fox','rtc',
    'nyt','wsj','espn','hbo','hulu','vice','vox','axios','politico',
  ]), [])

  // Full names of TV anchors / journalists — blocked as trending phrases.
  // They appear in headlines as interviewers, not as genuine news topics.
  const BLOCKED_ANCHOR_PHRASES = useMemo(() => new Set([
    // CBS
    'margaret brennan','norah odonnell','gayle king','tony dokoupil','john dickerson',
    // NBC / MSNBC
    'lester holt','savannah guthrie','hoda kotb','andrea mitchell','kristen welker',
    'mika brzezinski','joe scarborough','chris hayes','joy reid','ari melber',
    'ali velshi','rachel maddow','lawrence odonnell','nicolle wallace',
    // CNN
    'jake tapper','anderson cooper','wolf blitzer','erin burnett','dana bash',
    'poppy harlow','kate bolduan','abby phillip','brianna keilar','john berman',
    'jim sciutto','jim acosta','brian stelter','bianna golodryga','chris cuomo',
    'don lemon','omar jimenez',
    // Fox News
    'bret baier','martha maccallum','neil cavuto','harris faulkner',
    'ainsley earhardt','steve doocy','pete hegseth','jesse watters',
    'laura ingraham','sean hannity','tucker carlson','chris wallace','sandra smith',
    // ABC
    'george stephanopoulos','martha raddatz','david muir','robin roberts',
    'michael strahan','amy robach','gio benitez',
    // PBS / NPR
    'judy woodruff','gwen ifill','amna nawaz','geoff bennett',
    // BBC
    'huw edwards','sophie raworth','mishal husain','fiona bruce','andrew marr',
    'laura kuenssberg','victoria derbyshire',
    // Sky News
    'kay burley','dermot murnaghan','anna botting','adam boulton',
    // ITV
    'piers morgan','susanna reid','phillip schofield','holly willoughby',
    // Chuck Todd (NBC)
    'chuck todd',
  ]), [])

  // Anchor last names — suppresses singles like "Brennan" appearing alone
  const ANCHOR_LAST_NAMES = useMemo(() => new Set([
    'brennan','tapper','cooper','blitzer','lemon','maddow','hannity','carlson',
    'ingraham','cavuto','baier','maccallum','wallace','todd','stephanopoulos',
    'raddatz','muir','welker','holt','mitchell','brzezinski','scarborough',
    'hayes','reid','melber','velshi','guthrie','kotb','acosta','stelter',
    'burnett','bash','harlow','bolduan','keilar','berman','sciutto','golodryga',
    'faulkner','earhardt','doocy','watters','cuomo','dokoupil','dickerson',
    'woodruff','husain','kuenssberg','burley','murnaghan','nawaz','benitez',
    'strahan','robach','nawaz',
  ]), [])

  // Words that are generic adjectives in isolation but act as place-name prefixes
  // when capitalized and followed by a proper noun (e.g. "New York", "North Korea",
  // "West Bank", "Great Britain", "San Francisco", "Fort Worth", "Mount Everest").
  // These are in COMMON_WORDS (so standalone "new/old/north/south" don't surface)
  // but should NOT block phrase building when they appear capitalised mid-title.
  const PLACE_PREFIXES = new Set([
    'new','old','north','south','east','west','central',
    'great','grand','upper','lower','inner','outer',
    'san','los','las','el','la','port','fort','mount','lake','cape',
    'saint','santa','sri','abu','al',
  ])

  // Stop-words allowed to sit *inside* a phrase but not start/end one
  const PHRASE_CONNECTORS = new Set(['of','the','and','in','on','at','to','for','by','with','from','over','into','as','a'])

  const trendingTopics = useMemo(() => {
    const phraseFreq   = {}
    const phraseOutlets = {}  // phrase key → Set of outlet_ids
    const singleFreq   = {}
    const singleOutlets = {}  // single key → Set of outlet_ids
    const displayForm  = {}

    // topicsSource: up to 1000 rows, title+outlet_id only — full 24h window
    for (const article of topicsSource.slice(0, 1000)) {
      const title = (article.title || '').trim()
      if (!title) continue
      const rawWords = title.split(/\s+/)

      // ── Pass 1: multi-word phrases ──
      let buffer = []

      const flushBuffer = () => {
        // Trim trailing connectors
        while (buffer.length && PHRASE_CONNECTORS.has(buffer[buffer.length - 1].key)) buffer.pop()
        // Trim leading connectors
        while (buffer.length && PHRASE_CONNECTORS.has(buffer[0].key)) buffer.shift()
        if (buffer.length < 2) { buffer = []; return }
        // Reject phrases containing a COMMON_WORDS token (e.g. "Major Plans", "Latest Deal"),
        // UNLESS that token is a PLACE_PREFIX — "New York", "North Korea", "San Francisco"
        // are valid phrases even though "new/north/san" are common words.
        const nonConnectors = buffer.filter(t => !PHRASE_CONNECTORS.has(t.key))
        if (nonConnectors.some(t => (COMMON_WORDS.has(t.key) && !PLACE_PREFIXES.has(t.key)) || MEDIA_ACRONYMS.has(t.key))) {
          buffer = []; return
        }
        const phrase    = buffer.map(t => t.word).join(' ')
        const phraseKey = phrase.toLowerCase()
        phraseFreq[phraseKey] = (phraseFreq[phraseKey] || 0) + 1
        if (!phraseOutlets[phraseKey]) phraseOutlets[phraseKey] = new Set()
        phraseOutlets[phraseKey].add(article.outlet_id)
        displayForm[phraseKey] = phrase
        buffer = []
      }

      rawWords.forEach((raw, idx) => {
        const clean = raw.replace(/[^a-zA-Z'-]/g, '').replace(/^'+|'+$/g, '')
        if (!clean) { flushBuffer(); return }
        const isAcronym    = /^[A-Z]{2,6}$/.test(clean)
        const key0         = clean.toLowerCase()
        // A word is a proper noun if it starts with a capital letter AND is not a
        // common stop-word. Exception: capitalised PLACE_PREFIXES (New, North, San…)
        // are allowed into the buffer so "New York", "North Korea" etc. form correctly.
        // The flushBuffer check still rejects any phrase where a COMMON_WORDS term
        // is a non-connector, so "New deal" or "North facing" won't surface.
        const isPlacePrefix = /^[A-Z][a-z]+$/.test(clean) && PLACE_PREFIXES.has(key0)
        const isProperNoun  = /^[A-Z][a-z]{1,}$/.test(clean) && !COMMON_WORDS.has(key0) && !PHRASE_CONNECTORS.has(key0)
        const isConnector   = PHRASE_CONNECTORS.has(key0)
        if (isAcronym || isProperNoun || isPlacePrefix) {
          buffer.push({ word: isAcronym ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(), key: key0 })
        } else if (isConnector && buffer.length > 0) {
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
        const key          = clean.toLowerCase()
        const isProperNoun = /^[A-Z][a-z]{1,}$/.test(clean) && !COMMON_WORDS.has(key) && !PHRASE_CONNECTORS.has(key)
        if (!isAcronym && !isProperNoun) return
        if (key.length < 3) return
        if (COMMON_WORDS.has(key) || MEDIA_ACRONYMS.has(key)) return
        singleFreq[key] = (singleFreq[key] || 0) + 1
        if (!singleOutlets[key]) singleOutlets[key] = new Set()
        singleOutlets[key].add(article.outlet_id)
        if (!displayForm[key]) {
          displayForm[key] = isAcronym ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
        }
      })
    }

    // Phrases ≥ 4 mentions across ≥ 2 outlets; singles ≥ 4 across ≥ 2 outlets.
    // Outlet diversity prevents tabloid clustering: 4 Sun articles about the same
    // celebrity story don't constitute a trending topic — real news spreads.
    const scored = {}
    for (const [key, count] of Object.entries(phraseFreq)) {
      if (
        count >= 4 &&
        (phraseOutlets[key]?.size ?? 0) >= 2 &&
        !BLOCKED_ANCHOR_PHRASES.has(key)
      ) scored[key] = count * 3
    }
    // Deduplicate singles against ALL extracted phrases (including blocked ones like
    // "margaret brennan") — otherwise blocking a phrase removes it from the dedup
    // set and lets the constituent first name slip through as a standalone topic.
    const allPhraseKeys = Object.keys(phraseFreq)
    for (const [key, count] of Object.entries(singleFreq)) {
      if (
        count >= 4 &&
        (singleOutlets[key]?.size ?? 0) >= 2 &&
        !scored[key] &&
        !allPhraseKeys.some(p => p.includes(key)) &&
        !ANCHOR_LAST_NAMES.has(key)
      ) {
        scored[key] = count
      }
    }

    return Object.entries(scored)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key]) => displayForm[key] || key.charAt(0).toUpperCase() + key.slice(1))
  }, [topicsSource, COMMON_WORDS, PLACE_PREFIXES, MEDIA_ACRONYMS, BLOCKED_ANCHOR_PHRASES, ANCHOR_LAST_NAMES])

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
      <div className="container" style={{ maxWidth: 1240 }}>

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

          {/* Hint text — shown when not searching and no history dropdown */}
          {!search && !(searchFocused && searchHistory.length > 0) && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 10, paddingLeft: 2 }}>
              Searches every story across all outlets — not just headlines
            </p>
          )}
        </div>

        {/* Topic insight cards */}
        {topicInsights.length > 0 && (
          <div style={{ marginBottom: 14 }}>
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

        {/* Sort — Top stories / Latest. Category + region browsing lives on Explore. */}
        {!isSearchActive && (
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            {SORTS.map(s => (
              <button
                key={s.value}
                className={`pill${sort === s.value ? ' active' : ''}`}
                onClick={() => setSort(s.value)}
              >{s.label}</button>
            ))}
          </div>
        )}

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
                    : <span>{sort === 'latest' ? 'Latest stories' : (SORTS.find(s => s.value === sort)?.label || 'Top stories')}</span>
                }
              </div>
              {/* Density toggle */}
              <button
                onClick={toggleDensity}
                title={density === 'compact' ? 'Switch to comfortable view' : 'Switch to compact view'}
                aria-label="Toggle feed density"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--surface)', border: '0.5px solid var(--border)',
                  borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, color: 'var(--text2)', flexShrink: 0,
                }}
              >
                {density === 'compact' ? '☰ Compact' : '▤ Comfortable'}
              </button>
            </div>

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
            <div className={`feed${density === 'compact' ? ' feed-compact' : ''}${!isSearchActive && !activeTopic ? ' feed--home' : ''}`}>
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
                          <span style={{ fontSize: 13, fontWeight: 700, color: following ? 'var(--green-dark)' : 'var(--coral)', flexShrink: 0 }}>{following ? '✓' : '+'}</span>
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
                  <h3>No articles on "{activeTopic}" in the last 24h</h3>
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
                    relatedArticles={a.cluster_peers || []}
                    compact={density === 'compact'}
                  />
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
                    {displayList.length} article{displayList.length !== 1 ? 's' : ''} on {activeTopic} in the last 24h
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
          <Sidebar outlets={outlets} navigate={navigate} />
        </div>
      </div>

      {/* Legal modal */}
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  )
}
