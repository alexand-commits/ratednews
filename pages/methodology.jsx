import Head from 'next/head'
import { useAppContext } from './_app'
import MethodologyPage from '../src/pages/MethodologyPage'

export default function Methodology() {
  const { goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>Methodology — How RatedNews Works</title>
        <meta name="description" content="How RatedNews works: a community-rated news aggregator. Where the news comes from, how community ratings and outlet scores are calculated, known limitations, and changelog." />
        <link rel="canonical" href="https://www.ratednews.com/methodology" />
        <meta property="og:title"       content="Methodology — How RatedNews Works" />
        <meta property="og:description" content="Full transparency on how RatedNews works — where the news comes from, how community ratings and scores are calculated, and known limitations." />
        <meta property="og:url"         content="https://www.ratednews.com/methodology" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Methodology — How RatedNews Works" />
        <meta name="twitter:description" content="How RatedNews works — where the news comes from and how community ratings and scores are calculated." />
        <meta name="twitter:image"      content="https://www.ratednews.com/og-image.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: 'Methodology — How RatedNews Works',
            description: 'Full transparency on how RatedNews works — where the news comes from, how community ratings and outlet scores are calculated, known limitations, and changelog.',
            url: 'https://www.ratednews.com/methodology',
            publisher: {
              '@type': 'Organization',
              name: 'RatedNews',
              url: 'https://www.ratednews.com',
            },
            about: [
              { '@type': 'Thing', name: 'News aggregator' },
              { '@type': 'Thing', name: 'Community news ratings' },
              { '@type': 'Thing', name: 'Media quality ratings' },
            ],
          }) }}
        />
      </Head>
      <MethodologyPage goBack={goBack} />
    </>
  )
}
