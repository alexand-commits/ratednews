import React, { useState, useEffect } from 'react'
import { db } from '../lib/supabase'

const ACCURACY_OPTIONS = [
  { value: 'accurate',        label: '✓ Accurate',       color: 'var(--green)' },
  { value: 'mostly_accurate', label: '~ Mostly accurate', color: 'var(--amber)' },
  { value: 'inaccurate',      label: '✗ Inaccurate',      color: 'var(--red)'   },
]

const BIAS_OPTIONS = [
  { value: 'far_left',  label: 'Far left'  },
  { value: 'left',      label: 'Left'      },
  { value: 'centre',    label: 'Centre'    },
  { value: 'right',     label: 'Right'     },
  { value: 'far_right', label: 'Far right' },
]

export default function OutletRatingModal({ outlet, onClose, onRated, showToast, user }) {
  const [accuracyVote, setAccuracyVote] = useState(null)
  const [biasVote, setBiasVote]         = useState(null)
  const [overallStars, setOverallStars] = useState(0)
  const [hoverStar, setHoverStar]       = useState(0)
  const [reviewText, setReviewText]     = useState('')
  const [submitting, setSubmitting]     = useState(false)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function submit() {
    if (!overallStars) { showToast('Please give an overall star rating'); return }
    setSubmitting(true)

    const { error } = await db.from('outlet_ratings').insert({
      outlet_id:     outlet.id,
      accuracy_vote: accuracyVote,
      bias_vote:     biasVote,
      overall_stars: overallStars,
      review_text:   reviewText.trim() || null,
      ...(user ? { user_id: user.id } : {}),
    })

    if (error) {
      showToast('Could not submit rating — try again')
      setSubmitting(false)
      return
    }

    // community_score + total_ratings are recomputed server-side by the
    // recompute_outlet_score trigger — see sql/02_recompute_scores_trigger.sql

    if (!user) {
      localStorage.setItem(`rated_outlet_${outlet.id}`, JSON.stringify({ overallStars, accuracyVote, biasVote }))
    }

    showToast('Rating submitted — thanks!')
    onRated({ overallStars, accuracyVote, biasVote })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Rate this outlet</div>
            <div className="modal-subtitle">{outlet.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Accuracy */}
        <div className="rating-section">
          <div className="rating-section-label">How accurate is this outlet?</div>
          <div className="rating-option-row">
            {ACCURACY_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`rating-option-btn${accuracyVote === o.value ? ' selected' : ''}`}
                style={accuracyVote === o.value ? { background: o.color, borderColor: o.color, color: '#fff' } : {}}
                onClick={() => setAccuracyVote(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bias */}
        <div className="rating-section">
          <div className="rating-section-label">Political bias?</div>
          <div className="rating-option-row">
            {BIAS_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`rating-option-btn${biasVote === o.value ? ' selected' : ''}`}
                onClick={() => setBiasVote(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overall stars */}
        <div className="rating-section">
          <div className="rating-section-label">Overall trust rating <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <span
                key={s}
                className="rating-star"
                style={{ color: s <= (hoverStar || overallStars) ? 'var(--amber)' : 'var(--border2)' }}
                onClick={() => setOverallStars(s)}
                onMouseEnter={() => setHoverStar(s)}
                onMouseLeave={() => setHoverStar(0)}
              >
                ★
              </span>
            ))}
            {overallStars > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 4 }}>
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][overallStars]}
              </span>
            )}
          </div>
        </div>

        {/* Optional review */}
        <div className="rating-section">
          <div className="rating-section-label">Review <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span></div>
          <textarea
            className="compose-input"
            style={{ width: '100%', minHeight: 72, resize: 'vertical', padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}
            placeholder="Share your thoughts on this outlet..."
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            maxLength={500}
          />
          {reviewText.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>{reviewText.length}/500</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={submitting}
            style={{ flex: 2, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Submitting…' : 'Submit rating'}
          </button>
        </div>
      </div>
    </div>
  )
}
