import Head from 'next/head'
import { useAppContext } from './_app'
import OutletsListPage from '../src/pages/OutletsListPage'

export default function Outlets() {
  const { navigate, goBack, allOutlets, showToast, user, openAuthModal } = useAppContext()

  return (
    <>
      <Head>
        <title>News Outlet Bias Ratings — BBC, CNN, Fox News & More — RatedNews</title>
        <meta name="description" content="Browse bias ratings and accuracy scores for 50+ major news outlets including BBC, CNN, Fox News, The Guardian and Wall Street Journal. See which outlets report fairly and which lean left or right." />
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
