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


// ── Headline overlap ────────────────────────────────────────────────────────
// How much of this coverage is actually the same text.
//
// Measured over 701 stories: 61% have at least one near-identical pair and 18%
// have 30%+ of their pairs near-identical. Both ends are informative — six
// outlets running one agency's wording, or seven that each wrote their own.
//
// Reported as a COUNT, never as "syndicated". Two outlets can independently
// land on the same words for a simple factual story, so the honest statement is
// how many headlines match and the reader draws the conclusion. Counts, never
// conclusions.
const OVERLAP_STOP = new Set(('the a an and or but of to in on at for with from by as is are was were be been ' +
  'has have had will would could should says say said after before over under new more most it its his her ' +
  'their they them this that these those what which who how why when where').split(' '))

const tokens = t => new Set((t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/).filter(w => w.length > 2 && !OVERLAP_STOP.has(w)))

// Jaccard: shared words over total distinct words. 0.6 is the threshold where
// two headlines stop reading as independently written.
const SIMILAR_AT = 0.6

function overlapOf(members) {
  const toks = members.map(m => tokens(m.title))
  if (toks.length < 3) return null
  const linked = new Set()
  let pairs = 0, similar = 0
  for (let i = 0; i < toks.length; i++) {
    for (let j = i + 1; j < toks.length; j++) {
      const a = toks[i], b = toks[j]
      const inter = [...a].filter(x => b.has(x)).length
      const union = new Set([...a, ...b]).size
      pairs++
      if (union && inter / union >= SIMILAR_AT) { similar++; linked.add(i); linked.add(j) }
    }
  }
  if (!pairs) return null
  return { share: similar / pairs, matching: linked.size, total: members.length }
}

// ── Still developing ────────────────────────────────────────────────────────
// First covered over 12h ago, and someone published within the last 3. Fires on
// 20% of multi-outlet stories. Uses spans in hours, so it survives the
// timestamp problem in ingest.mjs (feeds without a pubDate get stamped at
// ingest, up to 15 minutes late) — noise at that scale, fatal for ordering.
function developingOf(members) {
  const ts = members.map(m => +new Date(m.published_at)).filter(n => !isNaN(n)).sort((a, b) => a - b)
  if (ts.length < 3) return null
  const hoursSince = t => (Date.now() - t) / 3600000
  const oldest = hoursSince(ts[0]), newest = hoursSince(ts[ts.length - 1])
  if (oldest > 12 && newest < 3) return { spanHours: Math.round(oldest) }
  return null
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
  const overlap = overlapOf(members)
  const developing = developingOf(members)
  if (!spread.length && !framing.length && !overlap && !developing) return null

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

      {overlap && overlap.matching >= 2 && (
        <Card>
          <Label>📄 How much of this is the same text</Label>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text)' }}>{overlap.matching} of {overlap.total}</strong>
            {' headlines use near-identical wording.'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Compared word-for-word across headlines. Outlets can land on the same words independently — we count, we don't conclude.
          </div>
        </Card>
      )}

      {overlap && overlap.matching === 0 && overlap.total >= 5 && (
        <Card>
          <Label>✍️ Independently written</Label>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)' }}>
            No two of these <strong style={{ color: 'var(--text)' }}>{overlap.total}</strong> headlines share enough wording to look like the same copy.
          </div>
        </Card>
      )}

      {developing && (
        <Card>
          <Label>🔄 Still developing</Label>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)' }}>
            First covered <strong style={{ color: 'var(--text)' }}>{developing.spanHours} hours ago</strong>, and outlets are still publishing on it.
          </div>
        </Card>
      )}

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
