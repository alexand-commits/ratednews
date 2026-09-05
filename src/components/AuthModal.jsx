import React, { useState } from 'react'
import { db } from '../lib/supabase'

export default function AuthModal({ onClose, showToast, initialTab = 'signin' }) {
  const [tab, setTab]         = useState(initialTab) // 'signin' | 'signup' | 'reset'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'error'|'success', text }
  const [signupDone, setSignupDone] = useState(false) // show post-signup screen

  function switchTab(t) { setTab(t); setMessage(null); setSignupDone(false) }

  async function handleSignIn(e) {
    e.preventDefault()
    if (!email || !password) { setMessage({ type: 'error', text: 'Please enter your email and password.' }); return }
    setLoading(true); setMessage(null)
    // The signIn promise can hang behind supabase-js's auth lock even after
    // the sign-in succeeds (the SIGNED_IN event closes this modal from _app
    // in that case). The race keeps the button honest instead of spinning
    // forever on "Please wait…".
    const result = await Promise.race([
      db.auth.signInWithPassword({ email, password }),
      new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 12000)),
    ])
    setLoading(false)
    if (result.timedOut) {
      setMessage({ type: 'error', text: 'That took longer than it should. You may already be signed in — if this stays open, refresh the page.' })
      return
    }
    if (result.error) { setMessage({ type: 'error', text: result.error.message }); return }
    showToast('Welcome back!')
    onClose()
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (!email || !password) { setMessage({ type: 'error', text: 'Please enter your email and password.' }); return }
    if (password.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters.' }); return }
    setLoading(true); setMessage(null)
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://www.ratednews.com' },
    })
    setLoading(false)
    if (error) { setMessage({ type: 'error', text: error.message }); return }
    // Supabase never errors when the email is already registered (anti-
    // enumeration) — it returns a user with an EMPTY identities array and
    // sends no email. Detect that so we don't show a "check your inbox"
    // screen for a mailbox that will never receive anything.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setMessage({ type: 'error', text: 'That email already has an account. Try signing in, or reset your password.' })
      return
    }
    setSignupDone(true)
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (!email) { setMessage({ type: 'error', text: 'Please enter your email address.' }); return }
    setLoading(true); setMessage(null)
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.ratednews.com',
    })
    setLoading(false)
    if (error) { setMessage({ type: 'error', text: error.message }); return }
    setMessage({ type: 'success', text: 'Password reset email sent — check your inbox.' })
  }

  async function handleResendConfirmation() {
    if (!email) return
    setLoading(true)
    await db.auth.resend({ type: 'signup', email })
    setLoading(false)
    showToast('Confirmation email resent!')
  }

  // ── Post-signup confirmation screen ──────────────────────────────────────────
  if (signupDone) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-playfair), serif' }}>Check your inbox</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              We've sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%', marginBottom: 10 }}
              onClick={() => switchTab('signin')}
            >
              Go to sign in
            </button>
            <button
              onClick={handleResendConfirmation}
              disabled={loading}
              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              {loading ? 'Sending…' : "Didn't receive it? Resend"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Reset password tab ────────────────────────────────────────────────────────
  if (tab === 'reset') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div className="modal-title">Reset password</div>
              <div className="modal-subtitle">We'll email you a link to set a new password.</div>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
              <input
                type="email"
                className="compose-input"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border2)' }}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            {message && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14,
                background: message.type === 'error' ? 'var(--red-light)' : 'var(--green-light)',
                color: message.type === 'error' ? 'var(--red)' : 'var(--green-dark)',
                border: `0.5px solid ${message.type === 'error' ? 'var(--red)' : 'var(--green)'}`
              }}>
                {message.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => switchTab('signin')} style={{ flex: 1 }}>← Back</button>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Sign in / Sign up tabs ────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Welcome to RatedNews</div>
            <div className="modal-subtitle">Rate articles, track outlets, join the discussion.</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)', marginBottom: 20 }}>
          {[['signin', 'Sign in'], ['signup', 'Create account']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: tab === key ? 500 : 400,
                background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--coral)' : '2px solid transparent',
                color: tab === key ? 'var(--coral)' : 'var(--text2)', cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif', marginBottom: -1, transition: 'all 0.15s'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
              <input
                type="email"
                className="compose-input"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border2)' }}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</label>
                {tab === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchTab('reset')}
                    style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                className="compose-input"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border2)' }}
                placeholder={tab === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 14,
              background: message.type === 'error' ? 'var(--red-light)' : 'var(--green-light)',
              color: message.type === 'error' ? 'var(--red)' : 'var(--green-dark)',
              border: `0.5px solid ${message.type === 'error' ? 'var(--red)' : 'var(--green)'}`
            }}>
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
          {tab === 'signin'
            ? <span>No account? <button onClick={() => switchTab('signup')} style={{ background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-dm-sans), sans-serif' }}>Create one</button></span>
            : <span>Already have an account? <button onClick={() => switchTab('signin')} style={{ background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-dm-sans), sans-serif' }}>Sign in</button></span>
          }
        </div>
      </div>
    </div>
  )
}
