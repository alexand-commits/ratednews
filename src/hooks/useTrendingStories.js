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
          const clusters = new Map()
          for (const a of (data || [])) {
            let c = clusters.get(a.cluster_id)
            if (!c) {
              // Newest-first: the first article seen anchors title + slug
              c = { anchor: a, outlets: new Set(), newest: a.published_at, oldest: a.published_at }
              clusters.set(a.cluster_id, c)
            }
            c.outlets.add(a.outlet_id)
            if (a.published_at < c.oldest) c.oldest = a.published_at
          }
          const now = Date.now()
          cache = [...clusters.values()]
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
