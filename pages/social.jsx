import Head from 'next/head'
import { useAppContext } from './_app'
import SocialPage from '../src/pages/SocialPage'

export async function getServerSideProps() { return { props: {} } }

export default function Social() {
  const { navigate, goBack, user } = useAppContext()
  return (
    <>
      <Head>
        <title>Social content desk — RatedNews</title>
        <meta name="robots" content="noindex" />
      </Head>
      <SocialPage user={user} navigate={navigate} goBack={goBack} />
    </>
  )
}
