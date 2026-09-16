import React from 'react'

// A legal document as a full page, not a modal. Renders the same content the
// footer modal shows — see src/content/legal.js for why that is shared rather
// than duplicated.
//
// Deliberately plain: this exists to be read by a person looking for a specific
// clause, and to be found by a crawler. No cards, no accent rails.
//
// **bold** is the only markup the source uses, so that is all this renders.
function inline(text, key) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1
      ? <strong key={`${key}-${i}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{part}</strong>
      : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
  )
}

export default function LegalDoc({ doc }) {
  if (!doc) return null
  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 56 }}>
        <h1 style={{
          fontFamily: 'var(--font-playfair), serif', fontSize: 32, fontWeight: 700,
          lineHeight: 1.2, marginBottom: 6,
        }}>
          {doc.title}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 30 }}>
          Last updated {doc.updated}
        </p>

        {doc.sections.map((s, i) => (
          <section key={i} style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text)',
              fontFamily: 'var(--font-lato), sans-serif',
            }}>
              {s.heading}
            </h2>
            {s.body.split('\n').filter(Boolean).map((line, j) => {
              const bullet = line.trimStart().startsWith('•')
              return (
                <p key={j} style={{
                  fontSize: 14.5, lineHeight: 1.7, color: 'var(--text2)',
                  marginBottom: 9, paddingLeft: bullet ? 14 : 0,
                }}>
                  {inline(bullet ? line.trimStart().slice(1).trim() : line, `${i}-${j}`)}
                </p>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
