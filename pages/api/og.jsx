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
      {/* alignSelf:stretch fills parent height — more reliable than height:'100%' in satori */}
      <div style={{ display: 'flex', width: `${pct}%`, alignSelf: 'stretch', borderRadius: height, background: color }} />
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
  const title = full.length > 100 ? full.slice(0, 97) + '…' : full
  const sc    = Number(score) || 0
  const has   = sc > 0
  const rgb   = has ? scoreRgb(sc) : null
  const info  = biasInfo(bias)
  // Larger base sizes — card is 1200×630, there's room to be bold
  const fs    = title.length > 80 ? 38 : title.length > 60 ? 46 : title.length > 40 ? 54 : 62

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 64px 40px' }}>
        {/* Logo + outlet row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <Logo size={36} />
          {outlet
            ? <span style={{ color: TEXT3, fontSize: 15, fontFamily: SF, letterSpacing: '0.04em' }}>{outlet}</span>
            : null}
        </div>
        {/* Badges */}
        {has && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            <div style={{ display: 'flex', padding: '6px 18px', borderRadius: 8, background: `rgba(${rgb},0.15)`, border: `1.5px solid rgba(${rgb},0.40)` }}>
              <span style={{ color: scoreColor(sc), fontSize: 15, fontWeight: 700, fontFamily: SF, letterSpacing: '0.07em' }}>COMMUNITY {sc}/100</span>
            </div>
            {info && (
              <div style={{ display: 'flex', padding: '6px 18px', borderRadius: 8, background: `rgba(${info.rgb},0.13)`, border: `1.5px solid rgba(${info.rgb},0.38)` }}>
                <span style={{ color: info.color, fontSize: 15, fontWeight: 700, fontFamily: SF, letterSpacing: '0.07em' }}>{info.label.toUpperCase()}</span>
              </div>
            )}
          </div>
        )}
        {/* Headline — grows to fill available space */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-start' }}>
          <div style={{ color: TEXT1, fontFamily: SE, fontSize: fs, fontWeight: 700, lineHeight: 1.22, display: 'flex' }}>
            {title}
          </div>
        </div>
        {/* Score bar + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
          {has && <Bar value={sc} color={scoreColor(sc)} height={5} />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: TEXT4, fontSize: 14, fontFamily: SF }}>ratednews.com</span>
            <span style={{ color: TEXT3, fontSize: 13, fontFamily: SF }}>Community-rated news</span>
          </div>
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
          {/* Quality */}
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
              <div style={{ display: 'flex', width: '100%', height: 9, borderRadius: 9 }}>
                {fairPct > 0 && <div style={{ display: 'flex', width: `${fairPct}%`, alignSelf: 'stretch', background: '#639922' }} />}
                {missPct > 0 && <div style={{ display: 'flex', width: `${missPct}%`, alignSelf: 'stretch', background: '#C8930A' }} />}
                {cbPct   > 0 && <div style={{ display: 'flex', width: `${cbPct}%`,   alignSelf: 'stretch', background: '#C0392B' }} />}
                <div style={{ display: 'flex', flex: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.09)' }} />
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
                  <div style={{ display: 'flex', width: `${barW}%`, alignSelf: 'stretch', background: sc > 0 ? scoreColor(sc) : 'transparent', borderRadius: 6 }} />
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
// ── Brand / default card ──────────────────────────────────────────────────────
// Site-wide default share image (homepage, about, rankings, etc.).
function BrandCard() {
  const GREEN   = '#8DC44A'
  const SURFACE = '#2E2B28'
  const LINE    = 'rgba(255,255,255,0.10)'
  const outletDots = ['#5B7BC0', '#C0392B', '#639922', '#C8930A', '#D85A30']
  // Mock coverage rows — width pairs for the headline "text" bars
  const rows = [
    { dot: '#5B7BC0', w1: 190, w2: 120 },
    { dot: '#C0392B', w1: 160, w2: 150 },
    { dot: '#639922', w1: 200, w2: 90  },
  ]
  return (
    <Shell>
      <div style={{ display: 'flex', flex: 1, padding: '64px 64px 48px', gap: 56 }}>
        {/* Left: brand + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1.2, justifyContent: 'center' }}>
          <Logo size={72} />
          <div style={{ display: 'flex', width: 320, height: 3, background: 'rgba(216,90,48,0.55)', marginTop: 22, marginBottom: 30 }} />
          <div style={{ display: 'flex', color: TEXT1, fontFamily: SE, fontSize: 46, fontWeight: 700, lineHeight: 1.18 }}>
            Trust the source, not just the story
          </div>
          <div style={{ display: 'flex', color: TEXT2, fontFamily: SF, fontSize: 24, marginTop: 22 }}>
            Community-rated news from 200+ outlets
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 40 }}>
            <span style={{ color: TEXT4, fontSize: 16, fontFamily: SF }}>ratednews.com</span>
            <span style={{ display: 'flex', width: 4, height: 4, borderRadius: 4, background: TEXT4 }} />
            <span style={{ color: TEXT3, fontSize: 15, fontFamily: SF }}>updated continuously</span>
          </div>
        </div>

        {/* Right: product vignette — one story, many sources */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18,
            padding: '26px 28px', gap: 18,
          }}>
            <span style={{ color: TEXT3, fontFamily: SF, fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>ONE STORY · EVERY ANGLE</span>
            {rows.map((r, i) => (
              <div key={String(i)} style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: i < rows.length - 1 ? 18 : 0, borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'flex', width: 12, height: 12, borderRadius: 12, background: r.dot }} />
                  <div style={{ display: 'flex', width: 86, height: 9, borderRadius: 9, background: 'rgba(255,255,255,0.22)' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', width: r.w1, height: 11, borderRadius: 11, background: 'rgba(255,255,255,0.13)' }} />
                  <div style={{ display: 'flex', width: r.w2, height: 11, borderRadius: 11, background: 'rgba(255,255,255,0.13)' }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <div style={{ display: 'flex' }}>
                {outletDots.map((c, i) => (
                  <span key={String(i)} style={{
                    display: 'flex', width: 22, height: 22, borderRadius: 22,
                    background: c, marginLeft: i === 0 ? 0 : -7,
                    border: `2px solid ${SURFACE}`,
                  }} />
                ))}
              </div>
              <span style={{ display: 'flex', color: CORAL_L, fontFamily: SF, fontSize: 17, fontWeight: 700 }}>22 sources covering this story</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <span key={String(i)} style={{ display: 'flex', width: 14, height: 14, borderRadius: 14, background: i < 4 ? GREEN : 'rgba(255,255,255,0.14)' }} />
              ))}
            </div>
            <span style={{ display: 'flex', color: TEXT2, fontFamily: SF, fontSize: 17 }}>Rate the sources you trust</span>
          </div>
        </div>
      </div>
    </Shell>
  )
}

export default function handler(req) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'article'
    const opts = { width: W, height: H }

    if (type === 'brand') {
      return new ImageResponse(<BrandCard />, opts)
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
  } catch (err) {
    // Return a plain-text error in dev so we can see what broke
    return new Response(`OG render error: ${err?.message || err}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
