import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from './_app'
import SportsPage from '../src/pages/SportsPage'
import { detectSportType } from '../src/pages/SportsPage'

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

export default function Sports({ articles, generatedAt }) {
  const { navigate, goBack } = useAppContext()
  const router = useRouter()

  async function onRefresh() {
    await router.replace(router.asPath)
  }

  const itemListLd = articles && articles.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Sports News — Accuracy & Bias Rated | RatedNews',
    url: 'https://ratednews.com/sports',
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
        <title>Sports News — Accuracy &amp; Bias Rated | RatedNews</title>
        <meta name="description" content="Football, F1, rugby, tennis, cricket and golf — every story rated for accuracy and political bias. Cut through the spin in sports journalism." />
        <link rel="canonical" href="https://ratednews.com/sports" />
        <meta property="og:title"       content="Sports News — Accuracy & Bias Rated | RatedNews" />
        <meta property="og:description" content="Football, F1, rugby, tennis, cricket and golf — every story rated for accuracy and political bias." />
        <meta property="og:url"         content="https://ratednews.com/sports" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://ratednews.com/og-image.png" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Sports News — Accuracy & Bias Rated | RatedNews" />
        <meta name="twitter:description" content="Football, F1, rugby, tennis, cricket and golf — every story rated for accuracy and political bias." />
        {itemListLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/<\//g, '<\\/') }}
          />
        )}
      </Head>
      <SportsPage
        articles={articles}
        generatedAt={generatedAt}
        navigate={navigate}
        goBack={goBack}
        onRefresh={onRefresh}
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

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, published_at, accuracy_score, bias_direction, category, ai_summary, image_url, outlets(name, bias_direction, logo_url), comments(count)')
      .eq('category', 'sport')
      .gte('published_at', since7d)
      .order('published_at', { ascending: false })
      .limit(60)

    if (error) throw error

    const articles = (data || []).map(({ _sportType, ...rest }) => rest)

    return {
      props: {
        articles: articles || [],
        generatedAt: new Date().toISOString(),
      },
      revalidate: 300, // refresh every 5 minutes
    }
  } catch (err) {
    console.error('sports getStaticProps error:', err)
    return {
      props: {
        articles: [],
        generatedAt: new Date().toISOString(),
      },
      revalidate: 300,
    }
  }
}
