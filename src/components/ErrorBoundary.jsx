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
        <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ color: 'var(--red)', marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 16, fontSize: 12, overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            color: 'var(--text)',
          }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}
            onClick={() => window.history.back()}
          >
            ← Go back
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
