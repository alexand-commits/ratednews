// The outlet directory, edge-cached.
//
// _app.jsx needs this list on every page (slug generation for navigate(), the
// sidebar's Top Rated widget), and it was fetching 200+ rows from Supabase once
// per session behind a 5-minute sessionStorage cache. The list is identical for
// every reader and barely moves — names and types essentially never change, and
// community_score only shifts when someone rates. So there's no reason each
// visitor should query it.
//
// Same trade as /api/trending-stories: N-sessions-per-day queries become ~one
// per cache window. Note _app's refreshOutlets() still reads Supabase directly,
// so a reader who just rated an outlet sees their own score update immediately
// rather than waiting on this cache.
import { createClient } from '@supabase/supabase-js'

const OUTLET_SELECT =
  'id, name, country, logo_url, type, community_score, total_ratings, parent_outlet_id'

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )

    let data = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await supabase
        .from('outlets')
        .select(OUTLET_SELECT)
        .order('community_score', { ascending: false, nullsFirst: false })
      if (!r.error) { data = r.data; break }
      if (attempt === 1) throw r.error
    }

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600')
    res.status(200).json({ outlets: data || [] })
  } catch (err) {
    console.error('outlets api error:', err)
    // Short cache on failure — an empty outlet list degrades navigation, so
    // don't let a blip stick.
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    res.status(200).json({ outlets: [] })
  }
}
