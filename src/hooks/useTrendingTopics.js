import { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { computeTrendingTopics } from '../utils/topics'

// Site-wide trending topics for rail widgets on detail pages (article/story).
// Module-level cache: the lightweight 24h title pool (~100KB) is fetched once
// per session no matter how many pages mount the hook.
let cache = null
let inflight = null

export function useTrendingTopics() {
  const [topics, setTopics] = useState(cache || [])

  useEffect(() => {
    if (cache) return
    if (!inflight) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      inflight = db.from('articles')
        .select('title, outlet_id')
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(1000)
        .then(({ data }) => {
          cache = computeTrendingTopics(data || [])
          return cache
        })
    }
    let mounted = true
    inflight.then(t => { if (mounted) setTopics(t) })
    return () => { mounted = false }
  }, [])

  return topics
}
