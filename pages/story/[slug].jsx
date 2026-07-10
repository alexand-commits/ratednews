import Head from 'next/head'
import { useAppContext } from '../_app'
import StoryPage from '../../src/pages/StoryPage'
import ErrorBoundary from '../../src/components/ErrorBoundary'
import { articleSlug } from '../../src/utils/helpers'

const SHORT_ID_SUFFIX_RE = /-([0-9a-f]{8})$/i
const BARE_SHORT_RE       = /^([0-9a-f]{8})$/i

export default function StoryDetail({ story }) {
  const { navigate, goBack, showToast, user, openAuthModal, allOutlets } = useAppContext()
  if (!story) return null

  const count = story.members?.length || 0
  const ogImage = `https://www.ratednews.com/api/og?type=story&title=${encodeURIComponent((story.title || '').slice(0, 120))}&count=${count}&sources=${encodeURIComponent([...new Set((story.members || []).map(m => m.outlets?.name).filter(Boolean))].slice(0, 4).join('|'))}`
  const title = `${story.title} — ${count} ${count === 1 ? 'source' : 'sources'} covering it | RatedNews`
  const desc  = `See how ${count} news outlets are covering this story, side by side, on RatedNews. Rate the sources you trust.`
  const url   = `https://www.ratednews.com/story/${story.slug}`

  return (
    <>
      <Head>
        <title>{title}</title>
        {/* Coverage-spread share card — the product's signature moment */}
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title"       content={`${story.title} — ${count} sources covering it`} />
        <meta property="og:description" content={desc} />
        <meta property="og:url"         content={url} />
        <meta property="og:type"        content="website" />
        <meta property="og:image"       content={ogImage} />
        <meta property="og:image:type"  content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:image"      content={ogImage} />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${story.title} — ${count} sources`} />
        <meta name="twitter:description" content={desc} />
      </Head>
      <ErrorBoundary>
        <StoryPage
          story={story}
          navigate={navigate}
          goBack={goBack}
          showToast={showToast}
          user={user}
          onLoginClick={openAuthModal}
          outlets={allOutlets}
        />
      </ErrorBoundary>
    </>
  )
}

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
}

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' }
}

export async function getStaticProps({ params }) {
  const supabase = await getSupabase()
  const slug = params.slug

  const m = slug.match(SHORT_ID_SUFFIX_RE) || slug.match(BARE_SHORT_RE)
  if (!m) return { notFound: true }
  const pfx = m[1]

  // Resolve the anchor article from its 8-char short id (UUID range query)
  const { data: anchor } = await supabase
    .from('articles')
    .select('id, title, url, published_at, outlet_id, cluster_id, image_url, community_score, total_ratings, outlets(name, logo_url, country)')
    .gte('id', `${pfx}-0000-0000-0000-000000000000`)
    .lte('id', `${pfx}-ffff-ffff-ffff-ffffffffffff`)
    .single()
  if (!anchor) return { notFound: true }

  // Canonical slug guard
  const canonical = articleSlug(anchor.title, anchor.id)
  if (slug !== canonical) {
    return { redirect: { destination: `/story/${canonical}`, permanent: true } }
  }

  // Pull every article in the anchor's current cluster (cluster_id churns each
  // run, so we resolve it live here rather than baking it into the URL).
  let members = [anchor]
  if (anchor.cluster_id) {
    const { data: cluster } = await supabase
      .from('articles')
      .select('id, title, url, published_at, outlet_id, community_score, total_ratings, outlets(name, logo_url, country)')
      .eq('cluster_id', anchor.cluster_id)
      .order('published_at', { ascending: false })
    if (cluster && cluster.length) {
      // De-dupe by outlet (one take per outlet), anchor first
      const seen = new Set()
      members = []
      for (const a of [anchor, ...cluster]) {
        if (seen.has(a.outlet_id)) continue
        seen.add(a.outlet_id)
        members.push(a)
      }
    }
  }

  const story = {
    anchorId: anchor.id,
    slug: canonical,
    title: anchor.title,
    image: anchor.image_url || null,
    members,
  }

  return { props: { story }, revalidate: 900 }
}
