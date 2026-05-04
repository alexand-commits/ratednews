import React, { useState, useEffect } from 'react'
import { db } from './lib/supabase'
import Header from './components/Header'
import Toast from './components/Toast'
import BottomNav from './components/BottomNav'
import CategoryPage from './pages/CategoryPage'
import AboutPage from './pages/AboutPage'
import AuthModal from './components/AuthModal'
import FeedPage from './pages/FeedPage'
import ArticlePage from './pages/ArticlePage'
import OutletPage from './pages/OutletPage'
import OutletsListPage from './pages/OutletsListPage'
import RankingsPage from './pages/RankingsPage'
import ProfilePage from './pages/ProfilePage'
import PublicProfilePage from './pages/PublicProfilePage'

export default function App() {
  const [currentPage, setCurrentPage] = useState('feed')
  const [pageHistory, setPageHistory] = useState([]) // stack of {page, articleId, outletId, userId, category}
  const [selectedArticleId, setSelectedArticleId] = useState(null)
  const [selectedOutletId, setSelectedOutletId] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [allArticles, setAllArticles] = useState([])
  const [allOutlets, setAllOutlets] = useState([])
  const [totalArticleCount, setTotalArticleCount] = useState(null)
  const [articlesOffset, setArticlesOffset] = useState(0)
  const [hasMoreArticles, setHasMoreArticles] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ message: '', visible: false })
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [session, setSession] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [followedOutletIds, setFollowedOutletIds] = useState(new Set())

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Auth session
  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadFollows(session.user.id)
    })
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadFollows(session.user.id)
      else setFollowedOutletIds(new Set())
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadFollows(userId) {
    const { data } = await db.from('follows').select('outlet_id').eq('user_id', userId)
    setFollowedOutletIds(new Set((data || []).map(f => f.outlet_id)))
  }

  async function toggleFollow(outletId) {
    if (!user) return
    const isFollowing = followedOutletIds.has(outletId)
    if (isFollowing) {
      await db.from('follows').delete().eq('user_id', user.id).eq('outlet_id', outletId)
      setFollowedOutletIds(prev => { const n = new Set(prev); n.delete(outletId); return n })
      showToast('Unfollowed')
    } else {
      await db.from('follows').insert({ user_id: user.id, outlet_id: outletId })
      setFollowedOutletIds(prev => new Set([...prev, outletId]))
      showToast('Following!')
    }
  }

  // Data + deep link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const articleParam = params.get('article')
    if (articleParam) {
      setSelectedArticleId(articleParam)
      setCurrentPage('article')
      window.history.replaceState({}, '', window.location.pathname)
    }
    Promise.all([loadOutlets(), loadArticles()]).then(() => setLoading(false))

    // Real-time: new articles appear in feed automatically
    const channel = db
      .channel('new-articles')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'articles',
      }, async payload => {
        // Fetch the full article with outlet info
        const { data } = await db
          .from('articles')
          .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setAllArticles(prev => [data, ...prev])
          setTotalArticleCount(c => (c || 0) + 1)
        }
      })
      .subscribe()

    return () => { db.removeChannel(channel) }
  }, [])

  async function loadOutlets() {
    const { data } = await db.from('outlets').select('*').order('overall_score', { ascending: false })
    setAllOutlets(data || [])
  }

  const FEED_BATCH = 50

  async function loadArticles() {
    const [{ data }, { count }] = await Promise.all([
      db.from('articles')
        .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
        .order('published_at', { ascending: false })
        .range(0, FEED_BATCH - 1),
      db.from('articles').select('*', { count: 'exact', head: true }),
    ])
    setAllArticles(data || [])
    setTotalArticleCount(count || 0)
    setArticlesOffset(FEED_BATCH)
    setHasMoreArticles((data || []).length === FEED_BATCH)
  }

  async function loadMoreArticles() {
    if (loadingMore || !hasMoreArticles) return
    setLoadingMore(true)
    const { data } = await db.from('articles')
      .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
      .order('published_at', { ascending: false })
      .range(articlesOffset, articlesOffset + FEED_BATCH - 1)
    if (data && data.length > 0) {
      setAllArticles(prev => [...prev, ...data])
      setArticlesOffset(prev => prev + FEED_BATCH)
      setHasMoreArticles(data.length === FEED_BATCH)
    } else {
      setHasMoreArticles(false)
    }
    setLoadingMore(false)
  }

  function navigate(page, opts = {}) {
    // Push current state onto history stack before navigating
    setPageHistory(prev => [...prev, {
      page: currentPage,
      articleId: selectedArticleId,
      outletId: selectedOutletId,
      userId: selectedUserId,
      category: selectedCategory,
    }])
    if (opts.articleId !== undefined) setSelectedArticleId(opts.articleId)
    if (opts.outletId !== undefined) setSelectedOutletId(opts.outletId)
    if (opts.userId !== undefined) setSelectedUserId(opts.userId)
    if (opts.category !== undefined) setSelectedCategory(opts.category)
    else if (page === 'feed' && !opts.category) setSelectedCategory('all')
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  function goBack() {
    if (pageHistory.length === 0) {
      setCurrentPage('feed')
      setSelectedCategory('all')
      window.scrollTo(0, 0)
      return
    }
    const prev = pageHistory[pageHistory.length - 1]
    setPageHistory(h => h.slice(0, -1))
    setSelectedArticleId(prev.articleId)
    setSelectedOutletId(prev.outletId)
    setSelectedUserId(prev.userId)
    setSelectedCategory(prev.category || 'all')
    setCurrentPage(prev.page)
    window.scrollTo(0, 0)
  }

  async function refreshArticle(articleId) {
    const { data } = await db
      .from('articles')
      .select('*, outlets(name, country, bias_direction, logo_url), comments(count)')
      .eq('id', articleId)
      .single()
    if (data) setAllArticles(prev => prev.map(a => a.id === articleId ? data : a))
  }

  function showToast(msg) {
    setToast({ message: msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500)
  }

  const user = session?.user || null

  return (
    <>
      <Header
        navigate={navigate}
        isDark={isDark}
        toggleTheme={() => setIsDark(d => !d)}
        user={user}
        onLoginClick={() => setShowAuthModal(true)}
        onSignOut={async () => { await db.auth.signOut(); showToast('Signed out'); navigate('feed') }}
      />
      <Toast message={toast.message} visible={toast.visible} />

      {currentPage === 'feed' && (
        <FeedPage articles={allArticles} outlets={allOutlets} loading={loading} navigate={navigate} showToast={showToast} initialCategory={selectedCategory} totalArticleCount={totalArticleCount} user={user} followedOutletIds={followedOutletIds} onLoginClick={() => setShowAuthModal(true)} loadMoreArticles={loadMoreArticles} hasMoreArticles={hasMoreArticles} loadingMore={loadingMore} />
      )}
      {currentPage === 'categories' && (
        <CategoryPage articles={allArticles} navigate={navigate} goBack={goBack} />
      )}
      {currentPage === 'about' && (
        <AboutPage navigate={navigate} goBack={goBack} />
      )}
      {currentPage === 'article' && (
        <ArticlePage
          articleId={selectedArticleId}
          allArticles={allArticles}
          navigate={navigate}
          goBack={goBack}
          showToast={showToast}
          refreshArticle={refreshArticle}
          user={user}
          onLoginClick={() => setShowAuthModal(true)}
        />
      )}
      {currentPage === 'outlet' && (
        <OutletPage outletId={selectedOutletId} allOutlets={allOutlets} goBack={goBack} navigate={navigate} showToast={showToast} user={user} onLoginClick={() => setShowAuthModal(true)} followedOutletIds={followedOutletIds} toggleFollow={toggleFollow} />
      )}
      {currentPage === 'outlets' && (
        <OutletsListPage outlets={allOutlets} navigate={navigate} goBack={goBack} showToast={showToast} />
      )}
      {currentPage === 'rankings' && (
        <RankingsPage outlets={allOutlets} navigate={navigate} goBack={goBack} showToast={showToast} />
      )}
      {currentPage === 'profile' && (
        <ProfilePage user={user} navigate={navigate} goBack={goBack} showToast={showToast} followedOutletIds={followedOutletIds} allOutlets={allOutlets} toggleFollow={toggleFollow} />
      )}
      {currentPage === 'publicProfile' && (
        <PublicProfilePage userId={selectedUserId} navigate={navigate} goBack={goBack} showToast={showToast} />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} showToast={showToast} />
      )}

      <BottomNav currentPage={currentPage} navigate={navigate} />
    </>
  )
}
