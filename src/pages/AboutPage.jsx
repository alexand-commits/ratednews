import React, { useState } from 'react'
import LegalModal from '../components/LegalModal'

const SCORES = [
  {
    emoji: '🎯',
    title: 'Quality Score',
    range: '0 – 100',
    color: 'var(--green)',
    desc: 'How factually reliable an article appears based on its headline and summary. Mainstream outlets with clear, well-sourced reporting typically score 70–85. Lower scores indicate potential inaccuracies, unsupported claims, or fabricated content.',
    bands: [
      { label: '80–100', color: 'var(--green)',  text: 'Highly credible' },
      { label: '60–79',  color: 'var(--amber)',  text: 'Generally reliable' },
      { label: '0–59',   color: 'var(--red)',    text: 'Use caution' },
    ],
  },
  {
    emoji: '⚖️',
    title: 'Partisan Intensity',
    range: '0 – 100',
    color: 'var(--blue)',
    desc: 'How opinionated or one-sided the writing style is — regardless of which direction it leans. A calm, fact-based article scores low even if it has a political perspective. A heated opinion piece scores high even on a neutral topic.',
    bands: [
      { label: '0–30',   color: 'var(--green)',  text: 'Objective reporting' },
      { label: '31–60',  color: 'var(--amber)',  text: 'Some framing detectable' },
      { label: '61–100', color: 'var(--red)',    text: 'Strongly opinionated' },
    ],
  },
  {
    emoji: '🧭',
    title: 'Political Lean',
    range: 'Left · Centre · Right · Factual',
    color: 'var(--purple)',
    desc: 'The political direction of an article\'s framing — left, centre, or right. This is entirely separate from partisan intensity. A left-leaning article can be calm and objective (low intensity), or heated and one-sided (high intensity). Articles with very low partisan intensity (under 25) are labelled Factual instead — indicating straightforward reporting where political framing is not meaningfully present.',
    bands: [
      { label: '← Left',    color: 'var(--blue)',  text: 'Progressive or liberal framing' },
      { label: '◉ Centre',  color: 'var(--text2)', text: 'Balanced or no clear lean' },
      { label: '→ Right',   color: 'var(--red)',   text: 'Conservative framing' },
      { label: '✓ Factual', color: 'var(--text2)', text: 'Partisan intensity too low to assign a direction — consistent with factual reporting' },
    ],
  },
  {
    emoji: '📰',
    title: 'Headline Verdict',
    range: 'Fair · Misleading · Clickbait',
    color: 'var(--amber)',
    desc: 'Whether the headline accurately represents the article content. Only non-fair verdicts are flagged — fair headlines are the expected default and aren\'t shown to reduce noise.',
    bands: [
      { label: '✓ Fair',        color: 'var(--green)', text: 'Headline matches content' },
      { label: '⚠ Misleading',  color: '#856404',      text: 'Headline implies something unsupported' },
      { label: '✗ Clickbait',   color: 'var(--red)',   text: 'Exaggeration or withheld info to drive clicks' },
    ],
  },
  {
    emoji: '⭐',
    title: 'Community Score',
    range: '1 – 5 stars',
    color: 'var(--amber)',
    desc: 'The average star rating given by RatedNews readers. A single early rating carries limited weight — influence grows as more votes arrive, reaching full weight at 20+ ratings. This protects outlets from being unfairly boosted or buried by a handful of votes.',
    bands: [],
  },
]

export default function AboutPage({ navigate, goBack }) {
  const [legalDoc, setLegalDoc] = useState(null)
  return (
    <>
    <div className="page-content">
      <div className="container" style={{ maxWidth: 720 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
            How RatedNews works
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
            Every article on RatedNews is analysed by AI and rated by the community.
            Here's what each score means and how to read them.
          </p>
        </div>

        {/* How scoring works */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>The process</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '📡', step: '1. Ingestion', desc: 'Articles are pulled hourly from RSS feeds across 112 news outlets spanning the US, UK and international press. Promotional and sponsored content is automatically filtered before analysis.' },
              { icon: '🤖', step: '2. AI analysis', desc: 'Each article is analysed by Claude (Anthropic\'s AI) for quality, partisan intensity, political lean, headline fairness, and topic category.' },
              { icon: '👥', step: '3. Community rating', desc: 'Readers can rate articles with 1–5 stars and vote on quality, bias, and headline fairness. Outlets can also be rated directly.' },
              { icon: '📊', step: '4. Outlet scoring', desc: 'Outlet scores are recalculated every hour from all scored articles in the past 90 days. Below 20 community ratings the score is pure AI; at 20+ ratings, community input is blended in at 20% weight.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{s.step}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality score weighting */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 4 }}>How the quality score is calculated</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
            An outlet's score starts as the 30-day average AI quality score across all of its articles. Once 20 or more community ratings are recorded, reader input is blended in at 20% weight.
          </p>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <div style={{ height: 6, width: '80%', background: 'var(--blue)', borderRadius: '3px 0 0 3px' }} />
              <div style={{ height: 6, width: '20%', background: 'var(--amber)', borderRadius: '0 3px 3px 0' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 16 }}>
              <span><span style={{ color: 'var(--blue)' }}>■</span> AI analysis 80%</span>
              <span><span style={{ color: 'var(--amber)' }}>■</span> Community 20% <span style={{ color: 'var(--text3)' }}>(once 20+ ratings)</span></span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
            Below the 20-rating threshold, scores are 100% AI-derived — this protects outlets from being skewed by a handful of early votes.
          </p>
        </div>

        {/* Score breakdowns */}
        <div className="section-label" style={{ marginBottom: 16 }}>Score breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SCORES.map(s => (
            <div key={s.title} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{s.emoji}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.range}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: s.bands.length ? 12 : 0 }}>
                {s.desc}
              </p>
              {s.bands.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {s.bands.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: b.color, width: 90, flexShrink: 0 }}>{b.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{b.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginTop: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Important note:</strong> AI scores are based on article headlines and summaries only — not the full article text. Scores reflect patterns in language and framing, not independent fact-checking. They are one signal among many and should be read alongside community ratings and your own judgement.
          </div>
        </div>

        {/* Methodology link */}
        <a href="/methodology" style={{ textDecoration: 'none', display: 'block', marginTop: 16 }}>
          <div style={{
            background: 'var(--surface)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'border-color 0.15s',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 2 }}>Full methodology</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>The scoring prompt, weighting formula, known limitations and changelog</div>
            </div>
            <span style={{ fontSize: 16, color: 'var(--text3)', flexShrink: 0, marginLeft: 12 }}>→</span>
          </div>
        </a>

        {/* Legal links */}
        <div style={{
          marginTop: 32,
          paddingTop: 20,
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>© {new Date().getFullYear()} RatedNews</span>
          {[
            { label: 'Privacy Policy',       doc: 'privacy'    },
            { label: 'Terms of Service',     doc: 'terms'      },
            { label: 'Community Guidelines', doc: 'guidelines' },
          ].map(({ label, doc }) => (
            <button
              key={doc}
              onClick={() => setLegalDoc(doc)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: 12, color: 'var(--text2)', cursor: 'pointer',
                fontFamily: 'inherit', textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>

    {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </>
  )
}
