import React, { useState, useEffect, useRef } from 'react'
import NewsCard from '../components/NewsCard'
import Sidebar from '../components/Sidebar'
import { timeAgo } from '../utils/helpers'
import { db } from '../lib/supabase'

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
  { value: 'War & Conflict', label: '⚔️ War & Conflict'   },
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
  savedArticleIds = new Set(), toggleSave,
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

  // Infinite scroll sentinel
  const sentinelRef = useRef(null)

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

  const filtered = (feedTab === 'following' ? followingArticles : articles)
    .filter(a => category === 'all' || getArticleCategory(a) === category)
    .filter(a => region === 'all' || getArticleRegion(a) === region)
    .slice()
    .sort((a, b) => {
      if (sort === 'trending')  return (b.comments?.[0]?.count || 0) - (a.comments?.[0]?.count || 0)
      if (sort === 'top-rated') return (b.accuracy_score || 0) - (a.accuracy_score || 0)
      return new Date(b.published_at) - new Date(a.published_at)
    })

  // Which list to display — DB results when search active, filtered otherwise
  const isSearchActive = dbResults !== null
  const displayList    = isSearchActive ? dbResults : filtered

  return (
    <div className="page-content">
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
                <strong>{totalArticleCount ?? (articles.length || '—')}</strong>
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
            type="text"
            placeholder="Search all stories..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
                [0, 1, 2].map(i => <div key={i} className="skeleton skeleton-card" />)
              ) : displayList.length === 0 && feedTab === 'following' && followedOutletIds.size === 0 ? (
                <div className="empty-state">
                  <h3>You're not following anyone yet</h3>
                  <p>Follow outlets you trust to build your personal feed.</p>
                  <button className="btn-outline" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate('outlets')}>
                    Browse outlets →
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
                    onClick={() => navigate('article', { articleId: a.id })}
                    navigate={navigate}
                  />
                ))
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
