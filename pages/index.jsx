import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { db } from '../src/lib/supabase'
import FeedPage from '../src/pages/FeedPage'
import { useAppContext } from './_app'

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
  'total_ratings', 'community_score', 'cluster_peers',
  'outlets(name, country, logo_url)',
  'comments(count)',
].join(', ')

export default function Feed({ initialArticles, initialCount }) {
  const router  = useRouter()
  const { navigate, allOutlets, user, followedOutletIds, savedArticleIds,
          toggleSave, showToast, openAuthModal } = useAppContext()

  const [articles,         setArticles]         = useState(initialArticles)
  const [totalCount,       setTotalCount]       = useState(initialCount)
  const [loading,          setLoading]          = useState(!initialArticles.length)
  const [offset,           setOffset]           = useState(initialArticles.length)
  const [hasMore,          setHasMore]          = useState(initialArticles.length === BATCH)
  const [loadingMore,      setLoadingMore]      = useState(false)
  const [fetchError,       setFetchError]       = useState(false)
  const [trendingArticles,     setTrendingArticles]     = useState([]) // full data — for card rendering under topics
  const [trendingTopicsSource, setTrendingTopicsSource] = useState([]) // title+outlet_id only — for topic computation

  // Always fetch fresh articles on mount — ISR data can be up to 5 min stale.
  // If ISR returned data, show it immediately and silently swap in fresh results.
  // If ISR returned nothing (cold start), show loading spinner until data arrives.
  useEffect(() => {
    const hasCached = initialArticles.length > 0
    if (!hasCached) setLoading(true)

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // 12s timeout — if Supabase doesn't respond, surface the error rather than
    // spinning skeletons indefinitely.
    const timeout = setTimeout(() => {
      setLoading(false)
      setFetchError(true)
    }, 12000)

    Promise.all([
      // Main paginated feed — newest articles across all outlets
      db.from('articles')
        .select(ARTICLE_SELECT)
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }),
      // Full-data 24h articles for card rendering when a trending topic is active.
      // 150 rows with all display columns — enough to fill any topic's article list.
      db.from('articles')
        .select(ARTICLE_SELECT)
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(150),
      // Minimal 24h fetch for trending topic computation only.
      // title + outlet_id is ~100 bytes/row, so 1000 rows ≈ 100KB — negligible egress.
      // A higher ceiling means topics that spiked earlier in the day still surface.
      db.from('articles')
        .select('title, outlet_id')
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(1000),
    ]).then(([{ data }, { count }, { data: recent }, { data: topicsSrc }]) => {
      clearTimeout(timeout)
      setFetchError(false)
      setArticles(data || [])
      setTotalCount(count || 0)
      setOffset(BATCH)
      setHasMore((data || []).length === BATCH)
      setTrendingArticles(recent || [])
      setTrendingTopicsSource(topicsSrc || [])
      if (!hasCached) setLoading(false)
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
      setArticles(prev => [...prev, ...data])
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
        .range(0, BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }),
    ])
    setArticles(data || [])
    setTotalCount(count || 0)
    setOffset(BATCH)
    setHasMore((data || []).length === BATCH)
  }

  return (
    <>
      <Head>
        <title>RatedNews — Trust the source, not just the story</title>
        <meta name="description" content="A community-rated news aggregator pulling top stories from 150+ outlets including BBC, CNN, Fox News and The Guardian. Readers rate every article and outlet for accuracy, bias and quality — updated continuously." />
        <link rel="canonical" href="https://www.ratednews.com/" />
        <meta property="og:title"       content="RatedNews — Trust the source, not just the story" />
        <meta property="og:description" content="Community-rated news from 150+ outlets. Readers rate accuracy, bias and quality — updated continuously." />
        <meta property="og:url"         content="https://www.ratednews.com/" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="RatedNews — Trust the source, not just the story" />
        <meta name="twitter:description" content="Community-rated news from 150+ outlets. Readers rate accuracy, bias and quality — updated continuously." />
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
        trendingArticles={trendingArticles}
        trendingTopicsSource={trendingTopicsSource}
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
    const [{ data: articles }, { count }] = await Promise.all([
      supabase.from('articles')
        .select(SSR_SELECT)
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      supabase.from('articles').select('*', { count: 'exact', head: true }),
    ])
    return {
      props: { initialArticles: articles || [], initialCount: count || 0 },
      revalidate: 900, // regenerate every 15 minutes — matches ingest cadence
    }
  } catch {
    return { props: { initialArticles: [], initialCount: 0 }, revalidate: 1800 }
  }
}
