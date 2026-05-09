import Head from 'next/head'
import { useAppContext } from './_app'

export default function NotFound() {
  const { navigate } = useAppContext()

  return (
    <>
      <Head>
        <title>Page not found — RatedNews</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>

          {/* Big muted number */}
          <div style={{
            fontSize: 96,
            fontWeight: 700,
            fontFamily: 'var(--font-playfair), serif',
            color: 'var(--border)',
            lineHeight: 1,
            marginBottom: 8,
          }}>
            404
          </div>

          {/* Coral accent bar */}
          <div style={{
            width: 40,
            height: 3,
            background: 'var(--coral)',
            borderRadius: 2,
            margin: '0 auto 24px',
          }} />

          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            fontFamily: 'var(--font-playfair), serif',
            marginBottom: 12,
            color: 'var(--text)',
          }}>
            Page not found
          </h1>

          <p style={{
            fontSize: 14,
            color: 'var(--text2)',
            lineHeight: 1.7,
            marginBottom: 32,
          }}>
            This article or outlet may have been removed, or the link might be out of date.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('feed')}
              className="btn-primary"
              style={{ padding: '10px 22px', fontSize: 14 }}
            >
              ← Back to feed
            </button>
            <button
              onClick={() => navigate('rankings')}
              style={{
                padding: '10px 22px',
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--surface)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              🏆 Rankings
            </button>
            <button
              onClick={() => navigate('outlets')}
              style={{
                padding: '10px 22px',
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--surface)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              📡 Outlets
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
