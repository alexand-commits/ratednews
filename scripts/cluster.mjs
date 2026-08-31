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

const CLUSTER_WINDOW_HOURS = 72  // how far back to look for story clusters
const MIN_OVERLAP          = 3   // significant words that must overlap
const BATCH_SIZE           = 100 // articles per DB upsert batch

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

  const cutoff = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  // Fetch all articles in the window with outlet info.
  // (No accuracy_score filter — AI scoring was removed; clustering is title-word
  //  overlap only, so it works on every ingested article.)
  // Keyset-paginated fetch. Two hard-won lessons live here:
  //  - Supabase caps every response at 1000 rows regardless of .limit(), and
  //    the window holds ~37k articles — a single fetch sees ~2.5 hours.
  //  - OFFSET pagination is quadratic server-side (page N scans and discards
  //    all prior rows); at 96 runs/day it burned the project's disk-IO
  //    budget. Cursor on (published_at, id) keeps every page an index seek.
  const articles = []
  let cursor = null
  for (;;) {
    let q = supabase
      .from('articles')
      .select('id, title, outlet_id, cluster_id, published_at, outlets(name)')
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1000)
    if (cursor) q = q.or(`published_at.lt."${cursor.ts}",and(published_at.eq."${cursor.ts}",id.lt."${cursor.id}")`)
    const { data: page, error } = await q
    if (error) {
      console.error('Failed to fetch articles:', error.message)
      process.exit(1)
    }
    articles.push(...(page || []))
    if (!page || page.length < 1000) break
    const last = page[page.length - 1]
    cursor = { ts: new Date(last.published_at).toISOString(), id: last.id }
  }

  console.log(`Fetched ${articles.length} articles from last ${CLUSTER_WINDOW_HOURS}h\n`)

  // Precompute significant word sets
  const pool = articles.map(a => ({
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

  // Words this common in a 72h window ("trump", "police") carry no story
  // identity — skip them when generating candidate pairs, both for precision
  // and to keep the pairing loop O(rare-word matches) instead of O(n²).
  const TOKEN_CAP = 250

  const sharedCounts = (i, skipAssigned, assigned) => {
    const m = new Map() // candidate index → overlapping word count
    for (const w of pool[i].words) {
      const post = index.get(w)
      if (post.length > TOKEN_CAP) continue
      for (const j of post) {
        if (j === i) continue
        if (skipAssigned && assigned.has(j)) continue
        m.set(j, (m.get(j) || 0) + 1)
      }
    }
    return m
  }

  // Main pass: anchor stars. Every member overlaps the anchor directly.
  const assigned = new Map() // pool index → clustersRaw index
  const clustersRaw = []     // [{ memberIdx: [pool indices] }]
  for (let i = 0; i < pool.length; i++) {
    if (assigned.has(i)) continue
    const counts = sharedCounts(i, true, assigned)
    const memberIdx = []
    for (const [j, n] of counts) {
      if (n >= MIN_OVERLAP && pool[j].outlet_id !== pool[i].outlet_id) memberIdx.push(j)
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
    for (const [j, n] of counts) {
      if (n >= MIN_OVERLAP && snapshot.has(j) && n > bestN) { best = j; bestN = n }
    }
    if (best != null) clustersRaw[snapshot.get(best)].memberIdx.push(i)
  }

  const components = clustersRaw
    .map(c => c.memberIdx.map(ix => pool[ix]))
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
      const peers = members
        .filter(m => m.id !== member.id)
        .filter(m => {
          const k = pubKey(m.outlets?.name)
          if (seenPubs.has(k)) return false
          seenPubs.add(k)
          return true
        })
        .slice(0, 40) // bound the JSONB payload — unbounded peer arrays on big clusters blew batch statement timeouts
        .map(m => ({
          id:        m.id,
          outlet_id: m.outlet_id,
          // logo_url deliberately dropped — no consumer reads it (OutletLogo
          // renders from the name) and it nearly doubled peer JSONB weight
          outlets: { name: m.outlets?.name ?? null },
        }))

      clusterUpdates.push({ id: member.id, cluster_id: clusterId, cluster_peers: peers })
      clusteredIds.add(member.id)
    }
  }

  // Articles in the window that are NOT in any cluster — clear stale data
  // (only where a stale cluster_id is actually set; blank rows stay untouched)
  const clearUpdates = articles
    .filter(a => !clusteredIds.has(a.id) && a.cluster_id)
    .map(a => ({ id: a.id, cluster_id: null, cluster_peers: [] }))

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
