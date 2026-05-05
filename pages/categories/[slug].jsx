import Head from 'next/head'
import { useState, useEffect } from 'react'
import { db } from '../../src/lib/supabase'
import FeedPage from '../../src/pages/FeedPage'
import { useAppContext } from '../_app'

const BATCH = 50

export const CATEGORY_META = [
  {
    value: 'Politics', slug: 'politics', emoji: '🏛',
    title: 'Political News Rated for Accuracy & Bias',
    description: 'Political news from the UK, US and beyond — every story rated for accuracy and bias by AI and community reviewers. Compare how outlets cover the same political events.',
  },
  {
    value: 'Business', slug: 'business', emoji: '📈',
    title: 'Business & Economy News Rated for Accuracy',
    description: 'Business, markets and economic news rated for factual accuracy — company results, inflation, interest rates and more across 50+ outlets.',
  },
  {
    value: 'Sport', slug: 'sport', emoji: '⚽',
    title: 'Sports News Rated for Accuracy & Fairness',
    description: 'Sports news from around the world, rated for accuracy and editorial fairness. Football, cricket, tennis, rugby and more — scored by AI and community reviewers.',
  },
  {
    value: 'Tech', slug: 'tech', emoji: '💻',
    title: 'Technology News Rated for Accuracy',
    description: 'Technology news rated for accuracy — AI, cybersecurity, startups, social media and innovation, compared across the outlets that cover them.',
  },
  {
    value: 'Science', slug: 'science', emoji: '🔬',
    title: 'Science News Rated for Factual Accuracy',
    description: 'Science and research news rated for factual accuracy — space, biology, climate science and discoveries, scored by AI across multiple outlets.',
  },
  {
    value: 'Health', slug: 'health', emoji: '🏥',
    title: 'Health & Medical News Rated for Accuracy',
    description: 'Health and medical news rated for factual accuracy — NHS coverage, clinical research, vaccines and public health, compared across 50+ outlets.',
  },
  {
    value: 'Environment', slug: 'environment', emoji: '🌱',
    title: 'Climate & Environment News Rated for Accuracy',
    description: 'Climate and environment news rated for accuracy — emissions, biodiversity, net zero policy and sustainability, compared across outlets with known bias ratings.',
  },
  {
    value: 'Entertainment', slug: 'entertainment', emoji: '🎬',
    title: 'Entertainment News Rated for Fairness',
    description: 'Entertainment news rated for accuracy and fairness — film, TV, music, celebrities and awards, scored across outlets so you can spot editorial spin.',
  },
  {
    value: 'Crime', slug: 'crime', emoji: '🔍',
    title: 'Crime & Justice News Rated for Accuracy',
    description: 'Crime and justice news rated for accuracy and fairness across UK and US outlets — court cases, policing and legal proceedings, compared side by side.',
  },
  {
    value: 'Travel', slug: 'travel', emoji: '✈️',
    title: 'Travel News Rated for Accuracy',
    description: 'Travel news and updates rated for accuracy — airline disruption, visa changes, destination news and tourism policy across multiple outlets.',
  },
  {
    value: 'Education', slug: 'education', emoji: '🎓',
    title: 'Education News Rated for Accuracy',
    description: 'Education news from schools, universities and policy — rated for factual accuracy across UK and US outlets covering tuition, exams and teaching.',
  },
  {
    value: 'War & Conflict', slug: 'war-conflict', emoji: '⚔️',
    title: 'War & Conflict News Rated for Accuracy',
    description: 'War and conflict coverage rated for accuracy and fairness — Gaza, Ukraine, and global conflicts compared across outlets to reveal differing narratives.',
  },
  {
    value: 'Culture', slug: 'culture', emoji: '🎨',
    title: 'Arts & Culture News Rated for Accuracy',
    description: 'Arts and culture news rated for accuracy and editorial fairness — museums, literature, fashion, architecture and heritage across leading outlets.',
  },
  {
    value: 'World', slug: 'world', emoji: '🌍',
    title: 'World News Rated for Accuracy & Bias',
    description: 'International news from around the world rated for accuracy and political bias — compare how different outlets frame the same global events.',
  },
]

export default function CategoryLanding({ slug, initialArticles, initialCount, categoryMeta }) {
  const { navigate, allOutlets, user, followedOutletIds, savedArticleIds,
          toggleSave, openAuthModal } = useAppContext()

  const [articles,    setArticles]    = useState(initialArticles)
  const [totalCount,  setTotalCount]  = useState(initialCount)
  const [loading,     setLoading]     = useState(!initialArticles.length)
  const [offset,      setOffset]      = useState(initialArticles.length)
  const [hasMore,     setHasMore]     = useState(initialArticles.length === BATCH)
  const [loadingMore, setLoadingMore] = useState(false)

  // Client-side fallback if SSR returned nothing
  useEffect(() => {
    if (initialArticles.length) return
    setLoading(true)
    Promise.all([
      db.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
        .eq('category', categoryMeta.value)
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }).eq('category', categoryMeta.value),
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
      .eq('category', categoryMeta.value)
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
        .eq('category', categoryMeta.value)
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }).eq('category', categoryMeta.value),
    ])
    setArticles(data || [])
    setTotalCount(count || 0)
    setOffset(BATCH)
    setHasMore((data || []).length === BATCH)
  }

  const canonical = `https://ratednews.com/categories/${slug}`
  const pageTitle = `${categoryMeta.emoji} ${categoryMeta.title} | RatedNews`

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={categoryMeta.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title"       content={categoryMeta.title + ' | RatedNews'} />
        <meta property="og:description" content={categoryMeta.description} />
        <meta property="og:url"         content={canonical} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://ratednews.com/og-image.png" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:image"      content="https://ratednews.com/og-image.png" />
      </Head>
      <FeedPage
        articles={articles}
        outlets={allOutlets}
        loading={loading}
        navigate={navigate}
        initialCategory={categoryMeta.value}
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

export async function getStaticPaths() {
  return {
    paths: CATEGORY_META.map(c => ({ params: { slug: c.slug } })),
    fallback: false,
  }
}

export async function getStaticProps({ params }) {
  const cat = CATEGORY_META.find(c => c.slug === params.slug)
  if (!cat) return { notFound: true }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )
    const [{ data: articles }, { count }] = await Promise.all([
      supabase.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
        .eq('category', cat.value)
        .order('published_at', { ascending: false })
        .range(0, BATCH - 1),
      supabase.from('articles').select('*', { count: 'exact', head: true }).eq('category', cat.value),
    ])
    return {
      props: {
        slug: cat.slug,
        initialArticles: articles || [],
        initialCount: count || 0,
        categoryMeta: { value: cat.value, emoji: cat.emoji, slug: cat.slug, title: cat.title, description: cat.description },
      },
      revalidate: 300,
    }
  } catch {
    return {
      props: {
        slug: cat.slug,
        initialArticles: [],
        initialCount: 0,
        categoryMeta: { value: cat.value, emoji: cat.emoji, slug: cat.slug, title: cat.title, description: cat.description },
      },
      revalidate: 60,
    }
  }
}
