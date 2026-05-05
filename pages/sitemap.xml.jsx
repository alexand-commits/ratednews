/**
 * Dynamic sitemap — generated at request time with ISR (revalidate 1hr).
 * Includes all outlet pages and recent articles.
 * Accessible at ratednews.com/sitemap.xml
 */

const STATIC_PAGES = [
  { url: 'https://ratednews.com/',           priority: '1.0', changefreq: 'hourly'  },
  { url: 'https://ratednews.com/outlets',    priority: '0.9', changefreq: 'daily'   },
  { url: 'https://ratednews.com/rankings',   priority: '0.9', changefreq: 'hourly'  },
  { url: 'https://ratednews.com/categories', priority: '0.7', changefreq: 'daily'   },
  { url: 'https://ratednews.com/about',      priority: '0.5', changefreq: 'monthly' },
]

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

  const [{ data: outlets }, { data: articles }] = await Promise.all([
    supabase.from('outlets').select('name, updated_at'),
    supabase.from('articles')
      .select('id, published_at')
      .gte('published_at', since90d)
      .order('published_at', { ascending: false })
      .limit(1000),
  ])

  const outletPages = (outlets || []).map(o => ({
    url:        `https://ratednews.com/outlet/${toSlug(o.name)}`,
    priority:   '0.8',
    changefreq: 'hourly',
    lastmod:    o.updated_at?.slice(0, 10),
  }))

  const articlePages = (articles || []).map(a => ({
    url:        `https://ratednews.com/article/${a.id}`,
    priority:   '0.6',
    changefreq: 'weekly',
    lastmod:    a.published_at?.slice(0, 10),
  }))

  const sitemap = buildSitemap([...STATIC_PAGES, ...outletPages, ...articlePages])

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')
  res.write(sitemap)
  res.end()

  return { props: {} }
}

// This component never renders — getServerSideProps writes the response directly
export default function Sitemap() { return null }
