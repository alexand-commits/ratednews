import React from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from './OutletLogo'

export default function Sidebar({ outlets, navigate }) {
  const top5 = outlets.filter(o => (o.overall_score || 0) > 0).slice(0, 5)

  return (
    <div className="sidebar">
      <div className="widget">
        <div className="widget-title">Top rated outlets</div>
        {top5.length === 0
          ? <div className="skeleton" style={{ height: 200 }}></div>
          : top5.map((o, i) => {
              const score = o.overall_score || 0
              return (
                <div key={o.id} className="outlet-rank-row" onClick={() => navigate('outlet', { outletId: o.id })}>
                  <span className="rank-num">{i + 1}</span>
                  <OutletLogo name={o.name} size={30} borderRadius={7} />
                  <span className="outlet-rank-name">{o.name}</span>
                  <div className="outlet-rank-bar-wrap">
                    <div className="rank-bar-bg">
                      <div className="rank-bar-fill" style={{ width: `${score}%`, background: scoreColor(score) }}></div>
                    </div>
                    <div className="rank-val" style={{ color: scoreColor(score) }}>{score}</div>
                  </div>
                </div>
              )
            })
        }
        <button
          className="btn-outline"
          style={{ width: '100%', marginTop: 12, fontSize: 12 }}
          onClick={() => navigate('rankings')}
        >
          Full rankings →
        </button>
      </div>
      <div className="widget">
        <div className="widget-title">How ratings work</div>
        <div className="rating-breakdown">
          <div className="rb-row">
            <span className="rb-label">Community</span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '40%', background: 'var(--coral)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--coral-dark)' }}>40%</span>
          </div>
          <div className="rb-row">
            <span className="rb-label">AI analysis</span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '35%', background: 'var(--blue)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--blue)' }}>35%</span>
          </div>
          <div className="rb-row">
            <span className="rb-label">Editorial</span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '25%', background: 'var(--green)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--green-dark)' }}>25%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
