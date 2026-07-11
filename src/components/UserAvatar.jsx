import React from 'react'

// One avatar everywhere: emoji on a chosen colour, falling back to initials
// on coral. No image uploads — zero moderation surface.
export const AVATAR_COLORS = ['#D85A30', '#639922', '#185FA5', '#534AB7', '#C8930A', '#C0392B', '#0F766E', '#6B6760']

export default function UserAvatar({ name = '', emoji = null, color = null, size = 40, fontSize = null }) {
  const initials = (name || '?').trim().slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color || 'var(--coral)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fontSize || (emoji ? size * 0.52 : size * 0.36), fontWeight: 700,
    }}>
      {emoji || initials}
    </div>
  )
}
