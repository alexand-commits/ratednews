import Head from 'next/head'
import Link from 'next/link'
import CoverageReportView from '../../src/components/CoverageReportView'

/**
 * /coverage-report/[week] — the permanent archive.
 *
 * The point is citability. A journalist writing "RatedNews found 44 first-to-
 * report wins for Reuters in the week of 7 September" needs a URL that still
 * shows those numbers next month. /coverage-report cannot be that URL, because
 * it moves every Monday.
 *
 * These are also the right KIND of page for a crawl-starved site: 52 permanent,
 * genuinely unique, data-rich URLs a year, against 14,000 near-duplicate
 * article pages a day.
 */

const fmtWeek = w => new Date(w).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function CoverageReportWeek({ report, week, prev, next, isLatest }) {
  const label = fmtWeek(week)
  const title = `The Coverage Report — week ending ${label} | RatedNews`
  const desc = report
    ? `How the news covered the news in the week ending ${label}: tracked language, framing splits and attention data from ${report.corpus.headlines.toLocaleString()} headlines across ${report.corpus.outlets} feeds. Counts, never conclusions.`
    : `The Coverage Report for the week ending ${label}.`
  const url = `https://www.ratednews.com/coverage-report/${week}`

  const navLink = {
    fontSize: 12, fontWeight: 600, color: 'var(--coral)', textDecoration: 'none',
    padding: '6px 12px', border: '0.5px solid var(--border)', borderRadius: 99,
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        {/* Self-canonical: each week is genuinely distinct content, and the
            whole purpose of the URL is that it keeps its own identity. */}
        <link rel="canonical" href={url} />
        <meta property="og:title" content={`The Coverage Report — week ending ${label}`} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="https://www.ratednews.com/api/og?type=brand" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <CoverageReportView
        report={report}
        eyebrow={
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Archive · week ending {label}
            </span>
            {!isLatest && (
              <Link href="/coverage-report" style={{ fontSize: 12, fontWeight: 600, color: 'var(--coral)', textDecoration: 'none' }}>
                See this week →
              </Link>
            )}
          </div>
        }
        footer={
          <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 30 }}>
            {prev && <Link href={`/coverage-report/${prev}`} style={navLink}>← Week ending {fmtWeek(prev)}</Link>}
            {next && <Link href={`/coverage-report/${next}`} style={navLink}>Week ending {fmtWeek(next)} →</Link>}
            <Link href="/coverage-report" style={{ ...navLink, color: 'var(--text2)' }}>All weeks</Link>
          </nav>
        }
      />
    </>
  )
}

function serviceClient(createClient) {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function getStaticPaths() {
  // 'blocking', never false: with fallback:false every deploy would pre-render
  // every archived week. Blocking generates each on first request and then
  // caches it, so the archive costs nothing until somebody reads it.
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const { listReportWeeks } = await import('../../src/server/coverage-store')
    const weeks = await listReportWeeks(serviceClient(createClient))
    // Only pre-build the newest couple; the rest generate on demand.
    return { paths: weeks.slice(0, 2).map(w => ({ params: { week: w.week } })), fallback: 'blocking' }
  } catch {
    return { paths: [], fallback: 'blocking' }
  }
}

export async function getStaticProps({ params }) {
  const week = String(params.week || '')
  // Reject anything that isn't a date before it reaches the database — the
  // param is a public URL segment.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { notFound: true, revalidate: 86400 }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const { fetchReportByWeek, listReportWeeks } = await import('../../src/server/coverage-store')
    const db = serviceClient(createClient)
    const [report, weeks] = await Promise.all([
      fetchReportByWeek(db, week),
      listReportWeeks(db),
    ])
    if (!report) return { notFound: true, revalidate: 3600 }

    // weeks is newest-first, so "next" is the newer neighbour.
    const i = weeks.findIndex(w => w.week === week)
    return {
      props: {
        report,
        week,
        prev: i >= 0 && weeks[i + 1] ? weeks[i + 1].week : null,
        next: i > 0 ? weeks[i - 1].week : null,
        isLatest: i === 0,
      },
      // Archived weeks never change; a day is plenty and keeps the newest
      // week's neighbour links fresh once a new report lands.
      revalidate: 86400,
    }
  } catch {
    return { notFound: true, revalidate: 600 }
  }
}
