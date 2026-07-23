import Head from 'next/head'
import Link from 'next/link'
import { toSlug } from '../src/utils/navigate'
import { MIN_RANK_RATINGS } from '../src/utils/helpers'
import OutletLogo from '../src/components/OutletLogo'

/**
 * /most-trusted-news-sources — evergreen ranking page targeting
 * "most trusted news sources", "least biased news", "most reliable news".
 * Unlike the listicles that dominate these queries, this one is a live,
 * community-voted ranking that updates hourly via ISR.
 */

const stars = o => (o.community_score / 20).toFixed(1)

export default function MostTrusted({ ranked, provisionalCount, generatedAt }) {
  const year = new Date(generatedAt).getFullYear()
  const title = `Most Trusted News Sources ${year} — Ranked by Readers | RatedNews`
  const desc  = ranked.length
    ? `The most trusted news outlets of ${year}, ranked by reader ratings for accuracy, bias and quality. ${ranked[0].name} currently leads with ${stars(ranked[0])}/5. Live community rankings, no AI.`
    : `News outlets ranked by reader ratings for accuracy, bias and quality. Live community rankings on RatedNews.`
  const url = 'https://www.ratednews.com/most-trusted-news-sources'

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Most Trusted News Sources ${year}`,
    description: desc,
    itemListElement: ranked.slice(0, 25).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: o.name,
      url: `https://www.ratednews.com/outlet/${toSlug(o.name)}`,
    })),
  }

  const faq = [
    {
      q: `What is the most trusted news source in ${year}?`,
      a: ranked.length
        ? `Based on RatedNews reader ratings, ${ranked[0].name} currently holds the top community score at ${stars(ranked[0])}/5${ranked[1] ? `, followed by ${ranked[1].name} (${stars(ranked[1])}/5)` : ''}. The ranking updates continuously as readers rate outlets for accuracy, bias and quality.`
        : `The ranking is being built by reader ratings right now — outlets need ${MIN_RANK_RATINGS}+ ratings to qualify.`,
    },
    {
      q: 'How is this ranking calculated?',
      a: `Entirely from reader ratings — no AI scoring, no editorial picks, no funding influence. Readers rate outlets and their articles for accuracy, bias and overall quality; an outlet needs at least ${MIN_RANK_RATINGS} ratings to hold a ranked position.`,
    },
    {
      q: 'Which news sources are least biased?',
      a: `RatedNews measures bias article by article through reader ratings rather than assigning outlets a fixed left/right label. The outlets above combine high accuracy ratings with high fair-coverage rates — see each outlet's page for its fairness breakdown.`,
    },
  ]

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title"       content={`Most Trusted News Sources ${year} — Ranked by Readers`} />
        <meta property="og:description" content={desc} />
        <meta property="og:url"         content={url} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`Most Trusted News Sources ${year}`} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/<\//g, '<\\/') }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/<\//g, '<\\/') }} />
      </Head>

      <div className="page-content">
        <div className="container" style={{ maxWidth: 760, paddingTop: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 28, lineHeight: 1.25, margin: '0 0 8px' }}>
            Most Trusted News Sources {year}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 6px' }}>
            News outlets ranked by readers — not by an algorithm, an editor or a funder. Every score
            below comes from community ratings of accuracy, bias and quality, and updates continuously
            as readers rate.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 20px' }}>
            Outlets qualify after {MIN_RANK_RATINGS}+ reader ratings{provisionalCount > 0 ? ` · ${provisionalCount} more are building their profile` : ''}.
          </p>

          {ranked.length === 0 ? (
            <section style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px 24px', marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>The ranking is being built right now</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 14px' }}>
                Outlets appear here once they have {MIN_RANK_RATINGS}+ reader ratings. Yours could be one of the first votes.
              </p>
              <Link href="/outlets" className="pill" style={{ textDecoration: 'none' }}>Rate an outlet →</Link>
            </section>
          ) : (
            <section style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24 }}>
              {ranked.map((o, i) => (
                <Link
                  key={o.id}
                  href={`/outlet/${toSlug(o.name)}`}
                  className="row-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', textDecoration: 'none', color: 'inherit', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}
                >
                  <span style={{ width: 26, fontSize: 14, fontWeight: 800, color: i < 3 ? 'var(--coral)' : 'var(--text3)', flexShrink: 0 }}>{i + 1}</span>
                  <OutletLogo name={o.name} size={34} borderRadius={8} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.name}
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginLeft: 8 }}>{o.country || 'International'}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--green-dark, #639922)', flexShrink: 0 }}>{stars(o)}<span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>/5</span></span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{o.total_ratings} ratings</span>
                </Link>
              ))}
            </section>
          )}

          <section style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 24px', marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 19, margin: '0 0 10px' }}>Frequently asked</h2>
            {faq.map(f => (
              <details key={f.q} style={{ borderTop: '0.5px solid var(--border)', padding: '9px 0' }}>
                <summary style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{f.q}</summary>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '8px 0 2px' }}>{f.a}</p>
              </details>
            ))}
          </section>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
            <Link href="/outlets" className="pill" style={{ textDecoration: 'none' }}>Full outlet rankings →</Link>
            <Link href="/methodology" className="pill" style={{ textDecoration: 'none' }}>How scoring works →</Link>
          </div>
        </div>
      </div>
    </>
  )
}

export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
    const { data } = await supabase
      .from('outlets')
      .select('id, name, country, community_score, total_ratings')
      .is('parent_outlet_id', null)
    const all = data || []
    const ranked = all
      .filter(o => (o.total_ratings || 0) >= MIN_RANK_RATINGS && (o.community_score || 0) > 0)
      .sort((a, b) => (b.community_score - a.community_score) || (b.total_ratings - a.total_ratings))
      .slice(0, 25)
    const provisionalCount = all.filter(o => (o.total_ratings || 0) > 0 && (o.total_ratings || 0) < MIN_RANK_RATINGS).length
    return { props: { ranked, provisionalCount, generatedAt: new Date().toISOString() }, revalidate: 3600 }
  } catch {
    return { props: { ranked: [], provisionalCount: 0, generatedAt: new Date().toISOString() }, revalidate: 3600 }
  }
}
