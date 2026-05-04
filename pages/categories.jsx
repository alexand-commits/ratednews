import Head from 'next/head'
import { useAppContext } from './_app'
import CategoryPage from '../src/pages/CategoryPage'

export default function Categories() {
  const { navigate, goBack } = useAppContext()

  return (
    <>
      <Head>
        <title>Browse by Category — RatedNews</title>
        <meta name="description" content="Browse news by category on RatedNews — Politics, Business, Tech, Sport, Health, Environment and more. Every story rated for bias and accuracy." />
        <link rel="canonical" href="https://ratednews.com/categories" />
      </Head>
      <CategoryPage navigate={navigate} goBack={goBack} />
    </>
  )
}
