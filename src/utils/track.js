// Funnel events → Google Analytics + Vercel Web Analytics (both silent
// no-ops when absent). Keep event names stable — they're the product's KPI
// vocabulary: rate_outlet, follow_outlet, topic_tap, search.
import { track as vercelTrack } from '@vercel/analytics'

export function track(event, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', event, params)
    }
  } catch {}
  try {
    vercelTrack(event, params)
  } catch {}
}
