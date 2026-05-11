import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { articleSlug, outletColor, scoreDot, timeAgo } from '../utils/helpers'
import { toSlug } from '../utils/navigate'

const HEADLINE_BADGES = {
  misleading: { bg: '#fff3cd', color: '#856404', label: '⚠ Misleading headline' },
  clickbait:  { bg: '#fde8e8', color: 'var(--red)', label: '✗ Clickbait headline' },
}

const BIAS_LABELS = {
  left:   { label: '← Left',   cls: 'score-badge score-badge-bias-left'   },
  centre: { label: '◉ Centre', cls: 'score-badge score-badge-bias-centre' },
  right:  { label: '→ Right',  cls: 'score-badge score-badge-bias-right'  },
}

// Compact dot colours for the angles list
const BIAS_DOTS = {
  left:   { color: '#4a90d9', label: 'Left'   },
  centre: { color: '#5cb85c', label: 'Centre' },
  right:  { color: '#d9534f', label: 'Right'  },
}

function accBadgeClass(score) {
  if (score >= 70) return 'score-badge score-badge-green'
  if (score >= 50) return 'score-badge score-badge-amber'
  return 'score-badge score-badge-red'
}

export default function NewsCard({ article, index, onClick, navigate, relatedArticles = [] }) {
  const [imgFailed, setImgFailed] = useState(false)

  const outlet = article.outlets || {}
  const [bg] = outletColor(outlet.name || 'X')
  const hasImage = article.image_url && !imgFailed
  const acc       = article.accuracy_score || 0
  const bias      = article.bias_direction
  const commentCount = article.comments?.[0]?.count || 0
  const hlBadge   = article.headline_vote ? HEADLINE_BADGES[article.headline_vote] : null
  const biasLabel = bias ? BIAS_LABELS[bias] : null
  const scored    = acc > 0
  const slug      = articleSlug(article.title, article.id)

  const hasAngles = relatedArticles.length > 0
  // All articles in this cluster (primary + related), deduped by outlet
  const allAngles = hasAngles
    ? [article, ...relatedArticles].filter((a, i, arr) =>
        arr.findIndex(x => x.outlet_id === a.outlet_id) === i
      )
    : []

  function handleCardClick(e) {
    if (e.target.closest('a')) return
    onClick?.(e)
  }

  const outletSlug = outlet.name ? toSlug(outlet.name) : null

  return (
    <div className="news-card" onClick={handleCardClick}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="outlet-row">
            {outletSlug ? (
              <Link href={`/outlet/${outletSlug}`} className="outlet-badge" style={{ textDecoration: 'none' }}>
                <span className="outlet-dot" style={{ background: bg }} />
                {outlet.name || 'Unknown'}
              </Link>
            ) : (
              <span className="outlet-badge">
                <span className="outlet-dot" style={{ background: bg }} />
                {outlet.name || 'Unknown'}
              </span>
            )}
            <span className="ts">{timeAgo(article.published_at)}</span>
          </div>

          <Link href={`/article/${slug}`} className="news-headline" style={{ textDecoration: 'none', color: 'inherit' }}>
            {article.title || 'Untitled'}
          </Link>

          {article.ai_summary
            ? <div className="news-summary">{article.ai_summary}</div>
            : article.summary && <div className="news-summary">{article.summary}</div>
          }
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <div style={{
            position: 'relative',
            width: 80, height: 80, flexShrink: 0,
            borderRadius: 8, overflow: 'hidden',
            background: 'var(--bg2)',
          }}>
            <Image
              src={article.image_url}
              alt={article.title}
              fill
              sizes="80px"
              style={{ objectFit: 'cover' }}
              priority={index < 2}
              onError={() => setImgFailed(true)}
            />
          </div>
        )}
      </div>

      <div className="score-row">
        {scored ? (
          <>
            {/* Credibility score — coloured pill, outlet-reputation gate on red */}
            {!(acc < 50 && (outlet.accuracy_score || 0) >= 65) && (
              <span className={accBadgeClass(acc)}>✦ {acc}</span>
            )}

            {/* Bias — original pill */}
            {(article.bias_score || 0) < 25
              ? <span className="score-badge score-badge-bias-centre">✓ Factual</span>
              : biasLabel && <span className={biasLabel.cls}>{biasLabel.label}</span>
            }

            {/* Headline vote — only shown when not fair */}
            {hlBadge && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                background: hlBadge.bg, color: hlBadge.color,
              }}>
                {hlBadge.label}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20 }}>
            ⏳ Pending analysis
          </span>
        )}

        {/* Category + comment count pushed right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {article.category && (
            <span className="score-mini" style={{ color: 'var(--text3)' }}>{article.category}</span>
          )}
          {commentCount > 0 && (
            <span className="score-mini" style={{ color: 'var(--text3)' }}>💬 {commentCount}</span>
          )}
          {commentCount >= 3 && (
            <span className="trending-chip">🔥 Hot</span>
          )}
        </div>
      </div>

      {/* Multi-outlet chip — taps through to article page where full coverage lives */}
      {hasAngles && (
        <Link
          href={`/article/${slug}`}
          style={{ textDecoration: 'none' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            borderTop: '1px solid var(--divider)',
            marginTop: 8,
            display: 'flex', alignItems: 'center', gap: 6,
            minHeight: 44, padding: '10px 0 4px',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 13 }}>📰</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>
              Also covered by {relatedArticles.length} other outlet{relatedArticles.length !== 1 ? 's' : ''}
            </span>
            {/* Bias dot preview */}
            <span style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
              {allAngles.map(a => {
                const dot = BIAS_DOTS[a.outlets?.bias_direction]
                return dot ? (
                  <span key={a.id} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: dot.color, display: 'inline-block', flexShrink: 0,
                  }} title={dot.label} />
                ) : null
              })}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>→</span>
          </div>
        </Link>
      )}
    </div>
  )
}
