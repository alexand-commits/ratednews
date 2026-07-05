import Head from 'next/head'
import Link from 'next/link'

// Note: pages/500.jsx cannot use hooks or context (Next.js renders it
// outside the normal app shell during server errors) — use plain HTML/CSS only
export default function ServerError() {
  return (
    <>
      <Head>
        <title>Something went wrong — RatedNews</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '0 24px',
        background: 'var(--bg, #201E1C)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>

          {/* Big muted number */}
          <div style={{
            fontSize: 96, fontWeight: 700,
            fontFamily: 'Georgia, serif',
            color: 'rgba(255,255,255,0.1)',
            lineHeight: 1, marginBottom: 8,
          }}>
            500
          </div>

          {/* Coral accent bar */}
          <div style={{
            width: 40, height: 3,
            background: '#ef4444',
            borderRadius: 2,
            margin: '0 auto 24px',
          }} />

          <h1 style={{
            fontSize: 22, fontWeight: 600,
            fontFamily: 'Georgia, serif',
            marginBottom: 12, color: '#f9fafb',
          }}>
            Something went wrong on our end
          </h1>

          <p style={{
            fontSize: 14, color: '#9ca3af',
            lineHeight: 1.7, marginBottom: 32,
          }}>
            We're having trouble loading RatedNews right now. This is usually
            temporary — try refreshing in a moment.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 22px', fontWeight: 600,
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
            <Link href="/" style={{
              display: 'inline-block',
              padding: '10px 22px', fontSize: 14, fontWeight: 600,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, color: '#9ca3af',
              textDecoration: 'none',
            }}>
              ← Back to feed
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}
