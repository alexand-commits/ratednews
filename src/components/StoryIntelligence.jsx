import React from 'react'
import { FRAMING_SETS } from '../server/coverage-watchlist'

/**
 * PREVIEW BUILD — story intelligence on the article page.
 *
 * What an article page can say that the source cannot. See
 * docs/story-intelligence-spec.md for the full plan and costings.
 *
 * DELIBERATELY computed at render time here, which is the wrong place for
 * production. The spec calls for computing this once per story inside
 * scripts/cluster.mjs and storing it, because a render-time computation repeats
 * the same work for every visitor. Doing it here costs one extra query and zero
 * schema changes, which is the right trade for finding out whether it is worth
 * having at all before building the pipeline for it.
 *
 * Renders NOTHING when it has nothing true to say. The framing split in
 * particular is rare — the weekly report found one on 3 of 11,675 stories — so
 * it has to be a highlight, never a fixture, and never an apology.
 */

// Geographic spread reads outlets.country, which is the outlet's home market —
// the same meaning the Outlets page uses. "19 UK outlets covered this" is a
// claim about who picked the story up, not about where the story happened.
const REGION_LABEL = {
  UK: 'UK', US: 'US', Europe: 'Europe', MiddleEast: 'Middle East',
  Africa: 'Africa', AsiaPac: 'Asia Pacific', Americas: 'Americas',
}

function spreadOf(members) {
  const counts = new Map()
  for (const m of members) {
    const c = m.outlets?.country
    if (!c) continue
    counts.set(c, (counts.get(c) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([country, n]) => ({ label: REGION_LABEL[country] || country, n }))
    .sort((a, b) => b.n - a.n)
}

// Same engine as the weekly Coverage Report's framingSplits(), run over one
// cluster instead of the whole corpus. A real split needs 2+ competing labels
// each chosen by 2+ DISTINCT publishers — one outlet using a word twice is not
// a disagreement.
function framingOf(members) {
  const out = []
  for (const set of FRAMING_SETS) {
    const usage = set.variants.map((label, i) => {
      const outlets = new Set()
      for (const m of members) {
        if (set.res[i].test(m.title || '')) outlets.add(m.outlets?.name || m.outlet_id)
      }
      return { label, outlets: [...outlets] }
    }).filter(u => u.outlets.length > 0)

    if (usage.length >= 2 && usage.filter(u => u.outlets.length >= 2).length >= 2) {
      out.push({ subject: set.subject, usage: usage.sort((a, b) => b.outlets.length - a.outlets.length) })
    }
  }
  return out.slice(0, 1) // one per story; more than that is noise
}

const Card = ({ children }) => (
  <div style={{
    background: 'var(--surface)', border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 10,
  }}>{children}</div>
)

const Label = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8,
  }}>{children}</div>
)

export default function StoryIntelligence({ members = [], totalOutlets = null }) {
  // Below three outlets there is no "coverage" to characterise.
  if (!members || members.length < 3) return null

  const spread = spreadOf(members)
  const framing = framingOf(members)
  if (!spread.length && !framing.length) return null

  const counted = members.length
  const undercount = totalOutlets && totalOutlets > counted

  return (
    <div style={{ marginBottom: 16 }}>
      {framing.map(f => (
        <Card key={f.subject}>
          <Label>🪞 The same story, different words</Label>
          <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text2)' }}>
            {f.usage.map(u => (
              <div key={u.label}>
                <strong style={{ color: 'var(--text)' }}>
                  {u.outlets.length} {u.outlets.length === 1 ? 'outlet' : 'outlets'}
                </strong>
                {' said '}
                <span style={{ color: 'var(--coral)', fontWeight: 600 }}>“{u.label}”</span>
                <span style={{ color: 'var(--text3)' }}> — {u.outlets.slice(0, 4).join(', ')}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {spread.length > 0 && (
        <Card>
          <Label>🌍 Who picked it up</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {spread.map(s => (
              <span key={s.label} style={{
                fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                background: 'var(--bg2)', color: 'var(--text2)', whiteSpace: 'nowrap',
              }}>
                {s.n} {s.label}
              </span>
            ))}
          </div>
          {/* Say what the numbers are OF. A count without its base is the one
              thing this site should not publish. */}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            Based on {counted} of {totalOutlets || counted} outlets
            {undercount ? ' whose coverage we have indexed' : ''}.
          </div>
        </Card>
      )}
    </div>
  )
}
