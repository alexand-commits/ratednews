import Head from 'next/head'
import { useEffect } from 'react'
import { useAppContext } from '../_app'
import ArticleReviewPage from '../../src/pages/ArticleReviewPage'

const ALLOWED_EMAIL = 'alexandchow@gmail.com'

export async function getServerSideProps() { return { props: {} } }

export default function AdminArticles() {
  const { goBack, navigate, user } = useAppContext()

  // Client-side guard — redirect non-owners immediately
  useEffect(() => {
    if (user === null) navigate('feed')                        // logged out
    if (user && user.email !== ALLOWED_EMAIL) navigate('feed') // wrong account
  }, [user])

  if (!user || user.email !== ALLOWED_EMAIL) return null

  return (
    <>
      <Head>
        <title>Article Review — RatedNews</title>
        <meta name="robots" content="noindex" />
      </Head>
      <ArticleReviewPage goBack={goBack} />
    </>
  )
}
