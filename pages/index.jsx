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

  const [articles,      setArticles]      = useState(initialArticles)
  const [totalCount,    setTotalCount]    = useState(initialCount)
  const [loading,       setLoading]       = useState(!initialArticles.length)
  const [offset,        setOffset]        = useState(initialArticles.length)
  const [hasMore,       setHasMore]       = useState(initialArticles.length === BATCH)
  const [loadingMore,   setLoadingMore]   = useState(false)

  // If SSR returned nothing (cold start), load client-side
  useEffect(() => {
    if (initialArticles.length) return
    setLoading(true)
    Promise.all([
      db.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }),
    ]).then(([{ data }, { count }]) => {
      setArticles(data || [])
      setTotalCount(count || 0)
      setOffset(BATCH)
      setHasMore((data || []).length === BATCH)
      setLoading(false)
    })
  }, [])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { data } = await db.from('articles')
      .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
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
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
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
        <title>RatedNews — Know the bias before you read the story</title>
        <meta name="description" content="AI-powered media bias and accuracy ratings for 50+ news outlets including BBC, CNN, Fox News and The Guardian. Every article scored hourly for accuracy, bias direction, and headline fairness." />
        <link rel="canonical" href="https://ratednews.com/" />
        <meta property="og:title"       content="RatedNews — Know the bias before you read the story" />
        <meta property="og:description" content="AI-powered media bias and accuracy ratings for 50+ news outlets. Updated hourly." />
        <meta property="og:url"         content="https://ratednews.com/" />
        <meta property="og:type"        content="website" />
      </Head>
      <FeedPage
        articles={articles}
        outlets={allOutlets}
        loading={loading}
        navigate={navigate}
        showToast={showToast}
        initialCategory={router.query.category || 'all'}
        initialRegion={router.query.region   || 'all'}
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
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      supabase.from('articles').select('*', { count: 'exact', head: true }),
    ])
    return {
      props: { initialArticles: articles || [], initialCount: count || 0 },
      revalidate: 300, // regenerate every 5 minutes
    }
  } catch {
    return { props: { initialArticles: [], initialCount: 0 }, revalidate: 60 }
  }
}
