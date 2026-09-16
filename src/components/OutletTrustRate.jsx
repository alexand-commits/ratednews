import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import RatingDots, { RatingDotsInput } from './RatingDots'
import { track } from '../utils/track'
import { stashRating, pendingStarsFor } from '../utils/pendingRatings'

// One-tap outlet trust rating. Tapping a dot submits immediately — no modal,
// no required accuracy/bias/headline fields. The detailed rating modal is still
// available for people who want it; this removes the friction for everyone else.
//
// Writes only { outlet_id, overall_stars, user_id }; the other columns are
// nullable and the community_score trigger recomputes server-side.
export default function OutletTrustRate({
  outlet,
  user,
  onLoginClick,
  onRated,
  showToast,
  initialStars = 0,
  size = 24,
  label = 'Do you trust this source?',
  align = 'left',
}) {
  const [stars, setStars]   = useState(initialStars)
  const [hover, setHover]   = useState(0)
  const [saving, setSaving] = useState(false)
  // Whether the rating showing is held on this device rather than saved to an
  // account. Drives the copy under the dots and nothing else.
  const [held, setHeld]     = useState(false)

  // A signed-out reader who already tapped should see their own rating when
  // they come back to the page, not an empty row asking again.
  useEffect(() => {
    if (user) { setStars(initialStars); setHeld(false); return }
    const pending = pendingStarsFor(outlet?.id)
    setStars(pending || initialStars)
    setHeld(pending > 0)
  }, [initialStars, outlet?.id, user])

  async function rate(n) {
    // Signed out: the tap LANDS. We used to open the auth modal here, which
    // asked a stranger to create an account before they had done anything and
    // converted 0 of 98 on 2026-09-16. The rating is held on the device and
    // written to the account on sign-in — it does not touch the outlet's
    // public score until then. See src/utils/pendingRatings.js.
    if (!user) {
      if (!outlet?.id) return
      setStars(n)
      setHeld(true)
      stashRating(outlet.id, n)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)
      track('rate_outlet', { outlet_id: outlet.id, stars: n, pending: true })
      return
    }
    if (saving || !outlet?.id) return
    const prev = stars
    setStars(n)            // optimistic
    setSaving(true)
    // Update-first: if the user already rated this outlet, change it; otherwise insert.
    let { data, error } = await db
      .from('outlet_ratings')
      .update({ overall_stars: n })
      .eq('outlet_id', outlet.id)
      .eq('user_id', user.id)
      .select()
    if (!error && (!data || data.length === 0)) {
      ({ error } = await db
        .from('outlet_ratings')
        .insert({ outlet_id: outlet.id, overall_stars: n, user_id: user.id }))
    }
    setSaving(false)
    if (error) {
      setStars(prev)
      showToast?.('Could not save your rating — try again')
      return
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)
    onRated?.(n)
    setHeld(false)
    track('rate_outlet', { outlet_id: outlet?.id, stars: n, pending: false })
  }

  const rated = stars > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: rated ? 'var(--green-dark)' : 'var(--text2)' }}>
        {rated ? 'Your trust rating' : label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RatingDotsInput value={stars} hover={hover} onChange={rate} onHover={setHover} size={size} />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {rated ? 'Tap to change' : 'One tap to rate'}
        </span>
      </div>
      {/* The ask, AFTER the tap. It names what signing in does for the rating
          they have already given rather than demanding an account up front. */}
      {held && (
        <button
          onClick={() => onLoginClick?.()}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 11, color: 'var(--text3)', textAlign: 'left',
            lineHeight: 1.45,
          }}
        >
          Saved on this device.{' '}
          <span style={{ color: 'var(--coral)', fontWeight: 600, textDecoration: 'underline' }}>
            Sign in to add it to {outlet?.name || 'this outlet'}’s score
          </span>
        </button>
      )}
    </div>
  )
}

// Compact inline variant for cards — smaller, no helper text, for dense lists.
export function OutletTrustRateInline({ outlet, user, onLoginClick, onRated, showToast, initialStars = 0, size = 18 }) {
  const [stars, setStars]   = useState(initialStars)
  const [hover, setHover]   = useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (user) { setStars(initialStars); return }
    setStars(pendingStarsFor(outlet?.id) || initialStars)
  }, [initialStars, outlet?.id, user])

  async function rate(e, n) {
    e.stopPropagation()
    // Same inversion as the full component above. No room for the "sign in to
    // add it" line in a dense list row, so this variant just holds the tap —
    // the prompt appears on the outlet and article pages where there is space.
    if (!user) {
      if (!outlet?.id) return
      setStars(n)
      stashRating(outlet.id, n)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)
      track('rate_outlet', { outlet_id: outlet.id, stars: n, pending: true })
      return
    }
    if (saving || !outlet?.id) return
    const prev = stars
    setStars(n); setSaving(true)
    let { data, error } = await db.from('outlet_ratings').update({ overall_stars: n }).eq('outlet_id', outlet.id).eq('user_id', user.id).select()
    if (!error && (!data || data.length === 0)) {
      ({ error } = await db.from('outlet_ratings').insert({ outlet_id: outlet.id, overall_stars: n, user_id: user.id }))
    }
    setSaving(false)
    if (error) { setStars(prev); showToast?.('Could not save'); return }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)
    onRated?.(n)
    track('rate_outlet', { outlet_id: outlet?.id, stars: n, pending: false })
  }

  const active = hover || stars
  return (
    <span style={{ display: 'inline-flex', gap: 5 }} onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          role="button"
          aria-label={`Rate ${n} of 5`}
          onClick={e => rate(e, n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            width: size, height: size, borderRadius: '50%',
            background: n <= active ? 'var(--green)' : 'transparent',
            border: n <= active ? 'none' : '2px solid var(--border2)',
            cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s, border-color 0.12s',
          }}
        />
      ))}
    </span>
  )
}
