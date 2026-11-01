import React from 'react'

// What this outlet's week looked like against every other outlet we index.
//
// This is the only original content on an outlet page. Everything else — the
// logo, the section list, the feed of headlines — the outlet itself publishes
// better. These figures require watching all ~292 outlets at once, which is
// the one thing this site does that the outlet cannot.
//
// Google returned "Crawled – currently not indexed" for /outlet/bbc-news on a
// page of 211 mostly-boilerplate words. See docs/outlet-page-spec.md.
//
// Precomputed weekly in scripts/coverage-report.mjs. Renders nothing when the
// pack is missing, stale or the outlet is below the article gate — an empty
// state here would be worse than absence.

// "in our index", never "published". We see one RSS feed per outlet, which is
// a subset of its output; claiming to count what an outlet published would be
// false and trivially checkable.
const INDEX_NOTE = 'Counted from the stories we indexed this week — an outlet’s RSS feed is a subset of everything it publishes.'

// The "unmatched" figure needs this next to it, because the number reads as a
// compliment and often isn't. The New York Post scores 52% — and inspecting
// those 1,188 stories shows celebrity aggregation, listicles, state-politics
// columns and "cockroach milk could be the next superfood", not scoops. An
// outlet that files a lot of opinion and filler scores high for the same
// reason a wire service scores low: nobody else wrote it.
//
// It is still worth showing. The spread between outlets is real and
// informative — Reuters 25%, BBC News 28%, NY Post 52% — it just measures
// "distinct from the rest of the index", not "exclusive".
const UNMATCHED_NOTE = 'Unmatched means no other outlet we index ran a story we could match to it — that covers original reporting, opinion and filler alike, and stories worded too differently for us to match.'

function Figure({ value, label, sub }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 150 }}>
      <div style={{
        fontFamily: 'var(--font-playfair), serif', fontSize: 26, fontWeight: 700,
        lineHeight: 1.1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function OutletCoverageStats({ coverage, outletName }) {
  if (!coverage || !coverage.articles) return null

  const { articles, solo, firstWins, contested, rank, rankedOf, over = [], under = [] } = coverage
  const soloPct = Math.round((solo / articles) * 100)

  // Only claim a beat skew when it is actually a skew. 1.4x on a corpus
  // average is noise; by 1.5x the outlet is filing half again as much.
  const notable = over.filter(o => o.ratio >= 1.5).slice(0, 2)
  const light = under.filter(o => o.ratio <= 0.6).slice(0, 1)

  return (
    <section style={{
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '18px 22px', marginBottom: 16,
    }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
        color: 'var(--text3)', margin: '0 0 14px', fontFamily: 'var(--font-lato), sans-serif',
      }}>
        {outletName}&rsquo;s week in our index
      </h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 14 }}>
        <Figure
          value={articles.toLocaleString()}
          label="stories indexed"
          sub={rank && rankedOf ? `#${rank} of ${rankedOf} by volume` : null}
        />
        <Figure
          value={`${soloPct}%`}
          label="unmatched in our index"
          sub={`${solo.toLocaleString()} of ${articles.toLocaleString()}`}
        />
        {contested > 0 && (
          <Figure
            value={firstWins.toLocaleString()}
            label="times first to report"
            sub={`of ${contested.toLocaleString()} stories several outlets covered`}
          />
        )}
      </div>

      {(notable.length > 0 || light.length > 0) && (
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)', margin: '0 0 10px' }}>
          Files{' '}
          {notable.map((o, i) => (
            <React.Fragment key={o.category}>
              {i > 0 && ' and '}
              <strong style={{ color: 'var(--text)' }}>{o.ratio}&times; more {o.category}</strong>
            </React.Fragment>
          ))}
          {notable.length > 0 && light.length > 0 && ', and '}
          {light.map(o => (
            <React.Fragment key={o.category}>
              <strong style={{ color: 'var(--text)' }}>
                {Math.round((1 - o.ratio) * 100)}% less {o.category}
              </strong>
            </React.Fragment>
          ))}
          {' '}than the average outlet we index.
        </p>
      )}

      <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
        {UNMATCHED_NOTE} {INDEX_NOTE}
        {coverage.week ? ` Week of ${coverage.week}.` : ''}
      </p>
    </section>
  )
}
