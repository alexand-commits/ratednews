/**
 * Dynamic sitemap — generated at request time with ISR (revalidate 1hr).
 * Includes all outlet pages and recent articles.
 * Accessible at ratednews.com/sitemap.xml
 */

const CATEGORY_SLUGS = [
  'politics','business','sport','tech','science','health',
  'environment','entertainment','culture','crime','travel','education',
  'conflict','world',
]

const STATIC_PAGES = [
  { url: 'https://www.ratednews.com/',           priority: '1.0', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/outlets',    priority: '0.9', changefreq: 'daily'   },
  { url: 'https://www.ratednews.com/trending',   priority: '0.9', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/sports',     priority: '0.9', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/explore',    priority: '0.7', changefreq: 'daily'   },
  { url: 'https://www.ratednews.com/categories', priority: '0.8', changefreq: 'daily'   },
  { url: 'https://www.ratednews.com/most-trusted-news-sources', priority: '0.9', changefreq: 'daily' },
  { url: 'https://www.ratednews.com/coverage-report', priority: '0.7', changefreq: 'weekly' },
  { url: 'https://www.ratednews.com/about',       priority: '0.5', changefreq: 'monthly' },
  { url: 'https://www.ratednews.com/methodology', priority: '0.5', changefreq: 'monthly' },
  ...CATEGORY_SLUGS.map(slug => ({
    url:        `https://www.ratednews.com/categories/${slug}`,
    priority:   '0.8',
    changefreq: 'hourly',
  })),
]

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function toArticleSlug(title, id) {
  const t = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '')
  return t ? `${t}-${String(id).slice(0, 8)}` : String(id).slice(0, 8)
}

function buildSitemap(pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
    ${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`
}

export async function getServerSideProps({ res }) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  )

  // Only include articles from the last 90 days — older ones churn IDs
  // and generate stale 404s in Search Console once they're re-ingested
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Paged, because PostgREST caps a response at 1000 rows however high the
  // .limit() is. The old single .limit(1500) therefore returned 1000 rows —
  // and at ~14k articles/day that is UNDER TWO HOURS of content. The sitemap
  // was a rolling 2-hour window: URLs appeared and vanished long before
  // Googlebot (~190 crawls/day) could reach them, which is exactly why Search
  // Console reported Discovery <1%. Page back far enough to publish a STABLE
  // set of story URLs that persists between regenerations.
  const PAGE = 1000
  const MAX_PAGES = 12          // ~12k articles scanned, ~4x/day — negligible
  const MAX_STORY_URLS = 3000
  async function fetchArticlePages() {
    const out = []
    const clusters = new Set()
    for (let p = 0; p < MAX_PAGES; p++) {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, published_at, cluster_id')
        .gte('published_at', since90d)
        .order('published_at', { ascending: false })
        .range(p * PAGE, p * PAGE + PAGE - 1)
      if (error || !data?.length) break
      out.push(...data)
      for (const a of data) if (a.cluster_id) clusters.add(a.cluster_id)
      if (data.length < PAGE) break              // exhausted
      if (clusters.size >= MAX_STORY_URLS) break // enough stories
    }
    return out
  }

  const [{ data: outlets }, articles] = await Promise.all([
    // NB: outlets has no updated_at column — selecting it errored the whole
    // query and silently dropped every outlet page from the sitemap.
    supabase.from('outlets').select('name, total_ratings').is('parent_outlet_id', null),
    fetchArticlePages(),
  ])

  const outletPages = (outlets || []).map(o => ({
    url:        `https://www.ratednews.com/outlet/${toSlug(o.name)}`,
    priority:   '0.9',
    changefreq: 'daily',
  }))

  // Compare pages — pairs of the 10 most-rated outlets (matches the prebuild
  // set in pages/compare/[pair].jsx). Alphabetical order is canonical.
  const topSlugs = (outlets || [])
    .filter(o => (o.total_ratings || 0) > 0)
    .sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0))
    .slice(0, 10)
    .map(o => toSlug(o.name))
  const comparePages = []
  for (let i = 0; i < topSlugs.length; i++) {
    for (let j = i + 1; j < topSlugs.length; j++) {
      const pair = [topSlugs[i], topSlugs[j]].sort()
      comparePages.push({
        url:        `https://www.ratednews.com/compare/${pair[0]}-vs-${pair[1]}`,
        priority:   '0.7',
        changefreq: 'weekly',
      })
    }
  }

  // Story pages — the unique, evergreen aggregation content (every outlet
  // covering one story). One URL per cluster, keyed on the most-recent
  // member's slug. These are the highest-value pages to get indexed.
  const seenClusters = new Set()
  const storyPages = []
  for (const a of (articles || [])) {
    if (!a.cluster_id || seenClusters.has(a.cluster_id)) continue
    seenClusters.add(a.cluster_id)
    storyPages.push({
      url:        `https://www.ratednews.com/story/${toArticleSlug(a.title, a.id)}`,
      priority:   '0.8',
      changefreq: 'daily',
      lastmod:    a.published_at?.slice(0, 10),
    })
  }

  // Article pages — kept for Google News freshness (they carry NewsArticle
  // schema), but they're thin stubs so they sit below stories/outlets.
  // One URL per cluster: the same headline syndicated across 3+ outlets was
  // listing 3+ near-duplicate URLs, diluting crawl budget. The newest member
  // represents the cluster (its story page covers the rest).
  // Solo articles are the thinnest thing on the site — one outlet restating its
  // own headline, with no story page to aggregate it. With a crawl budget of
  // ~190/day they shouldn't crowd out story pages, so cap them at the newest
  // few hundred rather than listing every one.
  const MAX_SOLO_ARTICLE_URLS = 250
  const articlePages = []
  for (const a of (articles || [])) {
    if (articlePages.length >= MAX_SOLO_ARTICLE_URLS) break
    // Clustered articles are represented by their richer /story page; listing
    // the newest member's stub too put the SAME slug on two paths, making the
    // story page compete with its own thin stub. Solo articles only here.
    if (a.cluster_id) continue
    articlePages.push({
      url:        `https://www.ratednews.com/article/${toArticleSlug(a.title, a.id)}`,
      priority:   '0.5',
      changefreq: 'weekly',
      lastmod:    a.published_at?.slice(0, 10),
    })
  }

  // Coverage Report archive. Separate client: the packs live in social_drafts,
  // which the anon key above rightly cannot read. Wrapped so a missing service
  // key degrades to "no archive URLs" rather than taking out the whole sitemap.
  // ~52 URLs a year, each permanently unique — cheap against crawl budget and
  // exactly the kind of page worth spending it on.
  let coveragePages = []
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const svc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      )
      const { listReportWeeks } = await import('../src/server/coverage-store')
      const weeks = await listReportWeeks(svc)
      coveragePages = weeks.map((w, i) => ({
        url: `https://www.ratednews.com/coverage-report/${w.week}`,
        // Archived weeks never change; only the newest is still moving.
        priority: i === 0 ? '0.7' : '0.6',
        changefreq: i === 0 ? 'weekly' : 'yearly',
        lastmod: (w.generatedAt || '').slice(0, 10) || undefined,
      }))
    }
  } catch { coveragePages = [] }

  const sitemap = buildSitemap([...STATIC_PAGES, ...coveragePages, ...outletPages, ...comparePages, ...storyPages, ...articlePages])

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
  res.write(sitemap)
  res.end()

  return { props: {} }
}

// This component never renders — getServerSideProps writes the response directly
export default function Sitemap() { return null }
