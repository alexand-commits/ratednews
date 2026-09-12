import { useState, useEffect } from 'react'
import Link from 'next/link'

/**
 * The rendered Coverage Report, shared by /coverage-report (whichever week is
 * newest) and /coverage-report/[week] (the permanent archive). One component so
 * an archived week can never drift from how the latest one is presented — the
 * whole point of the archive is that a citation still shows what was cited.
 *
 * House rule throughout: counts, never conclusions, and every published number
 * expands into the headlines behind it.
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

// The scale of the corpus, up front. Two of these numbers — stories and the
// single-outlet SHARE — were computed every week and then thrown away, so the
// page opened on a paragraph and never said how big the thing it was reporting
// on actually is.
function StatBar({ report }) {
  const a = report.attention || {}
  const stats = [
    { value: report.corpus.headlines?.toLocaleString(), label: 'headlines indexed' },
    { value: a.totalStories?.toLocaleString(), label: 'distinct stories' },
    { value: report.corpus.outlets?.toLocaleString(), label: 'outlets tracked' },
    a.totalStories && a.singleOutletStories != null
      ? {
          value: `${Math.round(a.singleOutletStories / a.totalStories * 100)}%`,
          label: 'covered by one outlet',
        }
      : null,
  ].filter(s => s && s.value != null)
  if (!stats.length) return null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
      marginBottom: 26,
    }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 16px',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
            {s.value}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// Desktop-only contents rail. This page is ~5,000px tall with four sections and
// sits in a 760px column, leaving ~340px of dead margin each side at 1440px.
// The answer to that space is navigation, not a wider column: 0 of 108 outlet
// labels truncate at the current width, and the methodology prose would run
// past a comfortable measure if the column grew.
const RAIL_SECTIONS = [
  { id: 'language',    label: 'Language watch' },
  { id: 'framing',     label: 'Same story, different words' },
  { id: 'attention',   label: 'Attention' },
  { id: 'methodology', label: 'Methodology' },
]

function ContentsRail({ report, sections }) {
  const [active, setActive] = useState(sections[0]?.id || null)

  useEffect(() => {
    const els = sections.map(s => document.getElementById(s.id)).filter(Boolean)
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    // rootMargin pulls the trip line to just under the sticky header, so the
    // highlighted item is the section actually being read rather than whichever
    // one happens to touch the viewport bottom.
    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [sections])

  return (
    <aside className="coverage-rail" aria-label="On this page">
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
        On this page
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 18 }}>
        {sections.map(s => {
          const on = active === s.id
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                fontSize: 12.5, lineHeight: 1.4, padding: '6px 10px', borderRadius: 6,
                textDecoration: 'none', color: on ? 'var(--coral)' : 'var(--text2)',
                fontWeight: on ? 600 : 500,
                background: on ? 'rgba(216,90,48,0.08)' : 'transparent',
                borderLeft: `2px solid ${on ? 'var(--coral)' : 'transparent'}`,
              }}
            >{s.label}</a>
          )
        })}
      </nav>
      {report?.corpus && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6, borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
          <div>{report.corpus.headlines?.toLocaleString()} headlines</div>
          <div>{report.corpus.outlets} outlets</div>
          <div style={{ marginTop: 8 }}>Counts, never conclusions.</div>
        </div>
      )}
    </aside>
  )
}

function Section({ id, title, sub, children }) {
  return (
    // scroll-margin-top clears the sticky site header, so a jump link doesn't
    // land the heading underneath it.
    <section id={id} style={{ marginBottom: 36, scrollMarginTop: 72 }}>
      <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 23, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>{sub}</p>}
      {children}
    </section>
  )
}

export default function CoverageReportView({ report, eyebrow = null, footer = null }) {
  return (
    <div className="page-content">
      <div className="coverage-shell">
        {report && <ContentsRail report={report} sections={RAIL_SECTIONS} />}
        <div className="container" style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 30 }}>
            {eyebrow}
            <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 30, fontWeight: 700, marginBottom: 6 }}>The Coverage Report</h1>
            {report ? (
              /* The corpus numbers moved into StatBar below — repeating them
                 here made the opening paragraph a caption for the thing it sat
                 above. */
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                How the news covered the news, {fmtDate(report.since)}–{fmtDate(report.generatedAt)}.
                Counts, never conclusions — <a href="#methodology" style={{ color: 'var(--coral)', textDecoration: 'none' }}>methodology</a>.
              </p>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>The first weekly report is being computed — check back Monday.</p>
            )}
          </div>

          {report && <StatBar report={report} />}

          {report && (
            <>
              <Section id="language" title="🔤 Language watch" sub="How many headlines contained each term, and which outlets used it most. Same subject, competing vocabulary.">
                {report.language.map(g => (
                  <div key={g.group} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 10 }}>{g.group}</div>
                    {g.terms.map(t => <TermBlock key={t.term} t={t} />)}
                  </div>
                ))}
              </Section>

              {report.framing.length > 0 && (
                <Section id="framing" title="🪞 Same story, different words" sub="Single stories where outlets split over what to call the same event.">
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

              <Section id="attention" title="👀 Attention" sub="Where the coverage went — and where it didn't.">
                <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', fontSize: 14, lineHeight: 1.8, color: 'var(--text2)' }}>
                  <div>📌 Biggest story: <strong style={{ color: 'var(--text)' }}>{report.attention.biggest?.story}</strong> — {report.attention.biggest?.outlets} outlets.</div>
                  <div>
                    🕳 <strong style={{ color: 'var(--text)' }}>{report.attention.singleOutletStories.toLocaleString()}</strong> stories were covered by only one outlet
                    {report.attention.totalStories ? <> — out of {report.attention.totalStories.toLocaleString()} in total.</> : '.'}
                  </div>
                </div>
                {report.attention.firstToReport.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 4 }}>
                      🏁 First to report — clear-lead wins on widely covered stories
                    </div>
                    {/* The denominator. "44 wins" says nothing without it. */}
                    {report.attention.qualifyingStories > 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10 }}>
                        out of {report.attention.qualifyingStories.toLocaleString()} stories that qualified — 5+ outlets, with one clearly first
                      </div>
                    )}
                    {report.attention.firstToReport.map((f, i) => (
                      <Bar key={f.outlet} label={f.outlet} value={f.wins} max={report.attention.firstToReport[0].wins} first={i === 0} />
                    ))}
                  </div>
                )}
              </Section>

              <Section id="methodology" title="Methodology">
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
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
        {footer}
        </div>
        {/* Balances the rail so the reading column stays centred on the page
            rather than shifting right by the rail's width. */}
        <div aria-hidden="true" />
      </div>
    </div>
  )
}
