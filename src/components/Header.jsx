import React, { useState, useRef, useEffect } from 'react'

export default function Header({ navigate, isDark, toggleTheme, user, onLoginClick, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="header">
      <div className="logo" onClick={() => navigate('feed')}>
        Rated<span>News</span>
      </div>
      <nav className="nav">
        <a onClick={() => navigate('feed')}>Feed</a>
        <a onClick={() => navigate('trending')}>Trending</a>
        <a onClick={() => navigate('sports')}>Sports</a>
        <a onClick={() => navigate('outlets')}>Outlets</a>
        <a onClick={() => navigate('rankings')}>Rankings</a>
        <a onClick={() => navigate('about')}>How it works</a>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="theme-toggle" onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? '☀️' : '🌙'}
        </button>

        {user ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--coral)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'opacity 0.15s',
                outline: menuOpen ? '2px solid var(--coral)' : 'none',
                outlineOffset: 2,
              }}
              title={user.email}
            >
              {user.email.slice(0, 2).toUpperCase()}
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 40, right: 0, zIndex: 200,
                background: 'var(--surface)', border: '0.5px solid var(--border)',
                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 160, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {user.email.split('@')[0]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{user.email}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate('profile') }}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: 'var(--text)', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '0.5px solid var(--border)',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  👤 Profile
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onSignOut() }}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, color: 'var(--red)', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  ↩ Sign out
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
