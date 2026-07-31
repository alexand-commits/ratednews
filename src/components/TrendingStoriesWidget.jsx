import React from 'react'
import Link from 'next/link'
import { useTrendingStories } from '../hooks/useTrendingStories'
import { track } from '../utils/track'

// The story-based trending widget — coverage-velocity story links, shared by
// every rail and mobile exit-ramp. Replaced the old token-frequency topic
// pills, which surfaced context-free fragments ("Islamic", "Heritage List")
// with no real destination. variant 'widget' is the standard rail card;
// 'inline' renders bare for mobile ramps inside existing containers.
// `stories` overrides the global feed with a caller-computed list (e.g. the
// sports page passes sport-only clusters) — same shape: {slug, title, outlets}.
export default function TrendingStoriesWidget({ variant = 'widget', title = '🔥 Trending · 24h', limit = 6, stories: storiesProp = null }) {
  const globalStories = useTrendingStories()
  const stories = storiesProp ?? globalStories
  if (!stories.length) return null

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stories.slice(0, limit).map((t, i) => (
        <Link
          key={t.slug}
          href={`/story/${t.slug}`}
          onClick={() => track('trending_story_tap', { slug: t.slug })}
          style={{
            display: 'block', padding: '9px 0', textDecoration: 'none',
            borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--text)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {t.title}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {t.outlets} sources covering
          </span>
        </Link>
      ))}
    </div>
  )

  if (variant === 'inline') {
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 2 }}>
          {title}
        </div>
        {list}
      </div>
    )
  }

  return (
    <div className="widget sidebar-trending">
      <div className="widget-title">{title}</div>
      {list}
    </div>
  )
}
