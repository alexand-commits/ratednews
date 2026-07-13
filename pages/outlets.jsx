import Head from 'next/head'
import { useAppContext } from './_app'
import OutletsRankingsPage from '../src/pages/OutletsRankingsPage'

// SSR the outlet list so this head-term landing page ("News Outlet Bias
// Ratings") has real, crawlable content — not a client-fetched skeleton.
export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
    const { data } = await supabase
      .from('outlets')
      .select('id, name, country, overall_score, logo_url, type, community_score, total_ratings, article_count_30d, parent_outlet_id')
      .order('overall_score', { ascending: false })
    return { props: { initialOutlets: data || [] }, revalidate: 3600 }
  } catch {
    return { props: { initialOutlets: [] }, revalidate: 3600 }
  }
}

export default function Outlets({ initialOutlets = [] }) {
  const { navigate, goBack, allOutlets, outletsLoading, showToast, user, openAuthModal, refreshOutlets, followedOutletIds, toggleFollow } = useAppContext()
  // Prefer the live context list once it's loaded; fall back to SSR outlets so
  // crawlers and the first paint aren't empty.
  const outlets = allOutlets.length ? allOutlets : initialOutlets

  return (
    <>
      <Head>
        <title>News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews</title>
        <meta name="description" content="Browse community ratings for 200+ major news outlets including BBC, CNN, Fox News, The Guardian and Wall Street Journal. See which outlets readers trust most for accuracy, bias and quality." />
        <link rel="canonical" href="https://www.ratednews.com/outlets" />
        <meta property="og:title"       content="News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews" />
        <meta property="og:description" content="Browse community ratings for 200+ major news outlets — see which readers trust most." />
        <meta property="og:url"         content="https://www.ratednews.com/outlets" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="News Outlet Bias Ratings — RatedNews" />
        <meta name="twitter:description" content="Community ratings for 200+ major news outlets — updated continuously." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'News Outlet Bias & Quality Ratings — RatedNews',
            description: 'Browse community ratings for 200+ major news outlets including BBC, CNN, Fox News, The Guardian and Wall Street Journal.',
            url: 'https://www.ratednews.com/outlets',
            publisher: {
              '@type': 'Organization',
              name: 'RatedNews',
              url: 'https://www.ratednews.com',
            },
          }) }}
        />
      </Head>
      <OutletsRankingsPage
        outlets={outlets}
        outletsLoading={outletsLoading && !initialOutlets.length}
        navigate={navigate}
        goBack={goBack}
        showToast={showToast}
        user={user}
        onLoginClick={openAuthModal}
        onRefresh={refreshOutlets}
        followedOutletIds={followedOutletIds}
        toggleFollow={toggleFollow}
      />
    </>
  )
}
