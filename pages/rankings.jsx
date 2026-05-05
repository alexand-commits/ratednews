import Head from 'next/head'
import { useAppContext } from './_app'
import RankingsPage from '../src/pages/RankingsPage'

export default function Rankings() {
  const { navigate, goBack, allOutlets, outletsLoading, showToast, user, refreshOutlets } = useAppContext()

  return (
    <>
      <Head>
        <title>News Outlet Bias & Accuracy Rankings — RatedNews</title>
        <meta name="description" content="Which news outlets are most accurate and least biased? RatedNews ranks 50+ UK, US and international outlets by accuracy score, political bias, and headline fairness — updated hourly." />
        <link rel="canonical" href="https://ratednews.com/rankings" />
        <meta property="og:title"       content="News Outlet Bias & Accuracy Rankings — RatedNews" />
        <meta property="og:description" content="Which news outlets are most accurate and least biased? RatedNews ranks 50+ outlets by accuracy, political bias, and headline fairness — updated hourly." />
        <meta property="og:url"         content="https://ratednews.com/rankings" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://ratednews.com/og-image.png" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="News Outlet Bias & Accuracy Rankings — RatedNews" />
        <meta name="twitter:description" content="Ranked by accuracy, political bias, and headline fairness across 50+ outlets." />
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
