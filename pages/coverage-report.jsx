import Head from 'next/head'
import Link from 'next/link'
import CoverageReportView from '../src/components/CoverageReportView'

/**
 * /coverage-report — always the newest week, plus an index of the archive.
 * Permanent per-week permalinks live at /coverage-report/[week]; this URL is
 * the evergreen entry point people bookmark and link as "the report".
 */

const fmtWeek = w => new Date(w).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function ArchiveIndex({ weeks, currentWeek }) {
  const past = weeks.filter(w => w.week !== currentWeek)
  if (!past.length) return null
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 23, fontWeight: 700, marginBottom: 4 }}>Past weeks</h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
        Every week is kept at its own address, so a number you cite stays where you cited it.
      </p>
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {past.map((w, i) => (
          <Link
            key={w.week}
            href={`/coverage-report/${w.week}`}
            style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
              padding: '11px 16px', textDecoration: 'none', color: 'inherit',
              borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Week ending {fmtWeek(w.week)}</span>
            {w.headlines != null && (
              <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                {w.headlines.toLocaleString()} headlines · {w.outlets} feeds
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function CoverageReport({ report, weeks }) {
  const title = 'The Coverage Report — How the News Covered the News This Week | RatedNews'
  const desc = report
    ? `Tracked language, framing splits and attention data from ${report.corpus.headlines.toLocaleString()} headlines across ${report.corpus.outlets} news feeds this week. Counts, never conclusions.`
    : 'Weekly data on how news outlets cover the news — tracked language, framing splits, and who reports first.'
  const currentWeek = report?.week || (report?.generatedAt || '').slice(0, 10) || null

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href="https://www.ratednews.com/coverage-report" />
        <meta property="og:title" content="The Coverage Report — RatedNews" />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content="https://www.ratednews.com/coverage-report" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.ratednews.com/api/og?type=brand" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <CoverageReportView
        report={report}
        footer={
          <>
            {currentWeek && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 28 }}>
                Citing this week? Link{' '}
                <Link href={`/coverage-report/${currentWeek}`} style={{ color: 'var(--coral)' }}>
                  the permalink for week ending {fmtWeek(currentWeek)}
                </Link>
                {' '}— this page moves on next Monday.
              </p>
            )}
            <ArchiveIndex weeks={weeks} currentWeek={currentWeek} />
          </>
        }
      />
    </>
  )
}

export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    // Service key: server-side only. The pack lives in social_drafts, which
    // anon clients rightly can't read.
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { fetchLatestReport, listReportWeeks } = await import('../src/server/coverage-store')
    const [report, weeks] = await Promise.all([
      fetchLatestReport(supabase),
      listReportWeeks(supabase),
    ])
    return { props: { report: report || null, weeks }, revalidate: 21600 }
  } catch {
    return { props: { report: null, weeks: [] }, revalidate: 600 }
  }
}
