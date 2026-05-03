import React, { useState } from 'react'
import { scoreColor } from '../utils/helpers'
import OutletLogo from '../components/OutletLogo'

export default function OutletsListPage({ outlets, navigate }) {
  const [search, setSearch] = useState('')

  const filtered = outlets.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.country || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-content">
      <div className="container">
        <div className="section-label" style={{ marginBottom: 16 }}>All outlets</div>
        <div className="search-bar" style={{ marginBottom: 16 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search outlets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>No outlets found.</p></div>
          ) : (
            filtered.map(o => {
              const score = o.overall_score || 0
              return (
                <div
                  key={o.id}
                  className="news-card"
                  onClick={() => navigate('outlet', { outletId: o.id })}
                  style={{ flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <OutletLogo name={o.name} size={40} borderRadius={10} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{o.country || ''} · {o.type || ''}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 500, color: scoreColor(score) }}>{score}</div>
                  </div>
                  <div className="score-bar-row" style={{ margin: 0 }}>
                    <span className="sbl" style={{ width: 80, fontSize: 11 }}>Accuracy</span>
                    <div className="sb-bg">
                      <div className="sb-fill" style={{ width: `${o.accuracy_score || 0}%`, background: scoreColor(o.accuracy_score || 0) }}></div>
                    </div>
                    <span className="sbv" style={{ fontSize: 11 }}>{o.accuracy_score || 0}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
