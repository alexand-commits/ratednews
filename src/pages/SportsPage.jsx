import React, { useState } from 'react'
import Link from 'next/link'
import { articleSlug, outletColor, timeAgo } from '../utils/helpers'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

// ─── Sport detection ────────────────────────────────────────────────────────
const SPORT_KEYWORDS = {
  football: [
    'premier league','champions league','fa cup','efl cup','carabao cup',
    'bundesliga','la liga','serie a','ligue 1','eredivisie','mls',
    'world cup','euros','euro 2024','euro 2025','fifa','uefa',
    'arsenal','chelsea','manchester united','manchester city','liverpool',
    'tottenham','spurs','aston villa','newcastle','west ham','everton',
    'barcelona','real madrid','atletico','psg','juventus','inter milan',
    'ac milan','transfer window','goalkeeper','striker','wembley',
    'old trafford','anfield','stamford bridge','etihad','white hart lane',
    'soccer','footballer','football club','premier',
  ],
  f1: [
    'formula 1','formula one','f1','grand prix','gp race',
    'verstappen','hamilton','leclerc','norris','alonso','sainz',
    'russell','piastri','perez','ferrari','red bull racing',
    'mercedes amg','mclaren','aston martin f1','williams f1',
    'pole position','pit stop','qualifying session',
    'monaco gp','silverstone','monza','spa','bahrain','suzuka',
    'fia','constructors championship','drivers championship',
  ],
  rugby: [
    'rugby union','rugby league','six nations','premiership rugby',
    'rugby world cup','try scored','scrum','lineout','fly-half',
    'england rugby','wales rugby','ireland rugby','scotland rugby',
    'british lions','all blacks','springboks','wallabies',
    'saracens','bath rugby','harlequins','exeter chiefs','leinster',
    'munster','ulster','clermont','toulouse',
  ],
  tennis: [
    'tennis','wimbledon','us open tennis','french open',
    'australian open','roland garros','atp tour','wta tour',
    'djokovic','alcaraz','sinner','swiatek','medvedev',
    'rublev','zverev','gauff','sabalenka','nadal','federer',
    'serve','ace','break point','deuce','grand slam tennis',
    'tie break','clay court','grass court',
  ],
  cricket: [
    'cricket','test match','ashes','ipl','indian premier league',
    't20','one day international','odi','wicket','innings',
    'batting average','bowling figures','lord\'s cricket','headingley',
    'edgbaston','the oval','ben stokes','bazball','england cricket',
    'india cricket','australia cricket','pakistan cricket',
  ],
  golf: [
    'golf','the masters','the open championship','ryder cup',
    'pga tour','lpga','us open golf','us pga championship',
    'augusta national','par','birdie','eagle','bogey',
    'rory mcilroy','jon rahm','scottie scheffler','tiger woods',
    'hole-in-one','course record','links golf',
  ],
}

export function detectSportType(article) {
  const text = `${article.title || ''} ${article.ai_summary || ''}`.toLowerCase()
  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return sport
  }
  return null
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SPORT_FILTERS = [
  { value: 'all',      label: 'All Sports' },
  { value: 'football', label: '⚽ Football' },
  { value: 'f1',       label: '🏎 F1' },
  { value: 'rugby',    label: '🏉 Rugby' },
  { value: 'tennis',   label: '🎾 Tennis' },
  { value: 'cricket',  label: '🏏 Cricket' },
  { value: 'golf',     label: '⛳ Golf' },
]

const SPORT_TAG_STYLES = {
  football: { background: '#dbeafe', color: '#1d4ed8' },
  f1:       { background: '#fee2e2', color: '#b91c1c' },
  rugby:    { background: '#fef3c7', color: '#92400e' },
  tennis:   { background: '#dcfce7', color: '#166534' },
  cricket:  { background: '#fef9c3', color: '#854d0e' },
  golf:     { background: '#f3e8ff', color: '#6b21a8' },
}

const SPORT_TAG_LABELS = {
  football: '⚽ Football',
  f1:       '🏎 F1',
  rugby:    '🏉 Rugby',
  tennis:   '🎾 Tennis',
  cricket:  '🏏 Cricket',
  golf:     '⛳ Golf',
}

function SportTag({ type }) {
  if (!type) return null
  const style = SPORT_TAG_STYLES[type] || { background: 'var(--bg2)', color: 'var(--text2)' }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      ...style,
    }}>
      {SPORT_TAG_LABELS[type] || type}
    </span>
  )
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

function ScoreBadges({ article }) {
  const acc  = article.accuracy_score || 0
  const bias = article.bias_direction
  if (!acc) return null
  return (
    <>
      <span className={accBadgeClass(acc)}>✦ {acc}</span>
      {bias && BIAS_LABELS[bias] && (
        <span className={BIAS_LABELS[bias].cls}>{BIAS_LABELS[bias].label}</span>
      )}
    </>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SportsPage({ articles, generatedAt, navigate, goBack, onRefresh }) {
  const [activeSport, setActiveSport] = useState('all')
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  const updatedMins = generatedAt
    ? Math.round((Date.now() - new Date(generatedAt)) / 60000)
    : null

  // Attach sport type to each article client-side
  const tagged = (articles || []).map(a => ({
    ...a,
    _sportType: detectSportType(a),
  }))

  const filtered = activeSport === 'all'
    ? tagged
    : tagged.filter(a => a._sportType === activeSport)

  // Count per sport for pill badges
  const counts = {}
  for (const a of tagged) {
    if (a._sportType) counts[a._sportType] = (counts[a._sportType] || 0) + 1
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="page-content" {...pullHandlers}>
        {pullIndicator}
        <div className="container" style={{ maxWidth: 680 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No sports articles yet</div>
            <div style={{ fontSize: 14, color: 'var(--text3)' }}>
              Sports coverage will appear here once our feeds are running.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hero   = filtered[0]
  const ranked = filtered.slice(1)

  return (
    <div className="page-content" {...pullHandlers}>
      {pullIndicator}
      <div className="container" style={{ maxWidth: 680 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: 26, fontWeight: 700, margin: 0,
              fontFamily: 'Playfair Display, serif', color: 'var(--text)',
            }}>
              ⚽ Sports
            </h1>
            {updatedMins !== null && (
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
                Updated {updatedMins <= 1 ? 'just now' : `${updatedMins} mins ago`}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            Accuracy-rated coverage across all major sports
          </p>
        </div>

        {/* Sport filter pills */}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          {SPORT_FILTERS.map(f => (
            <button
              key={f.value}
              className={`pill${activeSport === f.value ? ' active' : ''}`}
              onClick={() => setActiveSport(f.value)}
            >
              {f.label}
              {f.value !== 'all' && counts[f.value] > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 10, fontWeight: 700,
                  background: activeSport === f.value ? 'rgba(255,255,255,0.25)' : 'var(--bg2)',
                  color: activeSport === f.value ? '#fff' : 'var(--text3)',
                  padding: '1px 5px', borderRadius: 10,
                }}>
                  {counts[f.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No {activeSport} articles in the last 7 days.</p>
          </div>
        ) : (
          <>
            {/* Hero card */}
            {hero && (
              <>
                <div className="section-label" style={{ marginBottom: 8 }}>Top Story</div>
                <HeroCard article={hero} navigate={navigate} />
              </>
            )}

            {/* Ranked list */}
            {ranked.length > 0 && (
              <>
                <div className="section-label" style={{ margin: '20px 0 8px' }}>
                  Latest Coverage
                </div>
                <div style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}>
                  {ranked.map((a, i) => (
                    <ArticleRow
                      key={a.id}
                      article={a}
                      rank={i + 2}
                      isLast={i === ranked.length - 1}
                      navigate={navigate}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Hero card ───────────────────────────────────────────────────────────────
function HeroCard({ article, navigate }) {
  const outlet   = article.outlets || {}
  const [dotBg]  = outletColor(outlet.name || 'X')
  const slug     = articleSlug(article.title, article.id)
  const comments = article.comments?.[0]?.count || 0

  return (
    <div
      onClick={e => { if (e.target.closest('a')) return; navigate('article', { articleId: article.id, title: article.title }) }}
      className="row-hover"
      style={{
        background: 'var(--surface)', border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 20, marginBottom: 12, cursor: 'pointer',
      }}
    >
      {/* Outlet + time row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotBg, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
          {outlet.name || 'Unknown'}
        </span>
        {article._sportType && (
          <span style={{ marginLeft: 2 }}>
            <SportTag type={article._sportType} />
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
          {timeAgo(article.published_at)}
        </span>
      </div>

      {/* Headline */}
      <Link
        href={`/article/${slug}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{
          margin: '0 0 10px', fontSize: 20, fontWeight: 700, lineHeight: 1.35,
          fontFamily: "'Playfair Display', Georgia, serif", color: 'var(--text)',
        }}>
          {article.title}
        </h2>
      </Link>

      {/* Summary */}
      {article.ai_summary && (
        <p style={{
          margin: '0 0 12px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {article.ai_summary}
        </p>
      )}

      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <ScoreBadges article={article} />
        {comments > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'var(--bg)', color: 'var(--text2)',
            border: '0.5px solid var(--border)', borderRadius: 20, padding: '2px 8px',
          }}>
            💬 {comments}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Article row ─────────────────────────────────────────────────────────────
function ArticleRow({ article, rank, isLast, navigate }) {
  const outlet   = article.outlets || {}
  const [dotBg]  = outletColor(outlet.name || 'X')
  const slug     = articleSlug(article.title, article.id)
  const comments = article.comments?.[0]?.count || 0
  const acc      = article.accuracy_score || 0

  return (
    <div
      onClick={e => { if (e.target.closest('a')) return; navigate('article', { articleId: article.id, title: article.title }) }}
      className="row-hover"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px', cursor: 'pointer',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
      }}
    >
      {/* Rank */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--bg2)', color: 'var(--text3)',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
      }}>
        #{rank}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Outlet + sport tag row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotBg, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>
            {outlet.name || 'Unknown'}
          </span>
          {article._sportType && <SportTag type={article._sportType} />}
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
            {timeAgo(article.published_at)}
          </span>
        </div>

        {/* Headline */}
        <Link
          href={`/article/${slug}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text)',
            lineHeight: 1.4, marginBottom: 6,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.title}
          </div>
        </Link>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <ScoreBadges article={article} />
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

      {/* Accuracy score */}
      {acc > 0 && (
        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 36 }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: acc >= 70 ? 'var(--green-dark)' : acc >= 50 ? 'var(--amber)' : 'var(--red)',
          }}>
            {acc}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            acc
          </div>
        </div>
      )}
    </div>
  )
}
