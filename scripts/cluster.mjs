#!/usr/bin/env node
/**
 * RatedNews Article Clustering Script
 * Usage: node scripts/cluster.mjs
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Groups articles covering the same story across different outlets.
 * Writes cluster_id (UUID) and cluster_peers (JSONB) directly to each article
 * so the feed card can show the "Also covered by other outlets" chip with an
 * accurate count — without guessing from whatever happens to be loaded in memory.
 *
 * cluster_peers shape (stored on every article in a cluster):
 *   [{ id, outlet_id, outlets: { name } }, ...]
 *   — exactly the fields NewsCard needs (logos render from the name).
 *
 * Algorithm:
 *   1. Fetch all articles from the last CLUSTER_WINDOW_HOURS
 *   2. Extract significant words from each title (4+ chars, not stop words,
 *      lightly stemmed so stakes/stake and plans/plan count as one word)
 *   3. Anchor-star clustering: each cluster is an anchor article plus every
 *      article sharing ≥ MIN_OVERLAP significant words WITH THE ANCHOR, then
 *      a one-hop rescue pass attaches remaining orphans to the cluster of an
 *      article they overlap (against a snapshot — no chains). Full transitive
 *      union-find was tried and collapsed 5k unrelated articles into one blob;
 *      the old greedy pass permanently claimed articles for whichever cluster
 *      saw them first, orphaning even identical Reuters/CNA headlines.
 *   4. Components with 2+ distinct outlets become clusters; each reuses the
 *      cluster_id most of its members already carry (stable across runs —
 *      fresh UUIDs every run silently defeated the social scout's per-story
 *      cool-down and seen-memory, which match on cluster_id)
 *   5. Write cluster_id + cluster_peers to all clustered articles
 *   6. Clear cluster_id / cluster_peers on articles in the window that
 *      didn't make it into any cluster (stale data cleanup)
 */

import { createClient }  from '@supabase/supabase-js'
import { fetchHeadlines }  from '../src/server/coverage-compute.js'
import { randomUUID }    from 'crypto'
import dotenv            from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CLUSTER_WINDOW_HOURS = Number(process.env.CLUSTER_WINDOW_HOURS || 48)  // how far back to look for story clusters.
// Trimmed from 72h: clustering action is concentrated in a story's first 24–48h,
// so re-scanning hours 49–72 every 15-min run was ~a third of the read cost for
// the marginal case of a 3-day-old story picking up a late outlet. Existing story
// pages resolve cluster_id live at request time, so a smaller window never shrinks
// what an already-formed story shows. Bump back to 72 to revert.
// ── Tunables. Env-overridable so DRY_RUN=1 can sweep configurations against the
// live corpus without editing code. Defaults are the shipped behaviour.
const num = (name, dflt) => (process.env[name] ? Number(process.env[name]) : dflt)

const MIN_OVERLAP        = num('MIN_OVERLAP', 3)   // significant words that must overlap
// The rescue pass joins orphans to an existing cluster. Held to the same low bar
// as the main pass it produced outright false joins (an Oasis article landing in
// a Liverpool-vs-Atletico cluster), so it can be required to be stricter.
// 4, not MIN_OVERLAP. Measured on a live 48h corpus: at 3 an Oasis-ticket
// article was absorbed into a 51-article Liverpool-vs-Atletico cluster; at 4 it
// lands in a correct 3-article Oasis cluster. Cluster COUNT is identical either
// way (3695), so this buys precision without fragmenting.
const RESCUE_MIN_OVERLAP = num('RESCUE_MIN_OVERLAP', 4)
// Tokens appearing in more than this many titles carry no story identity and are
// skipped when generating candidate pairs.
const TOKEN_CAP          = num('TOKEN_CAP', 250)
// Require at least one shared token RARER than this to bind two articles. Common
// entity names ("liverpool", "atletico", "madrid") trivially give 3 overlaps for
// every article about one fixture, merging previews, betting offers, TV guides
// and match reports into a single "story". 0 disables the requirement.
const DISTINCTIVE_DF     = num('DISTINCTIVE_DF', 0)
// Cap how many articles one publisher can contribute to a cluster (0 = no cap).
// One local outlet posting 15 pieces on a fixture shouldn't define the cluster.
// 3. One local outlet filed 15 of 27 pieces on a single fixture. Capping does
// NOT cost source counts on real stories — the Philippine-ferry cluster keeps
// all 52 outlets, dropping only same-publisher duplicates (84 -> 77 articles).
const MAX_PER_PUBLISHER  = num('MAX_PER_PUBLISHER', 3)
const PEER_STORE_CAP     = num('PEER_STORE_CAP', 8)
const DRY_RUN            = process.env.DRY_RUN === '1'

// Service journalism and affiliate filler, not stories. These share every
// entity name with real coverage of the same fixture ("Liverpool", "Atletico",
// "Madrid"), so no overlap threshold can separate them — a betting offer and a
// match report are genuinely about the same teams. Excluding them from
// CLUSTERING keeps "N sources covering this" honest: 20 outlets reporting a
// match is a story, 20 bookmaker promos is not. They still appear in the feed
// as normal articles; they just don't inflate anyone's coverage count.
const JUNK_TITLE_RE = new RegExp([
  // Bookmaker / affiliate promos
  '\\bbetting\\b', '\\bbookmaker', 'sky ?bet\\b', 'bet ?365', 'ladbrokes',
  'paddy power', 'william hill', 'free bets?\\b', 'sign-?up offer',
  'offer:? ?\\d+/\\d+', '\\b\\d+/\\d+ (on|odds)\\b', 'best odds', '\\bacca\\b',
  'promo code', 'discount code', 'deal of the day',
  // Tipping/preview filler — "prediction, time, odds" in either order
  'predictions?.{0,30}\\bodds\\b', '\\bodds\\b.{0,30}predictions?',
  // Service journalism: how/when to watch
  'what tv channel', 'what channel', 'how to watch', 'live ?stream',
  'kick-?off time', 'start time and', 'tv channel and',
].join('|'), 'i')

const isJunk = title => JUNK_TITLE_RE.test(title || '')
const BATCH_SIZE           = 40  // articles per DB upsert batch. Dropped from 100:
// 100-row upserts of the cluster_peers JSONB were hitting Postgres statement
// timeouts under write pressure (heavy JSONB column + index churn). Smaller
// batches keep each statement well under the timeout and shorten lock hold time.

// Stop words — keep in sync with FeedPage and ArticlePage
const STOP = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','but','with',
  'from','by','as','is','are','was','were','be','been','has','have','had',
  'its','their','this','that','these','those','how','why','what','who',
  'when','where','says','said','will','can','may','over','after','before',
  'amid','about','into','new','first','second','just','also','more',
])

// Light stemming — just plural forms. Exact-match overlap kept same-story
// headlines apart ("plan to sell stakes" vs "plans stake sale" shared only
// one word). Deliberately shallow: no -ing/-ed stripping, which over-merges.
function stem(w) {
  if (w.length > 4) {
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y'
    if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2)
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  }
  return w
}

function sigWords(title) {
  return [...new Set(
    (title || '').toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w)).map(stem)
  )]
}

async function main() {
  console.log('🔗 RatedNews Article Clustering')
  console.log('================================\n')

  // Maintenance pause — a {kind:'maintenance', pause_cluster:true} row in
  // social_drafts makes every cron tick a no-op. Exists so the DB can be
  // given a genuinely quiet window to recover (IO budget refill, autovacuum)
  // without needing workflow-file edits. Toggle by inserting/deleting the row.
  const { data: pause } = await supabase.from('social_drafts')
    .select('id').eq('pack->>kind', 'maintenance').limit(1).maybeSingle()
  if (pause) {
    console.log('⏸ maintenance pause row present — skipping this run')
    return
  }

  // ── Cadence guard ──────────────────────────────────────────────────────────
  // Measured: one run re-reads ~29,600 rows (177s) to place ~54 new articles —
  // 0.2% of the corpus. Across 96 runs/day that's 2.84M row-reads and ~4.7
  // HOURS of database read time, almost all of it re-deriving clusters that
  // didn't change. Halving the cadence halves all of that for no algorithm
  // risk: ingest still runs every 15 min so articles appear in the feed
  // immediately; they just wait a little longer for their coverage badge.
  //
  // Enforced here rather than in .github/workflows (the deploy token has no
  // `workflow` scope), so the cron still ticks every 15 min and every other
  // tick exits in a couple of cheap queries.
  // Set MIN_RUN_INTERVAL_MIN=0 to disable.
  const MIN_RUN_INTERVAL_MIN = num('MIN_RUN_INTERVAL_MIN', 25)
  const STATE_KIND = 'cluster_state'
  let stateRowId = null
  if (MIN_RUN_INTERVAL_MIN > 0 && !DRY_RUN) {
    const { data: state } = await supabase.from('social_drafts')
      .select('id, pack').eq('pack->>kind', STATE_KIND)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    stateRowId = state?.id ?? null
    const last = state?.pack?.last_run ? Date.parse(state.pack.last_run) : 0
    const minsSince = (Date.now() - last) / 60000
    if (last && minsSince < MIN_RUN_INTERVAL_MIN) {
      console.log(`⏭ last run ${minsSince.toFixed(1)}min ago (< ${MIN_RUN_INTERVAL_MIN}) — skipping`)
      return
    }
  }

  const cutoff = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  // Fetch all articles in the window with outlet info.
  // (No accuracy_score filter — AI scoring was removed; clustering is title-word
  //  overlap only, so it works on every ingested article.)
  // Hour-chunked fetch via the shared core. Third pagination approach and
  // the one that actually seeks: OFFSET was quadratic; the or() keyset made
  // the planner FILTER-walk the whole newer range per page (still ~700k
  // row-touches per run — it kept burning the disk-IO budget for two weeks
  // while looking fixed). Pure gte/lt hour ranges are bounded index scans.
  let articles
  // DRY_CACHE lets a dry-run sweep reuse one fetched corpus across many configs
  // instead of re-reading 48h from the DB each time. Dev-only; ignored unless
  // DRY_RUN is set, so a real cron run can never read stale articles.
  const cachePath = DRY_RUN && process.env.DRY_CACHE ? process.env.DRY_CACHE : null
  const fs = await import('node:fs')
  if (cachePath && fs.existsSync(cachePath)) {
    articles = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    // Trim to the requested window so a narrower CLUSTER_WINDOW_HOURS can be
    // compared against the same cached corpus.
    const winCut = Date.now() - CLUSTER_WINDOW_HOURS * 3600e3
    const before = articles.length
    articles = articles.filter(a => new Date(a.published_at).getTime() >= winCut)
    console.log(`(dry-run cache: ${articles.length}/${before} articles within ${CLUSTER_WINDOW_HOURS}h)`)
  } else {
    try {
      articles = await fetchHeadlines(supabase, Date.now() - CLUSTER_WINDOW_HOURS * 3600e3, Date.now())
    } catch (err) {
      console.error('Failed to fetch articles:', err.message)
      process.exit(1)
    }
    if (cachePath) fs.writeFileSync(cachePath, JSON.stringify(articles))
  }

  console.log(`Fetched ${articles.length} articles from last ${CLUSTER_WINDOW_HOURS}h\n`)

  // Precompute significant word sets
  // Junk is excluded from the POOL, not from `articles` — so anything that
  // previously landed in a cluster still gets its stale cluster_id cleared by
  // the clear-updates pass below.
  const junkCount = articles.filter(a => isJunk(a.title)).length
  const pool = articles.filter(a => !isJunk(a.title)).map(a => ({
    ...a,
    words: new Set(sigWords(a.title)),
  }))

  // ── Union-find clustering ──────────────────────────────────────────────────
  // Inverted token index → only articles sharing at least one word are compared
  const index = new Map()
  pool.forEach((a, i) => {
    for (const w of a.words) {
      if (!index.has(w)) index.set(w, [])
      index.get(w).push(i)
    }
  })

  // Words this common carry no story identity — skip them when generating
  // candidate pairs, both for precision and to keep the pairing loop
  // O(rare-word matches) instead of O(n²). (TOKEN_CAP is a tunable up top.)
  const sharedCounts = (i, skipAssigned, assigned) => {
    const m = new Map() // candidate index → { n, distinctive }
    for (const w of pool[i].words) {
      const post = index.get(w)
      if (post.length > TOKEN_CAP) continue
      // Does this token actually identify a story, or is it just a common
      // entity that every article about the same fixture/person shares?
      const isDistinctive = DISTINCTIVE_DF > 0 && post.length <= DISTINCTIVE_DF
      for (const j of post) {
        if (j === i) continue
        if (skipAssigned && assigned.has(j)) continue
        const cur = m.get(j) || { n: 0, distinctive: false }
        cur.n++
        if (isDistinctive) cur.distinctive = true
        m.set(j, cur)
      }
    }
    return m
  }
  const binds = (s, threshold) =>
    s.n >= threshold && (DISTINCTIVE_DF === 0 || s.distinctive)

  // Main pass: anchor stars. Every member overlaps the anchor directly.
  const assigned = new Map() // pool index → clustersRaw index
  const clustersRaw = []     // [{ memberIdx: [pool indices] }]
  for (let i = 0; i < pool.length; i++) {
    if (assigned.has(i)) continue
    const counts = sharedCounts(i, true, assigned)
    const memberIdx = []
    for (const [j, s] of counts) {
      if (binds(s, MIN_OVERLAP) && pool[j].outlet_id !== pool[i].outlet_id) memberIdx.push(j)
    }
    if (!memberIdx.length) continue // singleton — not a cluster
    const cn = clustersRaw.length
    clustersRaw.push({ memberIdx: [i, ...memberIdx] })
    assigned.set(i, cn)
    memberIdx.forEach(j => assigned.set(j, cn))
  }

  // Rescue pass: orphans overlapping an already-clustered article join its
  // cluster. Matched against a snapshot of the main pass, so a rescued
  // article can't pull in further orphans — one hop, no chains.
  const snapshot = new Map(assigned)
  for (let i = 0; i < pool.length; i++) {
    if (snapshot.has(i)) continue
    const counts = sharedCounts(i, false, snapshot)
    let best = null, bestN = 0
    for (const [j, s] of counts) {
      if (binds(s, RESCUE_MIN_OVERLAP) && snapshot.has(j) && s.n > bestN) { best = j; bestN = s.n }
    }
    if (best != null) clustersRaw[snapshot.get(best)].memberIdx.push(i)
  }

  // One publisher posting 15 pieces on a fixture shouldn't define the cluster.
  // Keep the anchor plus the first N per outlet (members stay in anchor-first,
  // newest-first order).
  const capPerPublisher = ms => {
    if (MAX_PER_PUBLISHER <= 0) return ms
    const seen = new Map()
    return ms.filter(m => {
      const k = m.outlet_id || 'unknown'
      const n = (seen.get(k) || 0) + 1
      seen.set(k, n)
      return n <= MAX_PER_PUBLISHER
    })
  }

  const components = clustersRaw
    .map(c => capPerPublisher(c.memberIdx.map(ix => pool[ix])))
    .filter(ms => new Set(ms.map(m => m.outlet_id)).size >= 2)
    .sort((a, b) => b.length - a.length)

  // Stable ids: reuse the cluster_id most members already carry (biggest
  // component wins a contested id; the rest mint fresh UUIDs).
  const usedIds = new Set()
  const clusters = components.map(members => {
    const counts = new Map()
    for (const m of members) if (m.cluster_id) counts.set(m.cluster_id, (counts.get(m.cluster_id) || 0) + 1)
    const clusterId = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).find(id => !usedIds.has(id)) || randomUUID()
    usedIds.add(clusterId)
    return { clusterId, members }
  })

  const clusteredCount = clusters.reduce((s, c) => s + c.members.length, 0)
  console.log(`Found ${clusters.length} clusters spanning ${clusteredCount} articles\n`)

  // ── DRY_RUN: report quality, write nothing ─────────────────────────────────
  // Lets a config be swept against the live corpus before it touches the DB.
  // Watch BOTH directions: too loose merges unrelated stories, too tight
  // fragments one story into many small clusters.
  if (DRY_RUN) {
    const sizes = clusters.map(c => c.members.length)
    const bucket = { '2': 0, '3-5': 0, '6-10': 0, '11-20': 0, '21-50': 0, '50+': 0 }
    for (const n of sizes) {
      if (n === 2) bucket['2']++
      else if (n <= 5) bucket['3-5']++
      else if (n <= 10) bucket['6-10']++
      else if (n <= 20) bucket['11-20']++
      else if (n <= 50) bucket['21-50']++
      else bucket['50+']++
    }
    const pubsOf = ms => new Set(ms.map(m => m.outlet_id)).size
    console.log(`excluded as junk (betting/TV-guide/affiliate): ${junkCount}`)
    console.log(`CONFIG  MIN_OVERLAP=${MIN_OVERLAP} RESCUE=${RESCUE_MIN_OVERLAP} TOKEN_CAP=${TOKEN_CAP} DISTINCTIVE_DF=${DISTINCTIVE_DF} MAX_PER_PUB=${MAX_PER_PUBLISHER}`)
    console.log(`clusters=${clusters.length} clustered=${clusteredCount} singles=${pool.length - clusteredCount} largest=${sizes[0] || 0}`)
    console.log(`sizes ${JSON.stringify(bucket)}`)
    // FIND=<substring> — print the cluster containing that headline, so a
    // specific false join can be checked config-by-config rather than inferred
    // from aggregates.
    if (process.env.FIND) {
      const needle = process.env.FIND.toLowerCase()
      const hit = clusters.find(c => c.members.some(m => (m.title || '').toLowerCase().includes(needle)))
      if (!hit) {
        console.log(`\nFIND "${process.env.FIND}": not in ANY cluster (left as a single)`)
      } else {
        console.log(`\nFIND "${process.env.FIND}" -> cluster of ${hit.members.length} articles / ${new Set(hit.members.map(m => m.outlet_id)).size} outlets:`)
        for (const m of hit.members.slice(0, 14)) {
          console.log(`   [${(m.outlets?.name || '?').slice(0, 18).padEnd(18)}] ${m.title.slice(0, 70)}`)
        }
        if (hit.members.length > 14) console.log(`   … +${hit.members.length - 14} more`)
      }
    }

    // How many clusters actually SPAN more than 24h? Those are the only ones a
    // narrower window could splinter — everything else is fully contained.
    const spans = clusters.map(c => {
      const ts = c.members.map(m => new Date(m.published_at).getTime())
      return (Math.max(...ts) - Math.min(...ts)) / 3600e3
    })
    const over24 = spans.filter(h => h > 24).length
    const over12 = spans.filter(h => h > 12).length
    console.log(`cluster time-span: >12h ${over12}/${clusters.length} (${(100*over12/clusters.length).toFixed(1)}%), >24h ${over24}/${clusters.length} (${(100*over24/clusters.length).toFixed(1)}%)`)

    const topN = Number(process.env.SHOW || 3)
    for (const c of clusters.slice(0, topN)) {
      console.log(`\n--- cluster: ${c.members.length} articles / ${pubsOf(c.members)} outlets ---`)
      for (const m of c.members.slice(0, 12)) {
        console.log(`   [${(m.outlets?.name || '?').slice(0, 20).padEnd(20)}] ${m.title.slice(0, 72)}`)
      }
      if (c.members.length > 12) console.log(`   … +${c.members.length - 12} more`)
    }
    console.log('\n(DRY_RUN — nothing written)')
    return
  }

  // ── Build update payloads ──────────────────────────────────────────────────
  const clusteredIds  = new Set()
  const clusterUpdates = []

  for (const { clusterId, members } of clusters) {
    // Only rewrite clusters whose membership actually changed — with the full
    // 72h window in play, rewriting every member of every cluster would be
    // ~25k rows per 15-min cron run for mostly identical data.
    // FORCE_REWRITE=1 bypasses the guard (one-off cleanup when peer arrays
    // have gone stale — e.g. a member left but the survivors' ids didn't move).
    const changed = process.env.FORCE_REWRITE === '1' || members.some(m => m.cluster_id !== clusterId)
    if (!changed) {
      members.forEach(m => clusteredIds.add(m.id))
      continue
    }
    for (const member of members) {
      // "N sources" should mean publishers, not feeds — post-flattening,
      // BBC World + BBC Politics are separate outlets but one publisher.
      // Dedupe peers by normalised publisher key (keep the newest per publisher).
      const SUFFIX_RE = /\s+(World|Politics|Business|Markets|Money|Tech(nology)?|Science|Health|Entertainment|Arts|Culture|Environment|Travel|Education|Sport(s)?( [A-Za-z0-9 ]+)?|US|News)$/i
      const pubKey = name => {
        let k = (name || '').replace(/^The\s+/i, '').trim()
        // Strip section suffixes to a fixed point: "Fox News Politics" → "Fox News" → "Fox"
        for (let prev = null; prev !== k; ) { prev = k; k = k.replace(SUFFIX_RE, '').trim() }
        k = k.toLowerCase()
        if (k === 'nyt') k = 'new york times'
        return k
      }
      const seenPubs = new Set([pubKey(member.outlets?.name)])
      const dedupedPeers = members
        .filter(m => m.id !== member.id)
        .filter(m => {
          const k = pubKey(m.outlets?.name)
          if (seenPubs.has(k)) return false
          seenPubs.add(k)
          return true
        })

      // cluster_size is the AUTHORITATIVE count — distinct peer publishers,
      // excluding this article's own (identical semantics to the old
      // cluster_peers.length, so every existing read is a drop-in swap).
      // It has to be stored separately because the peer ARRAY is now capped
      // far below the real count.
      const clusterSize = dedupedPeers.length

      const peers = dedupedPeers
        // 8, not 40. Cards render at most 5 logos and nothing else reads past
        // the first few, so storing 40 put a fat JSONB blob on every row of
        // every list query for nothing. The true count lives in cluster_size,
        // so trimming the array no longer costs accuracy.
        .slice(0, PEER_STORE_CAP)
        .map(m => ({
          id:        m.id,
          outlet_id: m.outlet_id,
          // logo_url deliberately dropped — no consumer reads it (OutletLogo
          // renders from the name) and it nearly doubled peer JSONB weight
          outlets: { name: m.outlets?.name ?? null },
        }))

      clusterUpdates.push({ id: member.id, cluster_id: clusterId, cluster_peers: peers, cluster_size: clusterSize })
      clusteredIds.add(member.id)
    }
  }

  // Articles in the window that are NOT in any cluster — clear stale data
  // (only where a stale cluster_id is actually set; blank rows stay untouched)
  const clearUpdates = articles
    .filter(a => !clusteredIds.has(a.id) && a.cluster_id)
    .map(a => ({ id: a.id, cluster_id: null, cluster_peers: [], cluster_size: 0 }))

  const allUpdates = [...clusterUpdates, ...clearUpdates]
  console.log(`Writing ${clusterUpdates.length} clustered  +  ${clearUpdates.length} cleared\n`)

  // ── Batch upsert ───────────────────────────────────────────────────────────
  let written = 0, failed = 0

  for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
    const batch = allUpdates.slice(i, i + BATCH_SIZE)
    const { error: upErr } = await supabase
      .from('articles')
      .upsert(batch, { onConflict: 'id' })

    if (upErr) {
      console.error(`\n  ❌ Batch error: ${upErr.message}`)
      failed += batch.length
    } else {
      written += batch.length
      process.stdout.write(`  Progress: ${written}/${allUpdates.length}\r`)
    }
  }

  console.log(`\n\n================================`)
  console.log(`✅ Written: ${written}  ❌ Failed: ${failed}`)
  console.log(`📦 Clusters: ${clusters.length}  In clusters: ${clusteredCount}`)

  // Stamp the run so the cadence guard can skip the next tick. Written only
  // after a real run, so a skipped or failed run never pushes the window out.
  if (MIN_RUN_INTERVAL_MIN > 0) {
    const pack = { kind: STATE_KIND, last_run: new Date().toISOString() }
    if (stateRowId) await supabase.from('social_drafts').update({ pack }).eq('id', stateRowId)
    else await supabase.from('social_drafts').insert({ pack })
  }

  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `clusters=${clusters.length}\n`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
