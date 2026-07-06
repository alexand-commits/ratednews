import Head from 'next/head'
import { useState, useEffect } from 'react'
import { db } from '../../src/lib/supabase'
import FeedPage from '../../src/pages/FeedPage'
import { useAppContext } from '../_app'
import { articleSlug } from '../../src/utils/helpers'

const BATCH = 50

const ARTICLE_SELECT = [
  'id', 'title', 'published_at', 'outlet_id',
  'accuracy_score', 'bias_score', 'bias_direction', 'headline_vote',
  'category', 'geographic_scope', 'article_region',
  'ai_summary', 'summary', 'url', 'image_url',
  'total_ratings', 'community_score', 'cluster_peers',
  'outlets(name, country, bias_direction, logo_url, accuracy_score)',
  'comments(count)',
].join(', ')

export const CATEGORY_META = [
  {
    value: 'Politics', slug: 'politics', emoji: '🏛',
    title: 'Political News Rated for Quality & Bias',
    description: 'Political news from the UK, US and beyond — every story rated by the community for accuracy, bias and quality. Compare how outlets cover the same political events.',
  },
  {
    value: 'Business', slug: 'business', emoji: '📈',
    title: 'Business & Economy News Rated for Quality',
    description: 'Business, markets and economic news rated by the community — company results, inflation, interest rates and more across 50+ outlets.',
  },
  {
    value: 'Sport', slug: 'sport', emoji: '⚽',
    title: 'Sports News Rated for Quality & Fairness',
    description: 'Sports news from around the world, rated for quality and editorial fairness. Football, cricket, tennis, rugby and more — rated by the community.',
  },
  {
    value: 'Tech', slug: 'tech', emoji: '💻',
    title: 'Technology News Rated for Quality',
    description: 'Technology news rated by the community — AI, cybersecurity, startups, social media and innovation, compared across the outlets that cover them.',
  },
  {
    value: 'Science', slug: 'science', emoji: '🔬',
    title: 'Science News Rated for Quality',
    description: 'Science and research news rated by the community — space, biology, climate science and discoveries, rated by the community across outlets.',
  },
  {
    value: 'Health', slug: 'health', emoji: '🏥',
    title: 'Health & Medical News Rated for Quality',
    description: 'Health and medical news rated by the community — clinical research, vaccines, public health and healthcare policy, compared across 200+ community-rated outlets.',
  },
  {
    value: 'Environment', slug: 'environment', emoji: '🌱',
    title: 'Climate & Environment News Rated for Quality',
    description: 'Climate and environment news rated by the community — emissions, biodiversity, net zero policy and sustainability, compared across 200+ community-rated outlets.',
  },
  {
    value: 'Entertainment', slug: 'entertainment', emoji: '🎬',
    title: 'Entertainment News Rated for Fairness',
    description: 'Entertainment news rated by the community for accuracy and fairness — film, TV, music, celebrities and awards, compared across outlets so you can spot editorial spin.',
  },
  {
    value: 'Culture', slug: 'culture', emoji: '🎭',
    title: 'Culture & Arts News Rated for Quality',
    description: 'Arts and culture news rated by the community — books, film, art, theatre, fashion and heritage, compared across 200+ community-rated outlets.',
  },
  {
    value: 'Crime', slug: 'crime', emoji: '🔍',
    title: 'Crime & Justice News Rated for Quality',
    description: 'Crime and justice news rated by the community across UK and US outlets — court cases, policing and legal proceedings, compared side by side.',
  },
  {
    value: 'Travel', slug: 'travel', emoji: '✈️',
    title: 'Travel News Rated for Quality',
    description: 'Travel news and updates rated by the community — airline disruption, visa changes, destination news and tourism policy across multiple outlets.',
  },
  {
    value: 'Education', slug: 'education', emoji: '🎓',
    title: 'Education News Rated for Quality',
    description: 'Education news from schools, universities and policy — rated for quality across UK and US outlets covering tuition, exams and teaching.',
  },
  {
    value: 'Conflict', slug: 'conflict', emoji: '⚔️',
    title: 'Conflict News Rated for Quality',
    description: 'War and conflict coverage rated by the community for accuracy and fairness — Gaza, Ukraine, and global conflicts compared across outlets to reveal differing narratives.',
  },
  {
    value: 'World', slug: 'world', emoji: '🌍',
    title: 'World News Rated for Quality & Bias',
    description: 'International news from around the world rated by the community for accuracy and bias — compare how different outlets frame the same global events.',
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
        .select(ARTICLE_SELECT)
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
      .select(ARTICLE_SELECT)
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
        .select(ARTICLE_SELECT)
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

  const canonical = `https://www.ratednews.com/categories/${slug}`
  const pageTitle = `${categoryMeta.title} | RatedNews`

  // BreadcrumbList schema — Home > Categories > [Category]
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://www.ratednews.com' },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: 'https://www.ratednews.com/categories' },
      { '@type': 'ListItem', position: 3, name: categoryMeta.title, item: canonical },
    ],
  }

  // ItemList schema — helps Google surface category pages in Search with article links
  const itemListLd = articles.length ? {
    '@context':     'https://schema.org',
    '@type':        'ItemList',
    name:           categoryMeta.title,
    description:    categoryMeta.description,
    url:            canonical,
    numberOfItems:  totalCount,
    itemListElement: articles.slice(0, 10).map((a, i) => ({
      '@type':    'ListItem',
      position:   i + 1,
      url:        `https://www.ratednews.com/article/${articleSlug(a.title, a.id)}`,
      name:       a.title,
    })),
  } : null

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
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content={categoryMeta.title + ' | RatedNews'} />
        <meta name="twitter:description" content={categoryMeta.description} />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/<\//g, '<\\/') }}
        />
        {itemListLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/<\//g, '<\\/') }}
          />
        )}
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
        .select(ARTICLE_SELECT)
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
      revalidate: 1800,
    }
  } catch {
    return {
      props: {
        slug: cat.slug,
        initialArticles: [],
        initialCount: 0,
        categoryMeta: { value: cat.value, emoji: cat.emoji, slug: cat.slug, title: cat.title, description: cat.description },
      },
      revalidate: 1800,
    }
  }
}
