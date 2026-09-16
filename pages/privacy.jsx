import Head from 'next/head'
import LegalDoc from '../src/components/LegalDoc'
import { PRIVACY } from '../src/content/legal'

// A real, crawlable URL. This content used to exist only inside the footer's
// React modal, so there was nothing for a search engine — or an AdSense
// reviewer — to find. Both requirements point the same way: a legal document
// people are told they can read needs an address.
export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — RatedNews</title>
        <meta name="description" content="How RatedNews collects, uses and stores your data — what we collect, the third-party services we use, cookies and advertising, and your rights under GDPR." />
        <link rel="canonical" href="https://www.ratednews.com/privacy" />
        <meta property="og:title"       content="Privacy Policy — RatedNews" />
        <meta property="og:description" content="How RatedNews collects, uses and stores your data — what we collect, the third-party services we use, cookies and advertising, and your rights under GDPR." />
        <meta property="og:url"         content="https://www.ratednews.com/privacy" />
        <meta property="og:type"        content="website" />
      </Head>
      <LegalDoc doc={PRIVACY} />
    </>
  )
}
