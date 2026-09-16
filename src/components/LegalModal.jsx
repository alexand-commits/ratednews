import React, { useEffect } from 'react'
import { DOCS } from '../content/legal'

// ── Content ────────────────────────────────────────────────────────────────────


// ── Renderer ───────────────────────────────────────────────────────────────────

function renderBody(text) {
  // Convert **bold** and bullet lines into styled elements
  return text.split('\n').map((line, i) => {
    if (line.startsWith('•')) {
      const content = line.slice(1).trim()
      return (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'var(--coral)', flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      )
    }
    if (!line.trim()) return <div key={i} style={{ height: 8 }} />
    return <p key={i} style={{ margin: '0 0 4px' }}>{renderInline(line)}</p>
  })
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export default function LegalModal({ doc, onClose }) {
  const content = DOCS[doc]

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!content) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 0 0',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border2)',
          borderBottom: 'none',
          width: '100%',
          maxWidth: 680,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18), 0 -1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px 12px',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-playfair), serif' }}>
              {content.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Last updated {content.updated}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--text2)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 40px', fontSize: 13, lineHeight: 1.7, color: 'var(--text2)' }}>
          {content.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {s.heading}
              </div>
              <div>{renderBody(s.body)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
