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
 *   [{ id, outlet_id, outlets: { name, bias_direction, accuracy_score } }, ...]
 *   — exactly the fields NewsCard needs for bias dots and article links.
 *
 * Algorithm:
 *   1. Fetch all scored articles from the last CLUSTER_WINDOW_HOURS
 *   2. Extract significant words from each title (4+ chars, not stop words)
 *   3. Greedy clustering: for each unassigned article, find all others with
 *      ≥ MIN_OVERLAP significant word overlap from a different outlet
 *   4. Assign a shared cluster_id UUID to every member of each cluster
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

function sigWords(title) {
  return [...new Set(
    (title || '').toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w))
  )]
}

async function main() {
  console.log('🔗 RatedNews Article Clustering')
  console.log('================================\n')

  const cutoff = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  // Fetch all scored articles in the window with outlet info
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, outlet_id, outlets(name, bias_direction, accuracy_score)')
    .gte('published_at', cutoff)
    .not('accuracy_score', 'is', null)
    .order('published_at', { ascending: false })
    .limit(3000)

  if (error) {
    console.error('Failed to fetch articles:', error.message)
    process.exit(1)
  }

  console.log(`Fetched ${articles.length} articles from last ${CLUSTER_WINDOW_HOURS}h\n`)

  // Precompute significant word sets
  const pool = articles.map(a => ({
    ...a,
    words: new Set(sigWords(a.title)),
  }))

  // ── Greedy clustering ──────────────────────────────────────────────────────
  const assigned  = new Set()   // pool indices already in a cluster
  const clusters  = []          // [{ clusterId, members: [article, ...] }]

  for (let i = 0; i < pool.length; i++) {
    if (assigned.has(i)) continue
    const primary = pool[i]
    if (primary.words.size < 2) continue

    // Collect candidate indices first — don't mark assigned until cluster is confirmed valid.
    // Previously, assigned.add(j) fired inside the inner loop even when primary turned out
    // to be a singleton, permanently excluding those candidates from future clusters.
    const candidateIndices = []

    for (let j = 0; j < pool.length; j++) {
      if (i === j || assigned.has(j)) continue
      const candidate = pool[j]
      // Must be a different outlet
      if (candidate.outlet_id === primary.outlet_id) continue
      const overlap = [...candidate.words].filter(w => primary.words.has(w)).length
      if (overlap >= MIN_OVERLAP) candidateIndices.push(j)
    }

    if (candidateIndices.length < 1) continue   // singleton — not a cluster

    // Cluster is valid — now mark everyone as assigned
    assigned.add(i)
    candidateIndices.forEach(j => assigned.add(j))
    const members = [primary, ...candidateIndices.map(j => pool[j])]
    clusters.push({ clusterId: randomUUID(), members })
  }

  const clusteredCount = clusters.reduce((s, c) => s + c.members.length, 0)
  console.log(`Found ${clusters.length} clusters spanning ${clusteredCount} articles\n`)

  // ── Build update payloads ──────────────────────────────────────────────────
  const clusteredIds  = new Set()
  const clusterUpdates = []

  for (const { clusterId, members } of clusters) {
    for (const member of members) {
      const peers = members
        .filter(m => m.id !== member.id)
        .map(m => ({
          id:        m.id,
          outlet_id: m.outlet_id,
          outlets: {
            name:            m.outlets?.name            ?? null,
            bias_direction:  m.outlets?.bias_direction  ?? null,
            accuracy_score:  m.outlets?.accuracy_score  ?? null,
          },
        }))

      clusterUpdates.push({ id: member.id, cluster_id: clusterId, cluster_peers: peers })
      clusteredIds.add(member.id)
    }
  }

  // Articles in the window that are NOT in any cluster — clear stale data
  const clearUpdates = articles
    .filter(a => !clusteredIds.has(a.id))
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
