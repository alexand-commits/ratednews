import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import OutletPage from '../../src/pages/OutletPage'
import { toSlug } from '../../src/utils/navigate'

export default function OutletDetail({ outlet }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          followedOutletIds, toggleFollow, allOutlets } = useAppContext()

  // Fallback while ISR regenerates
  if (router.isFallback || !outlet) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const canonicalSlug = toSlug(outlet.name)

  return (
    <>
      <Head>
        <title>{outlet.name} Bias Rating & Accuracy Score — RatedNews</title>
        <meta
          name="description"
          content={`See ${outlet.name}'s AI-powered bias rating, accuracy score, and headline fairness breakdown on RatedNews. Scores updated hourly from real published articles.`}
        />
        <link rel="canonical" href={`https://www.ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:title"       content={`${outlet.name} — Bias & Accuracy Rating`} />
        <meta property="og:description" content={`${outlet.name} has an accuracy score of ${outlet.overall_score ?? '–'}/100 on RatedNews. See the full breakdown.`} />
        <meta property="og:url"         content={`https://www.ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content={`https://www.ratednews.com/api/og?type=outlet&outlet=${encodeURIComponent(outlet.name)}${outlet.overall_score ? `&score=${outlet.overall_score}` : ''}${outlet.bias_direction ? `&bias=${outlet.bias_direction}` : ''}`} />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${outlet.name} — Bias & Accuracy Rating | RatedNews`} />
        <meta name="twitter:description" content={`${outlet.name} scores ${outlet.overall_score ?? '–'}/100 for accuracy on RatedNews. AI-powered analysis updated hourly.`} />
        <meta name="twitter:image"       content={`https://www.ratednews.com/api/og?type=outlet&outlet=${encodeURIComponent(outlet.name)}${outlet.overall_score ? `&score=${outlet.overall_score}` : ''}${outlet.bias_direction ? `&bias=${outlet.bias_direction}` : ''}`} />

        {/* Organisation structured data — helps Google understand the page
            and can trigger rich results for outlet-related searches */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type':    'NewsMediaOrganization',
            name:        outlet.name,
            description: outlet.description || `${outlet.name} is a news outlet tracked and rated by RatedNews for accuracy, political bias, and headline fairness.`,
            url:         `https://www.ratednews.com/outlet/${canonicalSlug}`,
            ...(outlet.country === 'UK' && { areaServed: 'GB' }),
            ...(outlet.country === 'US' && { areaServed: 'US' }),
            aggregateRating: outlet.overall_score ? {
              '@type':      'AggregateRating',
              ratingValue:  outlet.overall_score,
              bestRating:   100,
              worstRating:  0,
              ratingCount:  outlet.total_articles || 1,
              reviewAspect: 'Accuracy and impartiality',
            } : undefined,
            additionalProperty: [
              outlet.bias_direction && {
                '@type': 'PropertyValue',
                name:    'Political bias',
                value:   outlet.bias_direction,
              },
              outlet.overall_score && {
                '@type': 'PropertyValue',
                name:    'Accuracy score',
                value:   `${outlet.overall_score}/100`,
              },
            ].filter(Boolean),
          }).replace(/<\//g, '<\\/')}}
        />
      </Head>
      <OutletPage
        outletId={outlet.id}
        allOutlets={allOutlets.length ? allOutlets : [outlet]}
        goBack={goBack}
        navigate={navigate}
        showToast={showToast}
        user={user}
        onLoginClick={openAuthModal}
        followedOutletIds={followedOutletIds}
        toggleFollow={toggleFollow}
      />
    </>
  )
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  )
}

export async function getStaticPaths() {
  const supabase = await getSupabase()
  const { data: outlets } = await supabase.from('outlets').select('name')
  return {
    paths: (outlets || []).map(o => ({ params: { slug: toSlug(o.name) } })),
    fallback: 'blocking', // new outlets get a page on first visit
  }
}

export async function getStaticProps({ params }) {
  const supabase = await getSupabase()

  // Step 1: fetch only id + name to find the matching slug — avoids loading
  // every column of every outlet just to do a JS-side slug comparison
  const { data: stubs } = await supabase.from('outlets').select('id, name')
  const match = (stubs || []).find(o => toSlug(o.name) === params.slug)
  if (!match) return { notFound: true }

  // Step 2: fetch the full outlet row by ID
  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', match.id).single()
  if (!outlet) return { notFound: true }

  return {
    props: { outlet },
    revalidate: 3600, // regenerate every hour, matching the ingest schedule
  }
}
