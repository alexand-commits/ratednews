import Head from 'next/head'
import { useAppContext } from '../_app'
import PublicProfilePage from '../../src/pages/PublicProfilePage'

export async function getServerSideProps() { return { props: {} } }

export default function PublicProfile() {
  const { navigate, goBack, showToast } = useAppContext()

  return (
    <>
      <Head>
        <title>Profile — RatedNews</title>
        <meta name="robots" content="noindex" />
      </Head>
      <PublicProfilePage navigate={navigate} goBack={goBack} showToast={showToast} />
    </>
  )
}
