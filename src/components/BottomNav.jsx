import React from 'react'
import { useRouter } from 'next/router'

const TABS = [
  { page: 'feed',     path: '/',         icon: '🏠', label: 'Feed'     },
  { page: 'trending', path: '/trending', icon: '🔥', label: 'Trending' },
  { page: 'sports',   path: '/sports',   icon: '⚽', label: 'Sports'   },
  { page: 'outlets',  path: '/outlets',  icon: '📡', label: 'Outlets'  },
]

const DETAIL_PATHS = ['/article/', '/outlet/', '/profile/']

export default function BottomNav({ navigate }) {
  const router = useRouter()
  const isDetail = DETAIL_PATHS.some(p => router.pathname.startsWith(p))

  return (
    <nav className="bottom-nav">
      {TABS.map(t => (
        <button
          key={t.page}
          className={`bottom-nav-item${!isDetail && router.pathname === t.path ? ' active' : ''}`}
          onClick={() => navigate(t.page)}
        >
          <span className="bottom-nav-icon-wrap">
            <span className="bottom-nav-icon">{t.icon}</span>
          </span>
          <span className="bottom-nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
