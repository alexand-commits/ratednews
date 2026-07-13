import React from 'react'
import OutletLogo from './OutletLogo'
import RatingDots from './RatingDots'
import { isRankEligible } from '../utils/helpers'
import { track } from '../utils/track'
import DigestSignup from './DigestSignup'

export default function Sidebar({ outlets, navigate, trendingTopics = [], activeTopic = null, onTopic }) {
  const top5 = outlets
    .filter(isRankEligible)
    .sort((a, b) => (b.community_score || 0) - (a.community_score || 0))
    .slice(0, 5)

  return (
    <div className="sidebar">
      {/* Trending topics — desktop only (mobile keeps the inline chips above the feed) */}
      {trendingTopics.length > 0 && onTopic && (
        <div className="widget sidebar-trending">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="widget-title">🔥 Trending · 24h</div>
            {activeTopic && (
              <button
                onClick={() => onTopic(activeTopic)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--coral)', padding: 0 }}
              >✕ Clear</button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {trendingTopics.map(topic => {
              const isActive = activeTopic === topic
              return (
                <button
                  key={topic}
                  onClick={() => { track('topic_tap', { topic }); onTopic(topic) }}
                  className={`pill pill-topic${isActive ? ' active' : ''}`}
                  style={{ fontSize: 11.5, padding: '4px 11px' }}
                >
                  🔍 {topic}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="widget">
        <div className="widget-title">Top rated outlets</div>
        {top5.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Outlets are ranked once they have 3+ community ratings — be one of the first to rate.</div>
        ) : (
          top5.map((o, i) => (
            <div key={o.id} className="outlet-rank-row" role="link" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('outlet', { outletId: o.id })} onClick={() => navigate('outlet', { outletId: o.id })}>
              <span className="rank-num">{i + 1}</span>
              <OutletLogo name={o.name} size={30} borderRadius={7} />
              <span className="outlet-rank-name" title={o.name}>{o.name}</span>
              <RatingDots value={o.community_score / 20} size={7} valueSize={12} />
            </div>
          ))
        )}
        <button
          className="btn-outline"
          style={{ width: '100%', marginTop: 12, fontSize: 12 }}
          onClick={() => navigate('rankings')}
        >
          Full rankings →
        </button>
        <a
          href="/most-trusted-news-sources"
          style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--coral)', textDecoration: 'none' }}
        >
          🏆 Most trusted sources {new Date().getFullYear()} →
        </a>
        <div style={{ borderTop: '0.5px solid var(--border)', marginTop: 14, paddingTop: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
          Scores come entirely from reader ratings — rate the sources you read to shape them.{' '}
          <a href="/methodology" style={{ color: 'var(--text3)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            How it works →
          </a>
        </div>
      </div>

      <DigestSignup />
    </div>
  )
}