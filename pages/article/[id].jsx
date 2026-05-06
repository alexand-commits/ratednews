import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import ArticlePage from '../../src/pages/ArticlePage'
import ErrorBoundary from '../../src/components/ErrorBoundary'
import { articleSlug } from '../../src/utils/helpers'

// Matches a full UUID at the END of a slug (or alone)
// e.g. "trump-signs-tariff-4f3ff8a6-4730-4e86-a7aa-9d493f4dfa71"
const UUID_SUFFIX_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const UUID_ONLY_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ArticleDetail({ article }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          savedArticleIds, toggleSave } = useAppContext()

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

  return (
    <>
      <Head>
        <title>{article.title} — RatedNews</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={`https://ratednews.com/article/${canonicalSlug}`} />
        <meta property="og:title"       content={article.title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url"         content={`https://ratednews.com/article/${canonicalSlug}`} />
        <meta property="og:type"        content="article" />
        {article.image_url && <meta property="og:image" content={article.image_url} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/') }}
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

  // ── Case 1: bare UUID (old link format) ───────────────────────────────────
  // Someone followed a pre-migration link — fetch the article and 301 redirect
  // to the canonical slug URL so Google consolidates to the new address.
  if (UUID_ONLY_RE.test(slug)) {
    const { data: article } = await supabase
      .from('articles')
      .select('id, title')
      .eq('id', slug)
      .single()

    if (!article) return { notFound: true }

    return {
      redirect: {
        destination: `/article/${articleSlug(article.title, article.id)}`,
        permanent:   true,
      },
    }
  }

  // ── Case 2: slug with UUID suffix (canonical format) ─────────────────────
  // Extract the UUID from the end of the slug for an exact DB lookup.
  const idMatch = slug.match(UUID_SUFFIX_RE)
  if (!idMatch) return { notFound: true }
  const id = idMatch[1]

  const { data: article } = await supabase
    .from('articles')
    .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
    .eq('id', id)
    .single()

  if (!article) return { notFound: true }

  return {
    props:      { article },
    revalidate: 3600,
  }
}
