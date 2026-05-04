import React, { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { db } from '../src/lib/supabase'
import Header from '../src/components/Header'
import BottomNav from '../src/components/BottomNav'
import Toast from '../src/components/Toast'
import AuthModal from '../src/components/AuthModal'
import { createNavigate } from '../src/utils/navigate'
import '../src/styles/globals.css'

// ── Global app context ──────────────────────────────────────────────────────
const AppContext = createContext({})
export function useAppContext() { return useContext(AppContext) }

export default function App({ Component, pageProps }) {
  const router = useRouter()

  const [isDark,           setIsDark]           = useState(false)
  const [session,          setSession]          = useState(null)
  const [showAuthModal,    setShowAuthModal]    = useState(false)
  const [toast,            setToast]            = useState({ message: '', visible: false })
  const [followedOutletIds,setFollowedOutletIds]= useState(new Set())
  const [savedArticleIds,  setSavedArticleIds]  = useState(new Set())
  const [allOutlets,       setAllOutlets]       = useState([])

  // ── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') setIsDark(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) { loadFollows(session.user.id); loadSaves(session.user.id) }
    })
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) { loadFollows(session.user.id); loadSaves(session.user.id) }
      else { setFollowedOutletIds(new Set()); setSavedArticleIds(new Set()) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Outlets (global, used by navigate for slug generation) ─────────────
  useEffect(() => {
    db.from('outlets').select('*').order('overall_score', { ascending: false })
      .then(({ data }) => setAllOutlets(data || []))
  }, [])

  // ── User data helpers ───────────────────────────────────────────────────
  async function loadFollows(userId) {
    const { data } = await db.from('follows').select('outlet_id').eq('user_id', userId)
    setFollowedOutletIds(new Set((data || []).map(f => f.outlet_id)))
  }

  async function loadSaves(userId) {
    const { data } = await db.from('saved_articles').select('article_id').eq('user_id', userId)
    setSavedArticleIds(new Set((data || []).map(r => r.article_id)))
  }

  async function toggleSave(articleId) {
    if (!user) { setShowAuthModal(true); return }
    const isSaved = savedArticleIds.has(articleId)
    if (isSaved) {
      await db.from('saved_articles').delete().eq('user_id', user.id).eq('article_id', articleId)
      setSavedArticleIds(prev => { const n = new Set(prev); n.delete(articleId); return n })
      showToast('Removed from saved')
    } else {
      await db.from('saved_articles').insert({ user_id: user.id, article_id: articleId })
      setSavedArticleIds(prev => new Set([...prev, articleId]))
      showToast('Article saved!')
    }
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

  function showToast(msg) {
    setToast({ message: msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500)
  }

  const user     = session?.user || null
  const navigate = createNavigate(router, allOutlets)
  const goBack   = () => router.back()

  const ctx = {
    user, session, isDark,
    toggleTheme:    () => setIsDark(d => !d),
    showToast,
    openAuthModal:  () => setShowAuthModal(true),
    followedOutletIds, toggleFollow,
    savedArticleIds,   toggleSave,
    allOutlets,
    navigate, goBack,
  }

  return (
    <AppContext.Provider value={ctx}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </Head>

      <Header
        navigate={navigate}
        isDark={isDark}
        toggleTheme={() => setIsDark(d => !d)}
        user={user}
        onLoginClick={() => setShowAuthModal(true)}
        onSignOut={async () => {
          await db.auth.signOut()
          showToast('Signed out')
          router.push('/')
        }}
      />

      <Toast message={toast.message} visible={toast.visible} />

      <Component {...pageProps} />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} showToast={showToast} />
      )}

      <BottomNav navigate={navigate} />
    </AppContext.Provider>
  )
}
