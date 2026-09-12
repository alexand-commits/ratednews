/**
 * Coverage Report compute core — shared by scripts/coverage-report.mjs (the
 * Monday cron / CLI) and /api/coverage-compute (the desk's on-demand button).
 *
 * Fetch strategy — third attempt, hard-won:
 *  - OFFSET pagination: quadratic (page N re-scans all prior rows). Burned
 *    the disk-IO budget.
 *  - Keyset via or(lt, and(eq,lt)): planner walks the whole newer range per
 *    page filtering rows out — fine at 72h, quadratic again at 14 days.
 *  - THIS: hour-chunked pure ranges (gte/lt on indexed published_at). Every
 *    request is a bounded index range scan; chunks that hit the 1000-row cap
 *    split themselves in half; a small worker pool keeps wall time ~15s.
 * Counting stays dumb regex over headlines so every published number is
 * auditable.
 */
import { WATCH_GROUPS, FRAMING_SETS } from './coverage-watchlist.js'

const DAYS = 7

export async function fetchHeadlines(db, sinceMs, untilMs) {
  const HOUR = 3600e3
  const chunks = []
  for (let t = sinceMs; t < untilMs; t += HOUR) chunks.push([t, Math.min(t + HOUR, untilMs)])

  const rows = []
  async function fetchChunk(fromMs, toMs, attempt = 0) {
    const { data, error } = await db.from('articles')
      .select('id, title, outlet_id, cluster_id, published_at, outlets(name)')
      .gte('published_at', new Date(fromMs).toISOString())
      .lt('published_at', new Date(toMs).toISOString())
      .limit(1000)
    if (error) {
      // Transient saturation (parallel chunks competing for disk) shows up as
      // statement timeouts on queries that run in ~200ms alone — back off and
      // retry twice before giving up on the whole sweep.
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        return fetchChunk(fromMs, toMs, attempt + 1)
      }
      throw new Error(`chunk ${new Date(fromMs).toISOString()}: ${error.message}`)
    }
    if (data.length >= 1000 && toMs - fromMs > 60e3) {
      // Chunk overflowed the row cap — split and refetch both halves
      const mid = Math.floor((fromMs + toMs) / 2)
      await fetchChunk(fromMs, mid)
      await fetchChunk(mid, toMs)
      return
    }
    rows.push(...data)
  }

  // 2, not more: six parallel range reads saturated disk throughput and
  // timed out chunks that run in 200ms alone. Sweeps take ~45s — fine for
  // both the cron and the API route's 300s ceiling.
  const CONCURRENCY = 2
  const queue = [...chunks]
  async function worker() {
    while (queue.length) {
      const c = queue.shift()
      if (!c) break
      await fetchChunk(c[0], c[1])
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return rows
}

// Section outlets post-consolidation share a parent brand — collapse ONLY the
// known section families so "BBC Sport" and "BBC News" don't split one
// publisher's counts. Everything else keeps its exact name (a generic suffix
// strip mangled standalone brands: "GB News" → "GB").
const FAMILIES = [
  [/^BBC\b/, 'BBC'],
  [/^Guardian\b|^The Guardian$/, 'The Guardian'],
  [/^NYT\b|^New York Times$/, 'New York Times'],
  [/^Sky News\b/, 'Sky News'],
  [/^Independent\b|^The Independent$/, 'The Independent'],
  [/^Fox News\b/, 'Fox News'],
  [/^NPR\b/, 'NPR'],
  [/^The Local\b/, 'The Local'],
]
function brandOf(name) {
  const n = (name || '').trim()
  for (const [re, brand] of FAMILIES) if (re.test(n)) return brand
  return n
}

function languageWatch(rows, prevRows) {
  const count = (pool, re, keepMatches = false) => {
    const byBrand = new Map()
    const matches = []
    let total = 0
    for (const r of pool) {
      if (!re.test(r.title || '')) continue
      total++
      const b = brandOf(r.outlets?.name)
      byBrand.set(b, (byBrand.get(b) || 0) + 1)
      if (keepMatches) matches.push({ t: (r.title || '').slice(0, 140), o: b, d: r.published_at })
    }
    // Newest first, UNCAPPED (safety ceiling only) — if the bar says an
    // outlet had 32, the audit list must show all 32.
    matches.sort((a, b) => (a.d < b.d ? 1 : -1))
    return { total, byBrand, matches: matches.slice(0, 1200) }
  }
  return WATCH_GROUPS.map(g => ({
    group: g.group,
    terms: g.variants.map(v => {
      const now = count(rows, v.re, true)
      const prev = count(prevRows, v.re)
      return {
        term: v.label,
        total: now.total,
        prevTotal: prev.total,
        // Per-1k-headline rates — corpus-growth-adjusted week-over-week
        rate: rows.length ? +(now.total / rows.length * 1000).toFixed(2) : 0,
        prevRate: prevRows.length ? +(prev.total / prevRows.length * 1000).toFixed(2) : 0,
        topOutlets: [...now.byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([outlet, n]) => ({ outlet, count: n })),
        headlines: now.matches, // click-to-audit on /coverage-report
      }
    }).sort((a, b) => b.total - a.total),
  }))
}

function framingSplits(rows) {
  const clusters = new Map()
  for (const r of rows) {
    if (!r.cluster_id) continue
    let c = clusters.get(r.cluster_id)
    if (!c) { c = { members: [] }; clusters.set(r.cluster_id, c) }
    c.members.push(r)
  }
  const splits = []
  for (const c of clusters.values()) {
    if (c.members.length < 6) continue
    for (const set of FRAMING_SETS) {
      const usage = set.variants.map((label, i) => {
        const brands = new Set()
        for (const m of c.members) if (set.res[i].test(m.title || '')) brands.add(brandOf(m.outlets?.name))
        return { label, outlets: brands.size, sample: brands.size ? [...brands].slice(0, 4) : [] }
      }).filter(u => u.outlets > 0)
      // A real split: 2+ competing labels, each chosen by 2+ publishers
      if (usage.length >= 2 && usage.filter(u => u.outlets >= 2).length >= 2) {
        const anchor = c.members[0]
        splits.push({
          subject: set.subject,
          story: anchor.title,
          totalOutlets: new Set(c.members.map(m => brandOf(m.outlets?.name))).size,
          usage: usage.sort((a, b) => b.outlets - a.outlets),
        })
      }
    }
  }
  const seen = new Set()
  return splits.sort((a, b) => b.totalOutlets - a.totalOutlets)
    .filter(s => { if (seen.has(s.subject)) return false; seen.add(s.subject); return true })
    .slice(0, 5)
}

function attention(rows) {
  const clusters = new Map()
  for (const r of rows) {
    if (!r.cluster_id) continue
    let c = clusters.get(r.cluster_id)
    if (!c) { c = { members: [] }; clusters.set(r.cluster_id, c) }
    c.members.push(r)
  }
  let biggest = null
  let singleOutletStories = 0
  const firstWins = new Map()
  for (const c of clusters.values()) {
    const byTime = c.members.slice().sort((a, b) => new Date(a.published_at) - new Date(b.published_at))
    const brands = new Set(byTime.map(m => brandOf(m.outlets?.name)))
    if (brands.size === 1) { singleOutletStories++; continue }
    if (!biggest || brands.size > biggest.outlets) {
      biggest = { story: byTime[byTime.length - 1].title, outlets: brands.size }
    }
    if (brands.size >= 5) {
      const firstBrand = brandOf(byTime[0].outlets?.name)
      const second = byTime.find(m => brandOf(m.outlets?.name) !== firstBrand)
      const gapMins = second ? (new Date(second.published_at) - new Date(byTime[0].published_at)) / 60000 : null
      // A win needs a ≥5 min clear lead — wire syndication republishes with
      // the agency's original timestamp; closer calls say nothing.
      if (gapMins != null && gapMins >= 5) firstWins.set(firstBrand, (firstWins.get(firstBrand) || 0) + 1)
    }
  }
  return {
    totalStories: clusters.size,
    biggest,
    singleOutletStories,
    firstToReport: [...firstWins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([outlet, wins]) => ({ outlet, wins })),
    qualifyingStories: [...firstWins.values()].reduce((s, n) => s + n, 0),
  }
}

/**
 * Which of the week's most-covered stories each major outlet carried.
 *
 * Only possible because articles are already clustered into stories — this is
 * the thing no one can copy without the whole pipeline.
 *
 * Framed as a COUNT, not a verdict. "Covered 6 of 8" is a fact; "ignored two
 * stories" is an accusation, and there are many innocent reasons a general
 * outlet skips a story — beat, region, a wire deal, the day it fell on. The
 * moment this page starts implying motive it loses the neutrality that makes
 * every other number on it credible.
 *
 * Two guards against unfair comparisons:
 *  - "Major outlets" are the highest-VOLUME publishers of the week, so nothing
 *    is measured against a title that only files a few pieces a day.
 *  - A story must clear MIN_OUTLETS distinct brands to count, so the set is
 *    stories that were unambiguously the week's news rather than one section's.
 * Neither makes cross-region comparison meaningful, which the methodology says
 * out loud rather than hiding.
 */
function coverageCompleteness(rows, { storyCount = 8, outletCount = 10, minOutlets = 15 } = {}) {
  const clusters = new Map()
  const volume = new Map()
  for (const r of rows) {
    const b = brandOf(r.outlets?.name)
    if (b) volume.set(b, (volume.get(b) || 0) + 1)
    if (!r.cluster_id || !b) continue
    let c = clusters.get(r.cluster_id)
    if (!c) { c = { brands: new Set(), newest: r }; clusters.set(r.cluster_id, c) }
    c.brands.add(b)
    if (r.published_at > c.newest.published_at) c.newest = r
  }

  const big = [...clusters.values()]
    .filter(c => c.brands.size >= minOutlets)
    .sort((a, b) => b.brands.size - a.brands.size)
    .slice(0, storyCount)
  // Below three stories there is no pattern to report, only noise.
  if (big.length < 3) return null

  const majors = [...volume.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, outletCount)
    .map(([brand]) => brand)

  const stories = big.map(c => ({ story: c.newest.title, outlets: c.brands.size }))

  const byOutlet = majors
    .map(outlet => {
      const missed = big.map((c, i) => (c.brands.has(outlet) ? -1 : i)).filter(i => i >= 0)
      return { outlet, covered: big.length - missed.length, of: big.length, missed }
    })
    .sort((a, b) => b.covered - a.covered || a.outlet.localeCompare(b.outlet))

  return { minOutlets, stories, byOutlet }
}

export async function computeCoverageReport(db) {
  const now = Date.now()
  const weekAgo = now - DAYS * 86400e3
  const twoWeeksAgo = now - 2 * DAYS * 86400e3

  const all = await fetchHeadlines(db, twoWeeksAgo, now)
  const weekAgoIso = new Date(weekAgo).toISOString()
  const rows = all.filter(r => r.published_at >= weekAgoIso)
  const prevRows = all.filter(r => r.published_at < weekAgoIso)

  const generatedAt = new Date().toISOString()
  return {
    kind: 'coverage_report',
    // Stable per-week key: the storage key today, and the URL slug when the
    // archive gets /coverage-report/[week]. Date-only so a re-run inside the
    // same day updates that week instead of forking it.
    week: generatedAt.slice(0, 10),
    generatedAt,
    windowDays: DAYS,
    since: weekAgoIso,
    corpus: {
      headlines: rows.length,
      prevHeadlines: prevRows.length,
      outlets: new Set(rows.map(r => r.outlets?.name).filter(Boolean)).size,
    },
    language: languageWatch(rows, prevRows),
    framing: framingSplits(rows),
    attention: attention(rows),
    completeness: coverageCompleteness(rows),
  }
}

// One row PER WEEK, keyed on report.week. Nothing is deleted.
//
// This used to keep a single row and overwrite it every Monday, so 52 unique
// datasets a year collapsed to one and every past week was destroyed. They are
// the most defensible thing the site produces — no one else can compute
// same-story vocabulary splits without the clustering pipeline — and they are
// only citable if the URL a journalist links still shows the numbers they
// quoted. So: accumulate.
//
// Re-running inside the same week updates that week's row rather than adding a
// second, which keeps the cron idempotent and preserves the old dedupe
// guarantee where it actually mattered.
//
// Growth is ~52 packs a year at a few hundred KB each. Fine to leave unbounded
// for years; if it ever needs a cap, prune oldest-first — never newest.
export async function storeCoverageReport(db, report) {
  const week = report.week
  if (!week) throw new Error('storeCoverageReport: report.week is required')

  const { data: sameWeek } = await db.from('social_drafts')
    .select('id').eq('pack->>kind', 'coverage_report').eq('pack->>week', week)
    .order('created_at', { ascending: false })

  if (sameWeek?.length) {
    await db.from('social_drafts').update({ pack: report }).eq('id', sameWeek[0].id)
    // Collapse any duplicates WITHIN this week only. Other weeks are history.
    for (const stray of sameWeek.slice(1)) {
      await db.from('social_drafts').delete().eq('id', stray.id)
    }
  } else {
    await db.from('social_drafts').insert({ pack: report })
  }
}
