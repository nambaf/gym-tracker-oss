'use client'

import { useEffect, useRef } from 'react'

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled) {
      releaseWakeLock()
      return
    }

    requestWakeLock()

    // Re-acquire the wake lock when the page becomes visible again.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      releaseWakeLock()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled])

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        const sentinel = await navigator.wakeLock.request('screen')
        wakeLockRef.current = sentinel
        // The browser releases the sentinel on its own whenever the document is
        // hidden. Without clearing the ref the guard above stayed true forever,
        // so the screen never woke back up for the rest of the workout.
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null
        })
      }
    } catch (err) {
      console.warn('Wake Lock not supported or denied:', err)
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }
}
