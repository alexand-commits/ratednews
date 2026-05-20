import Head from 'next/head'
import { useAppContext } from './_app'
import SocialAgentPage from '../src/pages/SocialAgentPage'

export async function getServerSideProps() { return { props: {} } }

export default function SocialAgent() {
  const { navigate, goBack } = useAppContext()
  return (
    <>
      <Head>
        <title>Social Agent — RatedNews</title>
        <meta name="robots" content="noindex" />
      </Head>
      <SocialAgentPage navigate={navigate} goBack={goBack} />
    </>
  )
}
