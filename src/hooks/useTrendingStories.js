import { useState, useEffect } from 'react'

// Sidebar trending rail — top story clusters by coverage velocity, the SAME
// signal that powers /trending and the social desk. Replaces the old
// token-frequency topic pills, which leaked context-free fragments
// ("Islamic", "Heritage List") and had no click destination.
//
// STRICT per-cluster counting: distinct outlets within one cluster, no
// fragment-pooling. Pooling across clusters was tried but made the sidebar's
// counts disagree with the /trending page (which counts strictly), so the same
// story showed two different numbers. Both surfaces now count the same way — a
// plainer number that always survives an audit.
//
// The grouping used to run in the browser off a 1200-row Supabase query
// (~1.6s — the last per-visitor hang on the homepage). It's identical for every
// reader, so it now comes from /api/trending-stories, which computes it once and
// is edge-cached for 15 minutes. Kept the module-level cache so a session still
// only asks once, across every page that mounts the rail.
let cache = null
let inflight = null

// `skip` is for callers that already have their own list (the sports rail passes
// sport-only clusters). Without it the hook still fetched the GLOBAL list and
// threw the result away — measured live on /sports: one request, no consumer.
// Hooks can't be called conditionally, so the flag lives here rather than at the
// call site.
export function useTrendingStories(skip = false) {
  const [stories, setStories] = useState(cache || [])

  useEffect(() => {
    if (skip || cache) return
    if (!inflight) {
      inflight = fetch('/api/trending-stories')
        .then(r => (r.ok ? r.json() : { stories: [] }))
        .then(({ stories: s }) => { cache = s || []; return cache })
        .catch(() => { inflight = null; return [] })
    }
    let mounted = true
    inflight.then(t => { if (mounted) setStories(t) })
    return () => { mounted = false }
  }, [skip])

  return stories
}
