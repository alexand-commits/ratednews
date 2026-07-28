import { useState, useEffect } from 'react'

// Render-time media query — for layouts that need different element SIZES per
// breakpoint (CSS visibility toggles would render both variants). Starts false
// on the server; corrects on mount, which is fine for client-fetched pages.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}
