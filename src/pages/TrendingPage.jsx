import React from 'react'
import Link from 'next/link'
import { articleSlug, outletColor, timeAgo } from '../utils/helpers'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

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

function ScoreBadges({ article }) {
  const acc = article.accuracy_score || 0
  const bias = article.bias_direction
  const scored = acc > 0
  const biasLabel = bias ? BIAS_LABELS[bias] : null

  if (!scored) return null
  return (
    <>
      <span className={accBadgeClass(acc)}>✦ {acc}</span>
      {biasLabel && <span className={biasLabel.cls}>{biasLabel.label}</span>}
    </>
  )
}

export default function TrendingPage({ articles, generatedAt, navigate, goBack, onRefresh }) {
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  const updatedMins = generatedAt
    ? Math.round((Date.now() - new Date(generatedAt)) / 60000)
    : null

  if (!articles || articles.length === 0) {
    return (
      <div className="page-content" {...pullHandlers}>
        {pullIndicator}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔥</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Nothing trending yet
          </div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>
            Check back soon — trending articles from the last 48 hours will appear here.
          </div>
        </div>
      </div>
    )
  }

  const hero = articles[0]
  const ranked = articles.slice(1)
  const heroOutlet = hero.outlets || {}
  const [heroBg] = outletColor(heroOutlet.name || 'X')
  const heroSlug = articleSlug(hero.title, hero.id)
  const heroComments = hero.comments?.[0]?.count || 0

  return (
    <div className="page-content" {...pullHandlers}>
    {pullIndicator}
    <div className="container" style={{ maxWidth: 680 }}>
      <button className="back-btn" onClick={goBack}>← Back</button>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: 'var(--text)',
            margin: 0, fontFamily: 'Playfair Display, serif',
          }}>
            🔥 Trending
          </h1>
          {updatedMins !== null && (
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
              Updated {updatedMins <= 1 ? 'just now' : `${updatedMins} mins ago`}
            </span>
          )}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Most discussed in the last 48 hours
        </p>
      </div>

      {/* Hero card */}
      <div
        onClick={() => navigate('article', { articleId: hero.id, title: hero.title })}
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 20,
          marginBottom: 12,
          cursor: 'pointer',
        }}
        className="row-hover"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: heroBg, flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
            {heroOutlet.name || 'Unknown'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
            {timeAgo(hero.published_at)}
          </span>
        </div>

        <Link
          href={`/article/${heroSlug}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
          onClick={e => e.stopPropagation()}
        >
          <h2 style={{
            margin: '0 0 10px',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.35,
            fontFamily: "'Playfair Display', Georgia, serif",
            color: 'var(--text)',
          }}>
            {hero.title}
          </h2>
        </Link>

        {hero.ai_summary && (
          <p style={{
            margin: '0 0 12px',
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {hero.ai_summary}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ScoreBadges article={hero} />
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'var(--bg)', color: 'var(--text2)',
            border: '0.5px solid var(--border)',
            borderRadius: 20, padding: '2px 8px',
          }}>
            💬 {heroComments} discussing
          </span>
        </div>
      </div>

      {/* Ranked list */}
      {ranked.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 8 }}>
            🔥 Most discussed
          </div>
          <div style={{
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {ranked.map((a, i) => {
              const outlet = a.outlets || {}
              const [dotBg] = outletColor(outlet.name || 'X')
              const slug = articleSlug(a.title, a.id)
              const comments = a.comments?.[0]?.count || 0

              return (
                <div
                  key={a.id}
                  onClick={() => navigate('article', { articleId: a.id, title: a.title })}
                  className="row-hover"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < ranked.length - 1 ? '0.5px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {/* Rank circle */}
                  <div style={{
                    width: 28, height: 28,
                    background: 'var(--bg2, var(--bg))',
                    color: 'var(--text3)',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}>
                    #{i + 2}
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: dotBg, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>
                        {outlet.name || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                        {timeAgo(a.published_at)}
                      </span>
                    </div>
                    <Link
                      href={`/article/${slug}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: 6,
                      }}>
                        {a.title}
                      </div>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <ScoreBadges article={a} />
                      {comments > 0 && (
                        <span style={{
                          fontSize: 10, color: 'var(--text3)',
                          background: 'var(--bg)', border: '0.5px solid var(--border)',
                          borderRadius: 20, padding: '1px 6px',
                        }}>
                          💬 {comments}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
    </div>
  )
}
