import React from 'react'
import OutletLogo from './OutletLogo'
import RatingDots from './RatingDots'

export default function Sidebar({ outlets, navigate }) {
  const top5 = outlets
    .filter(o => (o.community_score || 0) > 0 && !o.parent_outlet_id)
    .sort((a, b) => (b.community_score || 0) - (a.community_score || 0))
    .slice(0, 5)

  const topByRatings = outlets
    .filter(o => (o.total_ratings || 0) > 0 && !o.parent_outlet_id)
    .sort((a, b) => (b.total_ratings || 0) - (a.total_ratings || 0))
    .slice(0, 3)

  return (
    <div className="sidebar">
      <div className="widget">
        <div className="widget-title">Top rated outlets</div>
        {top5.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>No community ratings yet — be the first to rate an outlet.</div>
        ) : (
          top5.map((o, i) => (
            <div key={o.id} className="outlet-rank-row" onClick={() => navigate('outlet', { outletId: o.id })}>
              <span className="rank-num">{i + 1}</span>
              <OutletLogo name={o.name} size={30} borderRadius={7} />
              <span className="outlet-rank-name">{o.name}</span>
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
      </div>

      <div className="widget">
        <div className="widget-title">How scores work</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
          Outlet scores come entirely from reader ratings. Rate articles and outlets to shape the rankings.
        </div>
        {topByRatings.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>Most rated</div>
            {topByRatings.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }} onClick={() => navigate('outlet', { outletId: o.id })}>
                <OutletLogo name={o.name} size={22} borderRadius={5} />
                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{o.total_ratings} ratings</span>
              </div>
            ))}
          </div>
        )}
        <a
          href="/methodology"
          style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--text3)', textDecoration: 'none', textAlign: 'right' }}
        >
          How it works →
        </a>
      </div>
    </div>
  )
}
