import Head from 'next/head'
import { useAppContext } from './_app'
import RankingsPage from '../src/pages/RankingsPage'

export default function Rankings() {
  const { navigate, goBack, allOutlets, showToast, user } = useAppContext()

  return (
    <>
      <Head>
        <title>Outlet Rankings — RatedNews</title>
        <meta name="description" content="See how news outlets rank for accuracy, bias, and headline fairness. AI-powered rankings updated hourly across 50+ UK, US, and international outlets." />
        <link rel="canonical" href="https://ratednews.com/rankings" />
      </Head>
      <RankingsPage
        outlets={allOutlets}
        navigate={navigate}
        goBack={goBack}
        showToast={showToast}
        user={user}
      />
    </>
  )
}
