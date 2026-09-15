export function scoreColor(s) {
  return s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--amber)' : 'var(--red)'
}

export function scoreDot(s) {
  return s >= 80 ? 'dot-g' : s >= 60 ? 'dot-a' : 'dot-r'
}

export function outletInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

export function outletColor(name) {
  const colors = [
    ['#E6F1FB', '#185FA5'],
    ['#FAECE7', '#993C1D'],
    ['#EAF3DE', '#3B6D11'],
    ['#EEEDFE', '#534AB7'],
    ['#FAEEDA', '#854F0B'],
    ['#E1F5EE', '#0F6E56'],
    ['#FBEAF0', '#993556'],
  ]
  const idx = (name || 'X').charCodeAt(0) % colors.length
  return colors[idx]
}

// Generates a human-readable, SEO-friendly URL slug for an article.
// Format: "{title-words}-{uuid}"
// e.g. "trump-signs-tariff-order-4f3ff8a6-4730-4e86-a7aa-9d493f4dfa71"
// The UUID at the end lets getStaticProps do an exact DB lookup without
// needing a separate slug column.
export function articleSlug(title, id) {
  const t = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
  // Use only the first 8 hex chars of the UUID (the part before the first dash).
  // 16^8 = 4 billion possibilities → collision-free at 10k articles.
  const shortId = String(id).slice(0, 8)
  return t ? `${t}-${shortId}` : shortId
}

export function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 0) return 'just now'          // future-dated articles (clock skew / scheduled posts)
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + ' mins ago'
  if (diff < 86400) return Math.floor(diff / 3600) + ' hrs ago'
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' days ago'
  return Math.floor(diff / (86400 * 30)) + ' months ago'
}

// Minimum community ratings before an outlet holds a ranked position.
// Below this, scores render as provisional — a 5.0 from one rating is noise,
// and ranking on it undermines the whole trust proposition.
export const MIN_RANK_RATINGS = 3
export function isRankEligible(o) {
  return (o?.total_ratings || 0) >= MIN_RANK_RATINGS && (o?.community_score || 0) > 0
}

/**
 * Merge section feeds into their parent brand for ranking purposes.
 *
 * Sky Sports carries parent_outlet_id -> Sky News, and both hold their own
 * community_score. On 2026-09-15 that put Sky Sports at #1 in the rankings,
 * ABOVE its own parent — one publisher holding two competing trust scores,
 * with a section feed beating the brand it belongs to.
 *
 * Excluding children outright would be worse: Sky Sports had 3 ratings and Sky
 * News 2, so dropping the child takes the parent under MIN_RANK_RATINGS and
 * Sky disappears from the rankings altogether despite five real ratings from
 * five real people.
 *
 * So: fold each child's ratings into its parent and weight the score by rating
 * count, which is what a reader means when they say they trust Sky. A child
 * whose parent isn't in the list stands alone rather than being silently
 * dropped.
 */
export function rollUpOutlets(outlets = []) {
  const byId = new Map(outlets.map(o => [o.id, o]))
  const merged = new Map()

  for (const o of outlets) {
    const parent = o.parent_outlet_id && byId.get(o.parent_outlet_id)
    const target = parent || o
    const acc = merged.get(target.id) || { ...target, total_ratings: 0, _weighted: 0 }
    const n = o.total_ratings || 0
    acc.total_ratings += n
    acc._weighted += (o.community_score || 0) * n
    merged.set(target.id, acc)
  }

  return [...merged.values()].map(({ _weighted, ...o }) => ({
    ...o,
    community_score: o.total_ratings > 0 ? _weighted / o.total_ratings : (o.community_score || 0),
  }))
}
