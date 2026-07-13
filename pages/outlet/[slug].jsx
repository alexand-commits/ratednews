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

// FAQ built from live community data — targets the questions people search
// ("is X reliable", "is X biased"). Same text feeds the visible block and the
// FAQPage JSON-LD, so schema always matches on-page content.
function buildFaq(o) {
  const name  = o.name
  const stars = o.total_ratings > 0 && o.community_score > 0 ? (o.community_score / 20).toFixed(1) : null
  const n     = o.total_ratings || 0
  const faq = []

  faq.push({
    q: `Is ${name} reliable?`,
    a: stars
      ? `RatedNews readers give ${name} ${stars} out of 5 for overall trustworthiness, based on ${n} community ${n === 1 ? 'rating' : 'ratings'} covering accuracy, bias and quality. Scores update continuously as readers rate.`
      : `${name} hasn't received enough community ratings yet for a reliable score. RatedNews scores come entirely from reader ratings of accuracy, bias and quality — rate ${name} to help build its profile.`,
  })

  const fair = o.fair_rate != null ? Math.round(o.fair_rate) : null
  const misl = o.misleading_rate != null ? Math.round(o.misleading_rate) : null
  faq.push({
    q: `Is ${name} biased?`,
    a: fair != null
      ? `Readers judge ${fair}% of rated ${name} articles as fair coverage${misl != null ? ` and flag ${misl}% as misleading` : ''}. RatedNews doesn't assign a left/right label — bias is measured article by article, by the community.`
      : `The community is still rating ${name}'s articles for fairness and bias. RatedNews doesn't assign a left/right label — bias is measured article by article, by readers.`,
  })

  faq.push({
    q: `How is ${name} rated on RatedNews?`,
    a: `Every score comes from reader ratings — there is no AI or editorial scoring. Readers rate ${name}'s articles and the outlet itself for accuracy, bias and overall quality, and those ratings roll up into the community score shown on this page.`,
  })

  return faq
}

export default function OutletDetail({ outlet, compareTargets = [] }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          followedOutletIds, toggleFollow, allOutlets } = useAppContext()

  // Fallback while ISR regenerates
  if (router.isFallback || !outlet) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const canonicalSlug = toSlug(outlet.name)
  const faq = buildFaq(outlet)

  return (
    <>
      <Head>
        {/* Title matches the high-intent queries people actually type:
            "is <outlet> reliable", "is <outlet> biased", "<outlet> bias rating" */}
        <title>{`Is ${outlet.name} Reliable? Bias & Trust Ratings — RatedNews`}</title>
        <meta
          name="description"
          content={outlet.total_ratings > 0
            ? `Is ${outlet.name} reliable or biased? Readers give it ${(outlet.community_score / 20).toFixed(1)}/5 from ${outlet.total_ratings} community ${outlet.total_ratings === 1 ? 'rating' : 'ratings'} for accuracy, bias and quality. See reviews and its latest articles on RatedNews.`
            : `Is ${outlet.name} reliable or biased? See how readers rate it for accuracy, bias and quality on RatedNews — community ratings, reviews and its latest articles.`}
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

        {/* FAQPage schema — mirrors the visible FAQ block below */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(f => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
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

      {/* FAQ + compare links — search-intent content below the app UI */}
      <div className="container" style={{ maxWidth: 1240, paddingTop: 0 }}>
        <section style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 19, margin: '0 0 14px' }}>
            {outlet.name} — frequently asked
          </h2>
          {faq.map(f => (
            <details key={f.q} style={{ borderTop: '0.5px solid var(--border)', padding: '10px 0' }}>
              <summary style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>{f.q}</summary>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '8px 0 2px' }}>{f.a}</p>
            </details>
          ))}
        </section>

        {compareTargets.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Compare {outlet.name} with</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {compareTargets.map(o => {
                const pair = [canonicalSlug, toSlug(o.name)].sort()
                return (
                  <a key={o.id} href={`/compare/${pair[0]}-vs-${pair[1]}`} className="pill" style={{ textDecoration: 'none' }}>
                    {outlet.name} vs {o.name}
                  </a>
                )
              })}
            </div>
          </section>
        )}
      </div>
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
  const { data: stubs } = await supabase.from('outlets').select('id, name, total_ratings, parent_outlet_id')
  const match = (stubs || []).find(o => toSlug(o.name) === params.slug)
  if (!match) return { notFound: true }

  // Step 2: fetch the full outlet row by ID
  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', match.id).single()
  if (!outlet) return { notFound: true }

  // "Compare with" targets, resolved server-side so the /compare/* links are
  // in the prerendered HTML for crawlers (the client outlet context loads too
  // late for that). Same-brand outlets (BBC News vs BBC Sport) are excluded —
  // brand = first word after stripping a leading "The".
  const brand = name => (name || '').replace(/^The /i, '').split(' ')[0].toLowerCase()
  const outletBrand = brand(outlet.name)
  const compareTargets = (stubs || [])
    .filter(o => !o.parent_outlet_id && o.id !== outlet.id && (o.total_ratings || 0) > 0 && brand(o.name) !== outletBrand)
    .sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0))
    .slice(0, 4)
    .map(o => ({ id: o.id, name: o.name }))

  return {
    props: { outlet, compareTargets },
    revalidate: 3600, // regenerate every hour, matching the ingest schedule
  }
}
