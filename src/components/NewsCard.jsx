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
  const [showAngles, setShowAngles] = useState(false)

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
    if (e.target.closest('[data-angles]')) return
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
        {commentCount > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="score-mini" style={{ color: 'var(--text3)' }}>
              💬 {commentCount}
            </span>
          </div>
        )}
      </div>

      {/* Multi-angle toggle — only shown when 2+ outlets cover same story */}
      {hasAngles && (
        <div
          data-angles="true"
          style={{ borderTop: '0.5px solid var(--border)', marginTop: 8, paddingTop: 4 }}
        >
          {/* Full-width tap target for mobile */}
          <div
            role="button"
            onClick={e => { e.stopPropagation(); setShowAngles(v => !v) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              minHeight: 44, padding: '4px 0',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13 }}>📰</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: showAngles ? 'var(--coral)' : 'var(--text3)',
              transition: 'color 0.15s',
            }}>
              {allAngles.length} outlets covering this
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
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)' }}>
              {showAngles ? '▲' : '▼'}
            </span>
          </div>

          {showAngles && (
            <div style={{ marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allAngles.map(a => {
                const o      = a.outlets || {}
                const [oBg]  = outletColor(o.name || 'X')
                const oBias  = BIAS_DOTS[o.bias_direction]
                const oAcc   = a.accuracy_score || 0
                const oSlug  = articleSlug(a.title, a.id)
                const isPrimary = a.id === article.id
                return (
                  <Link
                    key={a.id}
                    href={`/article/${oSlug}`}
                    style={{ textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', minHeight: 44,
                      background: isPrimary ? 'var(--bg2)' : 'var(--surface)',
                      border: `0.5px solid ${isPrimary ? 'var(--coral)' : 'var(--border)'}`,
                      borderRadius: 8,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { if (!isPrimary) e.currentTarget.style.borderColor = 'var(--coral)' }}
                    onMouseLeave={e => { if (!isPrimary) e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: oBg, flexShrink: 0 }} />

                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: 'var(--text)', flex: 1, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {o.name || 'Unknown'}
                        {isPrimary && (
                          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 5 }}>
                            (this article)
                          </span>
                        )}
                      </span>

                      {oBias && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: oBias.color, flexShrink: 0 }}>
                          {oBias.label}
                        </span>
                      )}

                      {oAcc > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, flexShrink: 0,
                          color: oAcc >= 70 ? 'var(--green)' : oAcc >= 50 ? 'var(--amber)' : 'var(--red)',
                        }}>
                          ✦{oAcc}
                        </span>
                      )}

                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>→</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
