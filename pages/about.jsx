import Head from 'next/head'
import { useAppContext } from './_app'
import AboutPage from '../src/pages/AboutPage'

export default function About() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>How It Works — RatedNews</title>
        <meta name="description" content="How RatedNews works: a community-rated news aggregator pulling top stories from 150+ outlets, where readers rate the news outlets they trust for accuracy, bias and quality." />
        <link rel="canonical" href="https://www.ratednews.com/about" />
        <meta property="og:title"       content="How RatedNews Works — Community-Rated News" />
        <meta property="og:description" content="A community-rated news aggregator pulling top stories from 150+ outlets, where readers rate the news outlets they trust for accuracy, bias and quality." />
        <meta property="og:url"         content="https://www.ratednews.com/about" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="How RatedNews Works" />
        <meta name="twitter:description" content="Community-rated news from 150+ outlets — readers rate accuracy, bias and quality." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is RatedNews?',
                acceptedAnswer: { '@type': 'Answer', text: 'RatedNews is a community-rated news aggregator that pulls top stories from 150+ UK, US and international news outlets and lets readers rate the news outlets they trust for accuracy, bias and quality.' },
              },
              {
                '@type': 'Question',
                name: 'How are outlets scored?',
                acceptedAnswer: { '@type': 'Answer', text: 'Every score on RatedNews comes from the community. Readers give outlets a 1–5 star rating, and an outlet\'s community score is the average of those ratings expressed out of 100. The number of ratings is always shown so you can judge the sample size. There is no AI scoring.' },
              },
              {
                '@type': 'Question',
                name: 'How often is the feed updated?',
                acceptedAnswer: { '@type': 'Answer', text: 'New articles are pulled from outlet RSS feeds continuously, roughly every 15 minutes, so the feed stays current throughout the day.' },
              },
              {
                '@type': 'Question',
                name: 'Which news outlets does RatedNews cover?',
                acceptedAnswer: { '@type': 'Answer', text: 'RatedNews aggregates 150+ major news outlets including BBC, CNN, Fox News, The Guardian, The New York Times, Wall Street Journal, Daily Mail, Reuters, AP, and many more UK, US, and international sources.' },
              },
              {
                '@type': 'Question',
                name: 'Can I rate the outlets myself?',
                acceptedAnswer: { '@type': 'Answer', text: 'Yes. Registered users rate news outlets with a 1–5 trust rating. These community ratings are what drive every score on the site — no AI, no algorithms.' },
              },
            ],
          }) }}
        />
      </Head>
      <AboutPage navigate={navigate} goBack={goBack} />
    </>
  )
}
