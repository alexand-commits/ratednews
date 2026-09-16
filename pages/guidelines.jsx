import Head from 'next/head'
import LegalDoc from '../src/components/LegalDoc'
import { GUIDELINES } from '../src/content/legal'

// A real, crawlable URL. This content used to exist only inside the footer's
// React modal, so there was nothing for a search engine — or an AdSense
// reviewer — to find. Both requirements point the same way: a legal document
// people are told they can read needs an address.
export default function Guidelines() {
  return (
    <>
      <Head>
        <title>Community Guidelines — RatedNews</title>
        <meta name="description" content="How RatedNews expects its community to rate and comment — what good-faith rating looks like, and how manipulation is handled." />
        <link rel="canonical" href="https://www.ratednews.com/guidelines" />
        <meta property="og:title"       content="Community Guidelines — RatedNews" />
        <meta property="og:description" content="How RatedNews expects its community to rate and comment — what good-faith rating looks like, and how manipulation is handled." />
        <meta property="og:url"         content="https://www.ratednews.com/guidelines" />
        <meta property="og:type"        content="website" />
      </Head>
      <LegalDoc doc={GUIDELINES} />
    </>
  )
}
