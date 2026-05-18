'use client'
import { useMemo, useState } from 'react'
import { epley1RM } from '@/lib/progress'
import type { LoadState } from '@/lib/fetchJson'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Lang } from '@/lib/i18n'

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }
const FAILURE_TAG = 'cedimento'

type HistoryStats = {
  lastPerformance: { date: string; weight: number; reps: number; rpe?: number; note?: string; daysAgo: number } | null
  lastFailure: { date: string; weight: number; reps: number; daysAgo: number } | null
  recentSets: Array<{ date: string; weight: number; reps: number; rpe?: number; note?: string; e1rm: number }>
  maxE1rm: number
  avgIntensity: number
}

export default function ExerciseHistory({
  exerciseId, exerciseName, setsState, currentSessionId,
}: {
  exerciseId: string
  exerciseName: string
  setsState: LoadState<any[]>
  currentSessionId?: string
}) {
  const t = useT()
  const lang = useLang()
  const [expanded, setExpanded] = useState(false)

  const stats = useMemo<HistoryStats | null>(() => {
    if (setsState.status !== 'success') return null
    const sets = setsState.data || []
    const exerciseSets = sets
      .filter((s: any) => s.exerciseId === exerciseId && s.sessionId !== currentSessionId)
      .map((s: any) => ({
        ...s, date: new Date(s.ts),
        weight: Number(s.weight), reps: Number(s.reps),
        rpe: s.rpe ? Number(s.rpe) : undefined,
      }))
      .filter((s: any) => s.weight && s.reps)
      .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())

    if (exerciseSets.length === 0) return null

    const now = new Date()
    const last = exerciseSets[0]
    const lastPerformance = {
      date: last.date.toLocaleDateString(LOCALE[lang]),
      weight: last.weight, reps: last.reps, rpe: last.rpe, note: last.note,
      daysAgo: Math.floor((now.getTime() - last.date.getTime()) / (1000 * 60 * 60 * 24)),
    }

    const failureSet = exerciseSets.find((s: any) => s.rpe === 10 || s.note?.includes(FAILURE_TAG))
    const lastFailure = failureSet ? {
      date: failureSet.date.toLocaleDateString(LOCALE[lang]),
      weight: failureSet.weight, reps: failureSet.reps,
      daysAgo: Math.floor((now.getTime() - failureSet.date.getTime()) / (1000 * 60 * 60 * 24)),
    } : null

    const recentSets = exerciseSets.slice(0, 5).map((s: any) => ({
      date: s.date.toLocaleDateString(LOCALE[lang]),
      weight: s.weight, reps: s.reps, rpe: s.rpe, note: s.note,
      e1rm: Math.round(epley1RM(s.weight, s.reps)),
    }))

    let maxE1rm = 0, intensitySum = 0, intensityCount = 0
    exerciseSets.forEach((s: any) => {
      const e1 = epley1RM(s.weight, s.reps)
      maxE1rm = Math.max(maxE1rm, e1)
      if (e1) { intensitySum += s.weight / e1; intensityCount++ }
    })

    return {
      lastPerformance, lastFailure, recentSets,
      maxE1rm: Math.round(maxE1rm),
      avgIntensity: intensityCount ? Math.round((intensitySum / intensityCount) * 100) : 0,
    }
  }, [setsState, exerciseId, currentSessionId, lang])

  if (setsState.status === 'loading') {
    return (
      <div className="space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-12" />
      </div>
    )
  }
  if (setsState.status === 'error') {
    return (
      <div className="p-3 rounded-xl bg-accent-50 text-accent-600 text-sm">
        {t.exerciseHistory.errorLoad}
      </div>
    )
  }
  if (!stats) {
    return (
      <div className="p-3 rounded-xl bg-warning/8 text-ink-soft text-sm">
        <strong>{t.exerciseHistory.firstTimePrefix}</strong> con {exerciseName}{t.exerciseHistory.firstTimeSuffix}
      </div>
    )
  }

  const formatDaysAgo = (days: number) => {
    if (days === 0) return t.exerciseHistory.today
    if (days === 1) return t.exerciseHistory.yesterday
    if (days < 7) return `${days} ${t.exerciseHistory.daysAgoSuffix}`
    if (days < 14) return t.exerciseHistory.weeksAgoSingular
    if (days < 30) return `${Math.floor(days / 7)} ${t.exerciseHistory.weeksAgoSuffix}`
    const months = Math.floor(days / 30)
    const unit = months === 1 ? t.exerciseHistory.monthSingular : t.exerciseHistory.monthPlural
    return `${months} ${unit} ${t.exerciseHistory.monthsAgoSuffix}`
  }

  const stale = (stats.lastPerformance?.daysAgo || 0) > 14

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-2xl p-3 ${stale ? 'bg-warning/10' : 'bg-paper-sunken'}`}>
          <div className="label">{t.exerciseHistory.lastTime}</div>
          {stats.lastPerformance && (
            <>
              <div className="text-[15px] font-semibold num mt-1">
                {stats.lastPerformance.weight} kg × {stats.lastPerformance.reps}
                {stats.lastPerformance.rpe && (
                  <span className="text-muted ml-1 text-xs">@{stats.lastPerformance.rpe}</span>
                )}
              </div>
              <div className={`text-[11px] mt-0.5 ${stale ? 'text-warning' : 'text-muted'}`}>
                {formatDaysAgo(stats.lastPerformance.daysAgo)}
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl p-3 bg-paper-sunken">
          <div className="label">{t.exerciseHistory.maxE1rm}</div>
          <div className="text-[15px] font-semibold num mt-1">
            {stats.maxE1rm} <span className="text-muted text-xs">kg</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5 num">
            {t.exerciseHistory.avgIntensityShort} {stats.avgIntensity}%
          </div>
        </div>
      </div>

      {stats.recentSets.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-muted hover:text-ink-soft flex items-center gap-1 px-1"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {t.exerciseHistory.expandPrefix} {stats.recentSets.length} set
          </button>
          {expanded && (
            <div className="space-y-1 px-1">
              {stats.recentSets.map((set, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted">{set.date}</span>
                  <span className="num">
                    {set.weight} × {set.reps}
                    {set.rpe && <span className="text-muted ml-1">@{set.rpe}</span>}
                  </span>
                  <span className="text-muted-2 num">e1RM {set.e1rm}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
