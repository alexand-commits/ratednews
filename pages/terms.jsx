import Head from 'next/head'
import LegalDoc from '../src/components/LegalDoc'
import { TERMS } from '../src/content/legal'

// A real, crawlable URL. This content used to exist only inside the footer's
// React modal, so there was nothing for a search engine — or an AdSense
// reviewer — to find. Both requirements point the same way: a legal document
// people are told they can read needs an address.
export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Use — RatedNews</title>
        <meta name="description" content="The terms governing use of RatedNews — accounts, acceptable use, community ratings, content sourcing and liability." />
        <link rel="canonical" href="https://www.ratednews.com/terms" />
        <meta property="og:title"       content="Terms of Use — RatedNews" />
        <meta property="og:description" content="The terms governing use of RatedNews — accounts, acceptable use, community ratings, content sourcing and liability." />
        <meta property="og:url"         content="https://www.ratednews.com/terms" />
        <meta property="og:type"        content="website" />
      </Head>
      <LegalDoc doc={TERMS} />
    </>
  )
}
