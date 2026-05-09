import React, { useState } from 'react'
import { db } from '../lib/supabase'

export default function PasswordResetModal({ onClose, showToast }) {
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [message,     setMessage]     = useState(null) // { type: 'error'|'success', text }
  const [done,        setDone]        = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setLoading(true)
    setMessage(null)
    const { error } = await db.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setDone(true)
    showToast('Password updated!')
    setTimeout(onClose, 1500)
  }

  if (done) {
    return (
      <div className="modal-overlay">
        <div className="modal-card" style={{ maxWidth: 400, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-playfair), serif' }}>
            Password updated
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            You're all set. Redirecting you now…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Set new password</div>
            <div className="modal-subtitle">Choose a strong password for your account.</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                New password
              </label>
              <input
                type="password"
                className="compose-input"
                style={{ width: '100%', padding: '10px 14px' }}
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Confirm password
              </label>
              <input
                type="password"
                className="compose-input"
                style={{ width: '100%', padding: '10px 14px' }}
                placeholder="Repeat your new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
