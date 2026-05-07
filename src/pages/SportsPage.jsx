import React, { useState } from 'react'
import NewsCard from '../components/NewsCard'
import { timeAgo } from '../utils/helpers'
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

// ─── Story clustering ────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','are','was',
  'were','says','say','said','after','as','with','by','from','over','into',
  'its','it','his','her','their','our','how','why','what','who','when','will',
  'have','has','had','been','be','but','not','this','that','than','then',
  'report','reports','breaking','watch','exclusive','just','now','new',
])

function titleTokens(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function titlesMatch(a, b) {
  const ta = titleTokens(a)
  const tb = new Set(titleTokens(b))
  return ta.filter(w => tb.has(w)).length >= 3
}

// Groups articles into clusters, returns one representative per cluster
// (most recent) with a _clusterCount attached. Unclustered articles keep _clusterCount = 1.
function clusterArticles(articles) {
  const WINDOW_MS = 8 * 60 * 60 * 1000 // 8 hours
  const used = new Set()
  const clusters = []

  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue
    const group = [i]
    const timeA = new Date(articles[i].published_at).getTime()

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue
      const timeB = new Date(articles[j].published_at).getTime()
      if (Math.abs(timeA - timeB) > WINDOW_MS) continue
      if (titlesMatch(articles[i].title, articles[j].title)) {
        group.push(j)
      }
    }

    group.forEach(idx => used.add(idx))

    // Pick the most recent article as representative
    const rep = group.reduce((best, idx) =>
      new Date(articles[idx].published_at) > new Date(articles[best].published_at) ? idx : best
    , group[0])

    clusters.push({ ...articles[rep], _clusterCount: group.length })
  }

  return clusters
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

// ─── Main component ──────────────────────────────────────────────────────────
export default function SportsPage({ articles, generatedAt, navigate, goBack, onRefresh }) {
  const [activeSport, setActiveSport] = useState('all')
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  const updatedMins = generatedAt
    ? Math.round((Date.now() - new Date(generatedAt)) / 60000)
    : null

  // Attach sport type to each article client-side, sort by latest
  const tagged = (articles || [])
    .map(a => ({ ...a, _sportType: detectSportType(a) }))
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))

  const filtered = activeSport === 'all'
    ? tagged
    : tagged.filter(a => a._sportType === activeSport)

  // Cluster similar stories — deduplicate within 8hr window, surface outlet count
  const clustered = clusterArticles(filtered)

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

        {clustered.length === 0 ? (
          <div className="empty-state">
            <p>No {activeSport} stories in the last 7 days.</p>
          </div>
        ) : (
          <div className="feed">
            {clustered.map((a, i) => (
              <NewsCard
                key={a.id}
                article={a}
                index={i}
                onClick={() => navigate('article', { articleId: a.id, title: a.title })}
                navigate={navigate}
                clusterCount={a._clusterCount || 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
