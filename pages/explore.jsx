import Head from 'next/head'
import { useAppContext } from './_app'
import ExplorePage from '../src/pages/ExplorePage'

export default function Explore() {
  const { navigate, allOutlets } = useAppContext()

  return (
    <>
      <Head>
        <title>Explore — Search News by Topic | RatedNews</title>
        <meta name="description" content="Search every news story across 150+ outlets by topic, person or event. Browse by category or explore what's trending right now." />
        <link rel="canonical" href="https://www.ratednews.com/explore" />
        <meta property="og:title"       content="Explore — Search News by Topic | RatedNews" />
        <meta property="og:description" content="Search every news story across 150+ outlets by topic, person or event." />
        <meta property="og:url"         content="https://www.ratednews.com/explore" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Explore — Search News by Topic | RatedNews" />
        <meta name="twitter:description" content="Search every news story across 150+ outlets by topic, person or event." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
      </Head>
      <ExplorePage navigate={navigate} outlets={allOutlets} />
    </>
  )
}
