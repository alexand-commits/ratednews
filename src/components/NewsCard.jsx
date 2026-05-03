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
  left:   { label: '← Left',   color: 'var(--blue, #3b82f6)' },
  centre: { label: '◉ Centre', color: 'var(--text3)'         },
  right:  { label: '→ Right',  color: 'var(--red)'           },
}

export default function NewsCard({ article, index, onClick, navigate }) {
  const outlet = article.outlets || {}
  const [bg, fg] = outletColor(outlet.name || 'X')
  const acc = article.accuracy_score || 0
  const bias = article.bias_direction
  const com = article.community_score || 0
  const commentCount = article.comments?.[0]?.count || 0
  const hlBadge = article.headline_vote ? HEADLINE_BADGES[article.headline_vote] : null
  const biasLabel = bias ? BIAS_LABELS[bias] : null
  const scored = acc > 0

  function handleOutletClick(e) {
    if (!navigate || !outlet.id) return
    e.stopPropagation()
    navigate('outlet', { outletId: outlet.id })
  }

  return (
    <div className="news-card" onClick={onClick}>
      <div className="news-card-thumb" style={{ background: bg, color: fg }}>
        {article.image_url
          ? <img src={article.image_url} alt="" onError={e => { e.target.style.display = 'none' }} />
          : '📰'}
      </div>
      <div className="news-card-body">
        <div className="outlet-row">
          {/* Outlet chip — coloured dot + name, links to outlet page */}
          <span className="outlet-badge" onClick={handleOutletClick}>
            <span className="outlet-dot" style={{ background: bg }} />
            {outlet.name || 'Unknown'}
          </span>
          <span className="ts">{timeAgo(article.published_at)}</span>
          {index < 2 && <span className="trending-chip">↑ Trending</span>}
        </div>

        <div className="news-headline">{article.title || 'Untitled'}</div>

        {/* Headline verdict badge — sits under headline, only shown if non-fair */}
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
          {article.category && (
            <div className="score-mini" style={{ color: 'var(--text3)' }}>
              {CATEGORY_EMOJI[article.category] || '📰'} {article.category}
            </div>
          )}
          {biasLabel && scored && (
            <div className="score-mini" style={{ color: biasLabel.color }}>{biasLabel.label}</div>
          )}
          <div className="score-mini" style={{ marginLeft: 'auto', color: 'var(--text3)' }}>
            💬 {commentCount}
          </div>
        </div>
      </div>
    </div>
  )
}
