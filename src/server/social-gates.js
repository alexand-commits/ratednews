/**
 * Autopilot safety gates — decides, per post and per platform, whether the
 * bot may publish it or it stays manual-only. Pure function; used both to
 * annotate desk batches (so the owner can see what WOULD post) and by the
 * /api/social-auto run itself.
 *
 * Philosophy: the machine handles sport/business/tech/politics-as-theatre;
 * anything grave (war, death, disaster, crime) requires human eyes — on the
 * heaviest news days the bot going quiet is correct brand behaviour.
 */

const GRAVE_CATEGORIES = new Set(['Conflict', 'Crime'])

// Keyword net for grave stories that live outside the grave categories
// (an actor's death files under Entertainment; a plane crash under Travel).
const GRAVE_WORDS = /\b(dead|death|dies|died|dying|kill(?:ed|ing|s)?|murder|shooting|shot|stabb|war|missile|air ?strike|attack|bomb|blast|explosion|crash|disaster|earthquake|flood|wildfire|famine|victim|hostage|terror|massacre|casualt|suicide|overdose|abuse|rape|trafficking)/i

/**
 * @param {object} post  — {type, text, short, story}
 * @param {object|null} meta — {category, breaking, outlets, title} when known
 * @returns {{x: string, bluesky: string}} — 'ok' or the blocking reason
 */
export function evaluateAutoGates(post, meta) {
  // Format gates — some formats are owner-only by design
  if (post.type === 'poll') {
    return { x: 'polls are manual-only', bluesky: 'polls are manual-only' }
  }
  if (post.type === 'coverage_contrast') {
    return { x: 'signature format — manual only', bluesky: 'signature format — manual only' }
  }

  // Gravity gates — block both platforms
  const scanText = `${post.text || ''} ${post.story || ''} ${meta?.title || ''}`
  if (meta && GRAVE_CATEGORIES.has(meta.category)) {
    return { x: `${meta.category} story — human eyes required`, bluesky: `${meta.category} story — human eyes required` }
  }
  if (GRAVE_WORDS.test(scanText)) {
    return { x: 'sober story — human eyes required', bluesky: 'sober story — human eyes required' }
  }

  // Pipeline-truth gates — block both platforms
  if (meta?.liveEvent) {
    return { x: 'live event in progress — preview/result is a manual call', bluesky: 'live event in progress — preview/result is a manual call' }
  }
  // Audience gate: no UK/US/international outlet on it → big regionally,
  // invisible to this account's audience. Owner's judgment, not the bot's.
  if (meta?.regional) {
    return { x: 'regional story (no UK/US/intl coverage) — human call', bluesky: 'regional story (no UK/US/intl coverage) — human call' }
  }

  // Platform-specific
  let x = 'ok'
  if (meta?.breaking && (meta.outlets || 0) < 4) x = 'breaking with <4 outlets — too early for autopilot'
  if (/https?:\/\/|www\./i.test(post.text || '')) x = 'contains link'

  let bluesky = 'ok'
  if (typeof post.short !== 'string' || !post.short.trim()) bluesky = 'no Bluesky variant'
  else if (post.short.length > 300) bluesky = 'short over 300 chars'

  return { x, bluesky }
}

export const AUTO_RATE_LIMITS = {
  x:       { minGapMin: 120, maxPerDay: 3 },
  bluesky: { minGapMin: 120, maxPerDay: 6 },
}
