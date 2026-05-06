import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import ArticlePage from '../../src/pages/ArticlePage'
import ErrorBoundary from '../../src/components/ErrorBoundary'

export default function ArticleDetail({ article }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          savedArticleIds, toggleSave, allOutlets } = useAppContext()

  if (router.isFallback || !article) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const outletName   = article.outlets?.name || 'RatedNews'
  const summary      = article.ai_summary || article.summary || ''
  const acc          = article.accuracy_score || 0
  const biasDir      = article.outlets?.bias_direction || article.bias_direction || null
  const biasLabel    = { left: 'left-leaning', centre: 'centrist', right: 'right-leaning' }[biasDir] || null

  // Meta description: lead with scores when available so the search snippet
  // immediately shows the analytical value; fall back gracefully when unscored.
  const scorePart  = acc > 0
    ? `Accuracy ${acc}/100${biasLabel ? ` · ${biasLabel}` : ''}. `
    : ''
  const metaDesc = summary
    ? `${scorePart}${summary}`.slice(0, 155)
    : `AI accuracy & bias analysis of "${article.title}" by ${outletName} on RatedNews.`

  // Keywords: title words + outlet + category + analysis terms
  const keywords = [
    outletName,
    article.category,
    biasLabel,
    'news analysis',
    'bias rating',
    'accuracy score',
    'fact check',
  ].filter(Boolean).join(', ')

  // ── Review schema ─────────────────────────────────────────────────────────
  // @type Review signals to Google this page analyses the original article,
  // not republishes it. itemReviewed references the source; reviewRating
  // carries the accuracy score; reviewBody carries the AI analysis text.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'Review',
    name:       `${article.title} — Accuracy & Bias Analysis`,
    url:        `https://ratednews.com/article/${article.id}`,
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
      logo: {
        '@type': 'ImageObject',
        url:     'https://ratednews.com/og-image.png',
      },
    },
    ...(acc > 0 && {
      reviewRating: {
        '@type':       'Rating',
        ratingValue:   acc,
        bestRating:    100,
        worstRating:   0,
        ratingExplanation: 'AI-assessed accuracy score based on factual claims, source quality, and editorial standards.',
      },
    }),
    ...(summary && { reviewBody: summary }),
    ...(keywords && { keywords }),
    itemReviewed: {
      '@type':       'NewsArticle',
      headline:      article.title,
      url:           article.url,
      datePublished: article.published_at,
      ...(article.image_url && {
        image: { '@type': 'ImageObject', url: article.image_url },
      }),
      author: {
        '@type': 'Organization',
        name:    outletName,
      },
      publisher: {
        '@type': 'Organization',
        name:    outletName,
      },
    },
  }

  return (
    <>
      <Head>
        <title>{article.title} — RatedNews</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={`https://ratednews.com/article/${article.id}`} />
        <meta property="og:title"       content={article.title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url"         content={`https://ratednews.com/article/${article.id}`} />
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

// ── Data fetching ────────────────────────────────────────────────────────────

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  )
}

export async function getStaticPaths() {
  const supabase = await getSupabase()
  // Pre-build the most recent 500 articles; newer ones get built on demand
  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .order('published_at', { ascending: false })
    .limit(500)

  return {
    paths: (articles || []).map(a => ({ params: { id: String(a.id) } })),
    fallback: 'blocking',
  }
}

export async function getStaticProps({ params }) {
  const supabase = await getSupabase()
  const { data: article } = await supabase
    .from('articles')
    .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
    .eq('id', params.id)
    .single()

  if (!article) return { notFound: true }

  return {
    props: { article },
    revalidate: 3600,
  }
}
