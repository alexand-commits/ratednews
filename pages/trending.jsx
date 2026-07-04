import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from './_app'
import TrendingPage from '../src/pages/TrendingPage'

export default function Trending({ articles, generatedAt }) {
  const { navigate, goBack } = useAppContext()
  const router = useRouter()

  async function onRefresh() {
    await router.replace(router.asPath)
  }

  const itemListLd = articles && articles.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trending News — RatedNews',
    url: 'https://www.ratednews.com/trending',
    numberOfItems: Math.min(articles.length, 10),
    itemListElement: articles.slice(0, 10).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://www.ratednews.com/article/${articleSlug(a.title, a.id)}`,
      name: a.title,
    })),
  } : null

  return (
    <>
      <Head>
        <title>Trending News — Quality &amp; Bias Rated | RatedNews</title>
        <meta name="description" content="The most discussed news stories right now, ranked by how many outlets are covering each story. Top news from 150+ community-rated outlets." />
        <link rel="canonical" href="https://www.ratednews.com/trending" />
        <meta property="og:title"       content="Trending News — Quality & Bias Rated | RatedNews" />
        <meta property="og:description" content="The most discussed news stories right now, ranked by how many outlets are covering each story. Top news from 150+ community-rated outlets." />
        <meta property="og:url"         content="https://www.ratednews.com/trending" />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content="https://www.ratednews.com/api/og?type=brand" />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content="Trending News — Quality & Bias Rated | RatedNews" />
        <meta name="twitter:description" content="The most discussed news stories right now, ranked by how many outlets are covering each story. Top news from 150+ community-rated outlets." />
        <meta name="twitter:image"      content="https://www.ratednews.com/api/og?type=brand" />
        {itemListLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/<\//g, '<\\/') }}
          />
        )}
      </Head>
      <TrendingPage
        articles={articles}
        generatedAt={generatedAt}
        navigate={navigate}
        goBack={goBack}
        onRefresh={onRefresh}
      />
    </>
  )
}

function articleSlug(title, id) {
  const t = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
  const shortId = String(id).slice(0, 8)
  return t ? `${t}-${shortId}` : shortId
}

export async function getStaticProps() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, published_at, category, summary, image_url, view_count, total_ratings, community_score, outlets(name, logo_url, country), comments(count)')
      .gte('published_at', since24h)
      .order('published_at', { ascending: false })
      .limit(200)

    if (error) throw error

    // ── Cross-outlet coverage scoring ──────────────────────────────────────────
    // Extract meaningful tokens from a title (strip stop words + short words)
    const STOP = new Set(['the','a','an','in','on','at','to','for','of','and','or',
      'is','are','was','were','says','say','said','after','as','with','by','from',
      'over','into','its','it','his','her','their','how','why','what','who','will',
      'have','has','had','been','be','but','not','this','that','than','then'])

    function tokens(title) {
      return (title || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(w => w.length > 3 && !STOP.has(w))
    }

    // For each article, count how many OTHER outlet articles share 3+ tokens
    // within a 6-hour window — this is the cross-outlet coverage signal
    const COVERAGE_WINDOW = 6 * 3600000
    const allTokens = (data || []).map(a => ({ id: a.id, t: new Set(tokens(a.title)), ts: new Date(a.published_at).getTime(), outletId: a.outlets?.name }))

    const coverageMap = {}
    for (let i = 0; i < allTokens.length; i++) {
      let count = 0
      for (let j = 0; j < allTokens.length; j++) {
        if (i === j) continue
        if (allTokens[i].outletId === allTokens[j].outletId) continue // same outlet doesn't count
        if (Math.abs(allTokens[i].ts - allTokens[j].ts) > COVERAGE_WINDOW) continue
        const shared = [...allTokens[i].t].filter(w => allTokens[j].t.has(w)).length
        if (shared >= 3) count++
      }
      coverageMap[allTokens[i].id] = count
    }

    const scored = (data || []).map(a => {
      const hoursAgo  = (Date.now() - new Date(a.published_at)) / 3600000
      const views     = a.view_count || 0
      const comments  = a.comments?.[0]?.count || 0
      const coverage  = coverageMap[a.id] || 0
      // Cross-outlet coverage is the primary signal — stories covered by many
      // outlets score highest. Views + comments boost when traffic picks up.
      // Gravity decay: score / (age + 2)^1.8 — age naturally pushes stories down.
      const numerator  = coverage * 15 + views * 2 + comments * 20 + 1
      const trendScore = numerator / Math.pow(Math.max(0.1, hoursAgo) + 2, 1.8)
      return { ...a, _trendScore: trendScore, _coverage: coverage }
    })

    scored.sort((a, b) => b._trendScore - a._trendScore)

    // Deduplicate — once sorted by score, skip any article that shares 3+ tokens
    // with an already-selected article. Keeps the best representative per story.
    const selected = []
    const selectedTokenSets = []
    for (const a of scored) {
      const t = new Set(tokens(a.title))
      const isDupe = selectedTokenSets.some(existing => {
        const shared = [...t].filter(w => existing.has(w)).length
        return shared >= 3
      })
      if (!isDupe) {
        selected.push(a)
        selectedTokenSets.push(t)
      }
      if (selected.length >= 20) break
    }

    const articles = selected.map(({ _trendScore, _coverage, ...rest }) => ({ ...rest, coverage: _coverage }))

    return {
      props: {
        articles,
        generatedAt: new Date().toISOString(),
      },
      revalidate: 900, // refresh every 15 minutes — matches ingest cadence
    }
  } catch (err) {
    console.error('trending getStaticProps error:', err)
    return {
      props: {
        articles: [],
        generatedAt: new Date().toISOString(),
      },
      revalidate: 1800,
    }
  }
}
