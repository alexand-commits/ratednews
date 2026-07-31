import Head from 'next/head'
import { useAppContext } from './_app'
import CategoryPage from '../src/pages/CategoryPage'
import { CATEGORIES, fetchCategoryOverview } from '../src/utils/categoryOverview'

export default function Categories({ initial }) {
  const { navigate, goBack, allOutlets } = useAppContext()

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'News Categories on RatedNews',
    itemListElement: CATEGORIES.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      url: `https://www.ratednews.com/categories/${c.slug}`,
    })),
  }

  return (
    <>
      <Head>
        <title>Rated News by Topic — Politics, Business, Tech & More — RatedNews</title>
        <meta name="description" content="Browse this week's news by topic — Politics, Business, Tech, Health, Sport, Environment and more. Live story counts from 250+ outlets, each rated by readers for trustworthiness." />
        <link rel="canonical" href="https://www.ratednews.com/categories" />
        <meta property="og:title"       content="Rated News by Topic — Politics, Business, Tech & More" />
        <meta property="og:description" content="Browse this week's news by topic — live story counts from 250+ outlets, rated by readers." />
        <meta property="og:url"         content="https://www.ratednews.com/categories" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Rated News by Topic — RatedNews" />
        <meta name="twitter:description" content="Browse Politics, Business, Tech, Health, Sport and more — this week's stories from 250+ outlets, rated by readers." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      </Head>
      <CategoryPage navigate={navigate} goBack={goBack} outlets={allOutlets} initial={initial} />
    </>
  )
}

// ISR: crawlers (and first paint) get real category counts instead of a
// client-side "Loading…" — this page is a footer-linked SEO surface.
export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )
    const initial = await fetchCategoryOverview(supabase, 'all')
    return { props: { initial }, revalidate: 600 }
  } catch {
    return { props: { initial: null }, revalidate: 120 }
  }
}
