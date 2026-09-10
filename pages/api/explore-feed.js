// Explore's browse pools, edge-cached.
//
// The page ran three separate Supabase queries in the browser — the default
// pool, a per-region pool, and a per-category pool — each 100-200 heavy rows.
// The default one measured 2352ms. None of them are per-user: everyone
// browsing "Sport in the UK" gets the same articles.
//
// One route with query params gives each combination its own edge-cache entry,
// so the Nth reader of any combination gets a cache hit instead of a fresh
// 2-second query.
import { createClient } from '@supabase/supabase-js'

const SELECT = 'id, title, published_at, outlet_id, category, summary, url, image_url, total_ratings, community_score, cluster_id, cluster_peers, cluster_size'

// Whitelisted so a crafted URL can't mint unbounded cache entries or reach
// past the intended filters.
const REGIONS = ['all', 'US', 'UK', 'Europe', 'MiddleEast', 'Africa', 'AsiaPac', 'Americas']
const CATEGORIES = ['all', 'Politics', 'World', 'Business', 'Tech', 'Science', 'Health',
  'Environment', 'Sport', 'Entertainment', 'Culture', 'Crime', 'Conflict', 'Travel', 'Education']

export default async function handler(req, res) {
  const region = REGIONS.includes(req.query.region) ? req.query.region : 'all'
  const category = CATEGORIES.includes(req.query.category) ? req.query.category : 'all'

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )

    // Mirrors the depths the page used: a broad recent pool for browsing, a
    // shallower one per category since it's already narrowed.
    const limit = category === 'all' ? 200 : 100
    const build = () => {
      const joined = region === 'all'
        ? `${SELECT}, outlets(name, country, logo_url)`
        : `${SELECT}, outlets!inner(name, country, logo_url)`
      let q = supabase.from('articles').select(joined)
      if (category !== 'all') q = q.eq('category', category)
      if (region !== 'all') q = q.eq('outlets.country', region)
      return q.order('published_at', { ascending: false }).limit(limit)
    }

    let data = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await build()
      if (!r.error) { data = r.data; break }
      if (attempt === 1) throw r.error
    }

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800')
    res.status(200).json({ articles: data || [] })
  } catch (err) {
    console.error('explore-feed error:', err)
    // Short cache on failure so a blip can't pin an empty Explore page.
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    res.status(200).json({ articles: [] })
  }
}
