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
  // A unique description per story. Every story with <8 sources previously
  // shared one identical sentence — thousands of pages with the same meta
  // description is a weak signal on exactly the pages meant to carry our SEO.
  // Name the story and the outlets so each page describes itself.
  const outletNames = [...new Set((story.members || []).map(m => m.outlets?.name).filter(Boolean))]
  const rawDesc = count > 1
    ? `${count} outlets covering: ${story.title}. Compare how ${outletNames.slice(0, 3).join(', ')}${outletNames.length > 3 ? ' and others' : ''} reported it, side by side on RatedNews.`
    : `${story.title} — see how this story is being reported, side by side on RatedNews.`
  const desc = rawDesc.length > 158 ? `${rawDesc.slice(0, 155).trimEnd()}…` : rawDesc

  // Cluster-level canonical. EVERY member of a cluster yields a valid /story/
  // URL rendering the same page, and each feed card links to its own member's
  // URL — so a 20-outlet story advertised 20 near-duplicate URLs, each
  // self-canonicalising. Point them all at one representative (the newest
  // member, the same rule the sitemap uses) so they consolidate into a single
  // indexable page instead of competing with each other.
  const url = `https://www.ratednews.com/story/${story.canonicalSlug || story.slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',     item: 'https://www.ratednews.com' },
          { '@type': 'ListItem', position: 2, name: 'Trending', item: 'https://www.ratednews.com/trending' },
          { '@type': 'ListItem', position: 3, name: story.title, item: url },
        ],
      },
      {
        '@type': 'NewsArticle',
        headline: (story.title || '').slice(0, 110),
        url,
        image: [ogImage],
        description: desc,
        ...(story.latest_published_at || story.created_at
          ? { datePublished: story.latest_published_at || story.created_at }
          : {}),
        publisher: { '@type': 'Organization', name: 'RatedNews', url: 'https://www.ratednews.com' },
        isBasedOn: [...new Set((story.members || []).map(m => m.url).filter(Boolean))].slice(0, 10),
      },
    ],
  }
  // Neutralise any `</script>` sequence in feed-derived strings before injection.
  const jsonLdStr = JSON.stringify(jsonLd).replace(/<\//g, '<\\/')

  return (
    <>
      <Head>
        <title>{title}</title>
        {/* Coverage-spread share card — the product's signature moment */}
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title"       content={count >= 8 ? `${story.title} — ${count} sources covering it` : `${story.title} — coverage compared`} />
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStr }} />
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
  try {
    return { paths: [], fallback: 'blocking' }
  } catch {
    return { paths: [], fallback: 'blocking' }
  }
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
    .select('id, title, url, summary, published_at, outlet_id, cluster_id, image_url, community_score, total_ratings, outlets(name, logo_url, country, parent_outlet_id)')
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
      .select('id, title, url, summary, published_at, outlet_id, image_url, community_score, total_ratings, outlets(name, logo_url, country, parent_outlet_id)')
      .eq('cluster_id', anchor.cluster_id)
      .order('published_at', { ascending: false })
    if (cluster && cluster.length) {
      // De-dupe by PUBLISHER, not feed — post-consolidation BBC Sport and BBC
      // News are separate outlets under one parent brand; one take per brand
      // keeps the "N sources" claim honest. Anchor first, then newest.
      const seen = new Set()
      members = []
      for (const a of [anchor, ...cluster]) {
        const pub = a.outlets?.parent_outlet_id || a.outlet_id
        if (seen.has(pub)) continue
        seen.add(pub)
        members.push(a)
      }
    }
  }
  // Trim summaries for the page payload — cards clamp to two lines anyway
  for (const a of members) {
    if (a.summary) a.summary = String(a.summary).slice(0, 320)
    if (a.outlets) delete a.outlets.parent_outlet_id
  }

  // The representative URL for this cluster — newest member, matching the rule
  // pages/sitemap.xml.jsx uses to pick its one URL per cluster. Every other
  // member's /story/ URL canonicalises here.
  const newest = members.reduce((a, b) => (b.published_at > a.published_at ? b : a), members[0])

  const story = {
    anchorId: anchor.id,
    slug: canonical,
    canonicalSlug: articleSlug(newest.title, newest.id),
    title: anchor.title,
    // Hero: anchor's photo, else the first member that has one — an anchor
    // without a photo was blanking the hero even on well-photographed stories
    image: anchor.image_url || members.find(a => a.image_url)?.image_url || null,
    members,
  }

  // 1h, not 15min — story pages are the highest-volume ISR set (thousands of
  // slugs) and crawler hits at 900s were driving millions of ISR regenerations
  // ($ writes). Coverage lists barely change hour-to-hour; the article page
  // still re-resolves the live cluster on click.
  return { props: { story }, revalidate: 21600 }
}
