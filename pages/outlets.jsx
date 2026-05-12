import Head from 'next/head'
import { useAppContext } from './_app'
import OutletsListPage from '../src/pages/OutletsListPage'

export default function Outlets() {
  const { navigate, goBack, allOutlets, outletsLoading, showToast, user, openAuthModal, refreshOutlets, followedOutletIds, toggleFollow } = useAppContext()

  return (
    <>
      <Head>
        <title>News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews</title>
        <meta name="description" content="Browse bias ratings and accuracy scores for 100+ major news outlets including BBC, CNN, Fox News, The Guardian and Wall Street Journal. See which outlets report fairly and which lean left or right." />
        <link rel="canonical" href="https://www.ratednews.com/outlets" />
        <meta property="og:title"       content="News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews" />
        <meta property="og:description" content="Browse bias ratings and accuracy scores for 100+ major news outlets. See which outlets report fairly and which lean left or right." />
        <meta property="og:url"         content="https://www.ratednews.com/outlets" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="News Outlet Bias Ratings — RatedNews" />
        <meta name="twitter:description" content="Bias and accuracy scores for 100+ major news outlets — updated hourly." />
        <meta name="twitter:image"      content="https://www.ratednews.com/og-image.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'News Outlet Bias & Accuracy Ratings — RatedNews',
            description: 'Browse bias ratings and accuracy scores for 100+ major news outlets including BBC, CNN, Fox News, The Guardian and Wall Street Journal.',
            url: 'https://www.ratednews.com/outlets',
            publisher: {
              '@type': 'Organization',
              name: 'RatedNews',
              url: 'https://www.ratednews.com',
            },
          }) }}
        />
      </Head>
      <OutletsListPage
        outlets={allOutlets}
        outletsLoading={outletsLoading}
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
