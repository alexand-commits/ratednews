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
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 14px' }}>
          Every outlet gets a trust score out of 100, combining three signals. The weight of each shifts as more community votes come in.
        </p>

        {/* Signal descriptions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🤖</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>AI analysis</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Every article is scored for accuracy, bias and headline fairness by Claude AI. These are averaged across all articles per outlet.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>👥</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Community ratings</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Readers rate outlets directly. Community weight grows as more votes arrive — protecting against early manipulation.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📋</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Editorial baseline</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>A neutral starting point applied equally to all outlets until editorial reviews are published.</div>
            </div>
          </div>
        </div>

        {/* Tier table */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Weighting by engagement</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--border)' }}>
          {[
            { label: 'No votes yet',  ai: 70, editorial: 30, community: 0  },
            { label: '1–4 votes',     ai: 50, editorial: 30, community: 20 },
            { label: '5–19 votes',    ai: 40, editorial: 25, community: 35 },
            { label: '20+ votes',     ai: 35, editorial: 25, community: 40 },
          ].map((tier, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: 11, background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
              <div style={{ padding: '7px 10px', color: 'var(--text3)', borderRight: '0.5px solid var(--border)' }}>{tier.label}</div>
              <div style={{ padding: '7px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--blue)' }}>AI {tier.ai}%</span>
                <span style={{ color: 'var(--green-dark)' }}>Ed {tier.editorial}%</span>
                {tier.community > 0 && <span style={{ color: 'var(--coral)' }}>Comm {tier.community}%</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
          This prevents a small number of votes from having an outsized effect early on, while still rewarding outlets that earn genuine community trust over time.
        </div>
      </div>
    </div>
  )
}
