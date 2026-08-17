import React, { useState, useEffect, createContext, useContext } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

const OWNER = 'alexandchow@gmail.com'

const TYPE_META = {
  news:              { label: 'News post',        emoji: '📰', color: 'var(--text2)' },
  coverage_data:     { label: 'Coverage data',   emoji: '📊', color: 'var(--green-dark)' },
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

// Drafts are the model's; posts are the OWNER's. Every draft text is
// editable in place before publishing — the buttons post whatever the text
// says at the moment of posting.
function EditToggle({ editing, setEditing }) {
  return (
    <button
      onClick={() => setEditing(e => !e)}
      style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, border: `0.5px solid ${editing ? 'var(--green)' : 'var(--border)'}`, background: editing ? 'var(--green)' : 'var(--surface)', color: editing ? '#fff' : 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}
    >
      {editing ? '✓ Done' : '✏️ Edit'}
    </button>
  )
}

function DraftText({ editing, value, onChange, style }) {
  if (!editing) return <div style={style}>{value}</div>
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={Math.max(3, Math.ceil((value || '').length / 55))}
      style={{ ...style, display: 'block', width: '100%', background: 'var(--bg2, var(--bg))', border: '1px solid var(--coral)', borderRadius: 8, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
    />
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

function draftKey(story, text) {
  if (!story) return null
  let h = 5381
  const t = text || ''
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0
  return `${story}#${h.toString(36)}`
}

function PostButton({ platform, story, text, pollOptions, imageUrl, imageAlt, label, color, pulse }) {
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
      if (pubKey) record(platform, storyKey, json.url, pulse, (text || '').slice(0, 200))
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
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(post.text || '')
  const [short, setShort] = useState(post.short || '')
  const pool = post.images?.length ? post.images : post.card ? [post.card] : []
  const cardUrl = withCard ? (customPhoto || (pool.length ? pool[Math.min(imgIdx, pool.length - 1)] : undefined)) : undefined
  const cardAlt = post.meta?.title || post.story || ''

  const copyText = [
    text,
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
          <EditToggle editing={editing} setEditing={setEditing} />
          <CopyButton text={copyText} />
          {/https?:\/\/|www\./i.test(text) ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber, #C98A08)' }} title="X charges 13x for URL posts and buries their reach — links live in the Bluesky variant. Regenerate for linkless X drafts.">
              🔗 has link — X posting off
            </span>
          ) : (
            <PostButton platform="x" story={post.story} pulse={post.pulse} text={text} pollOptions={post.poll_options} imageUrl={cardUrl} imageAlt={cardAlt} label={post.card ? 'Post to X · 2¢' : 'Post to X · 1.5¢'} color="var(--coral)" />
          )}
        </span>
      </div>

      <DraftText editing={editing} value={text} onChange={setText} style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }} />

      {typeof text === 'string' && (() => {
        const n = text.length
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
              <CopyButton text={short} />
              {short.length <= 300 && (
                <PostButton platform="bluesky" story={post.story} pulse={post.pulse} text={short} imageUrl={cardUrl} imageAlt={cardAlt} label="Post to Bluesky" color="#2E86EA" />
              )}
            </span>
          </div>
          <DraftText editing={editing} value={short} onChange={setShort} style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }} />
          {(() => {
            const n = short.length
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
            <CopyButton text={fbText(text, short)} />
            <PostButton platform="facebook" story={post.story} pulse={post.pulse} text={fbText(text, short)} imageUrl={cardUrl} imageAlt={cardAlt} label="Post to Facebook" color="#1877F2" />
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

// The Coverage Report generator — data posts only RatedNews can make,
// drafted from the weekly language/framing/attention pack. Numbers come from
// the auditable compute script; the model only writes around them.
function CoverageGenerator({ onRun }) {
  const [posts, setPosts] = useState(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [note, setNote]   = useState('')

  async function generate() {
    if (busy) return
    setBusy(true); setError(''); setNote(''); setPosts(null)
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ coverage: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setPosts(sortByPulse(json.posts || []))
      if (json.note) setNote(json.note)
      if (json.posts?.length) onRun?.(json.posts, 'coverage')
    } catch (e) {
      setError(e.message?.includes('Failed to fetch')
        ? 'Connection dropped. If the run completed it will appear under Previous runs shortly.'
        : (e.message || 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>📊 Coverage Report</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Data posts only RatedNews can make — tracked language, same-story framing splits, first-to-report — from this week's indexed headlines. Charts render as branded cards.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={generate} disabled={busy} className="nav-pill" style={{ opacity: busy ? 0.55 : 1, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Crunching the week…' : 'Draft data posts'}
        </button>
        {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      </div>

      {posts && posts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {posts.map((post, i) => <PostCard key={i} post={post} />)}
        </div>
      )}
      {posts && posts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12 }}>{note || 'No coverage report available yet.'}</div>
      )}
    </div>
  )
}

// Owner picks the story: paste a ratednews story/article link (or an
// ingested article's original URL) and the desk drafts posts from that
// story's full cluster — same machinery as trending, aimed by hand.
function StoryLinkGenerator({ onRun }) {
  const [link, setLink]   = useState('')
  const [steer, setSteer] = useState('')
  const [posts, setPosts] = useState(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [note, setNote]   = useState('')

  async function generate() {
    if (!link.trim() || busy) return
    setBusy(true); setError(''); setNote(''); setPosts(null)
    try {
      const { data: { session } } = await db.auth.getSession()
      const res = await fetch('/api/social-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ storyUrl: link.trim(), steer }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setPosts(sortByPulse(json.posts || []))
      if (json.note) setNote(json.note)
      if (json.posts?.length) onRun?.(json.posts, 'story')
    } catch (e) {
      setError(e.message?.includes('Failed to fetch')
        ? 'Connection dropped. If the run completed it will appear under Previous runs shortly.'
        : (e.message || 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🎯 From a story link</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Paste a story or article link — the desk pulls that story's full coverage and drafts the post. Works with ratednews links or any article URL from our feeds.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={link}
          onChange={e => setLink(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="https://www.ratednews.com/story/…"
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        />
        <input
          value={steer}
          onChange={e => setSteer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="Optional angle — e.g. 'lead with the fan reaction'"
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={generate} disabled={busy || !link.trim()} className="nav-pill" style={{ opacity: busy || !link.trim() ? 0.55 : 1, cursor: busy || !link.trim() ? 'default' : 'pointer' }}>
            {busy ? 'Reading the coverage…' : 'Draft this story'}
          </button>
          {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
        </div>
      </div>

      {posts && posts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {posts.map((post, i) => <PostCard key={i} post={post} />)}
        </div>
      )}
      {posts && posts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 12 }}>{note || "Couldn't resolve that link."}</div>
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
  // Long-lived tabs (phone especially) were showing weeks-stale desk data —
  // refetch whenever the tab returns to the foreground.
  useEffect(() => {
    if (!isOwner) return
    const onVis = () => { if (document.visibilityState === 'visible') loadScout() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [isOwner])
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
  async function recordPosted(platform, story, url, pulse = null, preview = '') {
    setPubMap(prev => ({ ...prev, [`${platform}::${story}`]: { url } }))
    try {
      const { data: { session } } = await db.auth.getSession()
      await fetch('/api/social-auto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ platform, story, url, pulse, preview }),
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
            <CoverageGenerator onRun={recordRun} />
            <StoryLinkGenerator onRun={recordRun} />
            <Composer onRun={recordRun} />
          </div>

          {/* Previous runs — always visible on the right rail (desktop), below
              the desk on mobile. Server-side, so every device sees the same. */}
          <div className="sidebar">
            {/* Predicted vs actual — the feedback loop made visible. Metrics
                refresh every 6h (Bluesky + FB free reads; X reads are billed,
                so X posts list without numbers). */}
            {(scout?.metrics || []).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  📈 Performance · 7d
                </div>
                {[...scout.metrics]
                  .sort((a, b) => new Date(b.at) - new Date(a.at))
                  .slice(0, 10)
                  .map((m, i) => (
                    <a
                      key={(m.url || '') + i}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', padding: '7px 0', borderTop: i === 0 ? 'none' : '0.5px solid var(--border)', textDecoration: 'none' }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.platform === 'x' ? '𝕏' : m.platform === 'bluesky' ? '🦋' : '📘'} {(m.story || '').split('#')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {m.likes != null
                          ? <>{m.likes}♥ {m.reposts}↻ {m.replies}💬{Number.isFinite(m.pulse) ? <> · predicted {m.pulse}/10</> : null}</>
                          : 'metrics n/a on X'}
                        {' · '}{timeAgo(m.at)}
                      </div>
                    </a>
                  ))}
              </div>
            )}

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
                    {run.mode === 'trending' ? 'trending' : run.mode === 'coverage' ? '📊 coverage' : run.mode === 'story' ? '🎯 story link' : 'composer'} · {clock(run.at)} · {timeAgo(run.at)} · {run.posts.length} posts
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
