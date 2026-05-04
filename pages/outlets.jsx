import Head from 'next/head'
import { useAppContext } from './_app'
import OutletsListPage from '../src/pages/OutletsListPage'

export default function Outlets() {
  const { navigate, goBack, allOutlets, showToast, user, openAuthModal } = useAppContext()

  return (
    <>
      <Head>
        <title>News Outlets — RatedNews</title>
        <meta name="description" content="Browse all tracked news outlets on RatedNews. See AI-powered bias ratings, accuracy scores, and headline fairness for 50+ outlets including BBC, CNN, Fox News and more." />
        <link rel="canonical" href="https://ratednews.com/outlets" />
      </Head>
      <OutletsListPage
        outlets={allOutlets}
        navigate={navigate}
        goBack={goBack}
        showToast={showToast}
        user={user}
        onLoginClick={openAuthModal}
      />
    </>
  )
}
