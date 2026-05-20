import Head from 'next/head'
import { useAppContext } from './_app'
import CategoryPage from '../src/pages/CategoryPage'

export default function Categories() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>Rated News by Topic — Politics, Business, Tech & More — RatedNews</title>
        <meta name="description" content="Browse rated news stories by topic — Politics, Business, Tech, Health, Sport, Environment and more. Every article scored for bias and quality across 112 outlets." />
        <link rel="canonical" href="https://www.ratednews.com/categories" />
        <meta property="og:title"       content="Rated News by Topic — Politics, Business, Tech & More" />
        <meta property="og:description" content="Browse rated news stories by topic — Politics, Business, Tech, Health, Sport, Environment and more. Every article scored for bias and quality." />
        <meta property="og:url"         content="https://www.ratednews.com/categories" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/og-image.png" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Rated News by Topic — RatedNews" />
        <meta name="twitter:description" content="Browse Politics, Business, Tech, Health, Sport and more — every article scored for quality and bias." />
        <meta name="twitter:image"      content="https://www.ratednews.com/og-image.png" />
      </Head>
      <CategoryPage navigate={navigate} goBack={goBack} />
    </>
  )
}
