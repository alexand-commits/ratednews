import React from 'react'
import OutletLogo from './OutletLogo'
import RatingDots from './RatingDots'
import { isRankEligible } from '../utils/helpers'
import TrendingStoriesWidget from './TrendingStoriesWidget'

export default function Sidebar({ outlets, navigate }) {
  const top5 = outlets
    .filter(isRankEligible)
    .sort((a, b) => (b.community_score || 0) - (a.community_score || 0))
    .slice(0, 3)

  return (
    <div className="sidebar">
      <TrendingStoriesWidget />

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
        <a
          href="/most-trusted-news-sources"
          style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--coral)', textDecoration: 'none' }}
        >
          🏆 Full rankings →
        </a>
      </div>
    </div>
  )
}