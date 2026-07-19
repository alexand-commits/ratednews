/**
 * Autopilot safety gates — decides, per post and per platform, whether the
 * bot may publish it or it stays manual-only. Pure function; used both to
 * annotate desk batches (so the owner can see what WOULD post) and by the
 * /api/social-auto run itself.
 *
 * Philosophy: the scout only DRAFTS — a human approves every publish — so
 * the gates guard pipeline truth (live events go stale in transit) and
 * audience fit (regional-only stories), not gravity. Sober-story voice rules
 * live in the generation prompt; the owner is the judgment layer.
 */

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

// Draft-mode cadence: these throttle how often the scout DRAFTS (a 4-cent,
// zero-risk act reviewed by a human) — not a publishing schedule. 60-min gap
// keeps generation cost bounded; the 6h story cool-down handles repetition.
export const AUTO_RATE_LIMITS = {
  x:       { minGapMin: 60, maxPerDay: 8 },
  bluesky: { minGapMin: 60, maxPerDay: 8 },
}
