import React, { useState, useRef } from 'react'

export default function InfoTip({ text }) {
  const [visible, setVisible] = useState(false)
  const [offset, setOffset] = useState(0)
  const btnRef = useRef(null)

  function show() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const tipWidth = 280
      const center = rect.left + rect.width / 2
      const leftEdge = center - tipWidth / 2
      const rightEdge = center + tipWidth / 2
      // Nudge so it stays 10px inside the viewport
      if (leftEdge < 10) {
        setOffset(10 - leftEdge)
      } else if (rightEdge > window.innerWidth - 10) {
        setOffset(window.innerWidth - 10 - rightEdge)
      } else {
        setOffset(0)
      }
    }
    setVisible(true)
  }

  return (
    <span className="infotip">
      <button
        ref={btnRef}
        className="infotip-btn"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
        aria-label="More info"
      >ⓘ</button>
      {visible && (
        <span
          className="infotip-box"
          style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
