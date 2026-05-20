import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAppContext } from './_app'
import ProfilePage from '../src/pages/ProfilePage'
import { db } from '../src/lib/supabase'

export async function getServerSideProps() { return { props: {} } }

export default function Profile() {
  const { navigate, goBack, user, showToast,
          followedOutletIds, allOutlets, toggleFollow,
          savedArticleIds, toggleSave } = useAppContext()
  const router = useRouter()

  // Redirect to the canonical profile URL once we know the user's handle.
  // Falls back to UUID so the link always resolves even without a username.
  useEffect(() => {
    if (!user) return
    db.from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const handle = data?.username || user.id
        router.replace(`/profile/${handle}`)
      })
  }, [user?.id])

  // Don't render anything — this route exists only to redirect to the
  // canonical profile URL. Rendering here causes a visible flash before redirect.
  return (
    <Head>
      <title>My Profile — RatedNews</title>
      <meta name="robots" content="noindex" />
    </Head>
  )
}
