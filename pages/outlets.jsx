import Head from 'next/head'
import { useAppContext } from './_app'
import OutletsListPage from '../src/pages/OutletsListPage'

export default function Outlets() {
  const { navigate, goBack, allOutlets, outletsLoading, showToast, user, openAuthModal, refreshOutlets } = useAppContext()

  return (
    <>
      <Head>
        <title>News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews</title>
        <meta name="description" content="Browse bias ratings and accuracy scores for 50+ major news outlets including BBC, CNN, Fox News, The Guardian and Wall Street Journal. See which outlets report fairly and which lean left or right." />
        <link rel="canonical" href="https://ratednews.com/outlets" />
        <meta property="og:title"       content="News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews" />
        <meta property="og:description" content="Browse bias ratings and accuracy scores for 50+ major news outlets. See which outlets report fairly and which lean left or right." />
        <meta property="og:url"         content="https://ratednews.com/outlets" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://ratednews.com/og-image.png" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="News Outlet Bias Ratings — RatedNews" />
        <meta name="twitter:description" content="Bias and accuracy scores for 50+ major news outlets — updated hourly." />
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
      />
    </>
  )
}
