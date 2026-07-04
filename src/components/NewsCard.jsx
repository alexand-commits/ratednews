import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { articleSlug, outletColor, scoreDot, timeAgo } from '../utils/helpers'
import { toSlug } from '../utils/navigate'
import RatingDots from './RatingDots'


export default function NewsCard({ article, index, onClick, navigate, relatedArticles = [] }) {
  const [imgFailed, setImgFailed] = useState(false)

  const outlet = article.outlets || {}
  const [bg] = outletColor(outlet.name || 'X')
  const hasImage = article.image_url && !imgFailed
  const com      = article.community_score || 0
  const ratings  = article.total_ratings || 0
  const slug     = articleSlug(article.title, article.id)

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

          {article.summary && <div className="news-summary">{article.summary}</div>}
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
              unoptimized
              onError={() => setImgFailed(true)}
            />
          </div>
        )}
      </div>

      {(article.category || com > 0 || ratings > 0) && (
        <div className="score-row">
          {article.category && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              {article.category}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {com > 0 ? (
              <RatingDots value={com / 20} size={7} valueSize={11} />
            ) : ratings > 0 ? (
              <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20 }}>
                {ratings} {ratings === 1 ? 'rating' : 'ratings'}
              </span>
            ) : null}
          </div>
        </div>
      )}

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
<span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>→</span>
          </div>
        </Link>
      )}
    </div>
  )
}
