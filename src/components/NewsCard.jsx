import React from 'react'
import { outletColor, scoreDot, timeAgo } from '../utils/helpers'

const HEADLINE_BADGES = {
  misleading: { bg: '#fff3cd', color: '#856404', label: '⚠ Misleading' },
  clickbait:  { bg: '#fde8e8', color: 'var(--red)', label: '✗ Clickbait' },
}

const CATEGORY_EMOJI = {
  Politics: '🏛', Business: '📈', Sport: '⚽', Tech: '💻',
  Science: '🔬', Health: '🏥', Environment: '🌱', Entertainment: '🎬',
  Crime: '⚖️', Travel: '✈️', Education: '🎓', World: '🌍',
}

const BIAS_LABELS = {
  left:   { label: '← Left',   cls: 'score-badge score-badge-bias-left'   },
  centre: { label: '◉ Centre', cls: 'score-badge score-badge-bias-centre' },
  right:  { label: '→ Right',  cls: 'score-badge score-badge-bias-right'  },
}

function accBadgeClass(score) {
  if (score >= 70) return 'score-badge score-badge-green'
  if (score >= 50) return 'score-badge score-badge-amber'
  return 'score-badge score-badge-red'
}

export default function NewsCard({ article, index, onClick, navigate }) {
  const outlet = article.outlets || {}
  const [bg] = outletColor(outlet.name || 'X')
  const acc       = article.accuracy_score || 0
  const bias      = article.bias_direction
  const commentCount = article.comments?.[0]?.count || 0
  const hlBadge   = article.headline_vote ? HEADLINE_BADGES[article.headline_vote] : null
  const biasLabel = bias ? BIAS_LABELS[bias] : null
  const scored    = acc > 0

  function handleOutletClick(e) {
    if (!navigate || !outlet.id) return
    e.stopPropagation()
    navigate('outlet', { outletId: outlet.id })
  }

  return (
    <div className="news-card" onClick={onClick}>
      <div className="outlet-row">
        <span className="outlet-badge" onClick={handleOutletClick}>
          <span className="outlet-dot" style={{ background: bg }} />
          {outlet.name || 'Unknown'}
        </span>
        <span className="ts">{timeAgo(article.published_at)}</span>
      </div>

      <div className="news-headline">{article.title || 'Untitled'}</div>

      {hlBadge && (
        <span style={{
          display: 'inline-block', fontSize: 10, fontWeight: 600,
          padding: '2px 8px', borderRadius: 20, marginBottom: 6,
          background: hlBadge.bg, color: hlBadge.color,
        }}>
          {hlBadge.label}
        </span>
      )}

      {article.ai_summary
        ? <div className="news-summary" style={{ fontStyle: 'italic', color: 'var(--text2)' }}>{article.ai_summary}</div>
        : article.summary && <div className="news-summary">{article.summary}</div>
      }

      <div className="score-row">
        {index < 2 && <span className="trending-chip">↑ Trending</span>}
        {scored && (
          <span className={accBadgeClass(acc)}>✦ {acc}</span>
        )}
        {biasLabel && scored && (
          <span className={biasLabel.cls}>{biasLabel.label}</span>
        )}
        {article.category && (
          <div className="score-mini" style={{ color: 'var(--text3)' }}>
            {CATEGORY_EMOJI[article.category] || '📰'} {article.category}
          </div>
        )}
        <div className="score-mini" style={{ marginLeft: 'auto', color: 'var(--text3)' }}>
          💬 {commentCount}
        </div>
      </div>
    </div>
  )
}
