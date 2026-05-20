/**
 * Shareable bias fingerprint card — /api/bias-card?userId=xxx
 * Edge runtime, Satori/ImageResponse.
 * Only renders for public profiles (public_profile = true).
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const W = 1200
const H = 630

const CORAL  = '#D85A30'
const BG     = '#111110'
const SURFACE = '#1C1B19'
const BORDER  = '#2C2A27'
const TEXT1  = 'rgba(255,255,255,0.92)'
const TEXT2  = '#9E9B95'
const TEXT3  = '#6B6760'
const BLUE   = '#3b82f6'
const GREEN  = '#639922'
const RED    = '#ef4444'

function trustLevel(total) {
  if (total >= 50) return { label: 'Expert',           emoji: '🏅', color: '#D85A30' }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: '#639922' }
  if (total >= 10) return { label: 'Contributor',      emoji: '✅', color: '#185FA5' }
  if (total >= 3)  return { label: 'Active Member',    emoji: '📰', color: '#6B6760' }
  return             { label: 'New Member',             emoji: '👋', color: '#9E9B95' }
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return new Response('Missing userId', { status: 400 })

    const base = process.env.VITE_SUPABASE_URL
    const key  = process.env.VITE_SUPABASE_ANON_KEY

    // Fetch profile first — only proceed if public
    const profileRes = await fetch(
      `${base}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=username,public_profile&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    const profiles = await profileRes.json()
    const profile = Array.isArray(profiles) ? profiles[0] : null

    if (!profile?.public_profile) {
      return new Response('Profile not found or private', { status: 404 })
    }

    // Profile is public — now safe to fetch ratings
    const ratingsRes = await fetch(
      `${base}/rest/v1/ratings?user_id=eq.${encodeURIComponent(userId)}&select=articles(bias_direction,outlets(name))&limit=300`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    const ratings = await ratingsRes.json()

    const username   = profile.username || 'Anonymous'
    const ratingList = Array.isArray(ratings) ? ratings : []
    const total      = ratingList.length

    // Bias breakdown
    const counts = { left: 0, centre: 0, right: 0 }
    const outletCounts = {}
    ratingList.forEach(r => {
      const dir = r.articles?.bias_direction
      if (dir && counts[dir] !== undefined) counts[dir]++
      const name = r.articles?.outlets?.name
      if (name) outletCounts[name] = (outletCounts[name] || 0) + 1
    })

    const biasTotal  = counts.left + counts.centre + counts.right
    const leftPct    = biasTotal ? Math.round((counts.left   / biasTotal) * 100) : 33
    const centrePct  = biasTotal ? Math.round((counts.centre / biasTotal) * 100) : 34
    const rightPct   = biasTotal ? Math.round((counts.right  / biasTotal) * 100) : 33

    let leanLabel = 'Balanced reader'
    if      (leftPct > 50)              leanLabel = 'Reads mostly left-leaning sources'
    else if (rightPct > 50)             leanLabel = 'Reads mostly right-leaning sources'
    else if (centrePct > 50)            leanLabel = 'Favours centrist sources'
    else if (leftPct > rightPct + 15)   leanLabel = 'Leans left in source choices'
    else if (rightPct > leftPct + 15)   leanLabel = 'Leans right in source choices'

    const topOutlets = Object.entries(outletCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const trust      = trustLevel(total)

    return new ImageResponse(
      <div style={{ width: W, height: H, background: BG, display: 'flex', flexDirection: 'column', padding: '48px 60px', fontFamily: 'sans-serif' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: CORAL, letterSpacing: '-0.3px' }}>RatedNews</div>
          <div style={{ fontSize: 14, fontWeight: 600, padding: '6px 16px', borderRadius: 20, border: `2px solid ${trust.color}`, color: trust.color }}>
            {trust.emoji} {trust.label}
          </div>
        </div>

        {/* Username + subtitle */}
        <div style={{ fontSize: 46, fontWeight: 700, color: TEXT1, marginBottom: 6, letterSpacing: '-1px' }}>
          @{username}
        </div>
        <div style={{ fontSize: 16, color: TEXT3, marginBottom: 36 }}>
          {total} article{total !== 1 ? 's' : ''} rated · ratednews.com
        </div>

        {/* Bias bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: TEXT3, textTransform: 'uppercase', marginBottom: 12 }}>
            Reading bias
          </div>
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            {leftPct > 0   && <div style={{ width: `${leftPct}%`,   background: BLUE  }} />}
            {centrePct > 0 && <div style={{ width: `${centrePct}%`, background: GREEN }} />}
            {rightPct > 0  && <div style={{ width: `${rightPct}%`,  background: RED   }} />}
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {[
              { label: 'Left',   pct: leftPct,   color: BLUE  },
              { label: 'Centre', pct: centrePct, color: GREEN },
              { label: 'Right',  pct: rightPct,  color: RED   },
            ].map(({ label, pct, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 16, color: TEXT2, fontWeight: 500 }}>{pct}% {label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lean label */}
        <div style={{ fontSize: 19, color: TEXT2, fontStyle: 'italic', marginBottom: 32 }}>
          {leanLabel}
        </div>

        {/* Top outlets */}
        {topOutlets.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: TEXT3, textTransform: 'uppercase', marginBottom: 14 }}>
              Top outlets
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {topOutlets.map(([name, count]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 18px' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: TEXT1 }}>{name}</span>
                  <span style={{ fontSize: 13, color: TEXT3 }}>{count} rated</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: TEXT3 }}>ratednews.com/profile/{username}</div>
          <div style={{ fontSize: 13, color: TEXT3 }}>AI-powered news quality ratings</div>
        </div>

      </div>,
      { width: W, height: H }
    )
  } catch (e) {
    return new Response('Error generating card', { status: 500 })
  }
}
