// Ratings tapped before signing in.
//
// The rating prompt used to open the auth modal the instant a stranger touched
// a dot. Measured 2026-09-16: 98 visitors, 89 of them first-ever, and ZERO
// ratings — the account was being asked for before the person had done
// anything, which is the most expensive possible moment to ask.
//
// So the tap lands first. It is held on the device, shown back to the reader as
// theirs, and only written to `outlet_ratings` once there is a real account
// behind it. That ordering matters for more than conversion:
//
//   A pending rating NEVER reaches an outlet's public score. Nothing here
//   writes to the database. Scores still come only from rows in
//   outlet_ratings, every one of which has a user_id. The house rule — no
//   ratings that aren't from a real person — is unchanged; all that moves is
//   when we ask who the person is.
//
// Storage is per-device and per-browser, and localStorage can throw outright
// (private windows, blocked site data), so every access is guarded and the
// caller must work when this returns nothing.

const KEY = 'rn_pending_ratings'

/** @returns {Record<string, number>} outlet_id -> stars */
export function readPending() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}

export function stashRating(outletId, stars) {
  if (!outletId || !stars) return
  try {
    const all = readPending()
    all[outletId] = stars
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* private window, blocked storage — the tap still shows in the UI */ }
}

export function pendingStarsFor(outletId) {
  if (!outletId) return 0
  return readPending()[outletId] || 0
}

export function pendingCount() {
  return Object.keys(readPending()).length
}

function clearPending() {
  try { localStorage.removeItem(KEY) } catch { /* nothing to do */ }
}

/**
 * Write every held rating to the database as `userId`, then clear the device.
 *
 * Runs on sign-in. Deliberately does NOT overwrite a rating the account
 * already has: someone who rated the Guardian from their laptop months ago
 * should not have it silently replaced by a tap from a phone they were logged
 * out on. The existing rating wins and the pending one is dropped.
 *
 * @returns {Promise<number>} how many ratings were actually saved
 */
export async function flushPendingRatings(db, userId) {
  const pending = readPending()
  const entries = Object.entries(pending)
  if (!entries.length || !userId) return 0

  let saved = 0
  try {
    const { data: existing } = await db
      .from('outlet_ratings')
      .select('outlet_id')
      .eq('user_id', userId)
      .in('outlet_id', entries.map(([id]) => id))
    const already = new Set((existing || []).map(r => r.outlet_id))

    for (const [outletId, stars] of entries) {
      if (already.has(outletId)) continue
      const { error } = await db
        .from('outlet_ratings')
        .insert({ outlet_id: outletId, overall_stars: stars, user_id: userId })
      if (!error) saved++
    }
  } catch {
    // Leave the pending ratings in place so the next sign-in retries them.
    return 0
  }

  clearPending()
  return saved
}
