import React, { useState } from 'react'
import LegalModal from '../components/LegalModal'

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
            RatedNews is a community-powered news aggregator. We pull articles from 50+ outlets and let readers rate what they read.
            Every score you see comes from the community — no AI scoring.
          </p>
        </div>

        {/* How it works */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>The process</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '📡', step: '1. Ingestion', desc: 'Articles are pulled from RSS feeds across 50+ news outlets spanning the US, UK and international press.' },
              { icon: '👥', step: '2. Community rating', desc: 'Readers can rate articles with 1–5 stars and give their view on accuracy, bias, and headline fairness. Outlets can also be rated directly.' },
              { icon: '📊', step: '3. Outlet scoring', desc: 'Outlet scores are the average star rating across all reader ratings, expressed out of 100. The rating count is always shown so you can judge the sample size.' },
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

        {/* Score breakdown */}
        <div className="section-label" style={{ marginBottom: 16 }}>Score breakdown</div>
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>⭐</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Community Score</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>1 – 5 stars</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
            The average star rating given by RatedNews readers, expressed out of 100 (5 stars = 100). The rating count is always displayed — a score from 3 ratings is far less reliable than one from 300.
          </p>
        </div>

        {/* Disclaimer */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Note:</strong> Community scores reflect reader perception, not independently verified fact. "Accurate" means the reader found the article credible based on what they know. Treat scores as collective signals, not verdicts.
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
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>How ratings work, known limitations, and changelog</div>
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
