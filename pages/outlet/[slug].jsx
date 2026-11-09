import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import OutletPage from '../../src/pages/OutletPage'
import { toSlug } from '../../src/utils/navigate'

// Community data only — the fair/misleading/clickbait rates and overall_score
// were computed by the retired AI pipeline (scripts/aggregate-outlets.mjs, no
// longer on any cron) and are frozen; putting them on a public share card
// would misattribute AI-era numbers to readers.
function outletOgUrl(o) {
  const base = 'https://www.ratednews.com/api/og?type=outlet'
  const p = new URLSearchParams({ outlet: o.name || '' })
  if (o.total_ratings > 0 && o.community_score > 0) {
    p.set('score', Math.round(o.community_score))
    p.set('stars', (o.community_score / 20).toFixed(1))
  }
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
      ? `RatedNews readers give ${name} ${stars} out of 5 for overall trustworthiness, based on ${n} community ${n === 1 ? 'rating' : 'ratings'} of overall trustworthiness. Scores update continuously as readers rate.`
      : `${name} hasn't received enough community ratings yet for a reliable score. RatedNews scores come entirely from reader trust ratings — rate ${name} to help build its profile.`,
  })

  // NB: no fair_rate/misleading_rate here — those columns are frozen output of
  // the retired AI pipeline, not reader data. Only claim what readers produce.
  faq.push({
    q: `Is ${name} biased?`,
    a: stars
      ? `RatedNews doesn't assign ${name} a left/right label. Its ${stars}/5 score measures overall reader trust, not political position — readers judge for themselves, outlet by outlet, whether coverage deserves their trust.`
      : `RatedNews doesn't assign ${name} a left/right label — scores measure overall reader trust, not political position. ${name} is still building its rating profile; rate it to contribute the first data points.`,
  })

  faq.push({
    q: `How is ${name} rated on RatedNews?`,
    a: `Every score comes from reader ratings — there is no AI or editorial scoring. Readers rate ${name}'s overall trustworthiness with a one-tap star rating, and those ratings roll up into the community score shown on this page.`,
  })

  return faq
}

export default function OutletDetail({ outlet, brandRating = null, compareTargets = [], coverage = null }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          followedOutletIds, toggleFollow, allOutlets } = useAppContext()

  // Fallback while ISR regenerates
  if (router.isFallback || !outlet) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const canonicalSlug = toSlug(outlet.name)
  // Identity from the outlet row, RATINGS from the brand roll-up. Every
  // consumer below (title, description, OG, FAQ, schema) then quotes the same
  // number the page body shows.
  const head = brandRating ? { ...outlet, ...brandRating } : outlet
  const faq = buildFaq(head)

  return (
    <>
      <Head>
        {/* Title matches the high-intent queries people actually type:
            "is <outlet> reliable", "is <outlet> biased", "<outlet> bias rating" */}
        <title>{`Is ${outlet.name} Reliable? Community Trust Ratings — RatedNews`}</title>
        <meta
          name="description"
          content={head.total_ratings > 0
            ? `Is ${outlet.name} reliable or biased? Readers give it ${(head.community_score / 20).toFixed(1)}/5 from ${head.total_ratings} community ${head.total_ratings === 1 ? 'rating' : 'ratings'} for accuracy, bias and quality. See reviews and its latest articles on RatedNews.`
            : `Is ${outlet.name} reliable or biased? See how readers rate it for accuracy, bias and quality on RatedNews — community ratings, reviews and its latest articles.`}
        />
        <link rel="canonical" href={`https://www.ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:title"       content={`${outlet.name} — Community Rating & Reviews`} />
        <meta property="og:description" content={head.total_ratings > 0
          ? `${outlet.name} has a community rating of ${(head.community_score / 20).toFixed(1)}/5 from ${head.total_ratings} reader ${head.total_ratings === 1 ? 'rating' : 'ratings'} on RatedNews.`
          : `Rate ${outlet.name} on RatedNews and see its latest articles. Community ratings shape the rankings.`} />
        <meta property="og:url"         content={`https://www.ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content={outletOgUrl(head)} />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${outlet.name} — Community Rating & Reviews | RatedNews`} />
        <meta name="twitter:description" content={head.total_ratings > 0
          ? `${outlet.name} scores ${(head.community_score / 20).toFixed(1)}/5 from ${head.total_ratings} reader ${head.total_ratings === 1 ? 'rating' : 'ratings'} on RatedNews.`
          : `Rate ${outlet.name} on RatedNews — community ratings shape the rankings.`} />
        <meta name="twitter:image"       content={outletOgUrl(head)} />

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
            aggregateRating: (head.total_ratings > 0 && head.community_score > 0) ? {
              '@type':      'AggregateRating',
              ratingValue:  (head.community_score / 20).toFixed(1),
              bestRating:   5,
              worstRating:  1,
              ratingCount:  head.total_ratings,
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
        coverage={coverage}
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
  const { data: stubs } = await supabase.from('outlets').select('id, name, total_ratings, parent_outlet_id, community_score')
  const match = (stubs || []).find(o => toSlug(o.name) === params.slug)
  if (!match) return { notFound: true }

  // Step 2: fetch the full outlet row by ID
  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', match.id).single()
  if (!outlet) return { notFound: true }

  // Brand score — the parent plus its section feeds, weighted by rating count.
  //
  // Everything in <Head> below used to read outlet.community_score and
  // outlet.total_ratings straight off the parent row, while the page BODY
  // (src/pages/OutletPage.jsx) rolled the children in. Sky News therefore
  // showed a reader "4.4 from 7" and told Google "4.5 from 2" in the meta
  // description, the FAQ answers and the aggregateRating schema. One outlet,
  // two numbers, and the wrong one was the machine-readable one.
  //
  // Same roll-up OutletPage does, computed here so the head and the body
  // cannot drift again.
  const kids = (stubs || []).filter(o => o.parent_outlet_id === outlet.id)
  const ratedRows = [outlet, ...kids].filter(o => (o?.total_ratings || 0) > 0)
  const brandRatings = ratedRows.reduce((n, o) => n + (o.total_ratings || 0), 0)
  const brandRating = {
    total_ratings: brandRatings,
    community_score: brandRatings > 0
      ? ratedRows.reduce((n, o) => n + (o.community_score || 0) * (o.total_ratings || 0), 0) / brandRatings
      : (outlet.community_score || 0),
  }

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

  // Weekly coverage stats for this outlet — the only original content on the
  // page. Computed across the whole corpus in scripts/coverage-report.mjs and
  // stored with the weekly pack; see docs/outlet-page-spec.md.
  //
  // Separate client: the packs live in social_drafts, which the anon key above
  // rightly cannot read. Wrapped so a missing service key, a missing pack or a
  // pack from before this field existed degrades to "no stats" rather than
  // taking out the whole page.
  //
  // Children are summed in: /outlet/bbc-news presents BBC as a brand with
  // sections, so its numbers must include BBC Sport and BBC World.
  let coverage = null
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import('@supabase/supabase-js')
      // NEXT_PUBLIC_ first, VITE_ as the fallback — the same pair
      // pages/sitemap.xml.jsx uses, and for the same reason: production is
      // configured with the NEXT_PUBLIC_ names while the local .env carries the
      // VITE_ ones. Reading only VITE_ here gave createClient an undefined URL
      // in production, which threw into the catch below and left `coverage`
      // null. It worked locally and failed live, silently, because the catch
      // did its job.
      const svc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      )
      // JSON-path select, NOT `select('pack')`. The weekly pack is 590 KB —
      // 587 KB of it is `language`, which this page has no use for — and
      // there are 257 outlet pages, so fetching the whole pack per page cost
      // ~150 MB of egress on every full rebuild to read one 67 KB object.
      const { data: pack } = await svc.from('social_drafts')
        .select('week:pack->>week, outletStats:pack->outletStats')
        .eq('pack->>kind', 'coverage_report')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      const stats = pack?.outletStats
      if (stats?.outlets) {
        const ids = [outlet.id, ...(stubs || []).filter(o => o.parent_outlet_id === outlet.id).map(o => o.id)]
        const parts = ids.map(id => stats.outlets[id]).filter(Boolean)
        if (parts.length) {
          const sum = k => parts.reduce((s, p) => s + (p[k] || 0), 0)
          coverage = {
            week: pack.week || null,
            articles: sum('articles'),
            solo: sum('solo'),
            firstWins: sum('firstWins'),
            contested: sum('contested'),
            // Rank belongs to the outlet itself, not the summed brand.
            rank: stats.outlets[outlet.id]?.rank ?? null,
            rankedOf: stats.rankedOf ?? null,
            over: stats.outlets[outlet.id]?.over ?? [],
            under: stats.outlets[outlet.id]?.under ?? [],
          }
        }
      }
    }
  } catch (err) {
    // Stats are a bonus and must never take the page down — but a silent catch
    // is how the env-name bug above survived a deploy and looked like "no data"
    // instead of "misconfigured". Log it so the build output says which.
    console.warn(`[outlet/${params.slug}] coverage stats unavailable:`, err?.message || err)
  }

  return {
    props: { outlet, brandRating, compareTargets, coverage },
    // 21600s = SIX hours, not one — the old comment here said "every hour,
    // matching the ingest schedule" and was wrong by a factor of six.
    // Six is right for this page: its content moves on two clocks, the
    // community score (rarely — 240 ratings all-time) and the weekly coverage
    // stats (once a week). Nothing here changes hourly, and 257 pages
    // regenerating more often is cost for no freshness.
    revalidate: 21600,
  }
}
