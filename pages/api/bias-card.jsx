/**
 * Shareable trust card — /api/bias-card?userId=xxx
 * (Path kept for existing OG links.) Renders a reader's trust map: the
 * sources they trust and distrust, their trust level and rating count.
 * Edge runtime, Satori. Only renders for public profiles.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const W = 1200
const H = 630
const CORAL   = '#D85A30'
const CORAL_L = '#E8724A'
const BG      = '#1A1917'
const SURFACE = '#2E2B28'
const LINE    = 'rgba(255,255,255,0.10)'
const TEXT1   = 'rgba(255,255,255,0.92)'
const TEXT2   = '#A8A49E'
const TEXT3   = '#6B6760'
const GREEN   = '#8DC44A'
const RED     = '#E24B4A'
const SF = 'sans-serif'
const SE = 'serif'

function trustLevel(total) {
  if (total >= 50) return { label: 'Expert', emoji: '🏅', color: CORAL }
  if (total >= 20) return { label: 'Trusted Reviewer', emoji: '⭐', color: GREEN }
  if (total >= 10) return { label: 'Contributor', emoji: '✅', color: '#5B7BC0' }
  if (total >= 3)  return { label: 'Active Member', emoji: '📰', color: TEXT2 }
  return { label: 'New Member', emoji: '👋', color: TEXT3 }
}

function Fallback() {
  return (
    <div style={{ display: 'flex', width: W, height: H, background: BG, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontFamily: SE, fontSize: 64, fontWeight: 700, color: TEXT1 }}>Rated</span>
        <span style={{ fontFamily: SE, fontSize: 64, fontWeight: 700, color: CORAL }}>News</span>
      </div>
    </div>
  )
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || ''
    if (!/^[0-9a-f-]{36}$/.test(userId)) return new ImageResponse(<Fallback />, { width: W, height: H })

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    const headers = { apikey: key, Authorization: `Bearer ${key}` }

    const profileRes = await fetch(
      `${base}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      { headers }
    )
    const [profile] = await profileRes.json()
    if (!profile?.public_profile) return new ImageResponse(<Fallback />, { width: W, height: H })

    const [ratingsRes, commentsRes] = await Promise.all([
      fetch(`${base}/rest/v1/outlet_ratings?user_id=eq.${encodeURIComponent(userId)}&select=overall_stars,outlets(name)&limit=200`, { headers }),
      fetch(`${base}/rest/v1/comments?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=200`, { headers }),
    ])
    const ratings  = await ratingsRes.json().catch(() => [])
    const comments = await commentsRes.json().catch(() => [])

    const name      = profile.username ? `@${profile.username}` : 'A RatedNews reader'
    const trusts    = (ratings || []).filter(r => (r.overall_stars || 0) >= 4).map(r => r.outlets?.name).filter(Boolean).slice(0, 4)
    const distrusts = (ratings || []).filter(r => (r.overall_stars || 0) > 0 && r.overall_stars <= 2).map(r => r.outlets?.name).filter(Boolean).slice(0, 3)
    const level     = trustLevel((ratings?.length || 0) + (comments?.length || 0))

    const col = (title, items, color, mark) => (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: '22px 26px', gap: 12 }}>
        <span style={{ color, fontFamily: SF, fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>{title}</span>
        {items.length ? items.map((n, i) => (
          <div key={String(i)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', width: 10, height: 10, borderRadius: 10, background: color }} />
            <span style={{ color: TEXT1, fontFamily: SF, fontSize: 21, fontWeight: 600 }}>{n}</span>
          </div>
        )) : <span style={{ color: TEXT3, fontFamily: SF, fontSize: 17 }}>{mark}</span>}
      </div>
    )

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H, background: BG, padding: '56px 64px 44px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 64, background: profile.avatar_color || CORAL, alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff', fontFamily: SF, fontWeight: 700 }}>
                {profile.avatar_emoji || (profile.username || 'R').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: TEXT1, fontFamily: SE, fontSize: 34, fontWeight: 700 }}>{name}</span>
                <span style={{ color: level.color, fontFamily: SF, fontSize: 17, fontWeight: 700 }}>{level.emoji} {level.label} · {ratings?.length || 0} sources rated</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontFamily: SE, fontSize: 30, fontWeight: 700, color: TEXT1 }}>Rated</span>
              <span style={{ fontFamily: SE, fontSize: 30, fontWeight: 700, color: CORAL }}>News</span>
            </div>
          </div>

          <div style={{ display: 'flex', color: TEXT1, fontFamily: SE, fontSize: 40, fontWeight: 700, marginTop: 34, marginBottom: 24 }}>
            My trust map of the news
          </div>

          <div style={{ display: 'flex', gap: 24, flex: 1 }}>
            {col('TRUSTS', trusts, GREEN, 'Still deciding…')}
            {col('TRUSTS LEAST', distrusts, RED, 'No verdicts yet')}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <span style={{ color: TEXT3, fontSize: 16, fontFamily: SF }}>ratednews.com — rate the sources you trust</span>
            <span style={{ color: CORAL_L, fontSize: 16, fontFamily: SF, fontWeight: 700 }}>What does your trust map look like?</span>
          </div>
        </div>
      ),
      { width: W, height: H }
    )
  } catch {
    return new ImageResponse(<Fallback />, { width: W, height: H })
  }
}
