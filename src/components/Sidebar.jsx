import React from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from './OutletLogo'
import InfoTip from './InfoTip'

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
            <span className="rb-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Community
              <InfoTip text="Readers rate outlets directly. Weight starts low and grows as more votes arrive — this protects against early manipulation. At 20+ votes it reaches full 40% weight." />
            </span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '40%', background: 'var(--coral)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--coral-dark)' }}>40%</span>
          </div>
          <div className="rb-row">
            <span className="rb-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              AI analysis
              <InfoTip text="Every article is scored by Claude AI for accuracy, bias and headline fairness. Scores are averaged across all of an outlet's articles. AI carries 70% of the score until community votes build up." />
            </span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '35%', background: 'var(--blue)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--blue)' }}>35%</span>
          </div>
          <div className="rb-row">
            <span className="rb-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Editorial
              <InfoTip text="A neutral baseline applied equally to all outlets. This will be replaced by editorial reviews as the platform grows." />
            </span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '25%', background: 'var(--green)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--green-dark)' }}>25%</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.6, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          Percentages shown are the target weights at full engagement. Hover the <span style={{ fontStyle: 'italic' }}>ⓘ</span> icons for details.
        </div>
      </div>
    </div>
  )
}
