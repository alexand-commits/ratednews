import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import OutletPage from '../../src/pages/OutletPage'
import { toSlug } from '../../src/utils/navigate'

function outletOgUrl(o) {
  const base = 'https://www.ratednews.com/api/og?type=outlet'
  const p = new URLSearchParams({ outlet: o.name || '' })
  if (o.overall_score ?? o.accuracy_score) p.set('score', o.overall_score ?? o.accuracy_score)
  if (o.bias_direction)    p.set('bias',        o.bias_direction)
  if (o.fair_rate != null) p.set('fair',        Math.round(o.fair_rate))
  if (o.misleading_rate != null) p.set('misleading', Math.round(o.misleading_rate))
  if (o.clickbait_rate != null)  p.set('clickbait',  Math.round(o.clickbait_rate))
  if (o.article_count_30d) p.set('articles',    o.article_count_30d)
  return `${base}&${p.toString()}`
}

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
        <title>{outlet.name} Community Rating & Reviews — RatedNews</title>
        <meta
          name="description"
          content={`See ${outlet.name}'s community rating and reader reviews on RatedNews. Readers rate the outlet for accuracy, bias and quality — plus its latest articles.`}
        />
        <link rel="canonical" href={`https://www.ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:title"       content={`${outlet.name} — Community Rating & Reviews`} />
        <meta property="og:description" content={outlet.total_ratings > 0
          ? `${outlet.name} has a community rating of ${(outlet.community_score / 20).toFixed(1)}/5 from ${outlet.total_ratings} reader ${outlet.total_ratings === 1 ? 'rating' : 'ratings'} on RatedNews.`
          : `Rate ${outlet.name} on RatedNews and see its latest articles. Community ratings shape the rankings.`} />
        <meta property="og:url"         content={`https://www.ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content={outletOgUrl(outlet)} />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${outlet.name} — Community Rating & Reviews | RatedNews`} />
        <meta name="twitter:description" content={outlet.total_ratings > 0
          ? `${outlet.name} scores ${(outlet.community_score / 20).toFixed(1)}/5 from ${outlet.total_ratings} reader ${outlet.total_ratings === 1 ? 'rating' : 'ratings'} on RatedNews.`
          : `Rate ${outlet.name} on RatedNews — community ratings shape the rankings.`} />
        <meta name="twitter:image"       content={outletOgUrl(outlet)} />

        {/* Organisation structured data — helps Google understand the page
            and can trigger rich results for outlet-related searches */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type':    'NewsMediaOrganization',
            name:        outlet.name,
            description: outlet.description || `${outlet.name} is a news outlet aggregated and rated by the RatedNews community for accuracy, bias and quality.`,
            url:         `https://www.ratednews.com/outlet/${canonicalSlug}`,
            ...(outlet.country === 'UK' && { areaServed: 'GB' }),
            ...(outlet.country === 'US' && { areaServed: 'US' }),
            // Only emit aggregateRating when real reader ratings exist — fabricated
            // review markup (e.g. ratingCount: 1) risks a Google structured-data penalty.
            aggregateRating: (outlet.total_ratings > 0 && outlet.community_score > 0) ? {
              '@type':      'AggregateRating',
              ratingValue:  (outlet.community_score / 20).toFixed(1),
              bestRating:   5,
              worstRating:  1,
              ratingCount:  outlet.total_ratings,
            } : undefined,
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
  try {
    const supabase = await getSupabase()
    const { data: outlets } = await supabase.from('outlets').select('name')
    return {
      paths: (outlets || []).map(o => ({ params: { slug: toSlug(o.name) } })),
      fallback: 'blocking', // new outlets get a page on first visit
    }
  } catch {
    return { paths: [], fallback: 'blocking' }
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
