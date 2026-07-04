import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import RatingDots, { RatingDotsInput } from './RatingDots'

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

  useEffect(() => { setStars(initialStars) }, [initialStars, outlet?.id])

  async function rate(n) {
    if (!user) { onLoginClick?.(); return }
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
          {rated ? 'Tap to change' : (user ? 'One tap to rate' : 'Sign in to rate')}
        </span>
      </div>
    </div>
  )
}

// Compact inline variant for cards — smaller, no helper text, for dense lists.
export function OutletTrustRateInline({ outlet, user, onLoginClick, onRated, showToast, initialStars = 0, size = 18 }) {
  const [stars, setStars]   = useState(initialStars)
  const [hover, setHover]   = useState(0)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setStars(initialStars) }, [initialStars, outlet?.id])

  async function rate(e, n) {
    e.stopPropagation()
    if (!user) { onLoginClick?.(); return }
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
