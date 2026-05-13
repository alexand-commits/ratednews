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
 *   a_outlet, a_score, a_bias, a_head
 *   b_outlet, b_score, b_bias, b_head
 *   caption   — bottom tagline
 *
 * Leaderboard card (type=leaderboard):
 *   title   — card title
 *   items   — JSON [{name, score, bias}] up to 8
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const config  = { api: { bodyParser: false } }

// ── Brand palette (matches x-header.svg / og-image.svg) ──────────────────────
const BG1    = '#1a1917'   // gradient start
const BG2    = '#262420'   // gradient end
const CARD   = '#2C2A27'   // elevated surface
const CARD2  = '#242220'   // deeper surface
const CORAL  = '#D85A30'
const CORAL2 = '#E8724A'   // gradient highlight
const TEXT1  = 'rgba(255,255,255,0.92)'
const TEXT2  = '#9E9B95'
const TEXT3  = '#6B6760'
const TEXT4  = '#4A4640'
const BORDER = 'rgba(255,255,255,0.07)'

function scoreColor(s) {
  const n = Number(s)
  if (n >= 70) return '#639922'   // matches site green
  if (n >= 50) return '#C8930A'   // amber
  return '#C0392B'                // red
}

function biasInfo(bias) {
  if (bias === 'left')   return { label: '← Left',   color: '#5B7BC0' }
  if (bias === 'right')  return { label: '→ Right',  color: '#C0392B' }
  if (bias === 'centre') return { label: '◉ Centre', color: '#9E9B95' }
  return null
}

// ── Shared: brand logo ────────────────────────────────────────────────────────
function Logo({ size = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
      <span style={{ fontFamily: 'serif', fontSize: size, fontWeight: 700, color: TEXT1, letterSpacing: '-0.5px' }}>
        Rated
      </span>
      <span style={{ fontFamily: 'serif', fontSize: size, fontWeight: 700, color: CORAL, letterSpacing: '-0.5px' }}>
        News
      </span>
    </div>
  )
}

// ── Shared: score pill ────────────────────────────────────────────────────────
function ScorePill({ score, size = 'md' }) {
  const has   = score && Number(score) > 0
  const color = has ? scoreColor(score) : TEXT3
  const pad   = size === 'lg' ? '8px 22px' : '5px 16px'
  const fs    = size === 'lg' ? 16 : 13

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: has ? `${color}18` : 'rgba(255,255,255,0.04)',
      border: `1.5px solid ${has ? `${color}60` : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 100, padding: pad,
    }}>
      <span style={{ color, fontSize: fs - 1, fontWeight: 700, fontFamily: 'sans-serif' }}>✦</span>
      <span style={{ color: TEXT1, fontSize: fs, fontWeight: 700, fontFamily: 'sans-serif' }}>
        {has ? `${score}/100` : 'Unscored'}
      </span>
    </div>
  )
}

// ── Shared: bias pill ─────────────────────────────────────────────────────────
function BiasPill({ bias, size = 'md' }) {
  const info = biasInfo(bias)
  if (!info) return null
  const pad = size === 'lg' ? '8px 20px' : '5px 14px'
  const fs  = size === 'lg' ? 15 : 13
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: `${info.color}18`,
      border: `1.5px solid ${info.color}55`,
      borderRadius: 100, padding: pad,
    }}>
      <span style={{ color: info.color, fontSize: fs, fontWeight: 600, fontFamily: 'sans-serif' }}>{info.label}</span>
    </div>
  )
}

// ── Shared: progress bar ──────────────────────────────────────────────────────
function Bar({ value, color, height = 6, bg = 'rgba(255,255,255,0.08)' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div style={{ display: 'flex', width: '100%', height, background: bg, borderRadius: height }}>
      <div style={{ display: 'flex', width: `${pct}%`, height: '100%', background: color, borderRadius: height }} />
    </div>
  )
}

// ── Shared: warm gradient bg with coral accent bar ────────────────────────────
// ImageResponse only supports flexbox — no position:absolute allowed
function Bg({ children }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      background: `linear-gradient(135deg, ${BG1} 0%, ${BG2} 100%)`,
    }}>
      {/* Left coral accent bar */}
      <div style={{
        width: 6, height: '100%', flexShrink: 0,
        background: `linear-gradient(180deg, ${CORAL2} 0%, ${CORAL} 100%)`,
      }} />
      {/* Right side: top accent line + content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Top accent line */}
        <div style={{ width: '100%', height: 2, flexShrink: 0, background: 'rgba(216,90,48,0.28)' }} />
        {/* Content area */}
        <div style={{ display: 'flex', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Card: Article ─────────────────────────────────────────────────────────────
function ArticleCard({ title: rawTitle, score, bias, outlet }) {
  const title   = (rawTitle || 'RatedNews').slice(0, 88)
  const trimmed = rawTitle && rawTitle.length > 88 ? title + '…' : title
  const info    = biasInfo(bias)
  const hasScore = score && Number(score) > 0
  const sc = Number(score) || 0

  return (
    <Bg>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '44px 56px 44px 50px', width: '100%',
      }}>
        {/* Top: logo + outlet */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={30} />
          {outlet && (
            <span style={{ color: TEXT3, fontSize: 13, fontFamily: 'sans-serif' }}>
              {outlet}
            </span>
          )}
        </div>

        {/* Middle: headline */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {hasScore && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: `${scoreColor(sc)}22`,
                border: `1px solid ${scoreColor(sc)}44`,
                borderRadius: 6, padding: '3px 12px',
              }}>
                <span style={{ color: scoreColor(sc), fontSize: 12, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.06em' }}>
                  CREDIBILITY {sc}/100
                </span>
              </div>
              {info && (
                <div style={{
                  background: `${info.color}18`,
                  border: `1px solid ${info.color}44`,
                  borderRadius: 6, padding: '3px 12px',
                }}>
                  <span style={{ color: info.color, fontSize: 12, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.06em' }}>
                    {info.label.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}
          <div style={{
            color: TEXT1,
            fontFamily: 'serif',
            fontSize: trimmed.length > 80 ? 28 : trimmed.length > 60 ? 34 : trimmed.length > 40 ? 40 : 46,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: '-0.3px',
            display: 'flex',
          }}>
            {trimmed}
          </div>
          {/* Score bar */}
          {hasScore && (
            <Bar value={sc} color={scoreColor(sc)} height={3} />
          )}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: TEXT4, fontSize: 13, fontFamily: 'sans-serif' }}>ratednews.com</span>
          <span style={{ color: TEXT3, fontSize: 12, fontFamily: 'sans-serif', fontStyle: 'italic' }}>
            AI-powered credibility rating
          </span>
        </div>
      </div>
    </Bg>
  )
}

// ── Card: Outlet scorecard ────────────────────────────────────────────────────
function OutletCard({ outlet, score, bias, fair, misleading, clickbait, stars, articles }) {
  const name       = outlet || 'Unknown Outlet'
  const hasScore   = score && Number(score) > 0
  const sc         = Number(score) || 0
  const fairPct    = Number(fair)       || 0
  const misleadPct = Number(misleading) || 0
  const cbPct      = Number(clickbait)  || 0
  const starsNum   = Number(stars)      || 0
  const artNum     = Number(articles)   || 0
  const hasFair    = fair !== null && fair !== '' && fair !== undefined
  const info       = biasInfo(bias)

  return (
    <Bg>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '40px 56px 40px 50px', width: '100%',
      }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={26} />
          <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Credibility Report
          </span>
        </div>

        {/* Outlet name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            color: TEXT1, fontFamily: 'serif',
            fontSize: name.length > 24 ? 42 : name.length > 16 ? 52 : 64,
            fontWeight: 700, lineHeight: 1.05,
            letterSpacing: '-1px', display: 'flex',
          }}>
            {name}
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', width: 400, height: 1, background: `rgba(216,90,48,0.3)` }} />

          {/* Stat rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {/* Credibility row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: TEXT2, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Credibility
                </span>
                <span style={{ color: hasScore ? scoreColor(sc) : TEXT3, fontSize: 15, fontFamily: 'sans-serif', fontWeight: 800 }}>
                  {hasScore ? `${sc}/100` : '—'}
                </span>
              </div>
              <Bar value={sc} color={hasScore ? scoreColor(sc) : 'rgba(255,255,255,0.08)'} height={6} />
            </div>

            {/* Headline fairness row */}
            {hasFair && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: TEXT2, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Headline Fairness
                  </span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ color: '#639922', fontSize: 11, fontFamily: 'sans-serif' }}>✓ {fairPct}% fair</span>
                    {misleadPct > 0 && <span style={{ color: '#C8930A', fontSize: 11, fontFamily: 'sans-serif' }}>⚠ {misleadPct}% misleading</span>}
                    {cbPct > 0      && <span style={{ color: '#C0392B', fontSize: 11, fontFamily: 'sans-serif' }}>✗ {cbPct}% clickbait</span>}
                  </div>
                </div>
                {/* Segmented bar */}
                <div style={{ display: 'flex', width: '100%', height: 6, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
                  {fairPct    > 0 && <div style={{ display: 'flex', width: `${fairPct}%`,    height: '100%', background: '#639922' }} />}
                  {misleadPct > 0 && <div style={{ display: 'flex', width: `${misleadPct}%`, height: '100%', background: '#C8930A' }} />}
                  {cbPct      > 0 && <div style={{ display: 'flex', width: `${cbPct}%`,      height: '100%', background: '#C0392B' }} />}
                  <div style={{ display: 'flex', flex: 1, height: '100%', background: 'rgba(255,255,255,0.08)' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScorePill score={score} />
          {info && <BiasPill bias={bias} />}
          {starsNum > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: 100, padding: '5px 14px',
            }}>
              <span style={{ color: '#C8930A', fontSize: 12, fontFamily: 'sans-serif' }}>★</span>
              <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif' }}>{starsNum.toFixed(1)}</span>
            </div>
          )}
          {artNum > 0 && (
            <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif' }}>
              {artNum.toLocaleString()} articles rated
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: TEXT4, fontSize: 12, fontFamily: 'sans-serif' }}>ratednews.com</span>
        </div>
      </div>
    </Bg>
  )
}

// ── Card: Comparison ──────────────────────────────────────────────────────────
function CompareCard({ aOutlet, aScore, aBias, aHead, bOutlet, bScore, bBias, bHead, caption }) {
  const tagline = caption || 'Same story. Different framing.'

  function Side({ name, score, bias, head, align = 'left' }) {
    const info  = biasInfo(bias)
    const sc    = Number(score) || 0
    const has   = sc > 0
    const trimH = head ? (head.length > 60 ? head.slice(0, 57) + '…' : head) : null

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1,
        padding: '36px 44px', justifyContent: 'space-between',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start',
      }}>
        {/* Outlet + bias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <span style={{
            color: TEXT1, fontFamily: 'serif',
            fontSize: (name || '').length > 18 ? 22 : 28,
            fontWeight: 700, letterSpacing: '-0.3px', display: 'flex',
          }}>
            {name || '—'}
          </span>
          {info && (
            <span style={{ color: info.color, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>
              {info.label}
            </span>
          )}
        </div>

        {/* Headline */}
        {trimH && (
          <div style={{
            color: TEXT2, fontSize: 16, fontFamily: 'serif',
            lineHeight: 1.45, fontStyle: 'italic', display: 'flex',
            textAlign: align === 'right' ? 'right' : 'left',
          }}>
            "{trimH}"
          </div>
        )}

        {/* Score */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          alignItems: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              color: has ? scoreColor(sc) : TEXT3,
              fontSize: 48, fontWeight: 800, fontFamily: 'serif', display: 'flex',
            }}>
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
    <Bg>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Top brand strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 44px 18px 38px',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <Logo size={22} />
          <span style={{ color: TEXT3, fontSize: 11, fontFamily: 'sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Same Story · Compared
          </span>
        </div>

        {/* Two columns */}
        <div style={{ display: 'flex', flex: 1 }}>
          <Side name={aOutlet} score={aScore} bias={aBias} head={aHead} align="left" />
          {/* Centre divider */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: 1, flex: 1, background: `linear-gradient(180deg, transparent, ${CORAL}66, transparent)` }} />
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `${CORAL}22`, border: `1.5px solid ${CORAL}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0',
            }}>
              <span style={{ color: CORAL, fontSize: 14, fontFamily: 'sans-serif', fontWeight: 700 }}>vs</span>
            </div>
            <div style={{ width: 1, flex: 1, background: `linear-gradient(180deg, transparent, ${CORAL}66, transparent)` }} />
          </div>
          <Side name={bOutlet} score={bScore} bias={bBias} head={bHead} align="right" />
        </div>

        {/* Bottom caption */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 44px 14px 38px',
          borderTop: `1px solid ${BORDER}`,
        }}>
          <span style={{ color: TEXT2, fontSize: 14, fontFamily: 'serif', fontStyle: 'italic' }}>{tagline}</span>
          <span style={{ color: TEXT4, fontSize: 11, fontFamily: 'sans-serif' }}>ratednews.com</span>
        </div>
      </div>
    </Bg>
  )
}

// ── Card: Leaderboard ─────────────────────────────────────────────────────────
function LeaderboardCard({ title, items }) {
  const rows     = items.slice(0, 7)
  const maxScore = Math.max(...rows.map(r => Number(r.score) || 0), 1)

  return (
    <Bg>
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '40px 56px 40px 50px', width: '100%', justifyContent: 'space-between',
      }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Logo size={24} />
            <div style={{
              color: TEXT1, fontFamily: 'serif',
              fontSize: 36, fontWeight: 700,
              letterSpacing: '-0.5px', display: 'flex', marginTop: 4,
            }}>
              {title || 'Outlet Rankings'}
            </div>
            {/* Coral underline */}
            <div style={{ display: 'flex', width: 280, height: 2, background: `rgba(216,90,48,0.4)` }} />
          </div>
          <span style={{ color: TEXT4, fontSize: 11, fontFamily: 'sans-serif', marginTop: 4 }}>ratednews.com</span>
        </div>

        {/* Ranked rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rows.map((row, i) => {
            const sc   = Number(row.score) || 0
            const info = biasInfo(row.bias)
            const barW = sc > 0 ? Math.round((sc / maxScore) * 100) : 0
            const isTop = i === 0

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: isTop ? '8px 14px' : '0',
                background: isTop ? `${CORAL}12` : 'transparent',
                borderRadius: isTop ? 8 : 0,
                border: isTop ? `1px solid ${CORAL}30` : 'none',
              }}>
                {/* Rank number */}
                <span style={{
                  color: isTop ? CORAL : TEXT3,
                  fontSize: 12, fontWeight: 800, fontFamily: 'sans-serif',
                  width: 20, textAlign: 'right', flexShrink: 0,
                }}>
                  {i + 1}
                </span>

                {/* Outlet name */}
                <span style={{
                  color: isTop ? TEXT1 : TEXT2,
                  fontSize: 14, fontWeight: isTop ? 700 : 500,
                  fontFamily: 'sans-serif',
                  width: 190, flexShrink: 0,
                }}>
                  {(row.name || '').slice(0, 24)}
                </span>

                {/* Bar */}
                <div style={{ display: 'flex', flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 5 }}>
                  <div style={{
                    display: 'flex', width: `${barW}%`, height: '100%',
                    background: sc > 0 ? scoreColor(sc) : 'transparent', borderRadius: 5,
                  }} />
                </div>

                {/* Score */}
                <span style={{
                  color: sc > 0 ? scoreColor(sc) : TEXT3,
                  fontSize: 15, fontWeight: 800, fontFamily: 'sans-serif',
                  width: 36, textAlign: 'right', flexShrink: 0,
                }}>
                  {sc > 0 ? sc : '—'}
                </span>

                {/* Bias */}
                {info ? (
                  <span style={{
                    color: info.color, fontSize: 11, fontFamily: 'sans-serif',
                    fontWeight: 600, width: 66, flexShrink: 0,
                  }}>
                    {info.label}
                  </span>
                ) : (
                  <span style={{ width: 66, flexShrink: 0 }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Bg>
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
