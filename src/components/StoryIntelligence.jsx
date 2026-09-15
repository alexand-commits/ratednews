import React from 'react'
import { FRAMING_SETS } from '../server/coverage-watchlist'

/**
 * What this story's coverage looks like across every outlet carrying it —
 * the thing a reader cannot get from any single source, including ours.
 *
 * Presented as ONE panel, not a stack of cards. Three identically-styled boxes
 * read as a wall and gave the reader no idea which number mattered; the overlap
 * figure is the finding and everything else is supporting detail, so the layout
 * now says that.
 *
 * Computed at render time, which is the wrong place for production — see
 * docs/story-intelligence-spec.md. It belongs in scripts/cluster.mjs, computed
 * once per story. Acceptable at current traffic, not at scale.
 *
 * Renders NOTHING when it has nothing true to say.
 */

const REGION_LABEL = {
  UK: 'UK', US: 'US', Europe: 'Europe', MiddleEast: 'Middle East',
  Africa: 'Africa', AsiaPac: 'Asia Pacific', Americas: 'Americas',
  Canada: 'Canada', International: 'International',
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

function framingOf(members) {
  const out = []
  for (const set of FRAMING_SETS) {
    const usage = set.variants.map((label, i) => {
      const outlets = new Set()
      for (const m of members) {
        if (set.res[i].test(m.title || '') || set.res[i].test(m.summary || '')) {
          outlets.add(m.outlets?.name || m.outlet_id)
        }
      }
      return { label, outlets: [...outlets] }
    }).filter(u => u.outlets.length > 0)
    if (usage.length >= 2 && usage.filter(u => u.outlets.length >= 2).length >= 2) {
      out.push({ subject: set.subject, usage: usage.sort((a, b) => b.outlets.length - a.outlets.length) })
    }
  }
  return out.slice(0, 1)
}

// Headline overlap. Reported as a COUNT, never as "syndication" — outlets can
// land on the same words independently for a simple factual story, so we state
// how many match and let the reader conclude.
const OVERLAP_STOP = new Set(('the a an and or but of to in on at for with from by as is are was were be been ' +
  'has have had will would could should says say said after before over under new more most it its his her ' +
  'their they them this that these those what which who how why when where').split(' '))

const tokens = t => new Set((t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/).filter(w => w.length > 2 && !OVERLAP_STOP.has(w)))

const SIMILAR_AT = 0.6

function overlapOf(members) {
  const toks = members.map(m => tokens(m.title))
  if (toks.length < 3) return null
  const linked = new Set()
  let pairs = 0
  for (let i = 0; i < toks.length; i++) {
    for (let j = i + 1; j < toks.length; j++) {
      const a = toks[i], b = toks[j]
      const inter = [...a].filter(x => b.has(x)).length
      const union = new Set([...a, ...b]).size
      pairs++
      if (union && inter / union >= SIMILAR_AT) { linked.add(i); linked.add(j) }
    }
  }
  return pairs ? { matching: linked.size, total: members.length } : null
}

// Spans in hours, so this survives ingest.mjs stamping feeds without a pubDate
// at ingest time — up to 15 minutes late, noise at this scale.
function developingOf(members) {
  const ts = members.map(m => +new Date(m.published_at)).filter(n => !isNaN(n)).sort((a, b) => a - b)
  if (ts.length < 3) return null
  const h = t => (Date.now() - t) / 3600000
  const oldest = h(ts[0])
  return (oldest > 12 && h(ts[ts.length - 1]) < 3) ? { hours: oldest } : null
}

// "95 hours ago" is a number, not a duration anyone feels.
const ago = hours => hours < 36
  ? `${Math.round(hours)} hours ago`
  : `${Math.round(hours / 24)} days ago`

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: '0.5px solid var(--border)' }}>
      <span style={{
        flexShrink: 0, width: 66, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--text3)', paddingTop: 2,
      }}>{label}</span>
      <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text2)', minWidth: 0 }}>{children}</span>
    </div>
  )
}

export default function StoryIntelligence({ members = [], totalOutlets = null }) {
  if (!members || members.length < 3) return null

  const spread = spreadOf(members)
  const framing = framingOf(members)
  const overlap = overlapOf(members)
  const developing = developingOf(members)
  if (!spread.length && !framing.length && !overlap && !developing) return null

  const counted = members.length
  // cluster_size is a snapshot from the last clustering run and can lag the live
  // cluster query, which produced "Based on 47 of 43 outlets" — a count larger
  // than its own total. Only claim a denominator when it is actually bigger.
  const knownTotal = totalOutlets && totalOutlets > counted ? totalOutlets : null

  const hasHero = overlap && overlap.total >= 4
  const heroIsOverlap = hasHero && overlap.matching >= 2

  return (
    <div style={{
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderLeft: '2px solid var(--coral)',
      borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 16,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
        color: 'var(--text3)', textTransform: 'uppercase', marginBottom: hasHero ? 10 : 4,
      }}>
        About this coverage
      </div>

      {/* The finding, at the size of a finding. */}
      {heroIsOverlap && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'var(--font-playfair), serif', fontSize: 26, fontWeight: 700,
            color: 'var(--coral)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
          }}>
            {overlap.matching} of {overlap.total}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>
            headlines use near-identical wording
          </div>
        </div>
      )}

      {hasHero && !heroIsOverlap && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'var(--font-playfair), serif', fontSize: 22, fontWeight: 700,
            color: 'var(--text)', lineHeight: 1.15,
          }}>
            Independently written
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>
            No two of these {overlap.total} headlines share enough wording to look like the same copy
          </div>
        </div>
      )}

      {framing.map(f => (
        <Row key={f.subject} label="Wording">
          {f.usage.map((u, i) => (
            <React.Fragment key={u.label}>
              {i > 0 && <span style={{ color: 'var(--text3)' }}> · </span>}
              <strong style={{ color: 'var(--text)' }}>{u.outlets.length}</strong>
              {' said '}
              <span style={{ color: 'var(--coral)', fontWeight: 600 }}>“{u.label}”</span>
            </React.Fragment>
          ))}
        </Row>
      ))}

      {spread.length > 0 && (
        <Row label="Spread">
          {spread.slice(0, 6).map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <span style={{ color: 'var(--text3)' }}> · </span>}
              <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.n}</strong>
              {' '}{s.label}
            </React.Fragment>
          ))}
        </Row>
      )}

      {developing && (
        <Row label="Timeline">
          First covered <strong style={{ color: 'var(--text)' }}>{ago(developing.hours)}</strong>, and outlets are still publishing on it
        </Row>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
        Based on {counted}{knownTotal ? ` of ${knownTotal}` : ''} outlet{counted === 1 ? '' : 's'} we have indexed.
        {heroIsOverlap ? ' Headlines compared word-for-word — outlets can reach the same wording independently, so this is a count, not a conclusion.' : ''}
      </div>
    </div>
  )
}
