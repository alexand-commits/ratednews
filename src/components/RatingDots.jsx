import React from 'react'

// Community rating shown as green dots (replaces the old amber stars).
// `value` is on the 0–5 scale. Pass community_score as score/20.
// Filled dots = green; remaining = hollow. Optional numeric value beside them.
export default function RatingDots({
  value = 0,
  size = 9,
  gap = 3,
  showValue = true,
  valueSize = 12,
  valueColor = 'var(--green-dark)',
  count = 5,
}) {
  const filled = Math.round(value)
  return (
    <span role="img" aria-label={`Community rating ${Number(value || 0).toFixed(1)} out of 5`} style={{ display: 'inline-flex', alignItems: 'center', gap: gap + 2 }}>
      <span style={{ display: 'inline-flex', gap }} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => {
          const on = i < filled
          return (
            <span
              key={i}
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: on ? 'var(--green)' : 'transparent',
                border: on ? 'none' : `1.5px solid var(--border2)`,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          )
        })}
      </span>
      {showValue && value > 0 && (
        <span style={{ fontSize: valueSize, fontWeight: 600, color: valueColor }}>
          {value.toFixed(1)}
        </span>
      )}
    </span>
  )
}

// Interactive 1–5 dot picker for the rating modals.
// `value` and hover are on the 1–5 scale; onChange(n) fires on click.
export function RatingDotsInput({ value = 0, hover = 0, onChange, onHover, size = 22 }) {
  const active = hover || value
  return (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = n <= active
        return (
          <span
            key={n}
            role="button"
            aria-label={`${n} dot${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => onHover && onHover(n)}
            onMouseLeave={() => onHover && onHover(0)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: on ? 'var(--green)' : 'transparent',
              border: on ? 'none' : `2px solid var(--border2)`,
              cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s',
              flexShrink: 0,
            }}
          />
        )
      })}
    </span>
  )
}
