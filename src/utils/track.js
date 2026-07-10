// Funnel events → Google Analytics (already loaded in _app). Silent no-op when
// GA is absent. Keep event names stable — they're the product's KPI vocabulary:
// rate_outlet, follow_outlet, topic_tap, search.
export function track(event, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', event, params)
    }
  } catch {}
}
