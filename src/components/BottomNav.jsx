import React from 'react'

const TABS = [
  { page: 'feed',       icon: '🏠', label: 'Feed'     },
  { page: 'rankings',   icon: '🏆', label: 'Rankings' },
  { page: 'outlets',    icon: '📡', label: 'Outlets'  },
  { page: 'categories', icon: '🗂', label: 'Browse'   },
]

export default function BottomNav({ currentPage, navigate }) {
  const activePage = ['article', 'outlet', 'profile'].includes(currentPage) ? null : currentPage

  return (
    <nav className="bottom-nav">
      {TABS.map(t => (
        <button
          key={t.page}
          className={`bottom-nav-item${activePage === t.page ? ' active' : ''}`}
          onClick={() => navigate(t.page)}
        >
          <span className="bottom-nav-icon">{t.icon}</span>
          <span className="bottom-nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
