import Head from 'next/head'
import { useAppContext } from './_app'
import CategoryPage from '../src/pages/CategoryPage'

export default function Categories() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>Rated News by Topic — Politics, Business, Tech & More — RatedNews</title>
        <meta name="description" content="Browse rated news stories by topic — Politics, Business, Tech, Health, Sport, Environment and more. Every article scored for bias and accuracy across 50+ outlets." />
        <link rel="canonical" href="https://ratednews.com/categories" />
      </Head>
      <CategoryPage navigate={navigate} goBack={goBack} />
    </>
  )
}
