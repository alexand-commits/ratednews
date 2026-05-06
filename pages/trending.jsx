import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from './_app'
import TrendingPage from '../src/pages/TrendingPage'

export default function Trending({ articles, generatedAt }) {
  const { navigate, goBack } = useAppContext()
  const router = useRouter()

  async function onRefresh() {
    await router.replace(router.asPath)
  }

  const itemListLd = articles && articles.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trending News — RatedNews',
    url: 'https://ratednews.com/trending',
    numberOfItems: Math.min(articles.length, 10),
    itemListElement: articles.slice(0, 10).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://ratednews.com/article/${articleSlug(a.title, a.id)}`,
      name: a.title,
    })),
  } : null

  return (
    <>
      <Head>
        <title>Trending News — Accuracy &amp; Bias Rated | RatedNews</title>
        <meta name="description" content="The most discussed news stories right now, ranked by reader activity. Every article rated for accuracy and political bias." />
        <link rel="canonical" href="https://ratednews.com/trending" />
        <meta property="og:title"       content="Trending News — Accuracy & Bias Rated | RatedNews" />
        <meta property="og:description" content="The most discussed news stories right now, ranked by reader activity. Every article rated for accuracy and political bias." />
        <meta property="og:url"         content="https://ratednews.com/trending" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://ratednews.com/og-image.png" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Trending News — Accuracy & Bias Rated | RatedNews" />
        <meta name="twitter:description" content="The most discussed news stories right now, ranked by reader activity. Every article rated for accuracy and political bias." />
        {itemListLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/<\//g, '<\\/') }}
          />
        )}
      </Head>
      <TrendingPage
        articles={articles}
        generatedAt={generatedAt}
        navigate={navigate}
        goBack={goBack}
        onRefresh={onRefresh}
      />
    </>
  )
}

function articleSlug(title, id) {
  const t = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
  const shortId = String(id).slice(0, 8)
  return t ? `${t}-${shortId}` : shortId
}

export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, published_at, accuracy_score, bias_direction, category, ai_summary, image_url, view_count, outlets(name, bias_direction, logo_url), comments(count)')
      .gte('published_at', since24h)
      .order('published_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const scored = (data || []).map(a => {
      const hoursAgo  = (Date.now() - new Date(a.published_at)) / 3600000
      const views     = a.view_count || 0
      const comments  = a.comments?.[0]?.count || 0
      // Views are the primary signal; comments carry more weight per-unit as they signal deeper engagement
      const trendScore = views * 1 + comments * 10 + Math.max(0, 24 - hoursAgo)
      return { ...a, _trendScore: trendScore }
    })

    scored.sort((a, b) => b._trendScore - a._trendScore)

    const articles = scored.slice(0, 20).map(({ _trendScore, ...rest }) => rest)

    return {
      props: {
        articles,
        generatedAt: new Date().toISOString(),
      },
      revalidate: 1800,
    }
  } catch (err) {
    console.error('trending getStaticProps error:', err)
    return {
      props: {
        articles: [],
        generatedAt: new Date().toISOString(),
      },
      revalidate: 1800,
    }
  }
}
