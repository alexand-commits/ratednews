import React, { useState, useEffect, createContext, useContext } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

const OWNER = 'alexandchow@gmail.com'

const TYPE_META = {
  news:              { label: 'News post',        emoji: '📰', color: 'var(--text2)' },
  coverage_contrast: { label: 'Coverage contrast', emoji: '🪞', color: 'var(--coral)' },
  coverage_spread: { label: 'Coverage spread', emoji: '🪞', color: 'var(--coral)' },
  poll:            { label: 'Poll',            emoji: '🗳️', color: 'var(--blue)' },
  media_literacy:  { label: 'Media literacy',  emoji: '🧠', color: 'var(--green-dark)' },
  roundup:         { label: 'Roundup',         emoji: '📰', color: 'var(--text2)' },
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
      style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, border: '0.5px solid var(--border)', background: copied ? 'var(--green)' : 'var(--surface)', color: copied ? '#fff' : 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// Two-tap publish: first tap arms ("Sure?"), second posts. Disarms after 4s.
// Nothing ships on a single stray click.
// Server-backed record of what the owner has published — keyed by
// platform::story#texthash so a draft posted on one device shows ✓ Posted
// everywhere. The story label alone collided: a contrast post and its news
// twin share a label by design, and recurring sagas get the same short label
// across runs — so posting one draft lit ✓ Posted on every lookalike for 7
// days. Hashing the exact text pins the record to THIS draft; the same draft
// still matches across devices (same text → same key).
const Published = createContext({ map: {}, record: () => {} })

// "14:32" — clock time in the viewer's timezone, shown next to relative ages
// so runs and drafts can be pinned to an actual moment.
const clock = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

// The scout cron fires at :07, :22, :37, :52 — the earliest a draft can land
// is the first tick at/after the rate window opens (generation adds a minute
// or two, hence the "~" wherever this is shown).
function nextScoutTick(after = Date.now()) {
  const d = new Date(after)
  d.setSeconds(0, 0)
  const next = [7, 22, 37, 52].find(t => t > d.getMinutes())
  if (next != null) d.setMinutes(next)
  else { d.setHours(d.getHours() + 1); d.setMinutes(7) }
  return d
}

function draftKey(story, text) {
  if (!story) return null
  let h = 5381
  const t = text || ''
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0
  return `${story}#${h.toString(36)}`
}

function PostButton({ platform, story, text, pollOptions, imageUrl, imageAlt, label, color }) {
  const [state, setState] = useState('idle') // idle | armed | busy | done | error
  const [url, setUrl]     = useState(null)
  const [error, setError] = useState('')
  const { map: publishedMap, record } = useContext(Published)
  const storyKey = draftKey(story, text)
  const pubKey = storyKey ? `${platform}::${storyKey}` : null
  const prior = pubKey ? publishedMap[pubKey] : null

  useEffect(() => {
    if (state !== 'armed') return
    const t = setTimeout(() => setState('idle'), 4000)
    return () => clearTimeout(t)
  }, [state])

  async function fire() {
    setState('busy'); setError('')
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ platform, text, pollOptions, imageUrl, imageAlt }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Post failed')
      setUrl(json.url); setState('done')
      if (pubKey) record(platform, storyKey, json.url)
    } catch (e) {
      setError(e.message); setState('error')
    }
  }

  if (state === 'done' || prior) {
    const href = state === 'done' ? url : prior?.url
    const chip = { fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: 'var(--green)', color: '#fff', textDecoration: 'none', flexShrink: 0 }
    return href
      ? <a href={href} target="_blank" rel="noopener noreferrer" style={chip}>✓ Posted — view</a>
      : <span style={chip}>✓ Posted</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {state === 'error' && <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error}>{error}</span>}
      <button
        onClick={() => (state === 'armed' ? fire() : setState('armed'))}
        disabled={state === 'busy'}
        style={{
          fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
          border: `0.5px solid ${state === 'armed' ? color : 'var(--border)'}`,
          background: state === 'armed' ? color : 'var(--surface)',
          color: state === 'armed' ? '#fff' : color,
          cursor: state === 'busy' ? 'default' : 'pointer', flexShrink: 0,
        }}
      >
        {state === 'busy' ? 'Posting…' : state === 'armed' ? 'Sure? Tap to post' : label}
      </button>
    </span>
  )
}

// Slim editorial-context line — coverage size + timing + state flags.
function MetaLine({ post }) {
  if (!post.meta) return null
  return (
    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>
      {post.meta.outlets} outlets · first {post.meta.first}
      {post.meta.breaking ? ' · ⚡ breaking' : ''}
      {post.meta.liveEvent ? ' · 🔴 live event' : ''}
      {post.meta.update ? ' · ↻ update' : ''}
    </div>
  )
}

// Thumbnail + attach toggle + cycler. Default on — the image is an upgrade;
// the toggle covers the odd bad photo, the cycler swaps in another cluster
// member's photo when the first is unusable or low quality.
// Client-side compress for owner-uploaded photos: phone shots → ≤1600px JPEG,
// retried smaller if the base64 payload would push the API's 4MB body cap.
// These sizes also clear Bluesky's ~976KB blob cap comfortably.
async function fileToJpegDataUrl(file) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('unreadable image'))
      i.src = objectUrl
    })
    const compress = (maxDim, q) => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * scale))
      c.height = Math.max(1, Math.round(img.height * scale))
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      return c.toDataURL('image/jpeg', q)
    }
    let out = compress(1600, 0.85)
    if (out.length > 2_500_000) out = compress(1280, 0.78)
    return out
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function CardPreview({ url, images, idx = 0, setIdx, on, setOn, custom, setCustom }) {
  const fileRef = React.useRef(null)
  const pool = images?.length ? images : url ? [url] : []
  const current = custom || (pool.length ? pool[Math.min(idx, pool.length - 1)] : null)
  if (!current && !setCustom) return null

  async function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = '' // same file can be re-picked after remove
    if (!f) return
    try {
      setCustom(await fileToJpegDataUrl(f))
      setOn?.(true)
    } catch { /* unreadable file — leave state as-is */ }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {current && (
        <img src={current} alt="post image preview" style={{ width: '100%', maxWidth: 420, borderRadius: 8, border: '0.5px solid var(--border)', opacity: on ? 1 : 0.35, display: 'block' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {current && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} />
            🖼 attach image to post
          </label>
        )}
        {!custom && pool.length > 1 && setIdx && (
          <button
            onClick={() => setIdx((idx + 1) % pool.length)}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
          >
            ↻ next image · {Math.min(idx, pool.length - 1) + 1}/{pool.length}
          </button>
        )}
        {setCustom && (
          <>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
            >
              📷 {custom ? 'replace photo' : 'use my own photo'}
            </button>
            {custom && (
              <>
                <button
                  onClick={() => setCustom(null)}
                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: '0.5px solid var(--border)', background: 'none', color: 'var(--text3)', cursor: 'pointer' }}
                >
                  ✕ back to story photos
                </button>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green-dark, #3E7C4F)' }}>your photo — posts on all platforms</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Facebook copy: the X text plus the story link — FB welcomes links and
// renders a preview card from the story page's OG tags.
function fbText(text, short) {
  const link = (short || '').match(/https?:\/\/\S+/)
  return link ? `${text}\n\n${link[0]}` : text
}

// Highest predicted engagement first; polls stay last.
function sortByPulse(posts) {
  return [...posts].sort((a, b) => {
    if ((a.type === 'poll') !== (b.type === 'poll')) return a.type === 'poll' ? 1 : -1
    return (b.pulse ?? 0) - (a.pulse ?? 0)
  })
}

function PostCard({ post }) {
  const meta = TYPE_META[post.type] || { label: post.type || 'Post', emoji: '✳️', color: 'var(--text2)' }
  const [withCard, setWithCard] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [customPhoto, setCustomPhoto] = useState(null) // owner-uploaded photo overrides the story pool
  const pool = post.images?.length ? post.images : post.card ? [post.card] : []
  const cardUrl = withCard ? (customPhoto || (pool.length ? pool[Math.min(imgIdx, pool.length - 1)] : undefined)) : undefined
  const cardAlt = post.meta?.title || post.story || ''

  const copyText = [
    post.text,
    post.poll_options?.length ? `\n\nPoll options:\n• ${post.poll_options.join('\n• ')}` : '',
  ].join('')

  return (
    <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: meta.color }}>
          {meta.emoji} {meta.label}
          {post.story ? <span style={{ color: 'var(--text2)', fontWeight: 600 }}> · {post.story}</span> : null}
          <span style={{ color: 'var(--text3)', fontWeight: 500 }}> · {post.type === 'poll' ? 'X only (no Bluesky polls)' : 'X'}</span>
          {Number.isFinite(post.pulse) && (
            <span
              title={post.pulse_why || ''}
              style={{ marginLeft: 8, fontWeight: 700, color: post.pulse >= 8 ? 'var(--coral)' : post.pulse >= 6 ? 'var(--amber, #C98A08)' : 'var(--text3)' }}
            >
              {post.pulse >= 8 ? '🔥 ' : ''}pulse {post.pulse}/10
            </span>
          )}
        </span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <CopyButton text={copyText} />
          {/https?:\/\/|www\./i.test(post.text) ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber, #C98A08)' }} title="X charges 13x for URL posts and buries their reach — links live in the Bluesky variant. Regenerate for linkless X drafts.">
              🔗 has link — X posting off
            </span>
          ) : (
            <PostButton platform="x" story={post.story} text={post.text} pollOptions={post.poll_options} imageUrl={cardUrl} imageAlt={cardAlt} label={post.card ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />
          )}
        </span>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{post.text}</div>

      {typeof post.text === 'string' && (() => {
        const n = post.text.length
        const over = n > 280
        return (
          <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: over ? 'var(--amber, #C98A08)' : 'var(--text3)' }}>
            {n} chars{over ? ' · past 280 (fine on Premium)' : ''}
          </div>
        )
      })()}

      {/* Bluesky short variant — hard 300-char platform limit */}
      {typeof post.short === 'string' && post.short && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2E86EA' }}>🦋 Bluesky</span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <CopyButton text={post.short} />
              {post.short.length <= 300 && (
                <PostButton platform="bluesky" story={post.story} text={post.short} imageUrl={cardUrl} imageAlt={cardAlt} label="Post to Bluesky" color="#2E86EA" />
              )}
            </span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{post.short}</div>
          {(() => {
            const n = post.short.length
            const over = n > 300
            return (
              <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: over ? 'var(--red)' : 'var(--text3)' }}>
                {n} / 300{over ? ` · ${n - 300} over — trim before posting` : ''}
              </div>
            )
          })()}
        </div>
      )}

      {!post.poll_options?.length && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1877F2' }}>
            📘 Facebook <span style={{ color: 'var(--text3)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· X copy + story link</span>
          </span>
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <CopyButton text={fbText(post.text, post.short)} />
            <PostButton platform="facebook" story={post.story} text={fbText(post.text, post.short)} imageUrl={cardUrl} imageAlt={cardAlt} label="Post to Facebook" color="#1877F2" />
          </span>
        </div>
      )}

      {post.poll_options?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {post.poll_options.map((o, i) => (
            <div key={i} style={{ fontSize: 13, padding: '7px 12px', border: '0.5px solid var(--border)', borderRadius: 99, color: 'var(--text2)' }}>{o}</div>
          ))}
        </div>
      )}

      {post.why && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10, fontStyle: 'italic' }}>Why: {post.why}</div>
      )}

      <MetaLine post={post} />
      <CardPreview url={post.card} images={post.images} idx={imgIdx} setIdx={setImgIdx} on={withCard} setOn={setWithCard} custom={customPhoto} setCustom={setCustomPhoto} />
    </div>
  )
}

// ── Post queue (main column) — autopilot scouts and drafts; the owner
// approves with the same two-tap buttons as the generators. Nothing publishes
// itself: the scout's job ends at the draft.
// One queue story: both platform variants, card preview + toggle, actions.
function QueueItem({ q, dismiss }) {
  const [withCard, setWithCard] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [customPhoto, setCustomPhoto] = useState(null) // owner-uploaded photo overrides the story pool
  const pool = q.images?.length ? q.images : q.card ? [q.card] : []
  const cardUrl = withCard ? (customPhoto || (pool.length ? pool[Math.min(imgIdx, pool.length - 1)] : undefined)) : undefined
  return (
    <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--coral)' }}>
          {q.live ? '✅ posted' : '🕐 drafted'} {clock(q.at)} · {timeAgo(q.at)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>· {q.story}</span>
        {Number.isFinite(q.pulse) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: q.pulse >= 8 ? 'var(--coral)' : 'var(--amber, #C98A08)' }}>
            {q.pulse >= 8 ? '🔥 ' : ''}pulse {q.pulse}/10
          </span>
        )}
        {q.url && <a href={q.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--coral)' }}>view →</a>}
        {!q.live && (
          <button
            onClick={() => dismiss(q.story)}
            title="Dismiss — removes this draft from the queue (the story won't be re-drafted)"
            style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'none', border: '0.5px solid var(--border)', borderRadius: 99, padding: '2px 10px', cursor: 'pointer' }}
          >
            ✕ Dismiss
          </button>
        )}
      </div>

      {q.x && (
        <>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{q.x}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{q.x.length} chars</span>
            <CopyButton text={q.x} />
            {!q.live && <PostButton platform="x" story={q.story} text={q.x} imageUrl={cardUrl} imageAlt={q.alt} label={q.card ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />}
          </div>
        </>
      )}

      {q.bluesky && (
        <div style={{ marginTop: q.x ? 12 : 0, paddingTop: q.x ? 12 : 0, borderTop: q.x ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: q.x ? 'var(--text2)' : 'var(--text)' }}>{q.bluesky}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: q.bluesky.length > 300 ? 'var(--red)' : 'var(--text3)' }}>{q.bluesky.length} / 300</span>
            <CopyButton text={q.bluesky} />
            {!q.live && q.bluesky.length <= 300 && <PostButton platform="bluesky" story={q.story} text={q.bluesky} imageUrl={cardUrl} imageAlt={q.alt} label="Post to Bluesky" color="#2E86EA" />}
          </div>
        </div>
      )}

      {q.facebook && (
        <div style={{ marginTop: (q.x || q.bluesky) ? 12 : 0, paddingTop: (q.x || q.bluesky) ? 12 : 0, borderTop: (q.x || q.bluesky) ? '0.5px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1877F2' }}>📘 Facebook</span>
            <CopyButton text={q.facebook} />
            {!q.live && <PostButton platform="facebook" story={q.story} text={q.facebook} imageUrl={cardUrl} imageAlt={q.alt} label="Post to Facebook" color="#1877F2" />}
          </div>
        </div>
      )}

      <CardPreview url={q.card} images={q.images} idx={imgIdx} setIdx={setImgIdx} on={withCard} setOn={setWithCard} custom={customPhoto} setCustom={setCustomPhoto} />
    </div>
  )
}

// A gated draft awaiting the owner's judgment — full text, reason, card, actions.
function JudgmentItem({ p, dismiss }) {
  const [withCard, setWithCard] = useState(true)
  const [imgIdx, setImgIdx] = useState(0)
  const [customPhoto, setCustomPhoto] = useState(null) // owner-uploaded photo overrides the story pool
  const pool = p.images?.length ? p.images : p.card ? [p.card] : []
  const cardUrl = withCard ? (customPhoto || (pool.length ? pool[Math.min(imgIdx, pool.length - 1)] : undefined)) : undefined
  return (
    <div style={{ background: 'var(--bg)', border: '0.5px dashed var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)' }}>
          {(TYPE_META[p.type] || {}).emoji || '✳️'} {p.story}
        </span>
        {Number.isFinite(p.pulse) && (
          <span style={{ fontSize: 10, fontWeight: 700, color: p.pulse >= 8 ? 'var(--coral)' : p.pulse >= 6 ? 'var(--amber, #C98A08)' : 'var(--text3)' }}>
            pulse {p.pulse}/10
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--amber, #C98A08)', fontWeight: 600 }} title={`X: ${p.x} · Bluesky: ${p.bluesky}`}>
          {p.x === p.bluesky ? p.x : `X: ${p.x}`}
        </span>
        <button
          onClick={() => dismiss(p.story)}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'none', border: '0.5px solid var(--border)', borderRadius: 99, padding: '2px 10px', cursor: 'pointer' }}
        >
          ✕ Dismiss
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{p.text}</div>
      {p.poll_options?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {p.poll_options.map((o, k) => (
            <span key={k} style={{ fontSize: 12, padding: '4px 12px', border: '0.5px solid var(--border)', borderRadius: 99, color: 'var(--text2)' }}>{o}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{(p.text || '').length} chars</span>
        <CopyButton text={p.text} />
        {!/https?:\/\/|www\./i.test(p.text || '') && (
          <PostButton platform="x" story={p.story} text={p.text} pollOptions={p.poll_options || undefined} imageUrl={p.poll_options?.length ? undefined : cardUrl} imageAlt={p.story} label={p.card && !p.poll_options?.length ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />
        )}
      </div>
      {p.short && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>{p.short}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: p.short.length > 300 ? 'var(--red)' : 'var(--text3)' }}>{p.short.length} / 300</span>
            <CopyButton text={p.short} />
            {p.short.length <= 300 && <PostButton platform="bluesky" story={p.story} text={p.short} imageUrl={cardUrl} imageAlt={p.story} label="Post to Bluesky" color="#2E86EA" />}
          </div>
        </div>
      )}
      {!p.poll_options?.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1877F2' }}>📘 Facebook</span>
          <CopyButton text={fbText(p.text, p.short)} />
          <PostButton platform="facebook" story={p.story} text={fbText(p.text, p.short)} imageUrl={cardUrl} imageAlt={p.story} label="Post to Facebook" color="#1877F2" />
        </div>
      )}
      <CardPreview url={p.card} images={p.images} idx={imgIdx} setIdx={setImgIdx} on={withCard} setOn={setWithCard} custom={customPhoto} setCustom={setCustomPhoto} />
    </div>
  )
}

function AutopilotFeed({ state }) {
  const [localDismissed, setLocalDismissed] = useState([])

  if (!state || state.error || !state.configured) return null

  async function dismiss(story) {
    setLocalDismissed(prev => [...prev, story]) // optimistic
    try {
      const { data: { session } } = await db.auth.getSession()
      await fetch('/api/social-auto', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ story }),
      })
    } catch {}
  }

  const hidden = new Set([...(state.dismissed || []).map(d => d.story), ...localDismissed])

  // Build the queue: newest drafts first, one card per story. Trending content
  // is perishable — a 2h-old surge isn't trending any more, so drafts expire
  // out of the queue instead of lingering (runs are still kept 7 days).
  const QUEUE_MAX_AGE_H = 2
  const queue = []
  const seenStories = new Set()
  for (const r of state.runs) { // runs arrive newest-first
    const entries = [...(r.posted || []).map(p => ({ ...p, live: true })), ...(r.wouldPost || [])]
    const byStory = new Map()
    for (const p of entries) {
      if (!byStory.has(p.story)) byStory.set(p.story, { story: p.story, at: r.at, x: null, bluesky: null, facebook: null, url: null, live: false, card: null, alt: '', pulse: p.pulse ?? null })
      const g = byStory.get(p.story)
      g[p.platform] = p.text
      if (p.card) { g.card = p.card; g.alt = p.alt || p.story }
      if (p.images?.length) g.images = p.images
      if (p.live) { g.live = true; g.url = p.url || g.url }
    }
    for (const [story, g] of byStory) {
      if (seenStories.has(story)) continue
      seenStories.add(story)
      if (hidden.has(story)) continue
      if ((Date.now() - new Date(g.at)) / 3600000 <= QUEUE_MAX_AGE_H) queue.push(g)
    }
  }

  // When could the next draft realistically land? A queue run needs at least
  // one platform's rate window open, then the next cron tick to find a story
  // surging. Windows come from the server (same maths as the real gate).
  const windows = state.nextWindow ? Object.values(state.nextWindow) : []
  const rateLimited = windows.length > 0 && windows.every(Boolean)
  const eta = nextScoutTick(rateLimited ? Math.min(...windows.map(w => +new Date(w))) : Date.now())

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>📥 Post queue</div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          the scout drafts, you decide — it never posts itself
        </span>
        {state.heartbeat && (
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }} title={state.heartbeat.last_result || ''}>
            ● last checked {timeAgo(state.heartbeat.at)} · {state.heartbeat.checks_today} check{state.heartbeat.checks_today === 1 ? '' : 's'} today
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        Drafts land here within ~15 min of a story surging and expire after 2 hours — trending doesn't keep. Two taps to publish; ✕ to bin.{' '}
        {rateLimited
          ? <strong>Rate-limited right now — earliest next draft ~{clock(eta)}.</strong>
          : <>Next scout pass ~{clock(eta)} — a draft drops if a story is surging.</>}
      </div>

      {queue.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
          Nothing trending right now — drafts expire after 2 hours, so an empty queue means no story is surging.
          {state.heartbeat ? ` Last check ${timeAgo(state.heartbeat.at)}: ${state.heartbeat.last_result || 'nothing new'}.` : ' The scout keeps watching.'}
        </div>
      ) : queue.slice(0, 8).map((q, i) => <QueueItem key={q.story + i} q={q} dismiss={dismiss} />)}

      {/* Manual-call drafts — fully written, gated for judgment not hidden. */}
      {(() => {
        const isActed = v => v === 'ok' || v === 'POSTED' || String(v || '').startsWith('WOULD POST')
        const manual = []
        const seen = new Set(seenStories)
        for (const r of state.runs) {
          for (const p of r.posts || []) {
            // Contrast posts and their news twins share a story label — key on
            // story+type so both variants can surface for the owner's pick.
            const key = `${p.story}::${p.type}`
            if (seen.has(key) || hidden.has(p.story)) continue
            if (isActed(p.x) || isActed(p.bluesky)) continue
            if ((Date.now() - new Date(r.at)) / 3600000 > QUEUE_MAX_AGE_H) continue
            seen.add(key)
            manual.push({ ...p, at: r.at })
          }
        }
        if (!manual.length) return null
        return (
          <div style={{ marginTop: 4, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', margin: '10px 0 8px' }}>
              🖐 Your call — drafted, but gated for judgment
            </div>
            {manual.slice(0, 5).map((p, i) => <JudgmentItem key={p.story + i} p={p} dismiss={dismiss} />)}
          </div>
        )
      })()}

    </div>
  )
}

function TrendingGenerator({ onRun }) {
  const [posts, setPosts] = useState(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [note, setNote]   = useState('')

  // Generation takes 40-90s. Mobile browsers kill long fetches on screen-lock
  // or a network blip — but the SERVER finishes and saves the run regardless.
  // On a dropped connection, poll manual-run history for the completed batch
  // instead of surfacing a false error.
  async function recoverRun(startedAt) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 15000))
      try {
        const { data: { session } } = await db.auth.getSession()
        const res = await fetch('/api/social-auto', { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const json = await res.json()
        const run = (json.manualRuns || []).find(r => new Date(r.at) >= startedAt)
        if (run?.posts?.length) return run.posts
      } catch { /* keep polling */ }
    }
    return null
  }

  async function generate() {
    if (busy) return
    setBusy(true); setError(''); setNote(''); setPosts(null)
    const startedAt = new Date(Date.now() - 5000)
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trending: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setPosts(sortByPulse(json.posts || []))
      if (json.note) setNote(json.note)
      if (json.posts?.length) onRun?.(json.posts, 'trending')
    } catch (e) {
      // Server-reported errors are real; connection-level failures may mean
      // the run completed without us — check before showing an error.
      const serverError = /Generation failed|Unauthorized|Forbidden|headline/i.test(e.message || '')
      if (serverError) {
        setError(e.message)
      } else {
        setError('Connection dropped mid-generation — checking whether the run completed…')
        const recovered = await recoverRun(startedAt)
        if (recovered) {
          setPosts(sortByPulse(recovered))
          setError('')
          setNote('Recovered — your connection dropped but the generation completed.')
          onRun?.(recovered, 'trending')
        } else {
          setError('Connection dropped. If the run completed server-side it will appear under Previous runs shortly — pull to refresh before regenerating.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>⚡ Generate from trending</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Drafts posts for 8 stories — the 6 hottest by coverage acceleration plus 2 wildcards picked for pure shareability.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={generate} disabled={busy} className="nav-pill" style={{ opacity: busy ? 0.55 : 1, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Reading the news cycle…' : 'Generate posts'}
        </button>
        {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      </div>

      {posts && posts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {posts.map((post, i) => <PostCard key={i} post={post} />)}
        </div>
      )}
      {posts && posts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12 }}>{note || 'Nothing strongly cross-covered right now — try again after the next news wave.'}</div>
      )}
    </div>
  )
}

function Composer({ onRun }) {
  const [input, setInput]     = useState('')
  const [steer, setSteer]     = useState('')
  const [posts, setPosts]     = useState(null)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  async function generate() {
    if (!input.trim() || busy) return
    setBusy(true); setError(''); setPosts(null)
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ headlines: input, steer }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setPosts(sortByPulse(json.posts || []))
      if (json.posts?.length) onRun?.(json.posts, 'compose')
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>✍️ Compose from your own headlines</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Paste a headline, or several from different outlets — one per line (e.g. <em>BBC — Bank holds rates</em>). We'll draft a few post options.
      </div>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={'BBC — Bank holds interest rates at 5%\nTelegraph — Millions face mortgage pain as Bank refuses to cut\nGuardian — Rate hold offers relief but squeeze continues'}
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 13, lineHeight: 1.5, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', marginBottom: 10 }}
      />
      <input
        type="text"
        value={steer}
        onChange={e => setSteer(e.target.value)}
        placeholder="Optional: steer the tone — e.g. “lean into the comedy of the wording”"
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={generate}
          disabled={busy || !input.trim()}
          className="nav-pill"
          style={{ opacity: busy || !input.trim() ? 0.55 : 1, cursor: busy || !input.trim() ? 'default' : 'pointer' }}
        >
          {busy ? 'Generating…' : 'Generate posts'}
        </button>
        {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      </div>

      {posts && posts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {posts.map((post, i) => <PostCard key={i} post={post} />)}
        </div>
      )}
      {posts && posts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12 }}>No posts came back — try rewording or adding another headline.</div>
      )}
    </div>
  )
}

export default function SocialPage({ user, goBack }) {
  const isOwner = user?.email === OWNER

  // Scout + history data — server-side, so it works identically on every
  // device (mobile posting included; localStorage history kept losing runs).
  const [scout, setScout] = useState(null)
  async function loadScout() {
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-auto', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const json = await res.json()
      setScout(res.ok ? json : { error: json.error || 'Failed to load' })
    } catch (e) { setScout({ error: e.message }) }
  }
  useEffect(() => { if (isOwner) loadScout() }, [isOwner])
  // After a manual generation, refetch so the run lands in server history.
  const recordRun = () => setTimeout(loadScout, 1500)

  // Published map: seeded from the server log, updated optimistically on post
  const [pubMap, setPubMap] = useState({})
  useEffect(() => {
    if (!scout?.published) return
    setPubMap(prev => {
      const m = { ...prev }
      for (const e of scout.published) m[`${e.platform}::${e.story}`] = { url: e.url, at: e.at }
      return m
    })
  }, [scout])
  async function recordPosted(platform, story, url) {
    setPubMap(prev => ({ ...prev, [`${platform}::${story}`]: { url } }))
    try {
      const { data: { session } } = await db.auth.getSession()
      await fetch('/api/social-auto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ platform, story, url }),
      })
    } catch {}
  }

  async function binRun(runId) {
    // Optimistic: drop it locally, then delete server-side
    setScout(s => s ? { ...s, manualRuns: (s.manualRuns || []).filter(r => r.id !== runId) } : s)
    try {
      const { data: { session } } = await db.auth.getSession()
      await fetch('/api/social-auto', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ runId }),
      })
    } catch { loadScout() }
  }

  if (!isOwner) {
    return (
      <div className="page-content">
        <div className="container" style={{ maxWidth: 1240 }}>
          <button className="back-btn" onClick={goBack}>← Back</button>
          <div className="empty-state">
            <h3>🔒 Private</h3>
            <p>This page is only available to the site owner.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Published.Provider value={{ map: pubMap, record: recordPosted }}>
    <div className="page-content">
      <div className="container" style={{ maxWidth: 1280 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 4, fontFamily: 'var(--font-playfair), serif' }}>
            🚀 Social content desk
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
            The scout drafts gate-passing posts into the queue within ~15 min of a story surging — you approve with two taps. Or generate a batch yourself; either way, nothing publishes without you.
          </p>
        </div>

        <div className="grid-desk">
          <div>
            <TrendingGenerator onRun={recordRun} />
            <AutopilotFeed state={scout} />
            <Composer onRun={recordRun} />
          </div>

          {/* Previous runs — always visible on the right rail (desktop), below
              the desk on mobile. Server-side, so every device sees the same. */}
          <div className="sidebar">
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
              Previous runs
            </div>
            {(scout?.manualRuns || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>No runs in the last 48h.</div>
            )}
            {(scout?.manualRuns || []).map((run, ri) => (
              <div key={run.id || ri} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                    {run.mode === 'trending' ? 'trending' : 'composer'} · {clock(run.at)} · {timeAgo(run.at)} · {run.posts.length} posts
                  </span>
                  {run.id && (
                    <button
                      onClick={() => binRun(run.id)}
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'none', border: '0.5px solid var(--border)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                    >
                      ✕ Bin
                    </button>
                  )}
                </div>
                {run.posts.map((post, i) => <PostCard key={i} post={post} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </Published.Provider>
  )
}
