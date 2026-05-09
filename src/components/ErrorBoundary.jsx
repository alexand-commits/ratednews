import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '60px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <h2 style={{
            fontFamily: 'var(--font-playfair), serif', fontSize: 22,
            fontWeight: 700, marginBottom: 8, color: 'var(--text)',
          }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.5 }}>
            An unexpected error occurred. Try refreshing the page — if the problem
            persists, come back in a few minutes.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--coral)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 22px', fontWeight: 600,
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Refresh page
            </button>
            <button
              onClick={() => { this.setState({ error: null }); window.history.back() }}
              style={{
                background: 'var(--surface)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: '10px 22px', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Go back
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
