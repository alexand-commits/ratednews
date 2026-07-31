// Category overview — per-category count + latest article over the last 7
// days, via cheap indexed head-count queries (2 per category, all parallel).
// Replaces the category_overview RPC, which window-scanned the ENTIRE
// articles table, started timing out as the table grew, and silently dropped
// the page onto a client-side fallback truncated at Supabase's 1,000-row cap
// (the "1,000 stories" the page showed was the cap, not a count).
export const WINDOW_DAYS = 7

export const CATEGORIES = [
  { value: 'Politics',       slug: 'politics',       emoji: '🏛',  label: 'Politics',       color: '#4B6FBF' },
  { value: 'Business',       slug: 'business',       emoji: '📈',  label: 'Business',       color: '#2E8B57' },
  { value: 'Sport',          slug: 'sport',          emoji: '⚽',  label: 'Sport',          color: '#E84B4B' },
  { value: 'Tech',           slug: 'tech',           emoji: '💻',  label: 'Tech',           color: '#7C5CBF' },
  { value: 'Science',        slug: 'science',        emoji: '🔬',  label: 'Science',        color: '#2196F3' },
  { value: 'Health',         slug: 'health',         emoji: '🏥',  label: 'Health',         color: '#D84B8A' },
  { value: 'Environment',    slug: 'environment',    emoji: '🌱',  label: 'Environment',    color: '#4CAF50' },
  { value: 'Entertainment',  slug: 'entertainment',  emoji: '🎬',  label: 'Entertainment',  color: '#FF9800' },
  { value: 'Crime',          slug: 'crime',          emoji: '🔍',  label: 'Crime',          color: '#795548' },
  { value: 'Travel',         slug: 'travel',         emoji: '✈️',  label: 'Travel',         color: '#00ACC1' },
  { value: 'Education',      slug: 'education',      emoji: '🎓',  label: 'Education',      color: '#D85A30' },
  { value: 'Conflict',       slug: 'conflict',       emoji: '⚔️',  label: 'Conflict',       color: '#757575' },
  { value: 'World',          slug: 'world',          emoji: '🌍',  label: 'World',          color: '#009688' },
]

export async function fetchCategoryOverview(client, region = 'all') {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const scope = q => {
    if (region === 'UK' || region === 'US') return q.eq('outlets.country', region)
    if (region === 'int') return q.not('outlets.country', 'in', '("UK","US")')
    return q
  }
  const joined = region !== 'all' // region filters need the outlets join
  const results = await Promise.all(CATEGORIES.map(async c => {
    const countQ = scope(client.from('articles')
      .select(joined ? 'id, outlets!inner(country)' : 'id', { count: 'exact', head: true })
      .eq('category', c.value)
      .gte('published_at', since))
    const latestQ = scope(client.from('articles')
      .select(joined ? 'id, title, published_at, outlets!inner(country)' : 'id, title, published_at')
      .eq('category', c.value)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(1))
    const [{ count }, { data: latest }] = await Promise.all([countQ, latestQ])
    return { category: c.value, cnt: count || 0, latest: latest?.[0] || null }
  }))
  const counts = {}, previews = {}
  for (const r of results) {
    counts[r.category] = r.cnt
    if (r.latest) previews[r.category] = { id: r.latest.id, title: r.latest.title, published_at: r.latest.published_at }
  }
  return { counts, previews }
}
