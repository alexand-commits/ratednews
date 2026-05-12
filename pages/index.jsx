import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { db } from '../src/lib/supabase'
import FeedPage from '../src/pages/FeedPage'
import { useAppContext } from './_app'

const BATCH = 50

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
  const [trendingArticles, setTrendingArticles] = useState([])

  // Always fetch fresh articles on mount — ISR data can be up to 5 min stale.
  // If ISR returned data, show it immediately and silently swap in fresh results.
  // If ISR returned nothing (cold start), show loading spinner until data arrives.
  useEffect(() => {
    const hasCached = initialArticles.length > 0
    if (!hasCached) setLoading(true)

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    Promise.all([
      // Main paginated feed
      db.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }),
      // Dedicated 24h fetch for trending — complete, not paginated
      db.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false }),
    ]).then(([{ data }, { count }, { data: recent }]) => {
      setArticles(data || [])
      setTotalCount(count || 0)
      setOffset(BATCH)
      setHasMore((data || []).length === BATCH)
      setTrendingArticles(recent || [])
      if (!hasCached) setLoading(false)
    })
  }, [])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { data } = await db.from('articles')
      .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
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
        .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
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
        <meta name="description" content="AI-powered bias and accuracy ratings for 100+ news outlets including BBC, CNN, Fox News and The Guardian. Every article scored for accuracy, political bias, and headline fairness — updated hourly." />
        <link rel="canonical" href="https://www.ratednews.com/" />
        <meta property="og:title"       content="RatedNews — Trust the source, not just the story" />
        <meta property="og:description" content="AI-powered bias and accuracy ratings for 100+ news outlets. Updated hourly." />
        <meta property="og:url"         content="https://www.ratednews.com/" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="RatedNews — Trust the source, not just the story" />
        <meta name="twitter:description" content="AI-powered bias and accuracy ratings for 100+ news outlets. Every article scored for accuracy, political bias, and headline fairness — updated hourly." />
        <meta name="twitter:image"      content="https://www.ratednews.com/og-image.png" />
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
    const [{ data: articles }, { count }] = await Promise.all([
      supabase.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      supabase.from('articles').select('*', { count: 'exact', head: true }),
    ])
    return {
      props: { initialArticles: articles || [], initialCount: count || 0 },
      revalidate: 300, // regenerate every 5 minutes
    }
  } catch {
    return { props: { initialArticles: [], initialCount: 0 }, revalidate: 300 }
  }
}
