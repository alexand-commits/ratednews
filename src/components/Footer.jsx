import React, { useState } from 'react'
import Link from 'next/link'
import LegalModal from './LegalModal'

// Global footer — legitimacy, legal access and SEO on every page.
export default function Footer() {
  const [legalDoc, setLegalDoc] = useState(null)
  const link = { color: 'var(--text3)', textDecoration: 'none', cursor: 'pointer', fontSize: 12 }
  return (
    <footer className="site-footer" style={{ borderTop: '0.5px solid var(--border)', marginTop: 32, padding: '20px 24px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 14, fontWeight: 700 }}>
          Rated<span style={{ color: 'var(--coral)' }}>News</span>
        </span>
        <Link href="/about" style={link}>About</Link>
        <Link href="/methodology" style={link}>Methodology</Link>
        <a onClick={() => setLegalDoc('privacy')} style={link}>Privacy</a>
        <a onClick={() => setLegalDoc('terms')} style={link}>Terms</a>
        <a onClick={() => setLegalDoc('guidelines')} style={link}>Guidelines</a>
        <a href="mailto:info@ratednews.com" style={link}>Contact</a>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          Trust the source, not just the story
        </span>
      </div>
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </footer>
  )
}
