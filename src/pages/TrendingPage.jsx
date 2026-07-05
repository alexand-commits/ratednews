import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { articleSlug, outletColor, timeAgo } from '../utils/helpers'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { computeTrendingTopics } from '../utils/topics'
import Sidebar from '../components/Sidebar'

function RankedRow({ a, rank, isLast, navigate }) {
  const [imgFailed, setImgFailed] = useState(false)
  const outlet = a.outlets || {}
  const [dotBg] = outletColor(outlet.name || 'X')
  const slug = articleSlug(a.title, a.id)
  const comments = a.comments?.[0]?.count || 0
  const hasImage = a.image_url && !imgFailed

  return (
    <div
      className="row-hover"
      onClick={() => navigate('article', { articleId: a.id, title: a.title })}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        borderBottom: !isLast ? '0.5px solid var(--border)' : 'none',
      }}
    >
      {/* Rank circle */}
      <div style={{
        width: 28, height: 28,
        background: 'var(--bg2, var(--bg))',
        color: 'var(--text3)',
        fontSize: 12, fontWeight: 700,
        borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        #{rank}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotBg, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{outlet.name || 'Unknown'}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{timeAgo(a.published_at)}</span>
        </div>
        <Link
          href={`/article/${slug}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text)',
            lineHeight: 1.4, marginBottom: 5,
          }}>
            {a.title}
          </div>
        </Link>
        {(a.summary) && (
          <div style={{
            fontSize: 12, color: 'var(--text2)', lineHeight: 1.55,
            marginBottom: 6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {a.summary}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {a.coverage > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'var(--coral)',
              background: 'rgba(216,90,48,0.08)', border: '0.5px solid rgba(216,90,48,0.25)',
              borderRadius: 20, padding: '1px 8px',
            }}>
              📰 {a.coverage + 1} outlets
            </span>
          )}
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

      {/* Thumbnail */}
      {hasImage && (
        <div style={{
          position: 'relative', width: 72, height: 72, flexShrink: 0,
          borderRadius: 8, overflow: 'hidden', background: 'var(--bg2)',
          marginTop: 2,
        }}>
          <Image
            src={a.image_url}
            alt=""
            fill
            sizes="72px"
            style={{ objectFit: 'cover' }}
            unoptimized
            onError={() => setImgFailed(true)}
          />
        </div>
      )}
    </div>
  )
}

export default function TrendingPage({ articles, generatedAt, navigate, goBack, onRefresh, outlets = [] }) {
  // Rail topics — shared engine over the trending pool; taps jump to the
  // homepage feed filtered to that topic
  const trendingTopics = useMemo(() => computeTrendingTopics(articles || []), [articles])
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
            Check back soon — trending articles from the last 24 hours will appear here.
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


  return (
    <div className="page-content" {...pullHandlers}>
    {pullIndicator}
    <div className="container" style={{ maxWidth: 1240, paddingTop: 14 }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: 'var(--text)',
            margin: 0, fontFamily: 'var(--font-playfair), serif',
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
          Most covered stories in the last 24 hours
        </p>
      </div>

      <div className="grid">
      <div>
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
          {hero.coverage > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--coral)', background: 'rgba(216,90,48,0.08)', border: '0.5px solid rgba(216,90,48,0.25)', borderRadius: 20, padding: '2px 10px' }}>
              📰 {hero.coverage + 1} outlets covering
            </span>
          )}
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
            fontFamily: 'var(--font-playfair), Georgia, serif',
            color: 'var(--text)',
          }}>
            {hero.title}
          </h2>
        </Link>

        {hero.summary && (
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
            {hero.summary}
          </p>
        )}

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
            {ranked.map((a, i) => (
              <RankedRow
                key={a.id}
                a={a}
                rank={i + 2}
                isLast={i === ranked.length - 1}
                navigate={navigate}
              />
            ))}
          </div>
        </>
      )}
      </div>

      {/* Rail — trending topics (tap → filtered feed) + top rated outlets */}
      <Sidebar
        outlets={outlets}
        navigate={navigate}
        trendingTopics={trendingTopics}
        onTopic={topic => navigate('feed', { topic })}
      />
      </div>
    </div>
    </div>
  )
}
