/**
 * Dynamic OG image endpoint — /api/og
 * Used by article pages to generate unique share-card images.
 *
 * Query params:
 *   title  — article headline (truncated to ~80 chars)
 *   score  — accuracy score 0–100 (optional)
 *   bias   — "left" | "centre" | "right" (optional)
 *   outlet — outlet name (optional)
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

export default function handler(req) {
  const { searchParams } = new URL(req.url)
  const rawTitle = searchParams.get('title') || 'RatedNews'
  const score    = searchParams.get('score')
  const bias     = searchParams.get('bias')
  const outlet   = searchParams.get('outlet') || ''

  const title = rawTitle.length > 90 ? rawTitle.slice(0, 87) + '…' : rawTitle
  const hasScore = score && Number(score) > 0
  const biasInfo = bias ? biasLabel(bias) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          background: '#0f0f0f',
          fontFamily: 'serif',
        }}
      >
        {/* Top: branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#ef4444',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            padding: '4px 10px',
            borderRadius: 6,
            letterSpacing: 1,
          }}>
            RATED
          </div>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif', letterSpacing: 1 }}>NEWS</span>
          {outlet && (
            <span style={{ color: '#6b7280', fontSize: 13, fontFamily: 'sans-serif', marginLeft: 8 }}>
              — {outlet}
            </span>
          )}
        </div>

        {/* Middle: headline */}
        <div style={{
          color: '#f9fafb',
          fontSize: title.length > 60 ? 32 : 40,
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: '-0.5px',
          display: 'flex',
        }}>
          {title}
        </div>

        {/* Bottom: score chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hasScore && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#1f1f1f',
              border: `1.5px solid ${scoreColor(score)}`,
              borderRadius: 100,
              padding: '6px 16px',
            }}>
              <span style={{ color: scoreColor(score), fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif' }}>✦</span>
              <span style={{ color: '#f9fafb', fontSize: 15, fontWeight: 700, fontFamily: 'sans-serif' }}>Accuracy {score}/100</span>
            </div>
          )}
          {biasInfo && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#1f1f1f',
              border: `1.5px solid ${biasInfo.color}`,
              borderRadius: 100,
              padding: '6px 16px',
            }}>
              <span style={{ color: biasInfo.color, fontSize: 15, fontWeight: 600, fontFamily: 'sans-serif' }}>{biasInfo.text}</span>
            </div>
          )}
          {!hasScore && !biasInfo && (
            <div style={{
              background: '#1f1f1f',
              border: '1.5px solid #374151',
              borderRadius: 100,
              padding: '6px 16px',
            }}>
              <span style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'sans-serif' }}>⏳ Awaiting AI analysis</span>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width:  1200,
      height: 630,
    },
  )
}
