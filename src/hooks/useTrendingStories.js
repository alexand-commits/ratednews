import { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { articleSlug } from '../utils/helpers'

// Sidebar trending rail — top story clusters by coverage velocity, the SAME
// signal that powers /trending and the social desk. Replaces the old
// token-frequency topic pills, which leaked context-free fragments
// ("Islamic", "Heritage List") and had no click destination.
// Module-level cache: fetched once per session across every page that mounts it.
let cache = null
let inflight = null

// Light plural stemming — keeps "goals"/"goal", "tankers"/"tanker" together.
function stem(w) {
  if (w.length > 4) {
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y'
    if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2)
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  }
  return w
}
const STOP = new Set(['the','a','an','in','on','at','to','for','of','and','or','is','are','was','were','says','say','said','after','as','with','by','from','over','into','its','his','her','their','will','have','has','had','been','be','but','not','this','that','than','then','live'])
function sigTokens(title) {
  const t = new Set()
  for (const w of (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length > 3 && !STOP.has(w)) t.add(stem(w))
  }
  return t
}
function overlaps(a, b, need = 3) {
  let shared = 0
  for (const w of a) if (b.has(w)) { shared++; if (shared >= need) return true }
  return false
}

export function useTrendingStories() {
  const [stories, setStories] = useState(cache || [])

  useEffect(() => {
    if (cache) return
    if (!inflight) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      inflight = db.from('articles')
        .select('id, title, cluster_id, outlet_id, published_at')
        .not('cluster_id', 'is', null)
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(1200)
        .then(({ data }) => {
          // Group by cluster_id; accumulate a token set from EVERY member title
          // (richer than the anchor alone) so fragment-pooling has signal.
          const clusters = new Map()
          for (const a of (data || [])) {
            let c = clusters.get(a.cluster_id)
            if (!c) {
              // Newest-first: the first article seen anchors title + slug
              c = { anchor: a, outlets: new Set(), tokens: new Set(), newest: a.published_at, oldest: a.published_at }
              clusters.set(a.cluster_id, c)
            }
            c.outlets.add(a.outlet_id)
            for (const w of sigTokens(a.title)) c.tokens.add(w)
            if (a.published_at < c.oldest) c.oldest = a.published_at
          }

          // ── Fragment pooling ────────────────────────────────────────────────
          // The clusterer splits one story across clusters when headlines are
          // rewritten (a match report vs "extend unbeaten run" — same story,
          // different words). Merge clusters sharing 3+ significant title tokens
          // into the biggest, UNIONING distinct outlets so the same outlet
          // across fragments isn't double-counted — the count grows only by
          // genuinely new outlets. Distinct angles (player ratings, a single
          // player's performance) share too few tokens to merge, so they stay
          // separate — which is correct.
          const merged = []
          for (const c of [...clusters.values()].sort((a, b) => b.outlets.size - a.outlets.size)) {
            const host = merged.find(m => overlaps(c.tokens, m.tokens))
            if (host) {
              for (const o of c.outlets) host.outlets.add(o)
              // NOTE: host.tokens is deliberately NOT grown with the fragment's
              // tokens — every fragment must overlap the host's ORIGINAL tokens
              // directly (star). Growing them chains unrelated stories: "US
              // strikes Iran tankers" would absorb every iran/strike/oil story
              // into one 139-outlet blob.
              if (c.oldest < host.oldest) host.oldest = c.oldest
              if (c.newest > host.newest) host.newest = c.newest
            } else {
              merged.push(c)
            }
          }

          const now = Date.now()
          cache = merged
            .filter(c => c.outlets.size >= 3)
            .map(c => {
              const firstAgeH = Math.max(0.75, (now - new Date(c.oldest)) / 3600000)
              const newestAgeH = Math.max(0, (now - new Date(c.newest)) / 3600000)
              return {
                title: c.anchor.title,
                slug: articleSlug(c.anchor.title, c.anchor.id),
                outlets: c.outlets.size,
                heat: (c.outlets.size / firstAgeH) * 10 / Math.pow(newestAgeH + 1, 1.2),
              }
            })
            .sort((a, b) => b.heat - a.heat)
            .slice(0, 6)
          return cache
        })
    }
    let mounted = true
    inflight.then(t => { if (mounted) setStories(t) })
    return () => { mounted = false }
  }, [])

  return stories
}
