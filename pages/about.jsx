import Head from 'next/head'
import { useAppContext } from './_app'
import AboutPage from '../src/pages/AboutPage'

export default function About() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>How It Works — RatedNews</title>
        <meta name="description" content="Learn how RatedNews uses AI to score news articles for accuracy, bias direction, and headline fairness across 50+ outlets — updated every hour." />
        <link rel="canonical" href="https://ratednews.com/about" />
      </Head>
      <AboutPage navigate={navigate} goBack={goBack} />
    </>
  )
}
