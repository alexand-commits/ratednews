/**
 * Dynamic sitemap — generated at request time with ISR (revalidate 1hr).
 * Includes all outlet pages and recent articles.
 * Accessible at ratednews.com/sitemap.xml
 */

const CATEGORY_SLUGS = [
  'politics','business','sport','tech','science','health',
  'environment','entertainment','crime','travel','education',
  'conflict','world',
]

const STATIC_PAGES = [
  { url: 'https://www.ratednews.com/',           priority: '1.0', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/outlets',    priority: '0.9', changefreq: 'daily'   },
  { url: 'https://www.ratednews.com/rankings',   priority: '0.9', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/trending',   priority: '0.9', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/sports',     priority: '0.9', changefreq: 'hourly'  },
  { url: 'https://www.ratednews.com/categories', priority: '0.8', changefreq: 'daily'   },
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

  const [{ data: outlets }, { data: articles }] = await Promise.all([
    supabase.from('outlets').select('name, updated_at'),
    supabase.from('articles')
      .select('id, title, published_at')
      .gte('published_at', since90d)
      .order('published_at', { ascending: false })
      .limit(1000),
  ])

  const outletPages = (outlets || []).map(o => ({
    url:        `https://www.ratednews.com/outlet/${toSlug(o.name)}`,
    priority:   '0.8',
    changefreq: 'hourly',
    lastmod:    o.updated_at?.slice(0, 10),
  }))

  const articlePages = (articles || []).map(a => ({
    url:        `https://www.ratednews.com/article/${toArticleSlug(a.title, a.id)}`,
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
