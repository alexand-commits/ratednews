import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAppContext } from '../_app'
import ArticlePage from '../../src/pages/ArticlePage'
import ErrorBoundary from '../../src/components/ErrorBoundary'
import { articleSlug } from '../../src/utils/helpers'
import { db } from '../../src/lib/supabase'

// Shape 1 — bare full UUID (pre-slug links):
//   "4f3ff8a6-4730-4e86-a7aa-9d493f4dfa71"
const BARE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Shape 2 — slug + full UUID suffix (brief transitional window):
//   "obama-slams-trump-4f3ff8a6-4730-4e86-a7aa-9d493f4dfa71"
const FULL_UUID_SUFFIX_RE = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

// Shape 3 — canonical: slug + 8-char short ID (first segment of UUID):
//   "obama-slams-trump-4f3ff8a6"
const SHORT_ID_SUFFIX_RE = /-([0-9a-f]{8})$/i

export default function ArticleDetail({ article: initialArticle }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          savedArticleIds, toggleSave, allOutlets } = useAppContext()

  // ISR pages can be up to 1h stale — refresh score data client-side so the
  // quality card always reflects the latest accuracy_score, bias, etc.
  const [article, setArticle] = useState(initialArticle)
  useEffect(() => {
    if (!initialArticle?.id) return
    db.from('articles')
      .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
      .eq('id', initialArticle.id)
      .single()
      .then(({ data }) => { if (data) setArticle(data) })
  }, [initialArticle?.id])

  // Track view — sessionStorage dedup so navigating back doesn't double-count
  useEffect(() => {
    if (!article?.id) return
    const key = `rn_viewed_${article.id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    // Pass auth token so server can record user-attributed view for media diet
    db.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ id: article.id }),
      }).catch(() => {}) // fire-and-forget
    })
  }, [article?.id])

  if (router.isFallback || !article) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const outletName = article.outlets?.name || 'RatedNews'
  const summary    = article.summary || ''
  const com        = article.community_score || 0
  const totalRatings = article.total_ratings || 0
  const rated      = totalRatings > 0 && com > 0
  const comStars   = rated ? (com / 20).toFixed(1) : null

  const scorePart = rated ? `Community rating ${comStars}/5 (${totalRatings} ${totalRatings === 1 ? 'rating' : 'ratings'}). ` : ''
  const metaDesc  = summary
    ? `${scorePart}${summary}`.slice(0, 155)
    : `"${article.title}" from ${outletName}, on RatedNews. Rate it for accuracy, bias and quality.`

  const keywords = [
    outletName, article.category,
    'news', 'community ratings', 'news aggregator',
  ].filter(Boolean).join(', ')

  const canonicalSlug = articleSlug(article.title, article.id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'Review',
    name:       `${article.title} — Community Rating`,
    url:        `https://www.ratednews.com/article/${canonicalSlug}`,
    datePublished: article.published_at,
    author: {
      '@type': 'Organization',
      name:    'RatedNews',
      url:     'https://www.ratednews.com',
    },
    publisher: {
      '@type': 'Organization',
      name:    'RatedNews',
      url:     'https://www.ratednews.com',
      logo: { '@type': 'ImageObject', url: 'https://www.ratednews.com/og-image.png' },
    },
    ...(rated && {
      reviewRating: {
        '@type':             'Rating',
        ratingValue:         comStars,
        bestRating:          5,
        worstRating:         1,
        ratingExplanation:   'Average rating from RatedNews readers.',
      },
    }),
    ...(summary   && { reviewBody: summary }),
    ...(keywords  && { keywords }),
    itemReviewed: {
      '@type':       'NewsArticle',
      headline:      article.title,
      url:           article.url,
      datePublished: article.published_at,
      ...(article.image_url && { image: { '@type': 'ImageObject', url: article.image_url } }),
      author:    { '@type': 'Organization', name: outletName },
      publisher: { '@type': 'Organization', name: outletName },
    },
  }

  const pageTitle = rated
    ? `${article.title} · ${comStars}/5 community — RatedNews`
    : `${article.title} — RatedNews`

  // Top-level NewsArticle schema — required for Google News carousel / Top Stories eligibility.
  // The Review schema above nests NewsArticle inside itemReviewed which Google ignores for carousel.
  // Emitting a second root-level NewsArticle block makes the page eligible.
  const newsArticleLd = {
    '@context': 'https://schema.org',
    '@type':    'NewsArticle',
    headline:   article.title,
    url:        article.url,
    mainEntityOfPage: `https://www.ratednews.com/article/${canonicalSlug}`,
    datePublished:  article.published_at,
    dateModified:   article.published_at,
    ...(summary && { description: summary }),
    ...(article.image_url && {
      image: { '@type': 'ImageObject', url: article.image_url, width: 1200, height: 630 },
    }),
    author: {
      '@type': 'Organization',
      name:    outletName,
    },
    publisher: {
      '@type': 'Organization',
      name:    'RatedNews',
      url:     'https://www.ratednews.com',
      logo:    { '@type': 'ImageObject', url: 'https://www.ratednews.com/og-image.png', width: 1200, height: 630 },
    },
    ...(keywords && { keywords }),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://www.ratednews.com/' },
      ...(article.category ? [{ '@type': 'ListItem', position: 2, name: article.category, item: `https://www.ratednews.com/categories/${article.category.toLowerCase()}` }] : []),
      { '@type': 'ListItem', position: article.category ? 3 : 2, name: article.title, item: `https://www.ratednews.com/article/${canonicalSlug}` },
    ],
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={`https://www.ratednews.com/article/${canonicalSlug}`} />
        <meta property="og:title"       content={article.title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url"         content={`https://www.ratednews.com/article/${canonicalSlug}`} />
        <meta property="og:type"        content="article" />
        <meta property="og:image"       content={`https://www.ratednews.com/api/og?title=${encodeURIComponent(article.title)}${rated ? `&score=${com}` : ''}&outlet=${encodeURIComponent(outletName)}`} />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content={pageTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image"      content={`https://www.ratednews.com/api/og?title=${encodeURIComponent(article.title)}${rated ? `&score=${com}` : ''}&outlet=${encodeURIComponent(outletName)}`} />
        {/* Only emit the Review schema when real reader ratings exist — a Review
            without a reviewRating triggers Search Console warnings. */}
        {rated && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/') }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleLd).replace(/<\//g, '<\\/') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/<\//g, '<\\/') }}
        />
      </Head>
      <ErrorBoundary>
        <ArticlePage
          articleId={article.id}
          allArticles={[article]}
          navigate={navigate}
          goBack={goBack}
          showToast={showToast}
          user={user}
          onLoginClick={openAuthModal}
          isSaved={savedArticleIds.has(article.id)}
          toggleSave={toggleSave}
          outlets={allOutlets}
        />
      </ErrorBoundary>
    </>
  )
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  )
}

export async function getStaticPaths() {
  // try/catch keeps env-less builds (CI build check) green — fallback:
  // 'blocking' means every path still server-renders on first hit.
  try {
    const supabase = await getSupabase()
    // Pre-build the 500 most recent articles with slug-based paths
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title')
      .order('published_at', { ascending: false })
      .limit(500)

    return {
      paths: (articles || []).map(a => ({
        params: { id: articleSlug(a.title, a.id) },
      })),
      fallback: 'blocking', // server-render on first hit — prevents Google indexing skeleton (no canonical)
    }
  } catch {
    return { paths: [], fallback: 'blocking' }
  }
}

export async function getStaticProps({ params }) {
  const supabase = await getSupabase()
  const slug = params.id

  // ── Shape 1: bare full UUID → redirect to canonical slug ─────────────────
  if (BARE_UUID_RE.test(slug)) {
    const { data: a } = await supabase
      .from('articles').select('id, title').eq('id', slug).single()
    if (!a) return { notFound: true }
    return { redirect: { destination: `/article/${articleSlug(a.title, a.id)}`, permanent: true } }
  }

  // ── Shape 2: slug + full UUID suffix → redirect to canonical slug ─────────
  const fullMatch = slug.match(FULL_UUID_SUFFIX_RE)
  if (fullMatch) {
    const { data: a } = await supabase
      .from('articles').select('id, title').eq('id', fullMatch[1]).single()
    if (!a) return { notFound: true }
    return { redirect: { destination: `/article/${articleSlug(a.title, a.id)}`, permanent: true } }
  }

  // ── Shape 3: canonical slug + 8-char short ID → serve the page ───────────
  const shortMatch = slug.match(SHORT_ID_SUFFIX_RE)
  if (!shortMatch) return { notFound: true }

  // UUID range query: PostgreSQL UUID columns don't support LIKE/ILIKE, so we
  // use gte/lte on the UUID range covered by the 8-char prefix segment.
  // All UUIDs starting with "xxxxxxxx-" fall between "xxxxxxxx-0000-0000-0000-000000000000"
  // and "xxxxxxxx-ffff-ffff-ffff-ffffffffffff" — collision-free at <10M articles.
  const pfx = shortMatch[1]
  const { data: article } = await supabase
    .from('articles')
    .select('*, outlets(name, country, bias_direction, logo_url, accuracy_score), comments(count)')
    .gte('id', `${pfx}-0000-0000-0000-000000000000`)
    .lte('id', `${pfx}-ffff-ffff-ffff-ffffffffffff`)
    .single()

  if (!article) return { notFound: true }

  // ── Canonical slug drift guard ────────────────────────────────────────────
  // The ingest script sometimes updates article titles after first publish
  // (e.g. filling in a complete headline). If that happened, the URL slug no
  // longer matches the current canonical. Redirect so Google sees a single
  // authoritative URL and never marks this page as "Alternative with canonical".
  const canonical = articleSlug(article.title, article.id)
  if (slug !== canonical) {
    return { redirect: { destination: `/article/${canonical}`, permanent: true } }
  }

  return { props: { article }, revalidate: 3600 }
}
