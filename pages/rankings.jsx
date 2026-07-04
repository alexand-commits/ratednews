import Head from 'next/head'
import { useAppContext } from './_app'
import RankingsPage from '../src/pages/RankingsPage'

function toOutletSlug(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function Rankings() {
  const { navigate, goBack, allOutlets, outletsLoading, showToast, user, refreshOutlets } = useAppContext()

  const scoredOutlets = (allOutlets || [])
    .filter(o => !o.parent_outlet_id)
    .filter(o => (o.accuracy_score || 0) > 0)
    .sort((a, b) => (b.accuracy_score || 0) - (a.accuracy_score || 0))

  const itemListLd = scoredOutlets.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    name:       'Most Accurate News Outlets — RatedNews',
    url:        'https://www.ratednews.com/rankings',
    numberOfItems: scoredOutlets.length,
    itemListElement: scoredOutlets.slice(0, 20).map((o, i) => ({
      '@type':    'ListItem',
      position:  i + 1,
      url:       `https://www.ratednews.com/outlet/${toOutletSlug(o.name)}`,
      name:      o.name,
    })),
  } : null

  return (
    <>
      <Head>
        <title>News Outlet Rankings — Community-Rated — RatedNews</title>
        <meta name="description" content="Which news outlets do readers trust most? RatedNews ranks 150+ UK, US and international outlets by community rating — real reader scores for accuracy, bias and quality." />
        <link rel="canonical" href="https://www.ratednews.com/rankings" />
        <meta property="og:title"       content="News Outlet Rankings — Community-Rated — RatedNews" />
        <meta property="og:description" content="Which news outlets do readers trust most? RatedNews ranks 150+ outlets by community rating." />
        <meta property="og:url"         content="https://www.ratednews.com/rankings" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="News Outlet Rankings — Community-Rated — RatedNews" />
        <meta name="twitter:description" content="150+ news outlets ranked by community rating — reader scores for accuracy, bias and quality." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        {itemListLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/<\//g, '<\\/') }}
          />
        )}
      </Head>
      <RankingsPage
        outlets={allOutlets}
        outletsLoading={outletsLoading}
        navigate={navigate}
        goBack={goBack}
        showToast={showToast}
        user={user}
        onRefresh={refreshOutlets}
      />
    </>
  )
}
