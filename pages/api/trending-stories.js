// Sidebar trending rail, computed once and cached at the edge.
//
// This used to be a 1200-row Supabase query run in the BROWSER on every session
// (measured ~1.6s, the last per-visitor hang on the homepage). The result is
// identical for every reader and only moves as fast as ingest does, so there is
// no reason each visitor should compute it. Serving it from an edge-cached JSON
// response turns N-sessions-per-day database queries into ~96 (one per 15-min
// cache window), and readers get a cache hit instead of a slow round trip.
//
// Counting stays STRICT per-cluster (distinct outlets within one cluster, no
// fragment pooling) so the sidebar's numbers match /trending exactly.
import { createClient } from '@supabase/supabase-js'
import { articleSlug } from '../../src/utils/helpers'

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Retry once — a transient timeout here shouldn't blank the rail.
    let data = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await supabase
        .from('articles')
        .select('id, title, cluster_id, outlet_id, published_at')
        .not('cluster_id', 'is', null)
        .gte('published_at', cutoff)
        .order('published_at', { ascending: false })
        .limit(1200)
      if (!r.error) { data = r.data; break }
      if (attempt === 1) throw r.error
    }

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
    const stories = [...clusters.values()]
      .filter(c => c.outlets.size >= 3)
      .map(c => {
        const firstAgeH  = Math.max(0.75, (now - new Date(c.oldest)) / 3600000)
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
      .map(({ heat, ...rest }) => rest) // heat is internal ranking only

    // 15-min edge cache matching the ingest cadence; serve stale while
    // revalidating so a reader never waits on the recompute.
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800')
    res.status(200).json({ stories })
  } catch (err) {
    console.error('trending-stories error:', err)
    // Short cache on failure so a blip can't pin an empty rail.
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    res.status(200).json({ stories: [] })
  }
}
