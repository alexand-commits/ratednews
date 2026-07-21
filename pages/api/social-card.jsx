/**
 * Social post cards — /api/social-card
 * Drawn (not AI-generated) 1200x630 PNGs attached to X/Bluesky posts.
 *
 * type=hybrid — outlet photo + RatedNews chrome:
 *   ?type=hybrid&title=..&img=<encoded photo url>&count=22&ribbon=BREAKING|UPDATE|FULL-TIME
 * type=clash — split coverage-contrast card:
 *   ?type=clash&ao=OutletA&aq=quote..&bo=OutletB&bq=quote..&foot=one-liner
 */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Satori only renders fonts you hand it — bundle Playfair for the display face
const playfair = fetch(new URL('../../src/assets/playfair-700.ttf', import.meta.url)).then(r => r.arrayBuffer())
const inter = fetch(new URL('../../src/assets/inter-700.ttf', import.meta.url)).then(r => r.arrayBuffer())

const SE = 'Playfair'
const SF = 'Inter'
const CORAL = '#E8724A'

const Brand = ({ size = 34 }) => (
  <span style={{ display: 'flex', fontFamily: SE, fontWeight: 700, fontSize: size }}>
    <span style={{ color: '#F2F0ED' }}>Rated</span>
    <span style={{ color: CORAL }}>News</span>
  </span>
)

function Hybrid({ title, img, count, ribbon, k }) {
  const W = Math.round(1200 * k), H = Math.round(630 * k)
  const z = n => Math.round(n * k)
  return (
    <div style={{ display: 'flex', width: W, height: H, position: 'relative', background: '#141210' }}>
      {img ? (
        <img src={img} width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} />
      ) : null}
      {/* scrim */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: 'linear-gradient(180deg, rgba(18,16,15,0.35) 0%, rgba(18,16,15,0.10) 30%, rgba(18,16,15,0.85) 74%, rgba(18,16,15,0.96) 100%)' }} />
      {/* top bar */}
      <div style={{ position: 'absolute', top: z(36), left: z(40), right: z(40), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'rgba(24,21,19,0.84)', borderRadius: z(11), padding: `${z(12)}px ${z(22)}px` }}>
          <Brand size={z(34)} />
        </div>
        {ribbon ? (
          <div style={{ display: 'flex', fontFamily: SF, fontSize: z(22), fontWeight: 800, letterSpacing: 2.5, color: '#fff', background: '#C0392B', padding: `${z(10)}px ${z(22)}px`, borderRadius: 99 }}>
            {ribbon}
          </div>
        ) : null}
      </div>
      {/* bottom */}
      <div style={{ position: 'absolute', left: z(40), right: z(40), bottom: z(32), display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontFamily: SE, fontSize: z(title.length > 70 ? 54 : 64), lineHeight: 1.12, fontWeight: 700, color: '#FBFAF8', marginBottom: z(20) }}>
          {title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(255,255,255,0.36)', paddingTop: z(18) }}>
          <span style={{ fontFamily: SF, fontSize: z(25), fontWeight: 700, color: '#F0B79E' }}>
            {count ? `${count} outlets covering — compare every angle` : 'compare every angle of the story'}
          </span>
          <span style={{ fontFamily: SF, fontSize: z(23), color: '#D8D4CF' }}>ratednews.com</span>
        </div>
      </div>
    </div>
  )
}

function Clash({ ao, aq, bo, bq, foot, k }) {
  const W = Math.round(1200 * k), H = Math.round(630 * k)
  const z = n => Math.round(n * k)
  const qSize = z(Math.max(aq.length, bq.length) > 110 ? 34 : 42)
  // Blue pane first (left), warm red second — readers parse the colours as
  // political lean, and compose puts the more left-leaning outlet in slot A.
  const pane = (outlet, quote, first) => (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1,
      // Extra padding on the seam side keeps quotes clear of the pill
      padding: first ? `${z(42)}px ${z(120)}px ${z(46)}px ${z(50)}px` : `${z(42)}px ${z(50)}px ${z(46)}px ${z(120)}px`,
      background: first
        ? 'linear-gradient(160deg, #1E2732, #191E24)'
        : 'linear-gradient(200deg, #33221B, #241C18)',
      gap: z(20),
    }}>
      <span style={{ fontFamily: SF, fontSize: z(24), fontWeight: 800, letterSpacing: 2, color: first ? '#7FA8D6' : CORAL }}>
        {outlet.toUpperCase()}
      </span>
      <span style={{ fontFamily: SE, fontSize: qSize, lineHeight: 1.28, color: '#F0EEEA' }}>
        “{quote}”
      </span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H, background: '#191715' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${z(28)}px ${z(52)}px` }}>
        <Brand size={z(34)} />
        <span style={{ fontFamily: SF, fontSize: z(22), fontWeight: 800, letterSpacing: 3.5, color: '#8A857E' }}>COVERAGE CHECK</span>
      </div>
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {pane(ao, aq, true)}
        {pane(bo, bq, false)}
        <div style={{ position: 'absolute', left: z(598), top: z(40), bottom: z(40), width: z(3), display: 'flex', background: 'rgba(255,255,255,0.18)' }} />
        <div style={{
          position: 'absolute', left: z(600), top: '44%', display: 'flex',
          transform: 'translateX(-50%)',
          background: '#191715', border: '2px solid rgba(255,255,255,0.28)', borderRadius: 99,
          padding: `${z(11)}px ${z(24)}px`, fontFamily: SF, fontSize: z(21), fontWeight: 800, letterSpacing: 3, color: '#CFCBC5',
        }}>
          SAME STORY
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${z(26)}px ${z(52)}px`, borderTop: '2px solid rgba(255,255,255,0.12)' }}>
        <span style={{ fontFamily: SF, fontSize: z(22), color: '#97918A' }}>{foot || 'Two outlets. Two different stories.'}</span>
        <span style={{ fontFamily: SF, fontSize: z(22), fontWeight: 700, color: CORAL }}>ratednews.com</span>
      </div>
    </div>
  )
}

export default async function handler(req) {
  try {
    const { searchParams: q } = new URL(req.url)
    const type = q.get('type')
    // ?w=900 renders a scaled-down card (Bluesky's blob cap is ~976KB)
    const w = Math.min(1200, Math.max(600, parseInt(q.get('w') || '1200', 10) || 1200))
    const k = w / 1200
    const size = {
      width: Math.round(1200 * k),
      height: Math.round(630 * k),
      fonts: [
        { name: 'Playfair', data: await playfair, weight: 700, style: 'normal' },
        { name: 'Inter', data: await inter, weight: 700, style: 'normal' },
      ],
    }

    if (type === 'hybrid') {
      const title = (q.get('title') || '').slice(0, 120)
      if (!title) return new Response('Missing title', { status: 400 })
      const img = q.get('img') || null
      // http(s) only, and skip formats Satori can't decode (webp/avif)
      const safeImg = img && /^https?:\/\//.test(img) && !/\.(webp|avif)(\?|$)/i.test(img) ? img : null
      const count = parseInt(q.get('count') || '0', 10) || 0
      const ribbon = (q.get('ribbon') || '').slice(0, 16).toUpperCase() || null
      return new ImageResponse(<Hybrid title={title} img={safeImg} count={count} ribbon={ribbon} k={k} />, size)
    }

    if (type === 'clash') {
      const ao = (q.get('ao') || '').slice(0, 40)
      const aq = (q.get('aq') || '').slice(0, 160)
      const bo = (q.get('bo') || '').slice(0, 40)
      const bq = (q.get('bq') || '').slice(0, 160)
      if (!ao || !aq || !bo || !bq) return new Response('Missing contrast params', { status: 400 })
      const foot = (q.get('foot') || '').slice(0, 90)
      return new ImageResponse(<Clash ao={ao} aq={aq} bo={bo} bq={bq} foot={foot} k={k} />, size)
    }

    return new Response('Unknown type', { status: 400 })
  } catch (e) {
    console.error('[social-card]', e.message)
    return new Response('Card render failed', { status: 500 })
  }
}
