import { useState, useRef, useCallback } from 'react'

const PULL_THRESHOLD = 70

export function usePullToRefresh(onRefresh) {
  const pullStartY = useRef(0)
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const onTouchStart = useCallback((e) => {
    if (window.scrollY <= 5 && !isRefreshing) {
      pullStartY.current = e.touches[0].clientY
    }
  }, [isRefreshing])

  const onTouchMove = useCallback((e) => {
    if (!pullStartY.current || isRefreshing) return
    const delta = e.touches[0].clientY - pullStartY.current
    if (delta > 0 && window.scrollY <= 5) {
      setPullY(Math.min(delta * 0.45, 80))
    } else {
      setPullY(0)
      pullStartY.current = 0
    }
  }, [isRefreshing])

  const onTouchEnd = useCallback(async () => {
    if (pullY >= PULL_THRESHOLD && onRefresh) {
      setPullY(0)
      setIsRefreshing(true)
      await onRefresh()
      setIsRefreshing(false)
    } else {
      setPullY(0)
    }
    pullStartY.current = 0
  }, [pullY, onRefresh])

  const pulling = pullY > 0 || isRefreshing
  const readyToRelease = pullY >= PULL_THRESHOLD

  const indicator = pulling ? (
    <div style={{
      position: 'fixed',
      top: 56,
      left: '50%',
      transform: `translateX(-50%) translateY(${isRefreshing ? 8 : Math.max(0, pullY - 20)}px)`,
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: 20,
      padding: '5px 14px',
      fontSize: 12,
      color: readyToRelease ? 'var(--coral)' : 'var(--text2)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      zIndex: 200,
      transition: isRefreshing ? 'transform 0.2s ease' : 'none',
      pointerEvents: 'none',
    }}>
      <span style={{
        display: 'inline-block',
        animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
        transform: readyToRelease && !isRefreshing ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}>
        {isRefreshing ? '↻' : '↓'}
      </span>
      {isRefreshing ? 'Refreshing…' : readyToRelease ? 'Release to refresh' : 'Pull to refresh'}
    </div>
  ) : null

  return {
    indicator,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    isRefreshing,
  }
}
