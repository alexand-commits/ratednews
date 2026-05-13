import Head from 'next/head'
import { useAppContext } from './_app'
import MethodologyPage from '../src/pages/MethodologyPage'

export default function Methodology() {
  const { goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>Methodology — How RatedNews Scores the News</title>
        <meta name="description" content="How RatedNews uses AI to score news articles for credibility, bias, and headline fairness. Includes the full scoring prompt, weighting formula, known limitations, and changelog." />
        <link rel="canonical" href="https://www.ratednews.com/methodology" />
        <meta property="og:title"       content="Methodology — How RatedNews Scores the News" />
        <meta property="og:description" content="Full transparency on how RatedNews AI scoring works — including the exact prompt, weighting formula, and limitations." />
        <meta property="og:url"         content="https://www.ratednews.com/methodology" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Methodology — How RatedNews Scores the News" />
        <meta name="twitter:description" content="Full transparency on how RatedNews AI scoring works — including the exact prompt, weighting formula, and limitations." />
        <meta name="twitter:image"      content="https://www.ratednews.com/og-image.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: 'Methodology — How RatedNews Scores the News',
            description: 'Full transparency on how RatedNews AI scoring works — including the exact prompt, weighting formula, known limitations, and changelog.',
            url: 'https://www.ratednews.com/methodology',
            publisher: {
              '@type': 'Organization',
              name: 'RatedNews',
              url: 'https://www.ratednews.com',
            },
            about: [
              { '@type': 'Thing', name: 'News bias detection' },
              { '@type': 'Thing', name: 'AI journalism analysis' },
              { '@type': 'Thing', name: 'Media credibility scoring' },
            ],
          }) }}
        />
      </Head>
      <MethodologyPage goBack={goBack} />
    </>
  )
}
