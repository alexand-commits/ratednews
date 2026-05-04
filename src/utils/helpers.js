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
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
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
