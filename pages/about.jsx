import Head from 'next/head'
import { useAppContext } from './_app'
import AboutPage from '../src/pages/AboutPage'

export default function About() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>How It Works — RatedNews</title>
        <meta name="description" content="Learn how RatedNews uses AI to score news articles for accuracy, bias direction, and headline fairness across 100+ outlets — updated every hour." />
        <link rel="canonical" href="https://www.ratednews.com/about" />
        <meta property="og:title"       content="How RatedNews Works — AI-Powered News Accuracy Ratings" />
        <meta property="og:description" content="Learn how RatedNews uses AI to score news articles for accuracy, bias direction, and headline fairness across 100+ outlets — updated every hour." />
        <meta property="og:url"         content="https://www.ratednews.com/about" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="How RatedNews Works" />
        <meta name="twitter:description" content="AI-powered accuracy and bias ratings for 50+ news outlets, updated every hour." />
      </Head>
      <AboutPage navigate={navigate} goBack={goBack} />
    </>
  )
}
