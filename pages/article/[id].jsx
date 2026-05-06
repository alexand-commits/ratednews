import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAppContext } from '../_app'
import ArticlePage from '../../src/pages/ArticlePage'
import ErrorBoundary from '../../src/components/ErrorBoundary'
import { articleSlug } from '../../src/utils/helpers'

// Shape 1 — bare full UUID (pre-slug links):
//   "4f3ff8a6-4730-4e86-a7aa-9d493f4dfa71"
const BARE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Shape 2 — slug + full UUID suffix (brief transitional window):
//   "obama-slams-trump-4f3ff8a6-4730-4e86-a7aa-9d493f4dfa71"
const FULL_UUID_SUFFIX_RE = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

// Shape 3 — canonical: slug + 8-char short ID (first segment of UUID):
//   "obama-slams-trump-4f3ff8a6"
const SHORT_ID_SUFFIX_RE = /-([0-9a-f]{8})$/i

export default function ArticleDetail({ article }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          savedArticleIds, toggleSave } = useAppContext()

  // Track view — sessionStorage dedup so navigating back doesn't double-count
  useEffect(() => {
    if (!article?.id) return
    const key = `rn_viewed_${article.id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: article.id }),
    }).catch(() => {}) // fire-and-forget
  }, [article?.id])

  if (router.isFallback || !article) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const outletName = article.outlets?.name || 'RatedNews'
  const summary    = article.ai_summary || article.summary || ''
  const acc        = article.accuracy_score || 0
  const biasDir    = article.outlets?.bias_direction || article.bias_direction || null
  const biasLabel  = { left: 'left-leaning', centre: 'centrist', right: 'right-leaning' }[biasDir] || null

  const scorePart = acc > 0 ? `Accuracy ${acc}/100${biasLabel ? ` · ${biasLabel}` : ''}. ` : ''
  const metaDesc  = summary
    ? `${scorePart}${summary}`.slice(0, 155)
    : `AI accuracy & bias analysis of "${article.title}" by ${outletName} on RatedNews.`

  const keywords = [
    outletName, article.category, biasLabel,
    'news analysis', 'bias rating', 'accuracy score', 'fact check',
  ].filter(Boolean).join(', ')

  const canonicalSlug = articleSlug(article.title, article.id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'Review',
    name:       `${article.title} — Accuracy & Bias Analysis`,
    url:        `https://ratednews.com/article/${canonicalSlug}`,
    datePublished: article.published_at,
    author: {
      '@type': 'Organization',
      name:    'RatedNews',
      url:     'https://ratednews.com',
    },
    publisher: {
      '@type': 'Organization',
      name:    'RatedNews',
      url:     'https://ratednews.com',
      logo: { '@type': 'ImageObject', url: 'https://ratednews.com/og-image.png' },
    },
    ...(acc > 0 && {
      reviewRating: {
        '@type':             'Rating',
        ratingValue:         acc,
        bestRating:          100,
        worstRating:         0,
        ratingExplanation:   'AI-assessed accuracy score based on factual claims, source quality, and editorial standards.',
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

  const pageTitle = acc > 0
    ? `${article.title} · Accuracy ${acc}/100 — RatedNews`
    : `${article.title} — RatedNews`

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://ratednews.com/' },
      ...(article.category ? [{ '@type': 'ListItem', position: 2, name: article.category, item: `https://ratednews.com/categories/${article.category.toLowerCase()}` }] : []),
      { '@type': 'ListItem', position: article.category ? 3 : 2, name: article.title, item: `https://ratednews.com/article/${canonicalSlug}` },
    ],
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={`https://ratednews.com/article/${canonicalSlug}`} />
        <meta property="og:title"       content={article.title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url"         content={`https://ratednews.com/article/${canonicalSlug}`} />
        <meta property="og:type"        content="article" />
        <meta property="og:image"       content={`https://ratednews.com/api/og?title=${encodeURIComponent(article.title)}${acc > 0 ? `&score=${acc}` : ''}${biasDir ? `&bias=${biasDir}` : ''}&outlet=${encodeURIComponent(outletName)}`} />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content={pageTitle} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image"      content={`https://ratednews.com/api/og?title=${encodeURIComponent(article.title)}${acc > 0 ? `&score=${acc}` : ''}${biasDir ? `&bias=${biasDir}` : ''}&outlet=${encodeURIComponent(outletName)}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/') }}
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
    fallback: 'blocking',
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
    .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
    .gte('id', `${pfx}-0000-0000-0000-000000000000`)
    .lte('id', `${pfx}-ffff-ffff-ffff-ffffffffffff`)
    .single()

  if (!article) return { notFound: true }

  return { props: { article }, revalidate: 3600 }
}
