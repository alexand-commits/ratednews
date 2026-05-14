/**
 * Dynamic OG image endpoint — /api/og
 * Edge runtime — satori/flexbox only. Rules:
 *  - No position:absolute/relative
 *  - No height:'100%' on children (use alignSelf:'stretch')
 *  - No calc(), no CSS variables
 *  - Alpha colours via rgba() only — no 8-digit hex
 *  - Sync handler only (no top-level await)
 *
 * CARD TYPES
 * article (default) | outlet | compare | leaderboard
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const config  = { api: { bodyParser: false } }

const W = 1200
const H = 630

// ── Palette ───────────────────────────────────────────────────────────────────
const CORAL   = '#D85A30'
const CORAL_L = '#E8724A'
const TEXT1   = 'rgba(255,255,255,0.92)'
const TEXT2   = '#9E9B95'
const TEXT3   = '#6B6760'
const TEXT4   = '#4A4640'
const SF      = 'sans-serif'
const SE      = 'serif'

function scoreColor(n) {
  const v = Number(n)
  if (v >= 70) return '#639922'
  if (v >= 50) return '#C8930A'
  return '#C0392B'
}
function scoreRgb(n) {
  const v = Number(n)
  if (v >= 70) return '99,153,34'
  if (v >= 50) return '200,147,10'
  return '192,57,43'
}
function biasInfo(b) {
  if (b === 'left')   return { label: 'Left-leaning',  color: '#5B7BC0', rgb: '91,123,192'  }
  if (b === 'right')  return { label: 'Right-leaning', color: '#C0392B', rgb: '192,57,43'   }
  if (b === 'centre') return { label: 'Centre',        color: '#9E9B95', rgb: '158,155,149' }
  return null
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Logo({ size = 44 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <span style={{ fontFamily: SE, fontSize: size, fontWeight: 700, color: TEXT1, letterSpacing: '-1px' }}>Rated</span>
      <span style={{ fontFamily: SE, fontSize: size, fontWeight: 700, color: CORAL, letterSpacing: '-1px' }}>News</span>
    </div>
  )
}

function Bar({ value, color, height = 8 }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={{ display: 'flex', width: '100%', height, borderRadius: height, background: 'rgba(255,255,255,0.09)' }}>
      <div style={{ display: 'flex', width: `${pct}%`, height: '100%', borderRadius: height, background: color }} />
    </div>
  )
}

// Shell: explicit W×H root, coral left strip via alignSelf:'stretch'
function Shell({ children }) {
  return (
    <div style={{
      display: 'flex', width: W, height: H,
      background: 'linear-gradient(135deg, #1a1917 0%, #262420 100%)',
    }}>
      {/* Coral left bar — stretches via parent align-items:stretch (default) */}
      <div style={{
        width: 7, alignSelf: 'stretch', flexShrink: 0,
        background: `linear-gradient(180deg, ${CORAL_L} 0%, ${CORAL} 100%)`,
      }} />
      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Top accent line */}
        <div style={{ height: 2, flexShrink: 0, background: 'rgba(216,90,48,0.30)' }} />
        {/* Content */}
        <div style={{ display: 'flex', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Article ───────────────────────────────────────────────────────────────────
function ArticleCard({ title: raw, score, bias, outlet }) {
  const full  = raw || 'RatedNews'
  const title = full.length > 88 ? full.slice(0, 85) + '…' : full
  const sc    = Number(score) || 0
  const has   = sc > 0
  const rgb   = has ? scoreRgb(sc) : null
  const info  = biasInfo(bias)
  const fs    = title.length > 80 ? 32 : title.length > 60 ? 38 : title.length > 40 ? 44 : 52

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '48px 60px' }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={38} />
          {outlet ? <span style={{ color: TEXT3, fontSize: 16, fontFamily: SF }}>{outlet}</span> : null}
        </div>
        {/* Headline block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {has && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', padding: '5px 16px', borderRadius: 7, background: `rgba(${rgb},0.13)`, border: `1.5px solid rgba(${rgb},0.38)` }}>
                <span style={{ color: scoreColor(sc), fontSize: 14, fontWeight: 700, fontFamily: SF, letterSpacing: '0.06em' }}>CREDIBILITY {sc}/100</span>
              </div>
              {info && (
                <div style={{ display: 'flex', padding: '5px 16px', borderRadius: 7, background: `rgba(${info.rgb},0.13)`, border: `1.5px solid rgba(${info.rgb},0.38)` }}>
                  <span style={{ color: info.color, fontSize: 14, fontWeight: 700, fontFamily: SF, letterSpacing: '0.06em' }}>{info.label.toUpperCase()}</span>
                </div>
              )}
            </div>
          )}
          <div style={{ color: TEXT1, fontFamily: SE, fontSize: fs, fontWeight: 700, lineHeight: 1.25, display: 'flex' }}>
            {title}
          </div>
          {has && <Bar value={sc} color={scoreColor(sc)} height={4} />}
        </div>
        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: TEXT4, fontSize: 15, fontFamily: SF }}>ratednews.com</span>
          <span style={{ color: TEXT3, fontSize: 13, fontFamily: SF }}>AI-powered credibility rating</span>
        </div>
      </div>
    </Shell>
  )
}

// ── Outlet scorecard ──────────────────────────────────────────────────────────
function OutletCard({ outlet, score, bias, fair, misleading, clickbait, stars, articles }) {
  const name    = outlet || 'Unknown Outlet'
  const sc      = Number(score) || 0
  const has     = sc > 0
  const rgb     = has ? scoreRgb(sc) : null
  const fairPct = Number(fair)       || 0
  const missPct = Number(misleading) || 0
  const cbPct   = Number(clickbait)  || 0
  const hasFair = fair !== null && fair !== '' && fair !== undefined
  const starsN  = Number(stars)    || 0
  const artN    = Number(articles) || 0
  const info    = biasInfo(bias)
  const nameFs  = name.length > 22 ? 48 : name.length > 14 ? 60 : 72

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '44px 60px' }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={34} />
          <span style={{ color: TEXT3, fontSize: 13, fontFamily: SF, letterSpacing: '0.1em' }}>CREDIBILITY REPORT</span>
        </div>
        {/* Name + bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: TEXT1, fontFamily: SE, fontSize: nameFs, fontWeight: 700, lineHeight: 1.05, display: 'flex' }}>
            {name}
          </div>
          <div style={{ height: 1, width: 400, background: 'rgba(216,90,48,0.35)' }} />
          {/* Credibility */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: TEXT2, fontSize: 13, fontFamily: SF, fontWeight: 600, letterSpacing: '0.08em' }}>CREDIBILITY</span>
              <span style={{ color: has ? scoreColor(sc) : TEXT3, fontSize: 18, fontFamily: SF, fontWeight: 800 }}>{has ? `${sc}/100` : '—'}</span>
            </div>
            <Bar value={sc} color={has ? scoreColor(sc) : 'rgba(255,255,255,0.09)'} height={9} />
          </div>
          {/* Headline fairness */}
          {hasFair && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: TEXT2, fontSize: 13, fontFamily: SF, fontWeight: 600, letterSpacing: '0.08em' }}>HEADLINE FAIRNESS</span>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ color: '#639922', fontSize: 13, fontFamily: SF }}>✓ {fairPct}% fair</span>
                  {missPct > 0 && <span style={{ color: '#C8930A', fontSize: 13, fontFamily: SF }}>⚠ {missPct}%</span>}
                  {cbPct   > 0 && <span style={{ color: '#C0392B', fontSize: 13, fontFamily: SF }}>✗ {cbPct}%</span>}
                </div>
              </div>
              <div style={{ display: 'flex', width: '100%', height: 9, borderRadius: 9, overflow: 'hidden' }}>
                {fairPct > 0 && <div style={{ display: 'flex', width: `${fairPct}%`, height: '100%', background: '#639922' }} />}
                {missPct > 0 && <div style={{ display: 'flex', width: `${missPct}%`, height: '100%', background: '#C8930A' }} />}
                {cbPct   > 0 && <div style={{ display: 'flex', width: `${cbPct}%`,   height: '100%', background: '#C0392B' }} />}
                <div style={{ display: 'flex', flex: 1, height: '100%', background: 'rgba(255,255,255,0.09)' }} />
              </div>
            </div>
          )}
        </div>
        {/* Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {has && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 18px', borderRadius: 100, background: `rgba(${rgb},0.13)`, border: `1.5px solid rgba(${rgb},0.38)` }}>
              <span style={{ color: scoreColor(sc), fontSize: 14, fontWeight: 700, fontFamily: SF }}>✦</span>
              <span style={{ color: TEXT1, fontSize: 15, fontWeight: 700, fontFamily: SF }}>{sc}/100</span>
            </div>
          )}
          {info && (
            <div style={{ display: 'flex', padding: '7px 18px', borderRadius: 100, background: `rgba(${info.rgb},0.13)`, border: `1.5px solid rgba(${info.rgb},0.38)` }}>
              <span style={{ color: info.color, fontSize: 15, fontWeight: 600, fontFamily: SF }}>{info.label}</span>
            </div>
          )}
          {starsN > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <span style={{ color: '#C8930A', fontSize: 14, fontFamily: SF }}>★</span>
              <span style={{ color: TEXT1, fontSize: 15, fontWeight: 700, fontFamily: SF }}>{starsN.toFixed(1)}</span>
            </div>
          )}
          {artN > 0 && <span style={{ color: TEXT3, fontSize: 13, fontFamily: SF }}>{artN} articles</span>}
          <div style={{ display: 'flex', flex: 1 }} />
          <span style={{ color: TEXT4, fontSize: 14, fontFamily: SF }}>ratednews.com</span>
        </div>
      </div>
    </Shell>
  )
}

// ── Comparison ────────────────────────────────────────────────────────────────
function CompareCard({ aOutlet, aScore, aBias, aHead, bOutlet, bScore, bBias, bHead, caption }) {
  const tag = caption || 'Same story. Different framing.'

  function Side({ name, score, bias, head }) {
    const sc   = Number(score) || 0
    const has  = sc > 0
    const info = biasInfo(bias)
    const h    = head ? (head.length > 55 ? head.slice(0, 52) + '…' : head) : null
    const nfs  = (name || '').length > 18 ? 24 : 30
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '32px 40px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: TEXT1, fontFamily: SE, fontSize: nfs, fontWeight: 700, display: 'flex' }}>{name || '—'}</span>
          {info && <span style={{ color: info.color, fontSize: 13, fontFamily: SF, fontWeight: 600 }}>{info.label}</span>}
        </div>
        {h && <div style={{ color: TEXT2, fontSize: 17, fontFamily: SE, lineHeight: 1.4, display: 'flex' }}>"{h}"</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ color: has ? scoreColor(sc) : TEXT3, fontSize: 58, fontWeight: 800, fontFamily: SE, display: 'flex' }}>{has ? sc : '—'}</span>
            {has && <span style={{ color: TEXT3, fontSize: 16, fontFamily: SF }}>/100</span>}
          </div>
          {has && <Bar value={sc} color={scoreColor(sc)} height={5} />}
        </div>
      </div>
    )
  }

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Brand strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Logo size={26} />
          <span style={{ color: TEXT3, fontSize: 12, fontFamily: SF, letterSpacing: '0.08em' }}>SAME STORY · COMPARED</span>
        </div>
        {/* Columns */}
        <div style={{ display: 'flex', flex: 1 }}>
          <Side name={aOutlet} score={aScore} bias={aBias} head={aHead} />
          {/* Divider */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', width: 52, flexShrink: 0 }}>
            <div style={{ width: 1, flex: 1, background: 'rgba(216,90,48,0.40)' }} />
            <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(216,90,48,0.15)', border: '1.5px solid rgba(216,90,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
              <span style={{ color: CORAL, fontSize: 13, fontFamily: SF, fontWeight: 700 }}>vs</span>
            </div>
            <div style={{ width: 1, flex: 1, background: 'rgba(216,90,48,0.40)' }} />
          </div>
          <Side name={bOutlet} score={bScore} bias={bBias} head={bHead} />
        </div>
        {/* Caption */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color: TEXT2, fontSize: 15, fontFamily: SE }}>{tag}</span>
          <span style={{ color: TEXT4, fontSize: 13, fontFamily: SF }}>ratednews.com</span>
        </div>
      </div>
    </Shell>
  )
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function LeaderboardCard({ title, items }) {
  const rows     = items.slice(0, 7)
  const maxScore = Math.max(...rows.map(r => Number(r.score) || 0), 1)
  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 60px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo size={32} />
            <span style={{ color: TEXT4, fontSize: 13, fontFamily: SF }}>ratednews.com</span>
          </div>
          <div style={{ color: TEXT1, fontFamily: SE, fontSize: 40, fontWeight: 700, display: 'flex', marginTop: 4 }}>{title || 'Outlet Rankings'}</div>
          <div style={{ height: 2, width: 300, background: 'rgba(216,90,48,0.45)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {rows.map((row, i) => {
            const sc   = Number(row.score) || 0
            const info = biasInfo(row.bias)
            const barW = sc > 0 ? Math.round((sc / maxScore) * 100) : 0
            const top  = i === 0
            return (
              <div key={String(i)} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: top ? '8px 14px' : '2px 0',
                background: top ? 'rgba(216,90,48,0.10)' : 'transparent',
                borderRadius: top ? 9 : 0,
                border: top ? '1px solid rgba(216,90,48,0.30)' : 'none',
              }}>
                <span style={{ color: top ? CORAL : TEXT3, fontSize: 14, fontWeight: 800, fontFamily: SF, width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ color: top ? TEXT1 : TEXT2, fontSize: 16, fontWeight: top ? 700 : 500, fontFamily: SF, width: 200, flexShrink: 0 }}>{(row.name || '').slice(0, 22)}</span>
                <div style={{ display: 'flex', flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', width: `${barW}%`, height: '100%', background: sc > 0 ? scoreColor(sc) : 'transparent', borderRadius: 6 }} />
                </div>
                <span style={{ color: sc > 0 ? scoreColor(sc) : TEXT3, fontSize: 17, fontWeight: 800, fontFamily: SF, width: 36, textAlign: 'right', flexShrink: 0 }}>{sc > 0 ? sc : '—'}</span>
                <span style={{ color: info ? info.color : 'transparent', fontSize: 12, fontFamily: SF, fontWeight: 600, width: 80, flexShrink: 0 }}>{info ? info.label : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default function handler(req) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'article'
  const opts = {
    width: W, height: H,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  }

  if (type === 'outlet') {
    return new ImageResponse(<OutletCard
      outlet={searchParams.get('outlet') || ''}
      score={searchParams.get('score')}   bias={searchParams.get('bias')}
      fair={searchParams.get('fair')}     misleading={searchParams.get('misleading')}
      clickbait={searchParams.get('clickbait')} stars={searchParams.get('stars')}
      articles={searchParams.get('articles')}
    />, opts)
  }
  if (type === 'compare') {
    return new ImageResponse(<CompareCard
      aOutlet={searchParams.get('a_outlet') || ''} aScore={searchParams.get('a_score')}
      aBias={searchParams.get('a_bias')}            aHead={searchParams.get('a_head') || ''}
      bOutlet={searchParams.get('b_outlet') || ''} bScore={searchParams.get('b_score')}
      bBias={searchParams.get('b_bias')}            bHead={searchParams.get('b_head') || ''}
      caption={searchParams.get('caption') || ''}
    />, opts)
  }
  if (type === 'leaderboard') {
    let items = []
    try { items = JSON.parse(searchParams.get('items') || '[]') } catch (_) {}
    return new ImageResponse(<LeaderboardCard title={searchParams.get('title') || 'Outlet Rankings'} items={items} />, opts)
  }
  return new ImageResponse(<ArticleCard
    title={searchParams.get('title') || ''}
    score={searchParams.get('score')} bias={searchParams.get('bias')}
    outlet={searchParams.get('outlet') || ''}
  />, opts)
}
