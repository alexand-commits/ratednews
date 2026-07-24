import React, { useState } from 'react'
import Link from 'next/link'
import LegalModal from './LegalModal'

// Global footer — legitimacy, legal access and SEO on every page.
export default function Footer() {
  const [legalDoc, setLegalDoc] = useState(null)
  const link = { color: 'var(--text3)', textDecoration: 'none', cursor: 'pointer', fontSize: 12 }
  // Legal links open modals — they're actions, so render as buttons for keyboard/AT access.
  const linkBtn = { ...link, background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }
  return (
    <footer className="site-footer" style={{ borderTop: '0.5px solid var(--border)', marginTop: 32, padding: '20px 24px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 14, fontWeight: 700 }}>
          Rated<span style={{ color: 'var(--coral)' }}>News</span>
        </span>
        <Link href="/about" style={link}>About</Link>
        <Link href="/methodology" style={link}>Methodology</Link>
        <Link href="/most-trusted-news-sources" style={link}>Most trusted sources</Link>
        <Link href="/categories" style={link}>Categories</Link>
        <button onClick={() => setLegalDoc('privacy')} style={linkBtn}>Privacy</button>
        <button onClick={() => setLegalDoc('terms')} style={linkBtn}>Terms</button>
        <button onClick={() => setLegalDoc('guidelines')} style={linkBtn}>Guidelines</button>
        <a href="mailto:info@ratednews.com" style={link}>Contact</a>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          Rate the source.
        </span>
      </div>
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </footer>
  )
}
