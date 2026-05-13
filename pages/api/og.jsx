/**
 * Dynamic OG image endpoint — /api/og
 * Runs on Vercel Edge — only flexbox CSS supported, no position:absolute,
 * no calc(), no CSS variables, no 8-digit hex colours. Use rgba() for alpha.
 *
 * CARD TYPES
 * ──────────
 * Article  (default):  title, score, bias, outlet
 * Outlet   (type=outlet): outlet, score, bias, fair, misleading, clickbait, stars, articles
 * Compare  (type=compare): a_outlet, a_score, a_bias, a_head, b_outlet, b_score, b_bias, b_head, caption
 * Leaderboard (type=leaderboard): title, items (JSON [{name,score,bias}])
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const config  = { api: { bodyParser: false } }

// ── Palette ───────────────────────────────────────────────────────────────────
const CORAL   = '#D85A30'
const CORAL_L = '#E8724A'
const TEXT1   = 'rgba(255,255,255,0.92)'
const TEXT2   = '#9E9B95'
const TEXT3   = '#6B6760'
const TEXT4   = '#4A4640'

function scoreColor(n) {
  const v = Number(n)
  if (v >= 70) return '#639922'
  if (v >= 50) return '#C8930A'
  return '#C0392B'
}
function scoreColorRgb(n) {
  const v = Number(n)
  if (v >= 70) return '99,153,34'
  if (v >= 50) return '200,147,10'
  return '192,57,43'
}

function biasInfo(bias) {
  if (bias === 'left')   return { label: 'Left-leaning',  color: '#5B7BC0', rgb: '91,123,192' }
  if (bias === 'right')  return { label: 'Right-leaning', color: '#C0392B', rgb: '192,57,43'  }
  if (bias === 'centre') return { label: 'Centre',        color: '#9E9B95', rgb: '158,155,149'}
  return null
}

// ── Shared components ─────────────────────────────────────────────────────────

function Logo({ size = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'serif', fontSize: size, fontWeight: 700, color: TEXT1, letterSpacing: '-0.5px' }}>Rated</span>
      <span style={{ fontFamily: 'serif', fontSize: size, fontWeight: 700, color: CORAL,  letterSpacing: '-0.5px' }}>News</span>
    </div>
  )
}

function Bar({ value, color, height = 6 }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={{ display: 'flex', width: '100%', height, background: 'rgba(255,255,255,0.08)', borderRadius: height }}>
      <div style={{ display: 'flex', width: `${pct}%`, height: '100%', background: color, borderRadius: height }} />
    </div>
  )
}

// Warm dark background + 6px coral left bar + 2px coral top line
function Shell({ children }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1917 0%, #262420 100%)' }}>
      {/* Left coral bar */}
      <div style={{ width: 6, height: '100%', flexShrink: 0, background: `linear-gradient(180deg, ${CORAL_L} 0%, ${CORAL} 100%)` }} />
      {/* Main column: top accent line + content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ height: 2, width: '100%', flexShrink: 0, background: 'rgba(216,90,48,0.30)' }} />
        <div style={{ display: 'flex', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Article card ──────────────────────────────────────────────────────────────
function ArticleCard({ title: raw, score, bias, outlet }) {
  const full    = raw || 'RatedNews'
  const title   = full.length > 90 ? full.slice(0, 87) + '…' : full
  const sc      = Number(score) || 0
  const hasScore = sc > 0
  const info    = biasInfo(bias)
  const rgb     = hasScore ? scoreColorRgb(sc) : null
  const fs      = title.length > 80 ? 28 : title.length > 60 ? 33 : title.length > 40 ? 39 : 46

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px 56px', width: '100%' }}>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={30} />
          {outlet ? <span style={{ color: TEXT3, fontSize: 13, fontFamily: 'sans-serif' }}>{outlet}</span> : null}
        </div>

        {/* Centre: badges + headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hasScore && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', padding: '4px 14px', borderRadius: 6, background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.35)` }}>
                <span style={{ color: scoreColor(sc), fontSize: 12, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.06em' }}>
                  CREDIBILITY {sc}/100
                </span>
              </div>
              {info && (
                <div style={{ display: 'flex', padding: '4px 14px', borderRadius: 6, background: `rgba(${info.rgb},0.12)`, border: `1px solid rgba(${info.rgb},0.35)` }}>
                  <span style={{ color: info.color, fontSize: 12, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.06em' }}>
                    {info.label.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}
          <div style={{ color: TEXT1, fontFamily: 'serif', fontSize: fs, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.3px', display: 'flex' }}>
            {title}
          </div>
          {hasScore && <Bar value={sc} color={scoreColor(sc)} height={3} />}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: TEXT4, fontSize: 13, fontFamily: 'sans-serif' }}>ratednews.com</span>
          <span style={{ color: TEXT3, fontSize: 12, fontFamily: 'sans-serif' }}>AI-powered credibility rating</span>
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
  const rgb     = has ? scoreColorRgb(sc) : null
  const fairPct = Number(fair)       || 0
  const missPct = Number(misleading) || 0
  const cbPct   = Number(clickbait)  || 0
  const hasFair = fair !== null && fair !== '' && fair !== undefined
  const starsN  = Number(stars)    || 0
  const artN    = Number(articles) || 0
  const info    = biasInfo(bias)
  const nameFs  = name.length > 24 ? 42 : name.length > 16 ? 52 : 62

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 56px', width: '100%' }}>

        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={26} />
          <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', letterSpacing: '0.1em' }}>CREDIBILITY REPORT</span>
        </div>

        {/* Name + bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: TEXT1, fontFamily: 'serif', fontSize: nameFs, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.05, display: 'flex' }}>
            {name}
          </div>
          <div style={{ height: 1, width: 360, background: 'rgba(216,90,48,0.30)' }} />

          {/* Credibility bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: TEXT2, fontSize: 11, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>CREDIBILITY</span>
              <span style={{ color: has ? scoreColor(sc) : TEXT3, fontSize: 14, fontFamily: 'sans-serif', fontWeight: 800 }}>{has ? `${sc}/100` : '—'}</span>
            </div>
            <Bar value={sc} color={has ? scoreColor(sc) : 'rgba(255,255,255,0.08)'} height={7} />
          </div>

          {/* Headline fairness bar */}
          {hasFair && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: TEXT2, fontSize: 11, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>HEADLINE FAIRNESS</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: '#639922', fontSize: 11, fontFamily: 'sans-serif' }}>✓ {fairPct}% fair</span>
                  {missPct > 0 && <span style={{ color: '#C8930A', fontSize: 11, fontFamily: 'sans-serif' }}>⚠ {missPct}% misleading</span>}
                  {cbPct   > 0 && <span style={{ color: '#C0392B', fontSize: 11, fontFamily: 'sans-serif' }}>✗ {cbPct}% clickbait</span>}
                </div>
              </div>
              <div style={{ display: 'flex', width: '100%', height: 7, borderRadius: 7, overflow: 'hidden' }}>
                {fairPct > 0 && <div style={{ display: 'flex', width: `${fairPct}%`, height: '100%', background: '#639922' }} />}
                {missPct > 0 && <div style={{ display: 'flex', width: `${missPct}%`, height: '100%', background: '#C8930A' }} />}
                {cbPct   > 0 && <div style={{ display: 'flex', width: `${cbPct}%`,   height: '100%', background: '#C0392B' }} />}
                <div style={{ display: 'flex', flex: 1, height: '100%', background: 'rgba(255,255,255,0.08)' }} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {has && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 16px', borderRadius: 100, background: `rgba(${rgb},0.12)`, border: `1.5px solid rgba(${rgb},0.35)` }}>
              <span style={{ color: scoreColor(sc), fontSize: 12, fontWeight: 700, fontFamily: 'sans-serif' }}>✦</span>
              <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif' }}>{sc}/100</span>
            </div>
          )}
          {info && (
            <div style={{ display: 'flex', padding: '5px 16px', borderRadius: 100, background: `rgba(${info.rgb},0.12)`, border: `1.5px solid rgba(${info.rgb},0.35)` }}>
              <span style={{ color: info.color, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>{info.label}</span>
            </div>
          )}
          {starsN > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#C8930A', fontSize: 12, fontFamily: 'sans-serif' }}>★</span>
              <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif' }}>{starsN.toFixed(1)}</span>
            </div>
          )}
          {artN > 0 && <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>{artN} articles</span>}
          <span style={{ marginLeft: 'auto', color: TEXT4, fontSize: 12, fontFamily: 'sans-serif' }}>ratednews.com</span>
        </div>
      </div>
    </Shell>
  )
}

// ── Comparison card ───────────────────────────────────────────────────────────
function CompareCard({ aOutlet, aScore, aBias, aHead, bOutlet, bScore, bBias, bHead, caption }) {
  const tag = caption || 'Same story. Different framing.'

  function Side({ name, score, bias, head }) {
    const sc   = Number(score) || 0
    const has  = sc > 0
    const rgb  = has ? scoreColorRgb(sc) : null
    const info = biasInfo(bias)
    const h    = head ? (head.length > 58 ? head.slice(0, 55) + '…' : head) : null
    const nfs  = (name || '').length > 18 ? 22 : 28

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '32px 40px', justifyContent: 'space-between' }}>
        {/* Outlet + bias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ color: TEXT1, fontFamily: 'serif', fontSize: nfs, fontWeight: 700, letterSpacing: '-0.3px', display: 'flex' }}>
            {name || '—'}
          </span>
          {info && <span style={{ color: info.color, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>{info.label}</span>}
        </div>
        {/* Headline */}
        {h && (
          <div style={{ color: TEXT2, fontSize: 16, fontFamily: 'serif', lineHeight: 1.45, display: 'flex' }}>
            "{h}"
          </div>
        )}
        {/* Score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ color: has ? scoreColor(sc) : TEXT3, fontSize: 52, fontWeight: 800, fontFamily: 'serif', display: 'flex' }}>
              {has ? sc : '—'}
            </span>
            {has && <span style={{ color: TEXT3, fontSize: 14, fontFamily: 'sans-serif' }}>/100</span>}
          </div>
          {has && <Bar value={sc} color={scoreColor(sc)} height={4} />}
        </div>
      </div>
    )
  }

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Brand strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Logo size={22} />
          <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', letterSpacing: '0.08em' }}>SAME STORY · COMPARED</span>
        </div>

        {/* Two columns + divider */}
        <div style={{ display: 'flex', flex: 1 }}>
          <Side name={aOutlet} score={aScore} bias={aBias} head={aHead} />
          {/* Centre divider */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', width: 48, flexShrink: 0 }}>
            <div style={{ width: 1, flex: 1, background: 'rgba(216,90,48,0.35)' }} />
            <div style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(216,90,48,0.15)', border: '1.5px solid rgba(216,90,48,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
              <span style={{ color: CORAL, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 700 }}>vs</span>
            </div>
            <div style={{ width: 1, flex: 1, background: 'rgba(216,90,48,0.35)' }} />
          </div>
          <Side name={bOutlet} score={bScore} bias={bBias} head={bHead} />
        </div>

        {/* Caption */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color: TEXT2, fontSize: 14, fontFamily: 'serif' }}>{tag}</span>
          <span style={{ color: TEXT4, fontSize: 11, fontFamily: 'sans-serif' }}>ratednews.com</span>
        </div>
      </div>
    </Shell>
  )
}

// ── Leaderboard card ──────────────────────────────────────────────────────────
function LeaderboardCard({ title, items }) {
  const rows     = items.slice(0, 7)
  const maxScore = Math.max(...rows.map(r => Number(r.score) || 0), 1)

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 56px', width: '100%', justifyContent: 'space-between' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo size={24} />
            <span style={{ color: TEXT4, fontSize: 11, fontFamily: 'sans-serif' }}>ratednews.com</span>
          </div>
          <div style={{ color: TEXT1, fontFamily: 'serif', fontSize: 36, fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', marginTop: 4 }}>
            {title || 'Outlet Rankings'}
          </div>
          <div style={{ height: 2, width: 260, background: 'rgba(216,90,48,0.40)' }} />
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, i) => {
            const sc   = Number(row.score) || 0
            const info = biasInfo(row.bias)
            const barW = sc > 0 ? Math.round((sc / maxScore) * 100) : 0
            const top  = i === 0

            return (
              <div key={String(i)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: top ? '7px 12px' : '2px 0',
                background: top ? 'rgba(216,90,48,0.10)' : 'transparent',
                borderRadius: top ? 8 : 0,
                border: top ? '1px solid rgba(216,90,48,0.28)' : 'none',
              }}>
                <span style={{ color: top ? CORAL : TEXT3, fontSize: 12, fontWeight: 800, fontFamily: 'sans-serif', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ color: top ? TEXT1 : TEXT2, fontSize: 14, fontWeight: top ? 700 : 500, fontFamily: 'sans-serif', width: 186, flexShrink: 0 }}>{(row.name || '').slice(0, 22)}</span>
                <div style={{ display: 'flex', flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 5 }}>
                  <div style={{ display: 'flex', width: `${barW}%`, height: '100%', background: sc > 0 ? scoreColor(sc) : 'transparent', borderRadius: 5 }} />
                </div>
                <span style={{ color: sc > 0 ? scoreColor(sc) : TEXT3, fontSize: 15, fontWeight: 800, fontFamily: 'sans-serif', width: 34, textAlign: 'right', flexShrink: 0 }}>{sc > 0 ? sc : '—'}</span>
                <span style={{ color: info ? info.color : 'transparent', fontSize: 11, fontFamily: 'sans-serif', fontWeight: 600, width: 68, flexShrink: 0 }}>{info ? info.label : ''}</span>
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
    width: 1200, height: 630,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  }

  if (type === 'outlet') {
    return new ImageResponse(<OutletCard
      outlet={searchParams.get('outlet') || ''}
      score={searchParams.get('score')}
      bias={searchParams.get('bias')}
      fair={searchParams.get('fair')}
      misleading={searchParams.get('misleading')}
      clickbait={searchParams.get('clickbait')}
      stars={searchParams.get('stars')}
      articles={searchParams.get('articles')}
    />, opts)
  }

  if (type === 'compare') {
    return new ImageResponse(<CompareCard
      aOutlet={searchParams.get('a_outlet') || ''}
      aScore={searchParams.get('a_score')}
      aBias={searchParams.get('a_bias')}
      aHead={searchParams.get('a_head') || ''}
      bOutlet={searchParams.get('b_outlet') || ''}
      bScore={searchParams.get('b_score')}
      bBias={searchParams.get('b_bias')}
      bHead={searchParams.get('b_head') || ''}
      caption={searchParams.get('caption') || ''}
    />, opts)
  }

  if (type === 'leaderboard') {
    let items = []
    try { items = JSON.parse(searchParams.get('items') || '[]') } catch (_) {}
    return new ImageResponse(<LeaderboardCard
      title={searchParams.get('title') || 'Outlet Rankings'}
      items={items}
    />, opts)
  }

  return new ImageResponse(<ArticleCard
    title={searchParams.get('title') || ''}
    score={searchParams.get('score')}
    bias={searchParams.get('bias')}
    outlet={searchParams.get('outlet') || ''}
  />, opts)
}
