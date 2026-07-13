import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { toSlug } from '../../src/utils/navigate'
import { MIN_RANK_RATINGS } from '../../src/utils/helpers'
import OutletLogo from '../../src/components/OutletLogo'

/**
 * /compare/bbc-news-vs-fox-news — crawlable head-to-head outlet comparison.
 * Targets "X vs Y bias / which is more reliable" queries. Canonical URL always
 * orders the two slugs alphabetically; the reverse order redirects.
 */

const stars = o => (o.total_ratings > 0 && o.community_score > 0 ? (o.community_score / 20).toFixed(1) : null)

function StatRow({ label, a, b, higherWins = true, suffix = '' }) {
  const aNum = typeof a === 'number' ? a : null
  const bNum = typeof b === 'number' ? b : null
  const aWins = aNum != null && bNum != null && aNum !== bNum && (higherWins ? aNum > bNum : aNum < bNum)
  const bWins = aNum != null && bNum != null && aNum !== bNum && (higherWins ? bNum > aNum : bNum < aNum)
  const cell = (v, wins) => (
    <span style={{ fontSize: 15, fontWeight: wins ? 800 : 600, color: wins ? 'var(--green-dark, #639922)' : 'var(--text)' }}>
      {v != null ? `${v}${suffix}` : '—'}
    </span>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '0.5px solid var(--border)' }}>
      <div style={{ textAlign: 'right' }}>{cell(a, aWins)}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', minWidth: 130 }}>{label}</div>
      <div>{cell(b, bWins)}</div>
    </div>
  )
}

function OutletHalf({ o, align }) {
  return (
    <Link href={`/outlet/${toSlug(o.name)}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 8, minWidth: 0 }}>
      <OutletLogo name={o.name} size={44} borderRadius={10} />
      <div style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 18, fontWeight: 700, textAlign: align === 'right' ? 'right' : 'left' }}>{o.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{o.country || 'International'}</div>
    </Link>
  )
}

export default function ComparePage({ a, b }) {
  const router = useRouter()
  if (router.isFallback || !a || !b) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const aStars = stars(a), bStars = stars(b)
  const bothRated = aStars != null && bStars != null
  const leader = bothRated ? (Number(aStars) === Number(bStars) ? null : (Number(aStars) > Number(bStars) ? a : b)) : null

  const url   = `https://www.ratednews.com/compare/${toSlug(a.name)}-vs-${toSlug(b.name)}`
  const title = `${a.name} vs ${b.name}: Which Is More Trusted? — RatedNews`
  const desc  = bothRated
    ? `${a.name} scores ${aStars}/5 and ${b.name} scores ${bStars}/5 from reader ratings on RatedNews. Compare their accuracy, bias and quality side by side.`
    : `Compare ${a.name} and ${b.name} side by side — community ratings for accuracy, bias and quality on RatedNews.`

  const faq = [
    {
      q: `Which is more reliable, ${a.name} or ${b.name}?`,
      a: leader
        ? `Based on reader ratings, ${leader.name} currently leads with ${stars(leader)}/5 (${a.name}: ${aStars}/5 from ${a.total_ratings} ratings; ${b.name}: ${bStars}/5 from ${b.total_ratings} ratings). Scores update continuously as the community rates.`
        : `Both outlets are still building their community rating profile on RatedNews. Scores come entirely from reader ratings of accuracy, bias and quality — rate either outlet to shape the comparison.`,
    },
    {
      q: `How are ${a.name} and ${b.name} rated?`,
      a: `Every score on RatedNews comes from reader ratings — no AI, no editorial scoring. Readers rate each outlet's articles and the outlets themselves for accuracy, bias and overall quality.`,
    },
  ]

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title"       content={`${a.name} vs ${b.name} — community trust ratings`} />
        <meta property="og:description" content={desc} />
        <meta property="og:url"         content={url} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content={`https://www.ratednews.com/api/og?type=brand`} />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${a.name} vs ${b.name} — RatedNews`} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image"       content={`https://www.ratednews.com/api/og?type=brand`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }).replace(/<\//g, '<\\/')}} />
      </Head>

      <div className="page-content">
        <div className="container" style={{ maxWidth: 760, paddingTop: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 26, lineHeight: 1.3, margin: '0 0 6px' }}>
            {a.name} vs {b.name}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 18px' }}>
            Community trust ratings, side by side. Scores come entirely from reader ratings — updated continuously.
          </p>

          <section style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'start', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><OutletHalf o={a} align="right" /></div>
              <div style={{ alignSelf: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text3)', padding: '0 6px' }}>VS</div>
              <OutletHalf o={b} align="left" />
            </div>

            {/* Community data only — fair/misleading/clickbait rates and the
                30-day article count were computed by the retired AI pipeline
                and are frozen; showing them here would misattribute them to
                readers. Add rows back only for reader-derived aggregates. */}
            <StatRow label="Community score" a={aStars ? Number(aStars) : null} b={bStars ? Number(bStars) : null} suffix="/5" />
            <StatRow label="Reader ratings" a={a.total_ratings || 0} b={b.total_ratings || 0} />

            {(a.total_ratings || 0) < MIN_RANK_RATINGS || (b.total_ratings || 0) < MIN_RANK_RATINGS ? (
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '12px 0 0' }}>
                Outlets need {MIN_RANK_RATINGS}+ reader ratings before their score counts as ranked — early numbers are provisional.
              </p>
            ) : null}
          </section>

          <section style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 24px', marginBottom: 24 }}>
            {faq.map(f => (
              <details key={f.q} style={{ padding: '8px 0' }}>
                <summary style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{f.q}</summary>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '8px 0 2px' }}>{f.a}</p>
              </details>
            ))}
          </section>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
            <Link href={`/outlet/${toSlug(a.name)}`} className="pill" style={{ textDecoration: 'none' }}>Rate {a.name} →</Link>
            <Link href={`/outlet/${toSlug(b.name)}`} className="pill" style={{ textDecoration: 'none' }}>Rate {b.name} →</Link>
            <Link href="/outlets" className="pill" style={{ textDecoration: 'none' }}>All outlet rankings →</Link>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
}

// Top rank-eligible outlets get prebuilt pairs; everything else builds on demand.
export async function getStaticPaths() {
  try {
    const supabase = await getSupabase()
    const { data } = await supabase
      .from('outlets')
      .select('name, total_ratings, community_score')
      .is('parent_outlet_id', null)
      .gte('total_ratings', MIN_RANK_RATINGS)
      .order('total_ratings', { ascending: false })
      .limit(10)
    const slugs = (data || []).map(o => toSlug(o.name))
    const paths = []
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const pair = [slugs[i], slugs[j]].sort()
        paths.push({ params: { pair: `${pair[0]}-vs-${pair[1]}` } })
      }
    }
    return { paths, fallback: 'blocking' }
  } catch {
    return { paths: [], fallback: 'blocking' }
  }
}

export async function getStaticProps({ params }) {
  const m = String(params.pair || '').match(/^(.+)-vs-(.+)$/)
  if (!m) return { notFound: true }
  const [slugA, slugB] = [m[1], m[2]]
  if (slugA === slugB) return { notFound: true }

  // Canonical order is alphabetical — redirect the reverse permutation.
  if (slugA > slugB) {
    return { redirect: { destination: `/compare/${slugB}-vs-${slugA}`, permanent: true } }
  }

  const supabase = await getSupabase()
  const { data: stubs } = await supabase.from('outlets').select('id, name').is('parent_outlet_id', null)
  const bySlug = new Map((stubs || []).map(o => [toSlug(o.name), o]))
  const stubA = bySlug.get(slugA)
  const stubB = bySlug.get(slugB)
  if (!stubA || !stubB) return { notFound: true }

  const { data: rows } = await supabase.from('outlets').select('*').in('id', [stubA.id, stubB.id])
  const a = (rows || []).find(o => o.id === stubA.id)
  const b = (rows || []).find(o => o.id === stubB.id)
  if (!a || !b) return { notFound: true }

  return { props: { a, b }, revalidate: 3600 }
}
