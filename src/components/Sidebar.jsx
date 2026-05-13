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
        <div className="widget-title">How scores are built</div>

        {/* Current state — what's actually running right now */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 8 }}>
          Current weighting
        </div>
        <div className="rating-breakdown">
          <div className="rb-row">
            <span className="rb-label">AI analysis</span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '70%', background: 'var(--blue)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--blue)' }}>70%</span>
            <InfoTip text="Every article is scored by Claude AI for credibility, bias direction, and headline fairness. Scores are averaged across the outlet's last 30 days of articles." />
          </div>
          <div className="rb-row">
            <span className="rb-label">Editorial baseline</span>
            <div className="rb-bar-bg"><div className="rb-bar-fill" style={{ width: '30%', background: 'var(--green)' }}></div></div>
            <span className="rb-val" style={{ color: 'var(--green-dark)' }}>30%</span>
            <InfoTip text="A neutral anchor (50/100) applied to all outlets equally. Prevents a handful of unusual articles from producing a wildly unrepresentative outlet score." />
          </div>
        </div>

        {/* How community changes the balance */}
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
            📊 As community ratings grow
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Community votes earn weight gradually — reaching up to <strong style={{ color: 'var(--text2)' }}>40%</strong> at 20+ ratings per outlet. This keeps early scores stable until enough voices have weighed in.
          </div>
        </div>

        <a
          href="/methodology"
          style={{ display: 'block', marginTop: 10, fontSize: 11, color: 'var(--text3)', textDecoration: 'none', textAlign: 'right' }}
        >
          Full methodology →
        </a>
      </div>
    </div>
  )
}
