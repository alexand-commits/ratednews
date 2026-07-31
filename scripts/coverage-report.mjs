#!/usr/bin/env node
/**
 * Coverage Report compute — the data behind "posts only RatedNews can make".
 * Usage: node scripts/coverage-report.mjs   (weekly GH cron + manual)
 *
 * Reads 14 days of headlines (this week + prior week for deltas) and computes:
 *  - language watch: per-outlet headline counts for tracked terms
 *  - framing splits: same story cluster, competing labels
 *  - attention: biggest story, single-outlet story count, first-to-report
 *    league, median pickup lag
 * Stores ONE {kind:'coverage_report'} pack in social_drafts (updated in
 * place). The desk generator and /coverage-report page only ever read it.
 * Counting is deliberately dumb (word-boundary regex over headlines) so every
 * published number is auditable.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { WATCH_GROUPS, FRAMING_SETS } from '../src/server/coverage-watchlist.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const DAYS = 7

async function fetchHeadlines(sinceIso) {
  const rows = []
  for (let from = 0; from < 200000; from += 1000) {
    const { data: page, error } = await db.from('articles')
      .select('title, outlet_id, cluster_id, published_at, outlets(name)')
      .gte('published_at', sinceIso)
      .order('published_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(page || []))
    if (!page || page.length < 1000) break
  }
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
  const count = (pool, re) => {
    const byBrand = new Map()
    let total = 0
    for (const r of pool) {
      if (!re.test(r.title || '')) continue
      total++
      const b = brandOf(r.outlets?.name)
      byBrand.set(b, (byBrand.get(b) || 0) + 1)
    }
    return { total, byBrand }
  }
  return WATCH_GROUPS.map(g => ({
    group: g.group,
    terms: g.variants.map(v => {
      const now = count(rows, v.re)
      const prev = count(prevRows, v.re)
      return {
        term: v.label,
        total: now.total,
        prevTotal: prev.total,
        // Per-1k-headline rates — the honest week-over-week comparison when
        // the corpus itself grows (feeds get added/resurrected)
        rate: rows.length ? +(now.total / rows.length * 1000).toFixed(2) : 0,
        prevRate: prevRows.length ? +(prev.total / prevRows.length * 1000).toFixed(2) : 0,
        topOutlets: [...now.byBrand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([outlet, n]) => ({ outlet, count: n })),
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
  // Biggest stories first, one split per subject to keep the report varied
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
      // Pickup lag: first article → first article from a DIFFERENT publisher
      const second = byTime.find(m => brandOf(m.outlets?.name) !== firstBrand)
      const gapMins = second ? (new Date(second.published_at) - new Date(byTime[0].published_at)) / 60000 : null
      // A "first to report" win needs a ≥5 min clear lead — wire syndication
      // republishes with the agency's original timestamp, so near-simultaneous
      // firsts say nothing about who actually broke the story.
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

async function main() {
  const now = Date.now()
  const weekAgo = new Date(now - DAYS * 86400e3).toISOString()
  const twoWeeksAgo = new Date(now - 2 * DAYS * 86400e3).toISOString()

  console.log('📊 Coverage Report — fetching 14d of headlines…')
  const all = await fetchHeadlines(twoWeeksAgo)
  const rows = all.filter(r => r.published_at >= weekAgo)
  const prevRows = all.filter(r => r.published_at < weekAgo)
  console.log(`this week: ${rows.length} headlines · prior week: ${prevRows.length}`)

  const report = {
    kind: 'coverage_report',
    generatedAt: new Date().toISOString(),
    windowDays: DAYS,
    since: weekAgo,
    corpus: {
      headlines: rows.length,
      prevHeadlines: prevRows.length,
      outlets: new Set(rows.map(r => r.outlets?.name).filter(Boolean)).size,
    },
    language: languageWatch(rows, prevRows),
    framing: framingSplits(rows),
    attention: attention(rows),
  }

  const { data: existing } = await db.from('social_drafts')
    .select('id').eq('pack->>kind', 'coverage_report').limit(1).maybeSingle()
  if (existing) await db.from('social_drafts').update({ pack: report }).eq('id', existing.id)
  else await db.from('social_drafts').insert({ pack: report })

  console.log(`stored. biggest story: "${report.attention.biggest?.story?.slice(0, 60)}" (${report.attention.biggest?.outlets} outlets)`)
  for (const g of report.language) {
    const top = g.terms[0]
    console.log(`${g.group}: '${top.term}' ${top.total} headlines (prev ${top.prevTotal}) — top: ${top.topOutlets.slice(0, 3).map(o => `${o.outlet} ${o.count}`).join(', ')}`)
  }
  console.log(`framing splits found: ${report.framing.length}`)
  console.log(`first-to-report: ${report.attention.firstToReport.slice(0, 3).map(f => `${f.outlet} ${f.wins}`).join(', ')} of ${report.attention.qualifyingStories} stories`)
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1) })
