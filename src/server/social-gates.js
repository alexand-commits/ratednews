/**
 * Autopilot safety gates — decides, per post and per platform, whether the
 * bot may publish it or it stays manual-only. Pure function; used both to
 * annotate desk batches (so the owner can see what WOULD post) and by the
 * /api/social-auto run itself.
 *
 * Philosophy: the scout only DRAFTS — a human approves every publish — so
 * gates are minimal: pipeline truth (live events go stale in transit) and
 * anti-fluff (gossip-grade content). Everything else — controversy, tragedy,
 * regional, thin breaking — flows to the owner, who is the judgment layer.
 */

// Gossip signals — deliberately narrow: hard news about these people still
// flows (a royal policy story has none of these tells).
export const FLUFF_RE = /\b(insider (reveals|says|claims)|source close to|body language expert|relationship expert|fans (spot|notice|react)|breaks? silence on .{0,30}(romance|relationship|split)|dating rumou?rs|red.carpet look|steps out (with|in)|shows off (her|his)|gently amused)\b/i

// Sensational crime-footage framing — "shocking moment", CCTV-gawking,
// bodycam voyeurism. A sober report of the same case still flows; the
// tabloid packaging of it doesn't.
export const BAIT_RE = /\b(shocking (moment|video|footage)|chilling (moment|video|footage|final)|horror (moment|video|footage)|caught on (camera|cctv|video|tape)|cctv (shows|captures|footage)|bodycam (footage|shows|captures)|dramatic (moment|footage)|moment\b[^.]{0,50}\b(kill(er|er's|ers)?|murder|stabb?|attack)|final moments)\b/i

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

  // Pipeline-truth gate — block both platforms (mid-game state is stale
  // before our ~20-min pipeline can deliver it; previews/results are fine)
  if (meta?.liveEvent) {
    return { x: 'live event in progress — preview/result is a manual call', bluesky: 'live event in progress — preview/result is a manual call' }
  }
  // Fluff gate: celebrity/royal gossip-grade stories. Broad news is wanted —
  // controversy, tragedy, regional, thin-breaking all flow — but insider-
  // reveals content isn't the brand.
  if (FLUFF_RE.test(`${post.text || ''} ${meta?.title || ''}`)) {
    return { x: 'gossip-grade fluff — skip', bluesky: 'gossip-grade fluff — skip' }
  }
  if (BAIT_RE.test(`${post.text || ''} ${meta?.title || ''}`)) {
    return { x: 'sensational crime-bait — skip', bluesky: 'sensational crime-bait — skip' }
  }

  // Platform-specific
  let x = 'ok'
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
