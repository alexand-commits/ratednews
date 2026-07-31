import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'

/**
 * /coverage-report — the public face of the weekly coverage data: tracked
 * language by outlet, same-story framing splits, attention stats. The data
 * pack is computed by scripts/coverage-report.mjs (weekly cron); this page
 * only renders it. House rule everywhere: counts, never conclusions.
 */

const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function Bar({ label, value, max, first, onClick, active }) {
  return (
    <div
      onClick={onClick}
      title={onClick ? `Show ${label}'s matching headlines` : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0', cursor: onClick ? 'pointer' : 'default', background: active ? 'rgba(216,90,48,0.07)' : 'none', borderRadius: 6 }}
    >
      <span style={{ width: 170, flexShrink: 0, textAlign: 'right', fontSize: 13, fontWeight: 600, color: active ? 'var(--coral)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: `${Math.max(2, Math.round(value / max * 100))}%`, maxWidth: '82%', height: 14, background: first ? 'var(--coral)' : 'rgba(216,90,48,0.4)', borderRadius: 4 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: first ? 'var(--coral)' : 'var(--text3)' }}>{value}</span>
      </div>
    </div>
  )
}

// Click-to-audit: every published count expands into the exact headlines
// behind it. The counting is dumb regex on purpose — this is where that
// pays off: any reader who doubts a number can read the receipts.
function TermBlock({ t }) {
  const [open, setOpen] = useState(false)
  const [outletFilter, setOutletFilter] = useState(null)
  const heads = t.headlines || []
  const shown = outletFilter ? heads.filter(h => h.o === outletFilter) : heads
  const capped = t.total > heads.length
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>“{t.term}”</span>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t.total.toLocaleString()} headlines</span>
        {t.prevRate > 0 && (() => {
          const ratio = t.rate / t.prevRate
          if (ratio >= 1.5) return <span style={{ fontSize: 12, color: 'var(--coral)' }}>▲ {Math.round(ratio * 10) / 10}× last week's rate</span>
          if (ratio <= 0.67) return <span style={{ fontSize: 12, color: 'var(--text3)' }}>▼ down to {Math.round(ratio * 100)}% of last week</span>
          return <span style={{ fontSize: 12, color: 'var(--text3)' }}>≈ level with last week</span>
        })()}
        {heads.length > 0 && (
          <button
            onClick={() => { setOpen(o => !o); setOutletFilter(null) }}
            style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {open ? '▾ hide the headlines' : '▸ audit: see the headlines'}
          </button>
        )}
      </div>
      {t.topOutlets.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {t.topOutlets.slice(0, 5).map((o, i) => (
            <Bar
              key={o.outlet} label={o.outlet} value={o.count} max={t.topOutlets[0].count} first={i === 0}
              active={open && outletFilter === o.outlet}
              onClick={heads.length ? () => { setOpen(true); setOutletFilter(f => f === o.outlet ? null : o.outlet) } : undefined}
            />
          ))}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', background: 'var(--bg)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            {outletFilter ? `${shown.length} from ${outletFilter}` : `${shown.length} headlines`}
            {capped && !outletFilter ? ` (newest ${heads.length} of ${t.total})` : ''}
            {outletFilter && <button onClick={() => setOutletFilter(null)} style={{ marginLeft: 8, fontSize: 11, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕ all outlets</button>}
          </div>
          {shown.map((h, i) => (
            <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5, padding: '4px 0', borderTop: i === 0 ? 'none' : '0.5px solid var(--divider, var(--border))', color: 'var(--text2)' }}>
              <span style={{ color: 'var(--text3)' }}>{fmtDate(h.d)}</span>
              {' · '}<strong style={{ color: 'var(--text)' }}>{h.o}</strong>
              {' — '}{h.t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, sub, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 23, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>{sub}</p>}
      {children}
    </section>
  )
}

export default function CoverageReport({ report }) {
  const title = 'The Coverage Report — How the News Covered the News This Week | RatedNews'
  const desc = report
    ? `Tracked language, framing splits and attention data from ${report.corpus.headlines.toLocaleString()} headlines across ${report.corpus.outlets} news feeds this week. Counts, never conclusions.`
    : 'Weekly data on how news outlets cover the news — tracked language, framing splits, and who reports first.'

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
      <div className="page-content">
        <div className="container" style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 30 }}>
            <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 30, fontWeight: 700, marginBottom: 6 }}>The Coverage Report</h1>
            {report ? (
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                How the news covered the news, {fmtDate(report.since)}–{fmtDate(report.generatedAt)}: {report.corpus.headlines.toLocaleString()} headlines
                indexed from {report.corpus.outlets} feeds. Counts, never conclusions — <a href="#methodology" style={{ color: 'var(--coral)', textDecoration: 'none' }}>methodology</a>.
              </p>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>The first weekly report is being computed — check back Monday.</p>
            )}
          </div>

          {report && (
            <>
              <Section title="🔤 Language watch" sub="How many headlines contained each term, and which outlets used it most. Same subject, competing vocabulary.">
                {report.language.map(g => (
                  <div key={g.group} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 10 }}>{g.group}</div>
                    {g.terms.map(t => <TermBlock key={t.term} t={t} />)}
                  </div>
                ))}
              </Section>

              {report.framing.length > 0 && (
                <Section title="🪞 Same story, different words" sub="Single stories where outlets split over what to call the same event.">
                  {report.framing.map((f, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{f.story}</div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                        {f.usage.map(u => (
                          <div key={u.label}>
                            <strong style={{ color: 'var(--text)' }}>{u.outlets} {u.outlets === 1 ? 'outlet' : 'outlets'}</strong> said “{u.label}”
                            {u.sample.length > 0 && <span style={{ color: 'var(--text3)' }}> — {u.sample.join(', ')}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              <Section title="👀 Attention" sub="Where the coverage went — and where it didn't.">
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', fontSize: 14, lineHeight: 1.8, color: 'var(--text2)' }}>
                  <div>📌 Biggest story: <strong style={{ color: 'var(--text)' }}>{report.attention.biggest?.story}</strong> — {report.attention.biggest?.outlets} outlets.</div>
                  <div>🕳 <strong style={{ color: 'var(--text)' }}>{report.attention.singleOutletStories.toLocaleString()}</strong> stories were covered by only one outlet.</div>
                </div>
                {report.attention.firstToReport.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 10 }}>
                      🏁 First to report — clear-lead wins on widely covered stories
                    </div>
                    {report.attention.firstToReport.map((f, i) => (
                      <Bar key={f.outlet} label={f.outlet} value={f.wins} max={report.attention.firstToReport[0].wins} first={i === 0} />
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Methodology">
                <div id="methodology" style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                  <p style={{ marginBottom: 8 }}>
                    Counts cover <strong>headlines</strong> we indexed from {report.corpus.outlets} public RSS feeds over the 7 days shown — not full article text.
                    A headline counts once per term (word-boundary match, case-insensitive), no matter how often the term repeats in it.
                    Section feeds are merged into their parent brand (BBC Sport counts as BBC).
                    Week-over-week changes are computed on rates per 1,000 indexed headlines (so growth in our own feed roster doesn't masquerade as a trend) and shown as multiples.
                    “First to report” counts stories covered by 5+ outlets where one outlet's article preceded every other outlet's by at least 5 minutes — wire syndication makes closer calls meaningless.
                    Tracked terms are chosen to cover competing vocabulary for the same subjects across the political spectrum.
                  </p>
                  <p>
                    We publish the numbers, not interpretations. Outlet trust scores on RatedNews come separately from <Link href="/outlets" style={{ color: 'var(--coral)', textDecoration: 'none' }}>reader ratings</Link>.
                  </p>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    // Service key: server-side only. The pack lives in social_drafts, which
    // anon clients rightly can't read.
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data } = await supabase.from('social_drafts')
      .select('pack').eq('pack->>kind', 'coverage_report').limit(1).maybeSingle()
    return { props: { report: data?.pack || null }, revalidate: 3600 }
  } catch {
    return { props: { report: null }, revalidate: 600 }
  }
}
