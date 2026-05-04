import Head from 'next/head'
import { useAppContext } from './_app'
import ProfilePage from '../src/pages/ProfilePage'

// Profile is auth-gated — always server-side render, never statically pre-render
export async function getServerSideProps() { return { props: {} } }

export default function Profile() {
  const { navigate, goBack, user, showToast,
          followedOutletIds, allOutlets, toggleFollow,
          savedArticleIds, toggleSave } = useAppContext()

  return (
    <>
      <Head>
        <title>My Profile — RatedNews</title>
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
