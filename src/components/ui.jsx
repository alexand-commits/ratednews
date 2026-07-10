import React from 'react'

/**
 * Shared UI primitives — the sanctioned building blocks for rails, chips and
 * section headers. New code should use these instead of ad-hoc inline styles;
 * existing code migrates opportunistically. Type scale + spacing: docs/DESIGN.md
 */

export function Widget({ children, className = '', style = {} }) {
  return (
    <div className={`widget ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}

export function WidgetTitle({ children, action = null }) {
  if (!action) return <div className="widget-title">{children}</div>
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div className="widget-title">{children}</div>
      {action}
    </div>
  )
}

export function ClearButton({ onClick, children = '✕ Clear' }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--coral)', padding: 0 }}
    >
      {children}
    </button>
  )
}

export function SectionHeading({ children, action = null, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, ...style }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-playfair), serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
        {children}
      </h2>
      {action}
    </div>
  )
}

export function Meta({ children, style = {} }) {
  return <span style={{ fontSize: 11, color: 'var(--text3)', ...style }}>{children}</span>
}
