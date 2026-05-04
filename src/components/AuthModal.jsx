import React, { useState } from 'react'
import { db } from '../lib/supabase'

export default function AuthModal({ onClose, showToast }) {
  const [tab, setTab] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'error'|'success', text }

  async function handleSignIn(e) {
    e.preventDefault()
    if (!email || !password) { setMessage({ type: 'error', text: 'Please enter your email and password.' }); return }
    setLoading(true); setMessage(null)
    const { error } = await db.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setMessage({ type: 'error', text: error.message }); return }
    showToast('Welcome back!')
    onClose()
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (!email || !password) { setMessage({ type: 'error', text: 'Please enter your email and password.' }); return }
    if (password.length < 6) { setMessage({ type: 'error', text: 'Password must be at least 6 characters.' }); return }
    setLoading(true); setMessage(null)
    const { error } = await db.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setMessage({ type: 'error', text: error.message }); return }
    setMessage({ type: 'success', text: 'Check your email for a confirmation link, then sign in.' })
  }

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
              onClick={() => { setTab(key); setMessage(null) }}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: tab === key ? 500 : 400,
                background: 'none', border: 'none', borderBottom: tab === key ? '2px solid var(--coral)' : '2px solid transparent',
                color: tab === key ? 'var(--coral)' : 'var(--text2)', cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif', marginBottom: -1, transition: 'all 0.15s'
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
                style={{ width: '100%', padding: '10px 14px' }}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</label>
              <input
                type="password"
                className="compose-input"
                style={{ width: '100%', padding: '10px 14px' }}
                placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
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
            ? <span>No account? <button onClick={() => { setTab('signup'); setMessage(null) }} style={{ background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>Create one</button></span>
            : <span>Already have an account? <button onClick={() => { setTab('signin'); setMessage(null) }} style={{ background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>Sign in</button></span>
          }
        </div>
      </div>
    </div>
  )
}
