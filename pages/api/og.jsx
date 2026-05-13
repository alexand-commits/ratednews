/**
 * Dynamic OG image endpoint — /api/og
 *
 * CARD TYPES
 * ──────────
 * Article card (default / type=article):
 *   title   — headline (truncated to ~90 chars)
 *   score   — credibility 0–100
 *   bias    — "left" | "centre" | "right"
 *   outlet  — outlet name
 *
 * Outlet scorecard (type=outlet):
 *   outlet      — outlet name (required)
 *   score       — credibility 0–100
 *   bias        — "left" | "centre" | "right"
 *   fair        — fair headline % 0–100
 *   misleading  — misleading headline % 0–100
 *   clickbait   — clickbait headline % 0–100
 *   stars       — reader avg stars e.g. "4.2"
 *   articles    — number of articles rated
 *
 * Comparison card (type=compare):
 *   a_outlet  — outlet A name
 *   a_score   — credibility A
 *   a_bias    — bias direction A
 *   a_head    — headline A (truncated)
 *   b_outlet  — outlet B name
 *   b_score   — credibility B
 *   b_bias    — bias direction B
 *   b_head    — headline B (truncated)
 *   caption   — bottom line (default: "Same story. Different framing.")
 *
 * Leaderboard card (type=leaderboard):
 *   title   — card title e.g. "Most Credible This Week"
 *   items   — JSON array [{name, score, bias}] up to 8 items
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const config  = { api: { bodyParser: false } }

// ── Shared helpers ────────────────────────────────────────────────────────────

const BG      = '#0c0c0b'
const SURFACE = '#181816'
const BORDER  = '#2a2a27'
const TEXT1   = '#f5f4f0'
const TEXT2   = '#9ca3af'
const TEXT3   = '#6b7280'
const CORAL   = '#D85A30'

function scoreColor(s) {
  const n = Number(s)
  if (n >= 70) return '#22c55e'
  if (n >= 50) return '#f59e0b'
  return '#ef4444'
}

function biasInfo(bias) {
  if (bias === 'left')   return { label: '← Left',   color: '#3b82f6' }
  if (bias === 'right')  return { label: '→ Right',  color: '#ef4444' }
  if (bias === 'centre') return { label: '◉ Centre', color: '#6b7280' }
  return null
}

function BrandMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        background: CORAL, color: '#fff',
        fontSize: 12, fontWeight: 800, fontFamily: 'sans-serif',
        padding: '3px 9px', borderRadius: 5, letterSpacing: '0.08em',
      }}>
        RATED
      </div>
      <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.06em' }}>
        NEWS
      </span>
    </div>
  )
}

function ScorePill({ score, size = 'md' }) {
  const has = score && Number(score) > 0
  const color = has ? scoreColor(score) : TEXT3
  const fs = size === 'lg' ? 22 : size === 'sm' ? 12 : 15
  const pip = size === 'lg' ? 16 : size === 'sm' ? 10 : 13
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: SURFACE, border: `1.5px solid ${has ? color : BORDER}`,
      borderRadius: 100, padding: size === 'lg' ? '8px 20px' : '5px 14px',
    }}>
      <span style={{ color, fontSize: pip, fontWeight: 700, fontFamily: 'sans-serif' }}>✦</span>
      <span style={{ color: TEXT1, fontSize: fs, fontWeight: 700, fontFamily: 'sans-serif' }}>
        {has ? `${score}/100` : '—'}
      </span>
    </div>
  )
}

function BiasPill({ bias, size = 'md' }) {
  const info = biasInfo(bias)
  if (!info) return null
  const fs = size === 'lg' ? 18 : size === 'sm' ? 11 : 14
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: SURFACE, border: `1.5px solid ${info.color}`,
      borderRadius: 100, padding: size === 'lg' ? '8px 20px' : '5px 14px',
    }}>
      <span style={{ color: info.color, fontSize: fs, fontWeight: 600, fontFamily: 'sans-serif' }}>{info.label}</span>
    </div>
  )
}

// Horizontal progress bar
function Bar({ value, color, bg = BORDER, height = 6 }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={{ display: 'flex', width: '100%', height, background: bg, borderRadius: height }}>
      <div style={{ display: 'flex', width: `${pct}%`, height: '100%', background: color, borderRadius: height }} />
    </div>
  )
}

// ── Card: Article (default) ───────────────────────────────────────────────────
function ArticleCard({ title: rawTitle, score, bias, outlet }) {
  const title   = (rawTitle || 'RatedNews').slice(0, 90)
  const trimmed = title.length < (rawTitle || '').length ? title + '…' : title
  const info    = biasInfo(bias)

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '44px 52px', background: BG,
    }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BrandMark />
        {outlet && (
          <span style={{ color: TEXT3, fontSize: 12, fontFamily: 'sans-serif', marginLeft: 6 }}>
            — {outlet}
          </span>
        )}
      </div>

      {/* Headline */}
      <div style={{
        color: TEXT1, fontFamily: 'serif',
        fontSize: trimmed.length > 70 ? 30 : trimmed.length > 50 ? 36 : 42,
        fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.3px', display: 'flex',
      }}>
        {trimmed}
      </div>

      {/* Bottom chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ScorePill score={score} />
        {info && <BiasPill bias={bias} />}
        <span style={{ marginLeft: 'auto', color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>ratednews.com</span>
      </div>
    </div>
  )
}

// ── Card: Outlet scorecard ────────────────────────────────────────────────────
function OutletCard({ outlet, score, bias, fair, misleading, clickbait, stars, articles }) {
  const name        = outlet || 'Unknown Outlet'
  const hasScore    = score && Number(score) > 0
  const hasFair     = fair !== null && fair !== undefined && fair !== ''
  const fairPct     = Number(fair) || 0
  const misleadPct  = Number(misleading) || 0
  const clickbaitPct = Number(clickbait) || 0
  const starsNum    = Number(stars) || 0
  const articleNum  = Number(articles) || 0

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '40px 52px', background: BG,
    }}>
      {/* Top: brand + label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandMark />
        <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Credibility &amp; Bias Report
        </span>
      </div>

      {/* Middle: outlet name + stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Outlet name */}
        <div style={{
          color: TEXT1, fontFamily: 'serif',
          fontSize: name.length > 22 ? 44 : name.length > 14 ? 54 : 64,
          fontWeight: 700, lineHeight: 1.1, letterSpacing: '-1px',
          marginBottom: 24, display: 'flex',
        }}>
          {name}
        </div>

        {/* Stat rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Credibility bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: TEXT2, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>Credibility</span>
              <span style={{ color: hasScore ? scoreColor(score) : TEXT3, fontSize: 14, fontFamily: 'sans-serif', fontWeight: 800 }}>
                {hasScore ? `${score}/100` : '—'}
              </span>
            </div>
            <Bar value={score} color={hasScore ? scoreColor(score) : BORDER} height={7} />
          </div>

          {/* Headline fairness bar */}
          {hasFair && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: TEXT2, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>Fair headlines</span>
                <span style={{ color: '#22c55e', fontSize: 14, fontFamily: 'sans-serif', fontWeight: 800 }}>{fairPct}%</span>
              </div>
              <div style={{ display: 'flex', width: '100%', height: 7, borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ display: 'flex', width: `${fairPct}%`, height: '100%', background: '#22c55e' }} />
                <div style={{ display: 'flex', width: `${misleadPct}%`, height: '100%', background: '#f59e0b' }} />
                <div style={{ display: 'flex', width: `${clickbaitPct}%`, height: '100%', background: '#ef4444' }} />
                <div style={{ display: 'flex', flex: 1, height: '100%', background: BORDER }} />
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ color: '#22c55e', fontSize: 10, fontFamily: 'sans-serif' }}>✓ Fair {fairPct}%</span>
                {misleadPct > 0 && <span style={{ color: '#f59e0b', fontSize: 10, fontFamily: 'sans-serif' }}>⚠ Misleading {misleadPct}%</span>}
                {clickbaitPct > 0 && <span style={{ color: '#ef4444', fontSize: 10, fontFamily: 'sans-serif' }}>✗ Clickbait {clickbaitPct}%</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: chips + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ScorePill score={score} />
        <BiasPill bias={bias} />
        {starsNum > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: SURFACE, border: `1.5px solid ${BORDER}`,
            borderRadius: 100, padding: '5px 14px',
          }}>
            <span style={{ color: '#f59e0b', fontSize: 13, fontFamily: 'sans-serif' }}>★</span>
            <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif' }}>{starsNum.toFixed(1)}</span>
          </div>
        )}
        {articleNum > 0 && (
          <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>{articleNum.toLocaleString()} articles</span>
        )}
        <span style={{ marginLeft: 'auto', color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>ratednews.com</span>
      </div>
    </div>
  )
}

// ── Card: Comparison ──────────────────────────────────────────────────────────
function CompareCard({ aOutlet, aScore, aBias, aHead, bOutlet, bScore, bBias, bHead, caption }) {
  const label = caption || 'Same story. Different framing.'
  const aInfo = biasInfo(aBias)
  const bInfo = biasInfo(bBias)

  function Side({ outletName, score, info, head }) {
    const trimHead = head ? (head.length > 55 ? head.slice(0, 52) + '…' : head) : null
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1,
        padding: '32px 36px', justifyContent: 'space-between',
      }}>
        {/* Outlet name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            color: TEXT1,
            fontSize: (outletName || '').length > 16 ? 22 : 26,
            fontWeight: 800, fontFamily: 'sans-serif', letterSpacing: '-0.3px', display: 'flex',
          }}>
            {outletName || '—'}
          </div>
          {info && (
            <span style={{ color: info.color, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>
              {info.label}
            </span>
          )}
        </div>

        {/* Headline */}
        {trimHead && (
          <div style={{
            color: TEXT2, fontSize: 17, fontFamily: 'serif',
            lineHeight: 1.4, fontStyle: 'italic', display: 'flex',
          }}>
            "{trimHead}"
          </div>
        )}

        {/* Score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            color: score && Number(score) > 0 ? scoreColor(score) : TEXT3,
            fontSize: 36, fontWeight: 800, fontFamily: 'sans-serif', display: 'flex',
          }}>
            {score && Number(score) > 0 ? score : '—'}
          </span>
          <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>Credibility /100</span>
          {score && Number(score) > 0 && (
            <Bar value={score} color={scoreColor(score)} height={5} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: BG,
    }}>
      {/* Top brand strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 36px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <BrandMark />
        <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Same Story · Different Framing
        </span>
      </div>

      {/* Two columns */}
      <div style={{ display: 'flex', flex: 1 }}>
        <Side outletName={aOutlet} score={aScore} info={aInfo} head={aHead} />
        {/* Divider */}
        <div style={{ width: 1, background: BORDER, margin: '24px 0' }} />
        <Side outletName={bOutlet} score={bScore} info={bInfo} head={bHead} />
      </div>

      {/* Bottom caption */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 36px',
        borderTop: `1px solid ${BORDER}`,
      }}>
        <span style={{ color: TEXT2, fontSize: 13, fontFamily: 'sans-serif', fontStyle: 'italic' }}>{label}</span>
        <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>ratednews.com</span>
      </div>
    </div>
  )
}

// ── Card: Leaderboard ─────────────────────────────────────────────────────────
function LeaderboardCard({ title, items }) {
  const rows = items.slice(0, 7)
  const maxScore = Math.max(...rows.map(r => Number(r.score) || 0), 1)

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '40px 52px', background: BG, justifyContent: 'space-between',
    }}>
      {/* Top */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <BrandMark />
          <div style={{
            color: TEXT1, fontSize: 32, fontWeight: 800,
            fontFamily: 'sans-serif', letterSpacing: '-0.5px', display: 'flex', marginTop: 6,
          }}>
            {title || 'Outlet Rankings'}
          </div>
        </div>
        <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', marginTop: 4 }}>ratednews.com</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center', marginTop: 16 }}>
        {rows.map((row, i) => {
          const sc    = Number(row.score) || 0
          const info  = biasInfo(row.bias)
          const barW  = sc > 0 ? Math.round((sc / maxScore) * 100) : 0

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Rank */}
              <span style={{
                color: i === 0 ? CORAL : TEXT3,
                fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif',
                width: 22, flexShrink: 0, textAlign: 'right',
              }}>
                {i + 1}
              </span>

              {/* Name */}
              <span style={{
                color: TEXT1, fontSize: 14, fontWeight: 600,
                fontFamily: 'sans-serif', width: 180, flexShrink: 0,
                overflow: 'hidden',
              }}>
                {(row.name || '').slice(0, 22)}
              </span>

              {/* Bar */}
              <div style={{ display: 'flex', flex: 1, height: 6, background: BORDER, borderRadius: 6 }}>
                <div style={{
                  display: 'flex', width: `${barW}%`, height: '100%',
                  background: scoreColor(sc), borderRadius: 6,
                }} />
              </div>

              {/* Score */}
              <span style={{
                color: sc > 0 ? scoreColor(sc) : TEXT3,
                fontSize: 14, fontWeight: 800, fontFamily: 'sans-serif',
                width: 40, textAlign: 'right', flexShrink: 0,
              }}>
                {sc > 0 ? sc : '—'}
              </span>

              {/* Bias chip */}
              {info && (
                <span style={{
                  color: info.color, fontSize: 10, fontFamily: 'sans-serif',
                  fontWeight: 600, width: 64, flexShrink: 0,
                }}>
                  {info.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default function handler(req) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'article'

  const opts = {
    width: 1200, height: 630,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  }

  if (type === 'outlet') {
    return new ImageResponse(
      <OutletCard
        outlet={searchParams.get('outlet') || ''}
        score={searchParams.get('score')}
        bias={searchParams.get('bias')}
        fair={searchParams.get('fair')}
        misleading={searchParams.get('misleading')}
        clickbait={searchParams.get('clickbait')}
        stars={searchParams.get('stars')}
        articles={searchParams.get('articles')}
      />,
      opts,
    )
  }

  if (type === 'compare') {
    return new ImageResponse(
      <CompareCard
        aOutlet={searchParams.get('a_outlet') || ''}
        aScore={searchParams.get('a_score')}
        aBias={searchParams.get('a_bias')}
        aHead={searchParams.get('a_head') || ''}
        bOutlet={searchParams.get('b_outlet') || ''}
        bScore={searchParams.get('b_score')}
        bBias={searchParams.get('b_bias')}
        bHead={searchParams.get('b_head') || ''}
        caption={searchParams.get('caption') || ''}
      />,
      opts,
    )
  }

  if (type === 'leaderboard') {
    let items = []
    try { items = JSON.parse(searchParams.get('items') || '[]') } catch (_) {}
    return new ImageResponse(
      <LeaderboardCard
        title={searchParams.get('title') || 'Outlet Rankings'}
        items={items}
      />,
      opts,
    )
  }

  // Default: article card
  return new ImageResponse(
    <ArticleCard
      title={searchParams.get('title') || ''}
      score={searchParams.get('score')}
      bias={searchParams.get('bias')}
      outlet={searchParams.get('outlet') || ''}
    />,
    opts,
  )
}
