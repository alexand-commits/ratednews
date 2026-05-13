import Head from 'next/head'
import { useAppContext } from './_app'
import AboutPage from '../src/pages/AboutPage'

export default function About() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>How It Works — RatedNews</title>
        <meta name="description" content="Learn how RatedNews uses AI to score news articles for credibility, bias direction, and headline fairness across 100+ outlets — updated every hour." />
        <link rel="canonical" href="https://www.ratednews.com/about" />
        <meta property="og:title"       content="How RatedNews Works — AI-Powered News Credibility Ratings" />
        <meta property="og:description" content="Learn how RatedNews uses AI to score news articles for credibility, bias direction, and headline fairness across 100+ outlets — updated every hour." />
        <meta property="og:url"         content="https://www.ratednews.com/about" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="How RatedNews Works" />
        <meta name="twitter:description" content="AI-powered credibility and bias ratings for 100+ news outlets, updated every hour." />
        <meta name="twitter:image"      content="https://www.ratednews.com/og-image.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is RatedNews?',
                acceptedAnswer: { '@type': 'Answer', text: 'RatedNews is an AI-powered news rating platform that scores every article for credibility, political bias direction, and headline fairness across 100+ UK, US and international news outlets.' },
              },
              {
                '@type': 'Question',
                name: 'How does RatedNews score articles?',
                acceptedAnswer: { '@type': 'Answer', text: 'Each article is analysed by an AI model that scores three dimensions: credibility (0–100), bias direction (left/centre/right), and headline fairness. Scores are weighted — credibility counts for 60%, bias for 25%, and headline fairness for 15%.' },
              },
              {
                '@type': 'Question',
                name: 'How often are scores updated?',
                acceptedAnswer: { '@type': 'Answer', text: 'New articles are ingested and scored every 30 minutes. Outlet-level scores are recalculated as an aggregate of recent article scores.' },
              },
              {
                '@type': 'Question',
                name: 'Which news outlets does RatedNews cover?',
                acceptedAnswer: { '@type': 'Answer', text: 'RatedNews covers 100+ major news outlets including BBC, CNN, Fox News, The Guardian, The New York Times, Wall Street Journal, Daily Mail, Reuters, AP, and many more UK, US, and international sources.' },
              },
              {
                '@type': 'Question',
                name: 'Can I rate articles myself?',
                acceptedAnswer: { '@type': 'Answer', text: 'Yes. Registered users can submit their own credibility and bias ratings on any article, and leave comments. Community ratings are displayed alongside AI scores.' },
              },
            ],
          }) }}
        />
      </Head>
      <AboutPage navigate={navigate} goBack={goBack} />
    </>
  )
}
