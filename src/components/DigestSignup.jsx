import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { track } from '../utils/track'

/**
 * Sidebar email capture for the weekly digest. Signed-in users are already in
 * the audience (email_prefs, opted in by default), so the widget hides itself
 * when a session exists.
 */
export default function DigestSignup() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail]     = useState('')
  const [status, setStatus]   = useState('idle') // idle | busy | done | error

  useEffect(() => {
    let mounted = true
    db.auth.getSession().then(({ data: { session } }) => {
      if (mounted && !session) setVisible(true)
    })
    return () => { mounted = false }
  }, [])

  if (!visible) return null

  async function subscribe(e) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setStatus('error'); return }
    setStatus('busy')
    const { error } = await db.from('digest_subscribers').insert({ email: clean })
    // Duplicate key = already subscribed = success as far as the reader cares
    if (!error || error.code === '23505') {
      setStatus('done')
      track('digest_signup')
    } else {
      setStatus('error')
    }
  }

  return (
    <div className="widget">
      <div className="widget-title">📬 The week in coverage</div>
      {status === 'done' ? (
        <div style={{ fontSize: 13, color: 'var(--green-dark)', fontWeight: 600 }}>
          You're on the list — see you Monday.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>
            The week's most-covered stories, every Monday. No account needed.
          </div>
          <form onSubmit={subscribe} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
              placeholder="you@example.com"
              aria-label="Email address"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
            />
            <button
              type="submit"
              disabled={status === 'busy'}
              className="nav-pill"
              style={{ width: '100%', padding: '9px 0', opacity: status === 'busy' ? 0.6 : 1 }}
            >
              {status === 'busy' ? 'Subscribing…' : 'Subscribe free'}
            </button>
          </form>
          {status === 'error' && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>
              That email didn't work — check it and try again.
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>
            One email a week · unsubscribe anytime
          </div>
        </>
      )}
    </div>
  )
}
