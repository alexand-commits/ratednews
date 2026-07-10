#!/usr/bin/env node
/**
 * Weekly digest — Monday mornings. The week's most-covered stories, trending
 * topics and top-rated outlets, emailed to every user who hasn't opted out.
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 * Sender: digest@ratednews.com (domain must be verified in Resend first).
 * Without RESEND_API_KEY the run logs the audience and exits 0 — safe to ship
 * ahead of the key.
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SITE = 'https://www.ratednews.com'

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const slug = (title, id) => {
  const t = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '')
  return `${t}-${String(id).slice(0, 8)}`
}

// ── 1. The week's content ─────────────────────────────────────────────────────
const STOP = new Set(['the','a','an','in','on','at','to','for','of','and','or','is','are','was','were','says','say','said','after','as','with','by','from','over','into','its','his','her','their','will','have','has','had','been','be','but','not','this','that','than','then'])
// Light stemming so investigating/investigation match across headlines
const stem = w => w.replace(/(ings?|ions?|ed|es|s)$/, '')
const sigTokens = t => new Set((t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)).map(stem))

async function weekContent() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const { data } = await db.from('articles')
    .select('id, title, published_at, image_url, cluster_id, cluster_peers, outlets(name)')
    .not('cluster_id', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(2000)

  // One row per cluster — prefer the rep with the biggest peer count, keep an
  // image from any member so rows stay illustrated.
  const clusters = new Map()
  for (const a of data || []) {
    const c = clusters.get(a.cluster_id)
    if (!c || (a.cluster_peers?.length || 0) > (c.cluster_peers?.length || 0)) {
      clusters.set(a.cluster_id, { ...a, image_url: a.image_url || c?.image_url || null })
    } else if (!c.image_url && a.image_url) {
      c.image_url = a.image_url
    }
  }

  // One slot per saga — a big running story fragments into several clusters
  // (same guard as the social desk) and would otherwise fill the digest.
  const sorted = [...clusters.values()].sort((x, y) => (y.cluster_peers?.length || 0) - (x.cluster_peers?.length || 0))
  const topStories = []
  const tokenSets = []
  for (const c of sorted) {
    const t = sigTokens(c.title)
    const sameSaga = tokenSets.some(prev => {
      let shared = 0, distinctive = false
      for (const w of t) if (prev.has(w)) { shared++; if (w.length >= 7) distinctive = true }
      // 3 shared stems, or 2 with a distinctive one (e.g. 'widdecombe') —
      // stops arrest-development headlines re-occupying a saga's slot while
      // keeping short generic overlaps ('semi', 'final') apart.
      return shared >= 3 || (shared >= 2 && distinctive)
    })
    if (sameSaga) continue
    topStories.push(c)
    tokenSets.push(t)
    if (topStories.length === 8) break
  }

  const { data: outlets } = await db.from('outlets')
    .select('id, name, community_score, total_ratings')
    .gte('total_ratings', 3)
    .gt('community_score', 0)
    .order('community_score', { ascending: false })
    .limit(3)

  return { topStories, topOutlets: outlets || [] }
}

// ── 2. Render ─────────────────────────────────────────────────────────────────
function renderEmail({ topStories, topOutlets }, unsubToken) {
  const [lead, ...rest] = topStories
  const leadHtml = lead ? `
    <tr><td style="padding:0 0 6px">
      <a href="${SITE}/story/${slug(lead.title, lead.id)}" style="text-decoration:none">
        ${lead.image_url ? `<img src="${lead.image_url}" alt="" width="480" style="width:100%;max-width:480px;border-radius:10px;display:block;margin-bottom:12px" />` : ''}
        <span style="color:#1a1917;font-size:20px;font-weight:700;line-height:1.3;font-family:Georgia,serif">${esc(lead.title)}</span>
      </a>
      <div style="font-size:12px;color:#9e9b95;margin-top:6px;padding-bottom:14px;border-bottom:1px solid #eee">${esc(lead.outlets?.name || '')} · <span style="color:#d85a30;font-weight:600">${(lead.cluster_peers?.length || 0) + 1} sources covering it</span></div>
    </td></tr>` : ''

  const stories = rest.map(a => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #eee">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="top">
          <a href="${SITE}/story/${slug(a.title, a.id)}" style="color:#1a1917;text-decoration:none;font-size:15px;font-weight:600;line-height:1.4;font-family:Georgia,serif">${esc(a.title)}</a>
          <div style="font-size:12px;color:#9e9b95;margin-top:5px">${esc(a.outlets?.name || '')} · ${(a.cluster_peers?.length || 0) + 1} sources</div>
        </td>
        ${a.image_url ? `<td width="86" valign="top" style="padding-left:14px"><a href="${SITE}/story/${slug(a.title, a.id)}"><img src="${a.image_url}" alt="" width="72" height="72" style="border-radius:8px;object-fit:cover;display:block" /></a></td>` : ''}
      </tr></table>
    </td></tr>`).join('')

  const outlets = topOutlets.length ? `
    <h3 style="font-size:13px;letter-spacing:1px;color:#9e9b95;margin:28px 0 6px">TOP RATED OUTLETS</h3>
    ${topOutlets.map(o => `<div style="font-size:14px;padding:5px 0">${esc(o.name)} — <span style="color:#639922;font-weight:700">${(o.community_score / 20).toFixed(1)}</span> <span style="color:#9e9b95;font-size:12px">(${o.total_ratings} ratings)</span></div>`).join('')}`
    : ''

  return `<!doctype html><html><body style="margin:0;background:#f8f6f4;padding:24px 12px;font-family:-apple-system,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px" cellpadding="0" cellspacing="0">
    <tr><td>
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:700">Rated<span style="color:#d85a30">News</span></div>
      <div style="font-size:12px;color:#9e9b95;margin:4px 0 20px">The week's most-covered stories · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${leadHtml}${stories}</table>
      ${outlets}
      <a href="${SITE}" style="display:inline-block;margin-top:24px;background:#d85a30;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 22px;border-radius:20px">Read this week's coverage →</a>
      <div style="font-size:11px;color:#9e9b95;margin-top:28px;border-top:1px solid #eee;padding-top:14px">
        You're receiving this because you have a RatedNews account.
        <a href="${SITE}/api/unsubscribe?token=${unsubToken}" style="color:#9e9b95">Unsubscribe</a>
      </div>
    </td></tr>
  </table></body></html>`
}

// ── 3. Audience + send ────────────────────────────────────────────────────────
async function main() {
  const content = await weekContent()
  if (!content.topStories.length) { console.log('No content this week — skipping send.'); return }

  // All users, ensure prefs rows exist, filter opt-outs
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    users.push(...(data?.users || []))
    if (!data || data.users.length < 200) break
  }
  const ids = users.map(u => u.id)
  if (ids.length) {
    // Insert missing pref rows (opted in by default, ignore conflicts)
    await db.from('email_prefs').upsert(ids.map(user_id => ({ user_id })), { onConflict: 'user_id', ignoreDuplicates: true })
  }
  const { data: prefs } = await db.from('email_prefs').select('user_id, weekly_digest, unsub_token').in('user_id', ids)
  const prefMap = new Map((prefs || []).map(p => [p.user_id, p]))
  const accountAudience = users.filter(u => u.email && (prefMap.get(u.id)?.weekly_digest !== false))

  // Public sidebar signups (no account) — dedupe against account emails
  const { data: subs } = await db.from('digest_subscribers').select('email, unsub_token').eq('subscribed', true)
  const accountEmails = new Set(accountAudience.map(u => u.email.toLowerCase()))
  const publicAudience = (subs || []).filter(s => !accountEmails.has(s.email.toLowerCase()))

  const audience = [
    ...accountAudience.map(u => ({ email: u.email, token: prefMap.get(u.id)?.unsub_token || '' })),
    ...publicAudience.map(s => ({ email: s.email, token: s.unsub_token })),
  ]
  console.log(`Audience: ${audience.length} (${accountAudience.length} accounts + ${publicAudience.length} subscribers)`)

  if (process.env.DIGEST_PREVIEW) {
    const fs = await import('fs')
    fs.writeFileSync(process.env.DIGEST_PREVIEW, renderEmail(content, 'preview-token'))
    console.log('Preview written to', process.env.DIGEST_PREVIEW)
    return
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — dry run only, no emails sent.')
    return
  }

  let sent = 0
  for (const u of audience) {
    const html = renderEmail(content, u.token)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'RatedNews <digest@ratednews.com>',
        to: u.email,
        subject: `This week's most-covered stories — ${content.topStories[0]?.title?.slice(0, 60)}…`,
        html,
        headers: { 'List-Unsubscribe': `<${SITE}/api/unsubscribe?token=${u.token}>` },
      }),
    })
    if (res.ok) sent++
    else console.error(`send failed for ${u.email}: ${res.status} ${await res.text()}`)
    await new Promise(r => setTimeout(r, 600)) // stay under Resend rate limits
  }
  console.log(`✅ Sent ${sent}/${audience.length}`)
}

main().catch(err => { console.error('[digest]', err); process.exit(1) })
