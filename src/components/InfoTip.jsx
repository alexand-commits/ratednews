import React, { useState, useRef } from 'react'

export default function InfoTip({ text }) {
  const [pos, setPos]       = useState(null)
  const btnRef              = useRef(null)

  function show() {
    if (!btnRef.current) return
    const rect    = btnRef.current.getBoundingClientRect()
    const tipWidth = 280
    const center  = rect.left + rect.width / 2
    // Keep 10px inside viewport on each side
    const clampedLeft = Math.max(10 + tipWidth / 2, Math.min(window.innerWidth - 10 - tipWidth / 2, center))
    setPos({
      // Anchor above the button — use viewport-relative coords so we escape any overflow container
      bottom: window.innerHeight - rect.top + 8,
      left:   clampedLeft,
    })
  }

  function hide() { setPos(null) }

  return (
    <span className="infotip">
      <button
        ref={btnRef}
        className="infotip-btn"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={e => { e.stopPropagation(); pos ? hide() : show() }}
        aria-label="More info"
      >ⓘ</button>
      {pos && (
        <span
          className="infotip-box"
          style={{
            position: 'fixed',
            bottom:   pos.bottom,
            left:     pos.left,
            transform: 'translateX(-50%)',
            // Override the absolute positioning from CSS
            top: 'auto',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
