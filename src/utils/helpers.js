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
