import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useAppContext } from '../_app'

/**
 * World Cup 2026 — scores & fixtures.
 * Data: TheSportsDB free tier, per-day endpoint (league 4429). ISR regenerates
 * at most once a minute regardless of traffic, so the free rate limit is never
 * stressed; the client re-polls today's fixtures every 60s while a match is live.
 */

const LEAGUE = 4429
const API = d => `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&l=${LEAGUE}`
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BREAK', 'P', 'LIVE'])
const DONE_STATUSES = new Set(['FT', 'AET', 'PEN', 'AP'])

const ROUND_LABELS = {
  1: 'Group stage · Matchday 1',
  2: 'Group stage · Matchday 2',
  3: 'Group stage · Matchday 3',
  16: 'Round of 16',
  125: 'Quarter-finals',
  150: 'Semi-finals',
  160: 'Third-place play-off',
  170: 'Final',
}

function dayString(offset) {
  const d = new Date(Date.now() + offset * 86400000)
  return d.toISOString().slice(0, 10)
}

function KickoffTime({ ts, fallback }) {
  // TheSportsDB timestamps are UTC without a zone marker — format in the
  // reader's locale after mount to avoid a hydration mismatch.
  const [label, setLabel] = useState(fallback)
  useEffect(() => {
    try {
      const d = new Date(ts + 'Z')
      if (!isNaN(d)) setLabel(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch {}
  }, [ts])
  return <span suppressHydrationWarning>{label}</span>
}

function MatchRow({ m }) {
  const live = LIVE_STATUSES.has(m.strStatus)
  const done = DONE_STATUSES.has(m.strStatus)
  const hasScore = m.intHomeScore !== null && m.intHomeScore !== undefined && m.intHomeScore !== ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
      {/* Status / time */}
      <div style={{ width: 58, flexShrink: 0, textAlign: 'center' }}>
        {live ? (
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', background: 'var(--coral)', borderRadius: 20, padding: '3px 9px' }}>
            {m.strStatus === 'HT' ? 'HT' : 'LIVE'}
          </span>
        ) : done ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{m.strStatus}</span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
            <KickoffTime ts={m.strTimestamp} fallback={(m.strTime || '').slice(0, 5)} />
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { name: m.strHomeTeam, badge: m.strHomeTeamBadge, score: m.intHomeScore, win: hasScore && Number(m.intHomeScore) > Number(m.intAwayScore) },
          { name: m.strAwayTeam, badge: m.strAwayTeamBadge, score: m.intAwayScore, win: hasScore && Number(m.intAwayScore) > Number(m.intHomeScore) },
        ].map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {t.badge && <img src={t.badge} alt="" width={18} height={18} style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: 14, fontWeight: done && !t.win ? 400 : 600, color: done && !t.win ? 'var(--text2)' : 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.name}
            </span>
            {(live || done) && hasScore && (
              <span style={{ fontSize: 15, fontWeight: 700, color: live ? 'var(--coral)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {t.score}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Round + venue */}
      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)' }}>
          {ROUND_LABELS[m.intRound] || `Round ${m.intRound}`}
        </span>
        {m.strVenue && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{m.strVenue}</span>}
      </div>
    </div>
  )
}

export default function Scores({ days, generatedAt }) {
  const { goBack } = useAppContext()
  const [liveDays, setLiveDays] = useState(days)

  // Re-poll today (and tomorrow, for matches spanning midnight UTC) every 60s
  // while any match is live or scheduled today — keeps scores moving without
  // waiting on ISR.
  useEffect(() => {
    const todayIdx = liveDays.findIndex(d => d.isToday)
    if (todayIdx === -1) return
    const anyActionToday = liveDays[todayIdx].events.some(e => !DONE_STATUSES.has(e.strStatus))
    if (!anyActionToday) return
    const id = setInterval(async () => {
      try {
        const targets = [liveDays[todayIdx], liveDays[todayIdx + 1]].filter(Boolean)
        const updates = await Promise.all(targets.map(t =>
          fetch(API(t.date)).then(r => r.json()).then(j => ({ date: t.date, events: j.events || [] }))
        ))
        setLiveDays(prev => prev.map(d => {
          const u = updates.find(x => x.date === d.date)
          return u && u.events.length ? { ...d, events: u.events } : d
        }))
      } catch {}
    }, 60000)
    return () => clearInterval(id)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const visible = liveDays.filter(d => d.events.length > 0)

  return (
    <>
      <Head>
        <title>World Cup 2026 Scores &amp; Fixtures — RatedNews</title>
        <meta name="description" content="FIFA World Cup 2026 live scores, results and upcoming fixtures — alongside community-rated coverage from 200+ outlets." />
        <link rel="canonical" href="https://www.ratednews.com/sports/scores" />
      </Head>
      <div className="page-content">
        <div className="container" style={{ maxWidth: 760, paddingTop: 14 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
              🏆 World Cup 2026
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
              Scores &amp; fixtures · times shown in your local timezone
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state"><p>No fixtures in this window — check back soon.</p></div>
          ) : visible.map(day => (
            <div key={day.date} style={{ marginBottom: 22 }}>
              <div className="section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                {day.label}
                {day.isToday && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)', border: '1px solid var(--coral)', borderRadius: 20, padding: '1px 8px' }}>TODAY</span>}
              </div>
              <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {day.events.map(m => <MatchRow key={m.idEvent} m={m} />)}
              </div>
            </div>
          ))}

          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            Scores update every minute during matches. Data via TheSportsDB.
          </p>
        </div>
      </div>
    </>
  )
}

export async function getStaticProps() {
  const offsets = [-3, -2, -1, 0, 1, 2, 3, 4, 5]
  const today = dayString(0)
  try {
    const days = await Promise.all(offsets.map(async off => {
      const date = dayString(off)
      let events = []
      try {
        const res = await fetch(API(date))
        const json = await res.json()
        events = json.events || []
      } catch {}
      const d = new Date(date + 'T12:00:00Z')
      return {
        date,
        isToday: date === today,
        label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
        events,
      }
    }))
    return { props: { days, generatedAt: new Date().toISOString() }, revalidate: 60 }
  } catch {
    return { props: { days: [], generatedAt: new Date().toISOString() }, revalidate: 300 }
  }
}
