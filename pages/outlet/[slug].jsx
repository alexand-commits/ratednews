import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAppContext } from '../_app'
import OutletPage from '../../src/pages/OutletPage'
import { toSlug } from '../../src/utils/navigate'

export default function OutletDetail({ outlet }) {
  const router = useRouter()
  const { navigate, goBack, showToast, user, openAuthModal,
          followedOutletIds, toggleFollow, allOutlets } = useAppContext()

  // Fallback while ISR regenerates
  if (router.isFallback || !outlet) {
    return <div className="page-content"><div className="container" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }

  const canonicalSlug = toSlug(outlet.name)

  return (
    <>
      <Head>
        <title>{outlet.name} Bias Rating & Accuracy Score — RatedNews</title>
        <meta
          name="description"
          content={`See ${outlet.name}'s AI-powered bias rating, accuracy score, and headline fairness breakdown on RatedNews. Scores updated hourly from real published articles.`}
        />
        <link rel="canonical" href={`https://ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:title"       content={`${outlet.name} — Bias & Accuracy Rating`} />
        <meta property="og:description" content={`${outlet.name} has an accuracy score of ${outlet.overall_score ?? '–'}/100 on RatedNews. See the full breakdown.`} />
        <meta property="og:url"         content={`https://ratednews.com/outlet/${canonicalSlug}`} />
        <meta property="og:type"        content="website" />
      </Head>
      <OutletPage
        outletId={outlet.id}
        allOutlets={allOutlets.length ? allOutlets : [outlet]}
        goBack={goBack}
        navigate={navigate}
        showToast={showToast}
        user={user}
        onLoginClick={openAuthModal}
        followedOutletIds={followedOutletIds}
        toggleFollow={toggleFollow}
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
  const { data: outlets } = await supabase.from('outlets').select('name')
  return {
    paths: (outlets || []).map(o => ({ params: { slug: toSlug(o.name) } })),
    fallback: 'blocking', // new outlets get a page on first visit
  }
}

export async function getStaticProps({ params }) {
  const supabase = await getSupabase()
  const { data: outlets } = await supabase.from('outlets').select('*')
  const outlet = (outlets || []).find(o => toSlug(o.name) === params.slug)

  if (!outlet) return { notFound: true }

  return {
    props: { outlet },
    revalidate: 3600, // regenerate every hour, matching the ingest schedule
  }
}
