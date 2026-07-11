/**
 * Profile page — owner sees private ProfilePage, everyone else sees PublicProfilePage.
 * Supports both UUID links (legacy) and username slugs:
 *   /profile/abc-123-uuid     → redirect to /profile/alexchow if username set
 *   /profile/alexchow         → renders profile (private if owner, public if visitor)
 */

import Head from 'next/head'
import { useAppContext } from '../_app'
import ProfilePage from '../../src/pages/ProfilePage'
import PublicProfilePage from '../../src/pages/PublicProfilePage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getServerSideProps({ params }) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  )

  const slug   = params.userId
  const isUuid = UUID_RE.test(slug)

  const { data: profile } = await (isUuid
    ? supabase.from('profiles').select('user_id, username, public_profile').eq('user_id', slug).maybeSingle()
    : supabase.from('profiles').select('user_id, username, public_profile').eq('username', slug).maybeSingle()
  )

  if (!profile) return { notFound: true }

  // UUID link + username exists → redirect to clean slug
  if (isUuid && profile.username) {
    return { redirect: { destination: `/profile/${profile.username}`, permanent: false } }
  }

  return {
    props: {
      userId:   profile.user_id,
      username: profile.username || null,
      isPublic: profile.public_profile || false,
    },
  }
}

export default function ProfileRoute({ userId, username, isPublic }) {
  const { navigate, goBack, user, showToast,
          followedOutletIds, allOutlets, toggleFollow,
          savedArticleIds, toggleSave } = useAppContext()

  const isOwner     = user?.id === userId
  const handle      = username ? `@${username}` : 'RatedNews User'
  const profileUrl  = `https://www.ratednews.com/profile/${username || userId}`
  const biasCardUrl = `https://www.ratednews.com/api/bias-card?userId=${userId}`
  const pageTitle   = isOwner ? 'My Profile — RatedNews' : `${handle} — RatedNews`
  const pageDesc    = `${handle}'s reading bias, media diet and article ratings on RatedNews.`

  // Owner always sees the full private profile regardless of public_profile setting
  if (isOwner) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
          <meta name="robots" content="noindex" />
        </Head>
        <ProfilePage
          user={user}
          navigate={navigate}
          goBack={goBack}
          showToast={showToast}
          followedOutletIds={followedOutletIds}
          allOutlets={allOutlets}
          toggleFollow={toggleFollow}
          savedArticleIds={savedArticleIds}
          toggleSave={toggleSave}
        />
      </>
    )
  }

  // Visitor sees the public profile (with privacy gate if not public)
  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        {isPublic ? (
          <>
            <meta name="description"         content={pageDesc} />
            <link rel="canonical"            href={profileUrl} />
            <meta property="og:title"        content={pageTitle} />
            <meta property="og:description"  content={pageDesc} />
            <meta property="og:url"          content={profileUrl} />
            <meta property="og:type"         content="profile" />
            <meta property="og:image"        content={biasCardUrl} />
            <meta property="og:image:width"  content="1200" />
            <meta property="og:image:height" content="630" />
            <meta name="twitter:card"        content="summary_large_image" />
            <meta name="twitter:title"       content={pageTitle} />
            <meta name="twitter:description" content={pageDesc} />
            <meta name="twitter:image"       content={biasCardUrl} />
          </>
        ) : (
          <meta name="robots" content="noindex" />
        )}
      </Head>
      <PublicProfilePage
        viewer={user}
        outlets={allOutlets}
        userId={userId}
        isPublic={isPublic}
        navigate={navigate}
        goBack={goBack}
        showToast={showToast}
      />
    </>
  )
}
