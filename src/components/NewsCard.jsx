import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { articleSlug, outletColor, scoreDot, timeAgo } from '../utils/helpers'
import { toSlug } from '../utils/navigate'

const HEADLINE_BADGES = {
  misleading: { bg: '#fff3cd', color: '#856404', label: '⚠ Misleading' },
  clickbait:  { bg: '#fde8e8', color: 'var(--red)', label: '✗ Clickbait' },
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

  function handleCardClick(e) {
    // Let the <a> handle its own navigation — don't fire onClick too
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

          {hlBadge && (
            <span style={{
              display: 'inline-block', fontSize: 10, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20, marginBottom: 6,
              background: hlBadge.bg, color: hlBadge.color,
              alignSelf: 'flex-start',
            }}>
              {hlBadge.label}
            </span>
          )}

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
        {commentCount >= 10 && <span className="trending-chip">💬 Discussed</span>}
        {scored ? (
          <>
            <span className={accBadgeClass(acc)}>✦ {acc}</span>
            {(article.bias_score || 0) < 25
              ? <span className="score-badge score-badge-bias-centre">◉ Factual</span>
              : biasLabel && <span className={biasLabel.cls}>{biasLabel.label}</span>
            }
          </>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20 }}>
            ⏳ Pending analysis
          </span>
        )}
        {article.category && (
          <div className="score-mini" style={{ color: 'var(--text3)' }}>
            {article.category}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="score-mini" style={{ color: 'var(--text3)' }}>💬 {commentCount}</span>
        </div>
      </div>
    </div>
  )
}
