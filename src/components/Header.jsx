import React from 'react'

export default function Header({ navigate, isDark, toggleTheme, user, onLoginClick }) {
  return (
    <header className="header">
      <div className="logo" onClick={() => navigate('feed')}>
        Rated<span>News</span>
      </div>
      <nav className="nav">
        <a onClick={() => navigate('feed')}>Feed</a>
        <a onClick={() => navigate('outlets')}>Outlets</a>
        <a onClick={() => navigate('rankings')}>Rankings</a>
        <a onClick={() => navigate('about')}>How it works</a>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="theme-toggle" onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? '☀️' : '🌙'}
        </button>
        {user ? (
          <button
            onClick={() => navigate('profile')}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--coral)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'opacity 0.15s'
            }}
            title={user.email}
            onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            {user.email.slice(0, 2).toUpperCase()}
          </button>
        ) : (
          <button className="nav-pill" onClick={onLoginClick}>Sign in</button>
        )}
        <div className="tagline">Trust the source, not just the story</div>
      </div>
    </header>
  )
}
