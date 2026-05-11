/**
 * Dynamic OG image endpoint — /api/og
 * Used by article and outlet pages to generate unique share-card images.
 *
 * Article mode (default):
 *   title  — article headline (truncated to ~80 chars)
 *   score  — accuracy score 0–100 (optional)
 *   bias   — "left" | "centre" | "right" (optional)
 *   outlet — outlet name (optional)
 *
 * Outlet mode:
 *   type   — "outlet"
 *   outlet — outlet name (required)
 *   score  — overall accuracy score 0–100 (optional)
 *   bias   — "left" | "centre" | "right" (optional)
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const config = { api: { bodyParser: false } }

// Score colour thresholds
function scoreColor(s) {
  const n = Number(s)
  if (n >= 80) return '#22c55e'
  if (n >= 60) return '#f59e0b'
  return '#ef4444'
}

function biasLabel(bias) {
  if (bias === 'left')   return { text: '← Left-leaning',  color: '#3b82f6' }
  if (bias === 'right')  return { text: '→ Right-leaning', color: '#ef4444' }
  if (bias === 'centre') return { text: '◉ Centrist',       color: '#6b7280' }
  return null
}

// Shared branding bar used by both card types
function BrandBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        background: '#ef4444', color: '#fff',
        fontSize: 14, fontWeight: 700, fontFamily: 'sans-serif',
        padding: '4px 10px', borderRadius: 6, letterSpacing: 1,
      }}>
        RATED
      </div>
      <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif', letterSpacing: 1 }}>NEWS</span>
    </div>
  )
}

function ScoreChip({ score }) {
  const hasScore = score && Number(score) > 0
  if (!hasScore) return (
    <div style={{ background: '#1f1f1f', border: '1.5px solid #374151', borderRadius: 100, padding: '6px 16px' }}>
      <span style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'sans-serif' }}>⏳ Awaiting analysis</span>
    </div>
  )
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: '#1f1f1f', border: `1.5px solid ${scoreColor(score)}`,
      borderRadius: 100, padding: '6px 16px',
    }}>
      <span style={{ color: scoreColor(score), fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif' }}>✦</span>
      <span style={{ color: '#f9fafb', fontSize: 15, fontWeight: 700, fontFamily: 'sans-serif' }}>Accuracy {score}/100</span>
    </div>
  )
}

function BiasChip({ bias }) {
  const info = bias ? biasLabel(bias) : null
  if (!info) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: '#1f1f1f', border: `1.5px solid ${info.color}`,
      borderRadius: 100, padding: '6px 16px',
    }}>
      <span style={{ color: info.color, fontSize: 15, fontWeight: 600, fontFamily: 'sans-serif' }}>{info.text}</span>
    </div>
  )
}

export default function handler(req) {
  const { searchParams } = new URL(req.url)
  const type   = searchParams.get('type') || 'article'
  const score  = searchParams.get('score')
  const bias   = searchParams.get('bias')
  const outlet = searchParams.get('outlet') || ''

  const opts = {
    width: 1200, height: 630,
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000' },
  }

  // ── Outlet card ─────────────────────────────────────────────────────────────
  if (type === 'outlet') {
    const displayName = outlet || 'Unknown Outlet'
    const hasScore = score && Number(score) > 0
    const biasInfo = bias ? biasLabel(bias) : null

    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '48px 56px',
          background: '#0f0f0f', fontFamily: 'sans-serif',
        }}>
          <BrandBar />

          {/* Centre: outlet name + descriptor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', fontFamily: 'sans-serif' }}>
              Media Bias &amp; Accuracy Report
            </div>
            <div style={{
              color: '#f9fafb', fontFamily: 'serif',
              fontSize: displayName.length > 20 ? 52 : 64,
              fontWeight: 700, lineHeight: 1.1, letterSpacing: '-1px',
              display: 'flex',
            }}>
              {displayName}
            </div>
          </div>

          {/* Bottom: score chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ScoreChip score={score} />
            {biasInfo && <BiasChip bias={bias} />}
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', fontFamily: 'sans-serif' }}>
              ratednews.com
            </div>
          </div>
        </div>
      ),
      opts,
    )
  }

  // ── Article card (default) ───────────────────────────────────────────────────
  const rawTitle = searchParams.get('title') || 'RatedNews'
  const title = rawTitle.length > 90 ? rawTitle.slice(0, 87) + '…' : rawTitle
  const biasInfo = bias ? biasLabel(bias) : null

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '48px 56px',
        background: '#0f0f0f', fontFamily: 'serif',
      }}>
        {/* Top: branding + outlet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandBar />
          {outlet && (
            <span style={{ color: '#6b7280', fontSize: 13, fontFamily: 'sans-serif', marginLeft: 8 }}>
              — {outlet}
            </span>
          )}
        </div>

        {/* Middle: headline */}
        <div style={{
          color: '#f9fafb', fontSize: title.length > 60 ? 32 : 40,
          fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.5px', display: 'flex',
        }}>
          {title}
        </div>

        {/* Bottom: score chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ScoreChip score={score} />
          {biasInfo && <BiasChip bias={bias} />}
        </div>
      </div>
    ),
    opts,
  )
}
