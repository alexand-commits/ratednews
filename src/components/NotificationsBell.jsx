import React, { useState, useEffect, useRef } from 'react'
import { db } from '../lib/supabase'
import { timeAgo } from '../utils/helpers'

// Header bell — replies to your comments land here. Unread count fetched on
// mount and every 5 min while the tab is visible; opening the dropdown marks
// everything read. (Replies aren't a 90-second-latency feature, and background
// tabs shouldn't poll all day.)
export default function NotificationsBell({ user, navigate }) {
  const [open, setOpen]     = useState(false)
  const [items, setItems]   = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (!user) return
    let mounted = true
    async function poll() {
      if (document.visibilityState !== 'visible') return
      const { count } = await db.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('read', false)
      if (mounted) setUnread(count || 0)
    }
    poll()
    const id = setInterval(poll, 300000)
    // Re-check immediately when the tab is refocused rather than waiting out the interval.
    const onVis = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onVis)
    return () => { mounted = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [user?.id])

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null

  async function openBell() {
    const next = !open
    setOpen(next)
    if (!next) return
    const { data } = await db.from('notifications')
      .select('id, type, article_id, article_title, actor_name, snippet, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8)
    setItems(data || [])
    if ((data || []).some(n => !n.read)) {
      await db.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
      setUnread(0)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={openBell}
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ''}`}
        className="theme-toggle"
        style={{ position: 'relative' }}
      >
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 16, background: 'var(--coral)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', width: 300, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', borderBottom: '0.5px solid var(--border)' }}>
            Notifications
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '18px 14px', fontSize: 13, color: 'var(--text3)' }}>
              Nothing yet — replies to your comments land here.
            </div>
          ) : items.map(n => (
            <button
              key={n.id}
              onClick={() => { setOpen(false); if (n.article_id) navigate('article', { articleId: n.article_id, title: n.article_title }) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', background: n.read ? 'none' : 'rgba(216,90,48,0.05)', border: 'none', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                <strong>{n.actor_name || 'Someone'}</strong> replied to your comment
              </div>
              {n.snippet && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{n.snippet}"</div>}
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                {n.article_title ? `${n.article_title.slice(0, 48)}… · ` : ''}{timeAgo(n.created_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
