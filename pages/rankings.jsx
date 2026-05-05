import Head from 'next/head'
import { useAppContext } from './_app'
import RankingsPage from '../src/pages/RankingsPage'

export default function Rankings() {
  const { navigate, goBack, allOutlets, showToast, user, refreshOutlets } = useAppContext()

  return (
    <>
      <Head>
        <title>News Outlet Bias & Accuracy Rankings — RatedNews</title>
        <meta name="description" content="Which news outlets are most accurate and least biased? RatedNews ranks 50+ UK, US and international outlets by accuracy score, political bias, and headline fairness — updated hourly." />
        <link rel="canonical" href="https://ratednews.com/rankings" />
      </Head>
      <RankingsPage
        outlets={allOutlets}
        navigate={navigate}
        goBack={goBack}
        showToast={showToast}
        user={user}
        onRefresh={refreshOutlets}
      />
    </>
  )
}
