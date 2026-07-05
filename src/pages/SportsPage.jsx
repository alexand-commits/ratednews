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
    'augusta national','birdie','bogey',
    'rory mcilroy','jon rahm','scottie scheffler','tiger woods',
    'hole-in-one','links golf',
  ],
  nfl: [
    'nfl','american football','super bowl','quarterback','touchdown',
    'kansas city chiefs','dallas cowboys','san francisco 49ers','philadelphia eagles',
    'buffalo bills','patrick mahomes','tom brady','end zone','gridiron',
  ],
  nba: [
    'nba','basketball','playoffs','lakers','boston celtics','golden state warriors',
    'lebron james','steph curry','slam dunk','three-pointer','march madness',
    'denver nuggets','milwaukee bucks',
  ],
  mlb: [
    'mlb','baseball','world series','new york yankees','los angeles dodgers',
    'home run','pitcher','shohei ohtani','strikeout','grand slam baseball','innings pitched',
  ],
  boxing: [
    'boxing','heavyweight','title fight','knockout','undisputed','ufc','mma',
    'welterweight','middleweight','anthony joshua','tyson fury','octagon','featherweight',
  ],
  cycling: [
    'cycling','tour de france','giro d\'italia','vuelta','peloton','road race',
    'time trial','yellow jersey','tadej pogacar','grand tour cycling',
  ],
}

export function detectSportType(article) {
  const text = `${article.title || ''} ${article.summary || ''}`.toLowerCase()
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
  { value: 'nfl',      label: '🏈 NFL' },
  { value: 'nba',      label: '🏀 Basketball' },
  { value: 'mlb',      label: '⚾ Baseball' },
  { value: 'rugby',    label: '🏉 Rugby' },
  { value: 'tennis',   label: '🎾 Tennis' },
  { value: 'cricket',  label: '🏏 Cricket' },
  { value: 'golf',     label: '⛳ Golf' },
  { value: 'boxing',   label: '🥊 Boxing/MMA' },
  { value: 'cycling',  label: '🚴 Cycling' },
]

const SORTS = [
  { value: 'trending', label: 'Top stories' },
  { value: 'latest',   label: 'Latest' },
]

// ─── Main component ──────────────────────────────────────────────────────────
export default function SportsPage({ articles, generatedAt, navigate, goBack, onRefresh }) {
  const [activeSport, setActiveSport] = useState('all')
  const [sort, setSort]               = useState('trending')
  const { indicator: pullIndicator, handlers: pullHandlers } = usePullToRefresh(onRefresh)

  const updatedMins = generatedAt
    ? Math.round((Date.now() - new Date(generatedAt)) / 60000)
    : null

  // Attach sport type to each article client-side
  const tagged = (articles || []).map(a => ({ ...a, _sportType: detectSportType(a) }))

  const bySport = activeSport === 'all'
    ? tagged
    : tagged.filter(a => a._sportType === activeSport)

  // Same sorts as the homepage feed. 'Top stories' uses the shared trend
  // formula (keep in sync with FeedPage / pages/index.jsx) + cluster dedup;
  // 'Latest' is pure chronology.
  let filtered
  if (sort === 'trending') {
    const trendScore = a => {
      const coverage  = a.cluster_peers?.length || 0
      const comments  = a.comments?.[0]?.count || 0
      const hoursAgo  = Math.max(0.1, (Date.now() - new Date(a.published_at)) / 3600000)
      return (coverage * 12 + comments * 5 + 1) / Math.pow(hoursAgo + 2, 1.8)
    }
    const seen = new Set()
    filtered = bySport
      .slice()
      .sort((a, b) => trendScore(b) - trendScore(a))
      .filter(a => {
        if (!a.cluster_id) return true
        if (seen.has(a.cluster_id)) return false
        seen.add(a.cluster_id)
        return true
      })
  } else {
    filtered = bySport.slice().sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
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
              fontFamily: 'var(--font-playfair), serif', color: 'var(--text)',
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
            Quality-rated coverage across all major sports
          </p>
        </div>

        {/* Sort — Top stories / Latest, mirroring the homepage feed */}
        <div className="filter-bar" style={{ marginBottom: 8 }}>
          {SORTS.map(s => (
            <button
              key={s.value}
              className={`pill${sort === s.value ? ' active' : ''}`}
              onClick={() => setSort(s.value)}
            >
              {s.label}
            </button>
          ))}
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
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No {activeSport} stories available yet.</p>
          </div>
        ) : (
          <div className="feed">
            {filtered.map((a, i) => (
              <NewsCard
                key={a.id}
                article={a}
                index={i}
                onClick={() => navigate('article', { articleId: a.id, title: a.title })}
                navigate={navigate}
                relatedArticles={a.cluster_peers || []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
