'use client'
import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

interface WorkoutTimerProps {
  startTime: string | null
  onStart: () => void
}

export function WorkoutTimer({ startTime, onStart }: WorkoutTimerProps) {
  const t = useT()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) { setElapsed(0); return }
    const tick = () => {
      const seconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
      setElapsed(seconds >= 0 ? seconds : 0)
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [startTime])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (!startTime) {
    return (
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 bg-ink text-white rounded-full px-4 py-2 text-[13px] font-medium active:scale-[0.98] transition-transform"
      >
        <Play size={12} fill="white" />
        {t.workoutTimer.startBtn}
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 bg-paper-card border border-ink/[0.06] rounded-full px-3 py-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      <span className="font-mono text-[13px] font-semibold num text-ink">
        {formatTime(elapsed)}
      </span>
    </div>
  )
}
