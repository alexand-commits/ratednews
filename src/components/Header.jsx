import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { db } from '../lib/supabase'

// Root tabs served by the mobile bottom nav — no back arrow on these.
// Everything else (article, story, outlet, profile, about…) gets one.
const TAB_PATHS = new Set(['/', '/trending', '/sports', '/explore', '/outlets'])

function getTrustLevel(total) {
  if (total >= 50) return { label: 'Expert',           emoji: '🏅', color: '#D85A30' }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: '#639922' }
  if (total >= 10) return { label: 'Contributor',      emoji: '✅', color: '#185FA5' }
  if (total >= 3)  return { label: 'Active Member',    emoji: '📰', color: '#6B6760' }
  return           { label: 'New Member',              emoji: '👋', color: '#9E9B95' }
}

export default function Header({ navigate, isDark, toggleTheme, user, onLoginClick, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [stats, setStats]       = useState(null)
  const menuRef = useRef(null)
  const router  = useRouter()

  // Twitter-style mobile back arrow: detail pages only, never the root tabs.
  const showBack = !TAB_PATHS.has(router.pathname)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Lazily fetch quick stats when dropdown opens — only once per session
  useEffect(() => {
    if (!menuOpen || !user || stats) return
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      db.from('profiles').select('username').eq('user_id', user.id).maybeSingle(),
      db.from('article_views').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('viewed_at', ninetyDaysAgo),
      db.from('saved_articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      db.from('follows').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      db.from('ratings').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      db.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([{ data: prof }, { count: views }, { count: saved }, { count: following }, { count: ratings }, { count: comments }]) => {
      const totalContrib = (ratings || 0) + (comments || 0)
      setStats({
        username:  prof?.username || user.email.split('@')[0],
        views:     views     || 0,
        saved:     saved     || 0,
        following: following || 0,
        trust:     getTrustLevel(totalContrib),
      })
    })
  }, [menuOpen, user])

  const initials = user ? user.email.slice(0, 2).toUpperCase() : ''

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        {showBack && (
          <button
            className="header-back mobile-only"
            onClick={() => (window.history.length > 1 ? router.back() : navigate('feed'))}
            aria-label="Back"
          >←</button>
        )}
        <div className="logo" onClick={() => navigate('feed')}>
          Rated<span>News</span>
        </div>
      </div>
      <nav className="nav">
        {[
          { label: 'Feed',     page: 'feed',     match: p => p === '/' },
          { label: 'Trending', page: 'trending', match: p => p === '/trending' },
          { label: 'Sports',   page: 'sports',   match: p => p === '/sports' },
          { label: 'Explore',  page: 'explore',  match: p => p === '/explore' },
          { label: 'Outlets',  page: 'outlets',  match: p => p === '/outlets' || p.startsWith('/outlet/') || p === '/rankings' },
        ].map(l => (
          <a
            key={l.page}
            className={l.match(router.pathname) ? 'active' : undefined}
            onClick={() => navigate(l.page)}
          >{l.label}</a>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="theme-toggle" onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? '☀️' : '🌙'}
        </button>

        {user ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            {/* Avatar button */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--coral)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--font-lato), sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'box-shadow 0.15s',
                boxShadow: menuOpen
                  ? '0 0 0 2.5px var(--bg), 0 0 0 4.5px var(--coral)'
                  : '0 0 0 2px var(--bg), 0 0 0 3.5px transparent',
              }}
              title={user.email}
            >
              {initials}
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 40, right: 0, zIndex: 200,
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(255,255,255,0.04)',
                width: 220, overflow: 'hidden',
              }}>

                {/* Profile header */}
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', background: 'var(--coral)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stats ? stats.username : user.email.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {/* Trust badge */}
                  {stats && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      borderRadius: 20, border: `1.5px solid ${stats.trust.color}`,
                      color: stats.trust.color, background: 'var(--bg)',
                    }}>
                      {stats.trust.emoji} {stats.trust.label}
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                {stats && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    borderBottom: '0.5px solid var(--border)',
                  }}>
                    {[
                      { value: stats.views,     label: 'Read'      },
                      { value: stats.saved,     label: 'Saved'     },
                      { value: stats.following, label: 'Following' },
                    ].map(({ value, label }) => (
                      <div key={label} style={{ padding: '10px 4px', textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Owner-only: social content desk */}
                {user.email === 'alexandchow@gmail.com' && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate('social') }}
                    style={{
                      width: '100%', padding: '9px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 13, color: 'var(--text)', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '0.5px solid var(--border)',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: 14 }}>🚀</span> Social desk
                  </button>
                )}

                {/* Nav links */}
                <button
                  onClick={() => { setMenuOpen(false); navigate('profile') }}
                  style={{
                    width: '100%', padding: '9px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: 'var(--text)', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '0.5px solid var(--border)',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 14 }}>👤</span> Profile
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate('about') }}
                  style={{
                    width: '100%', padding: '9px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: 'var(--text)', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '0.5px solid var(--border)',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 14 }}>ℹ️</span> How it works
                </button>

                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  style={{
                    width: '100%', padding: '9px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: 'var(--text)', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '0.5px solid var(--border)',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 14 }}>{isDark ? '☀️' : '🌙'}</span>
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>

                {/* Sign out */}
                <button
                  onClick={() => { setMenuOpen(false); onSignOut() }}
                  style={{
                    width: '100%', padding: '9px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: 'var(--red)', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 14 }}>↩</span> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="nav-pill" onClick={onLoginClick}>Sign in</button>
        )}
        <div className="tagline">Trust the source, not just the story</div>
      </div>
    </header>
  )
}
