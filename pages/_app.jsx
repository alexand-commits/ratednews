import React, { useState, useEffect, createContext, useContext } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Script from 'next/script'
import { db } from '../src/lib/supabase'
import Header from '../src/components/Header'
import BottomNav from '../src/components/BottomNav'
import Toast from '../src/components/Toast'
import AuthModal from '../src/components/AuthModal'
import PasswordResetModal from '../src/components/PasswordResetModal'
import ErrorBoundary from '../src/components/ErrorBoundary'
import { createNavigate } from '../src/utils/navigate'
import { Analytics } from '@vercel/analytics/react'
import { playfair, lato } from '../src/lib/fonts'
import '../src/styles/globals.css'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || ''

// ── Global app context ──────────────────────────────────────────────────────
const AppContext = createContext({})
export function useAppContext() { return useContext(AppContext) }

export default function App({ Component, pageProps }) {
  const router = useRouter()

  const [isDark,           setIsDark]           = useState(true)
  const [session,          setSession]          = useState(null)
  const [showAuthModal,       setShowAuthModal]       = useState(false)
  const [showPasswordReset,   setShowPasswordReset]   = useState(false)
  const [toast,            setToast]            = useState({ message: '', visible: false })
  const [followedOutletIds,setFollowedOutletIds]= useState(new Set())
  const [savedArticleIds,  setSavedArticleIds]  = useState(new Set())
  const [allOutlets,       setAllOutlets]       = useState([])
  const [outletsLoading,   setOutletsLoading]   = useState(true)

  // ── Google Analytics page-view tracking ─────────────────────────────────
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (typeof window.gtag === 'function') {
        window.gtag('config', GA_ID, { page_path: url })
      }
    }
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => router.events.off('routeChangeComplete', handleRouteChange)
  }, [router.events])

  // ── Theme ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light') setIsDark(false)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    // Also set background directly on html + body so the colour is visible
    // immediately — before CSS variables resolve — and fills any gap below
    // the fixed bottom nav on iOS Safari / Android Chrome.
    const bg = isDark ? '#201E1C' : '#F8F6F4'
    root.style.background = bg
    document.body.style.background = bg
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
      if (_event === 'PASSWORD_RECOVERY') {
        // User clicked a reset link — show the new-password form instead of logging in silently
        setShowPasswordReset(true)
        return
      }
      if (session?.user) { loadFollows(session.user.id); loadSaves(session.user.id) }
      else { setFollowedOutletIds(new Set()); setSavedArticleIds(new Set()) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Outlets (global, used by navigate for slug generation) ─────────────
  // Cache in sessionStorage for 5 minutes — avoids a cold Supabase fetch on
  // every page load and fixes the brief '—' flash on the feed stat chip.
  useEffect(() => {
    const CACHE_KEY = 'rn_outlets_cache'
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL && data?.length) {
          setAllOutlets(data)
          setOutletsLoading(false)
          return // skip fetch — cache is fresh
        }
      }
    } catch (e) {}

    // Explicit column list — avoids fetching any future large columns automatically.
    // Includes all fields used across FeedPage, OutletPage, and NewsCard.
    const OUTLET_SELECT = 'id, name, country, overall_score, accuracy_score, bias_score, bias_direction, logo_url, type, description, website_url, rss_url, community_score, total_ratings, fair_rate, misleading_rate, clickbait_rate, article_count_30d, parent_outlet_id'
    db.from('outlets').select(OUTLET_SELECT).order('overall_score', { ascending: false })
      .then(({ data }) => {
        const outlets = data || []
        setAllOutlets(outlets)
        setOutletsLoading(false)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: outlets, ts: Date.now() })) } catch (e) {}
      })
  }, [])

  async function refreshOutlets() {
    const OUTLET_SELECT = 'id, name, country, overall_score, accuracy_score, bias_score, bias_direction, logo_url, type, description, website_url, rss_url, community_score, total_ratings, fair_rate, misleading_rate, clickbait_rate, article_count_30d, parent_outlet_id'
    const { data } = await db.from('outlets').select(OUTLET_SELECT).order('overall_score', { ascending: false })
    if (data) {
      setAllOutlets(data)
      try { sessionStorage.setItem('rn_outlets_cache', JSON.stringify({ data, ts: Date.now() })) } catch (e) {}
    }
  }

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
      // Optimistic remove
      setSavedArticleIds(prev => { const n = new Set(prev); n.delete(articleId); return n })
      const { error } = await db.from('saved_articles').delete().eq('user_id', user.id).eq('article_id', articleId)
      if (error) {
        // Revert on failure
        setSavedArticleIds(prev => new Set([...prev, articleId]))
        showToast('Could not remove — please try again')
        if (process.env.NODE_ENV !== 'production') console.error('[toggleSave] delete failed:', error)
      } else {
        if (navigator.vibrate) navigator.vibrate(20)
        showToast('Removed from saved')
      }
    } else {
      // Optimistic add
      setSavedArticleIds(prev => new Set([...prev, articleId]))
      const { error } = await db.from('saved_articles').insert({ user_id: user.id, article_id: articleId })
      if (error) {
        // Revert on failure
        setSavedArticleIds(prev => { const n = new Set(prev); n.delete(articleId); return n })
        showToast('Could not save — please try again')
        if (process.env.NODE_ENV !== 'production') console.error('[toggleSave] insert failed:', error)
      } else {
        if (navigator.vibrate) navigator.vibrate([40, 30, 40])
        showToast('Article saved! 🔖')
      }
    }
  }

  async function toggleFollow(outletId) {
    if (!user) return
    const isFollowing = followedOutletIds.has(outletId)
    if (isFollowing) {
      // Optimistic update first
      setFollowedOutletIds(prev => { const n = new Set(prev); n.delete(outletId); return n })
      const { error } = await db.from('follows').delete().eq('user_id', user.id).eq('outlet_id', outletId)
      if (error) {
        // Revert
        setFollowedOutletIds(prev => new Set([...prev, outletId]))
        showToast('Could not unfollow — please try again')
        return
      }
      if (navigator.vibrate) navigator.vibrate(20)
      showToast('Unfollowed')
    } else {
      // Optimistic update first
      setFollowedOutletIds(prev => new Set([...prev, outletId]))
      const { error } = await db.from('follows').insert({ user_id: user.id, outlet_id: outletId })
      if (error) {
        // Revert
        setFollowedOutletIds(prev => { const n = new Set(prev); n.delete(outletId); return n })
        showToast('Could not follow — please try again')
        return
      }
      if (navigator.vibrate) navigator.vibrate([30, 40, 60])
      showToast('Following!')
    }
  }

  function showToast(msg) {
    setToast({ message: msg, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500)
  }

  const user     = session?.user || null
  const navigate = createNavigate(router, allOutlets)
  const goBack   = () => {
    // If this is the first page in session history, going back would exit the app
    if (typeof window !== 'undefined' && window.history.state?.idx > 0) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const ctx = {
    user, session, isDark,
    toggleTheme:    () => setIsDark(d => !d),
    showToast,
    openAuthModal:  () => setShowAuthModal(true),
    followedOutletIds, toggleFollow,
    savedArticleIds,   toggleSave,
    allOutlets, outletsLoading, refreshOutlets,
    navigate, goBack,
  }

  return (
    <AppContext.Provider value={ctx}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </Head>

      {/* Google Analytics — loaded after page is interactive, not render-blocking */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}', { page_path: window.location.pathname });
      `}</Script>

      <div className={`${playfair.variable} ${lato.variable}`} style={{ fontFamily: 'var(--font-lato), sans-serif' }}>
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

      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} showToast={showToast} />
      )}

      {showPasswordReset && (
        <PasswordResetModal
          onClose={() => setShowPasswordReset(false)}
          showToast={showToast}
        />
      )}

      <BottomNav navigate={navigate} />
      <Analytics />
      </div>
    </AppContext.Provider>
  )
}
