import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { db } from '../src/lib/supabase'
import FeedPage from '../src/pages/FeedPage'
import { useAppContext } from './_app'
import { computeTrendingTopics } from '../src/utils/topics'

const BATCH = 50

// Minimal column list — only what the feed cards actually render. Add columns
// here explicitly rather than select('*') so future DB additions don't silently
// inflate egress. The old AI columns (accuracy_score, bias_score, bias_direction,
// headline_vote, article_type, ai_summary) were removed with AI scoring — dropping
// them from this SELECT cuts egress on every 50–150 row feed fetch.
const ARTICLE_SELECT = [
  'id', 'title', 'published_at', 'outlet_id',
  'category', 'geographic_scope', 'article_region',
  'summary', 'url', 'image_url',
  'total_ratings', 'community_score', 'cluster_id', 'cluster_peers',
  'outlets(name, country, logo_url)',
  'comment_count',
].join(', ')

export default function Feed({ initialArticles, initialCount, initialTopics = [] }) {
  const router  = useRouter()
  const { navigate, allOutlets, user, followedOutletIds, savedArticleIds,
          toggleSave, showToast, openAuthModal, toggleFollow } = useAppContext()

  const [articles,         setArticles]         = useState(initialArticles)
  const [totalCount,       setTotalCount]       = useState(initialCount)
  const [loading,          setLoading]          = useState(!initialArticles.length)
  const [offset,           setOffset]           = useState(initialArticles.length)
  const [hasMore,          setHasMore]          = useState(initialArticles.length === BATCH)
  const [loadingMore,      setLoadingMore]      = useState(false)
  const [fetchError,       setFetchError]       = useState(false)
  const [trendingTopicsSource, setTrendingTopicsSource] = useState([]) // title+outlet_id only — for topic computation

  useEffect(() => {
    const hasCached = initialArticles.length > 0
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Topics power the pill bar and aren't in the SSR payload, so this one light
    // query (title + outlet_id, ~100KB) is always needed.
    const fetchTopics = () =>
      db.from('articles')
        .select('title, outlet_id')
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(1000)
        .then(({ data }) => { if (data) setTrendingTopicsSource(data) })
        .catch(() => {})

    // WARM PATH — ISR already handed us a ranked, cluster-deduped, ≤15-min-old
    // feed (getStaticProps applies the same trend sort). Firing a heavy 90-row
    // refetch on every mount just to swap near-identical data was the load 'hang'
    // and pure egress. Render the SSR feed as-is and only pull the light topic
    // source, deferred to idle so it never competes with hydration. Freshness is
    // covered by FeedPage's 2-min new-articles banner + infinite scroll.
    // Fire immediately rather than waiting for idle. This is a light query
    // (title+outlet_id, ~590ms) feeding the trending bar, which sits above the
    // fold — parking it behind requestIdleCallback (up to a 2.5s wait) made the
    // bar visibly pop in late. It's async I/O, so it doesn't block paint or
    // hydration; the deferral was only ever needed for the heavy 90-row refetch
    // that this path no longer does.
    if (hasCached) {
      // getStaticProps now ships the topic pills with the HTML, so the bar is
      // instant and this per-visitor 1000-row query (measured 2.6s — the "bar
      // hangs") is skipped entirely. Only fetch if the server had none.
      if (!initialTopics.length) fetchTopics()
      return
    }

    // COLD PATH — SSR returned nothing (a failed regeneration). The client fetch
    // is now the only data source, so fetch feed + count + topics with a skeleton
    // and a 12s timeout so we surface an error rather than spinning forever.
    setLoading(true)
    const timeout = setTimeout(() => {
      setLoading(false)
      setFetchError(true)
    }, 12000)

    Promise.all([
      db.from('articles')
        .select(ARTICLE_SELECT)
        .order('published_at', { ascending: false })
        .range(0, BATCH + 40 - 1),
      db.from('articles').select('*', { count: 'estimated', head: true }),
      db.from('articles')
        .select('title, outlet_id')
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(1000),
    ]).then(([{ data }, { count }, { data: topicsSrc }]) => {
      clearTimeout(timeout)
      setFetchError(false)
      setArticles(data || [])
      setTotalCount(count || 0)
      setOffset(BATCH + 40)
      setHasMore((data || []).length === BATCH + 40)
      setTrendingTopicsSource(topicsSrc || [])
      setLoading(false)
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
      setFetchError(true)
    })
  }, [])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { data } = await db.from('articles')
      .select(ARTICLE_SELECT)
      .order('published_at', { ascending: false })
      .range(offset, offset + BATCH - 1)
    if (data?.length) {
      // Ingest runs every 15 min, shifting offsets — filter out ids already
      // shown so a new article arriving mid-scroll can't duplicate a card.
      setArticles(prev => {
        const seen = new Set(prev.map(a => a.id))
        return [...prev, ...data.filter(a => !seen.has(a.id))]
      })
      setOffset(o => o + BATCH)
      setHasMore(data.length === BATCH)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  async function refresh() {
    const [{ data }, { count }] = await Promise.all([
      db.from('articles')
        .select(ARTICLE_SELECT)
        .order('published_at', { ascending: false })
        .range(0, BATCH + 40 - 1),
      db.from('articles').select('*', { count: 'estimated', head: true }),
    ])
    setArticles(data || [])
    setTotalCount(count || 0)
    setOffset(BATCH + 40)
    setHasMore((data || []).length === BATCH + 40)
  }

  return (
    <>
      <Head>
        <title>RatedNews — Rate the source</title>
        <meta name="description" content="A community-rated news aggregator pulling top stories from 200+ outlets including BBC, CNN, Fox News and The Guardian. Readers rate every article and outlet for accuracy, bias and quality — updated continuously." />
        <link rel="canonical" href="https://www.ratednews.com/" />
        <meta property="og:title"       content="RatedNews — Rate the source" />
        <meta property="og:description" content="Community-rated news from 200+ outlets. Readers rate accuracy, bias and quality — updated continuously." />
        <meta property="og:url"         content="https://www.ratednews.com/" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="RatedNews — Rate the source" />
        <meta name="twitter:description" content="Community-rated news from 200+ outlets. Readers rate accuracy, bias and quality — updated continuously." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'RatedNews',
            url: 'https://www.ratednews.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://www.ratednews.com/?topic={search_term_string}',
              },
              'query-input': 'required name=search_term_string',
            },
          }) }}
        />
      </Head>
      <FeedPage
        articles={articles}
        trendingTopicsSource={trendingTopicsSource}
        initialTopics={initialTopics}
        outlets={allOutlets}
        loading={loading}
        navigate={navigate}
        showToast={showToast}
        initialCategory={router.query.category || 'all'}
        initialRegion={router.query.region   || 'all'}
        initialTopic={router.query.topic     || null}
        initialTab={router.query.tab         || 'all'}
        totalArticleCount={totalCount}
        user={user}
        followedOutletIds={followedOutletIds}
        toggleFollow={toggleFollow}
        onLoginClick={openAuthModal}
        loadMoreArticles={loadMore}
        hasMoreArticles={hasMore}
        loadingMore={loadingMore}
        savedArticleIds={savedArticleIds}
        toggleSave={toggleSave}
        onRefresh={refresh}
        fetchError={fetchError}
      />
    </>
  )
}

export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )
    const SSR_SELECT = ARTICLE_SELECT // same minimal columns at build time
    // Over-fetch a recent pool, then rank it by the SAME "Top stories" trend
    // score the client uses (cross-outlet coverage + comments + recency decay),
    // collapse clusters to one row each, and take the top BATCH. This makes the
    // server-rendered first paint already match the client's default sort — no
    // flash of latest-order before hydration. Done in Node; no schema change.
    // Topic pills used to be computed in the browser from a 1000-row fetch on
    // EVERY visit — measured at 2.6s, so the bar visibly hung. It only changes
    // as fast as ingest does, so compute it here instead: once per ISR regen
    // (15 min) rather than once per visitor, and the bar ships with the HTML.
    const topicCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: raw }, { count }, { data: topicRows }] = await Promise.all([
      supabase.from('articles')
        .select(SSR_SELECT)
        .order('published_at', { ascending: false })
        .range(0, BATCH + 40 - 1),
      supabase.from('articles').select('*', { count: 'estimated', head: true }),
      supabase.from('articles')
        .select('title, outlet_id')
        .gte('published_at', topicCutoff)
        .order('published_at', { ascending: false })
        .limit(1000),
    ])

    // Mirrors FeedPage's topicInsights: count each topic across the sample,
    // drop one-offs, strongest first, cap at 5.
    let initialTopics = []
    try {
      const src = topicRows || []
      initialTopics = computeTrendingTopics(src)
        .slice(0, 8)
        .map(topic => {
          const key = topic.toLowerCase()
          return { topic, count: src.filter(a => (a.title || '').toLowerCase().includes(key)).length }
        })
        .filter(t => t.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    } catch { initialTopics = [] }
    // Keep this formula in sync with the 'trending' sort in src/pages/FeedPage.jsx
    const now = Date.now()
    const trendScore = a => {
      const coverage = a.cluster_peers?.length || 0
      const comments = a.comment_count || 0
      const hoursAgo = Math.max(0.1, (now - new Date(a.published_at)) / 3600000)
      return (coverage * 12 + comments * 5 + 1) / Math.pow(hoursAgo + 2, 1.8)
    }
    const seen = new Set()
    const articles = (raw || [])
      .slice()
      .sort((x, y) => trendScore(y) - trendScore(x))
      .filter(a => {
        if (!a.cluster_id) return true
        if (seen.has(a.cluster_id)) return false
        seen.add(a.cluster_id)
        return true
      })
      .slice(0, BATCH)
    return {
      props: { initialArticles: articles, initialCount: count || 0, initialTopics },
      revalidate: 900, // regenerate every 15 minutes — matches ingest cadence
    }
  } catch {
    // Retry fast on failure — an empty homepage forces every visitor down the
    // cold client-fetch path (skeleton hang), so don't let a transient DB blip
    // cache an empty feed for long. 120s, not 1800s.
    return { props: { initialArticles: [], initialCount: 0, initialTopics: [] }, revalidate: 120 }
  }
}
