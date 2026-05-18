'use client'
import { useEffect, useRef, useState } from 'react'
import { Plus, Square } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

const STORAGE_KEY = 'rest-timer-state'

interface TimerState { endTime: number | null; targetSec: number }

interface RestTimerProps {
  defaultSec?: number
  suggestedLabel?: string
}

export function RestTimer({ defaultSec = 90, suggestedLabel }: RestTimerProps) {
  const t = useT()
  const [sec, setSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [targetSec, setTargetSec] = useState(defaultSec)
  const notificationShownRef = useRef(false)

  useEffect(() => { if (!running) setTargetSec(defaultSec) }, [defaultSec, running])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state: TimerState = JSON.parse(saved)
        if (state.endTime && state.endTime > Date.now()) {
          setEndTime(state.endTime); setTargetSec(state.targetSec); setRunning(true)
        } else { localStorage.removeItem(STORAGE_KEY) }
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (endTime && running) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ endTime, targetSec }))
    } else { localStorage.removeItem(STORAGE_KEY) }
  }, [endTime, running, targetSec])

  useEffect(() => {
    if (!running || !endTime) return
    const i = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      setSec(remaining)
      if (remaining === 0) {
        setRunning(false); setEndTime(null); handleTimerComplete()
      }
    }, 100)
    return () => clearInterval(i)
  }, [running, endTime])

  function handleTimerComplete() {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 200])
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi2Gy/LaiToIHGS56+ejVA0ROKT0642cD')
      audio.play().catch(() => {})
    } catch {}
    if ('Notification' in window && Notification.permission === 'granted' && !notificationShownRef.current) {
      notificationShownRef.current = true
      new Notification(t.restTimer.notifTitle, {
        body: t.restTimer.notifBody, tag: 'rest-timer',
      })
      setTimeout(() => { notificationShownRef.current = false }, 2000)
    }
  }

  function start(seconds?: number) {
    const target = seconds || targetSec
    setEndTime(Date.now() + target * 1000)
    setTargetSec(target); setSec(target); setRunning(true)
    notificationShownRef.current = false
  }
  function stop() { setRunning(false); setEndTime(null); setSec(0) }

  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const progress = running && endTime ? Math.min(100, ((targetSec - sec) / targetSec) * 100) : 0
  const isUrgent = running && sec <= 10

  // Compact floating bar above BottomNav when running
  const floatingBar = running ? (
    <div
      className="fixed inset-x-0 z-50 px-3 pointer-events-none"
      style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 8px)' }}
    >
      <div className={`mx-auto max-w-screen-sm pointer-events-auto rounded-full shadow-lg
                       border transition-colors
                       ${isUrgent
                         ? 'bg-accent-500 text-white border-accent-600'
                         : 'bg-ink text-white border-ink-soft/30'}`}>
        <div className="flex items-stretch h-12">
          {/* Circular mini progress + time */}
          <div className="flex items-center gap-2.5 pl-3.5 pr-2">
            <div className="relative w-7 h-7">
              <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
                <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                <circle cx="14" cy="14" r="11" fill="none"
                        stroke={isUrgent ? '#ffffff' : '#d6492a'}
                        strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 11}
                        strokeDashoffset={2 * Math.PI * 11 - (progress / 100) * 2 * Math.PI * 11}
                        className="transition-all duration-200" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold num tracking-tight2">{mm}:{ss}</span>
            <span className="text-[10px] uppercase tracking-widest opacity-60 hidden xs:inline">{t.restTimer.rest}</span>
          </div>

          {/* Divider */}
          <div className="w-px bg-white/15 my-2" />

          {/* +30s */}
          <button
            onClick={() => endTime && setEndTime(endTime + 30000)}
            className="px-3 text-[12px] font-semibold inline-flex items-center gap-1 hover:bg-white/10 transition-colors"
          >
            <Plus size={12} strokeWidth={2.8} />30s
          </button>

          {/* Divider */}
          <div className="w-px bg-white/15 my-2" />

          {/* Stop */}
          <button
            onClick={stop}
            aria-label={t.restTimer.stopAria}
            className="px-3.5 inline-flex items-center gap-1.5 text-[12px] font-semibold hover:bg-white/10 transition-colors rounded-r-full"
          >
            <Square size={11} fill="currentColor" />{t.restTimer.stopBtn}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="label">{t.restTimer.label}</div>
          {suggestedLabel && (
            <div className="text-[11px] text-muted">{suggestedLabel}</div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[60, 75, 120, 150].map(s => {
            const m = Math.floor(s / 60), sec = s % 60
            return (
              <button
                key={s}
                onClick={() => start(s)}
                className={`rounded-xl py-2 text-xs font-semibold text-center num
                  ${targetSec === s
                    ? 'bg-ink text-white'
                    : 'bg-paper-sunken text-ink-soft hover:bg-paper-card'}`}
              >{m}:{String(sec).padStart(2, '0')}</button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            className="input w-20 text-center num"
            type="number" value={targetSec}
            onChange={e => setTargetSec(Number(e.target.value))}
            step={15} min={15} max={300}
          />
          <button
            onClick={() => start()}
            className="btn-primary flex-1 py-2.5 rounded-full text-sm"
          >
            {t.restTimer.startBtn} {Math.floor(targetSec / 60)}:{String(targetSec % 60).padStart(2, '0')}
          </button>
        </div>

        {running && (
          <div className="text-[11px] text-muted text-center">
            {t.restTimer.runningHint}
          </div>
        )}
      </div>

      {floatingBar}
    </>
  )
}
