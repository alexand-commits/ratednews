import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import ArticlePage from '../../src/pages/ArticlePage'

export default function ArticleDetail({ article }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          savedArticleIds, toggleSave, allOutlets } = useAppContext()

  if (router.isFallback || !article) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const outletName = article.outlets?.name || 'RatedNews'
  const summary    = article.ai_summary || article.summary || ''

  return (
    <>
      <Head>
        <title>{article.title} — RatedNews</title>
        <meta name="description" content={summary.slice(0, 155) || `Read ${article.title} with AI bias and accuracy analysis on RatedNews.`} />
        <link rel="canonical" href={`https://ratednews.com/article/${article.id}`} />
        <meta property="og:title"       content={article.title} />
        <meta property="og:description" content={summary.slice(0, 200)} />
        <meta property="og:url"         content={`https://ratednews.com/article/${article.id}`} />
        <meta property="og:type"        content="article" />
        {article.image_url && <meta property="og:image" content={article.image_url} />}
        {/* Structured data for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type':    'NewsArticle',
            headline:   article.title,
            description: summary,
            url:        `https://ratednews.com/article/${article.id}`,
            datePublished: article.published_at,
            publisher: {
              '@type': 'Organization',
              name:    outletName,
            },
            author: {
              '@type': 'Organization',
              name:    outletName,
            },
          }).replace(/<\//g, '<\\/')}}
        />
      </Head>
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
