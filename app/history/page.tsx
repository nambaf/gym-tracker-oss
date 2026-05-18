'use client'
import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { epley1RM } from '@/lib/progress'
import { useDataStore } from '@/store/data'
import { VolumeChart } from '@/components/VolumeChart'
import { IntensityChart } from '@/components/IntensityChart'
import { BodyMap } from '@/components/BodyMap'
import type { PlanRow } from '@/lib/models'
import {
  calculateSessionMuscleStatus,
  getWeeklyVolumeData,
  getDailyIntensityData,
  getWeeklyVolumeByMuscle,
} from '@/lib/bodyMapUtils'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Lang } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/dictionaries/it'

type Period = 'week' | 'month'
type DateRange = { start: Date; end: Date; label: string }

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }

function getWeekBounds(date: Date): { monday: Date; sunday: Date } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function generatePeriodOptions(t: Dictionary): DateRange[] {
  const now = new Date()
  const opts: DateRange[] = []
  const { monday: thisMonday, sunday: thisSunday } = getWeekBounds(now)
  opts.push({ start: thisMonday, end: thisSunday, label: t.history.periodThisWeek })
  const { monday: lastMonday, sunday: lastSunday } = getWeekBounds(
    new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
  )
  opts.push({ start: lastMonday, end: lastSunday, label: t.history.periodLastWeek })
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)
  opts.push({ start: thirtyDaysAgo, end: now, label: t.history.periodLast30 })
  const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3)
  opts.push({ start: threeMonthsAgo, end: now, label: t.history.periodLast3m })
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6)
  opts.push({ start: sixMonthsAgo, end: now, label: t.history.periodLast6m })
  return opts
}

function shortDay(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short' }).format(d)
}

function shortMonth(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { month: 'short' }).format(d)
}

export default function HistoryPage() {
  const t = useT()
  const lang = useLang()
  const {
    sessions: sessionsState, sets: setsState, exercises: exercisesState,
    plan: planState, loadAll, trainingMode,
  } = useDataStore()

  useEffect(() => { loadAll() }, [loadAll])

  const loading =
    sessionsState.status !== 'success' ||
    setsState.status !== 'success' ||
    exercisesState.status !== 'success'

  const [selectedPeriod, setSelectedPeriod] = useState<DateRange | null>(null)
  const [selectedChartPeriod, setSelectedChartPeriod] = useState<Period>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const periodOptions = useMemo(() => generatePeriodOptions(t), [t])

  const exerciseNames = useMemo(() => {
    const map = new Map<string, string>()
    exercisesState.data?.forEach(ex => map.set(ex.id, ex.name))
    return map
  }, [exercisesState.data])

  useEffect(() => {
    if (!selectedPeriod && sessionsState.status === 'success' && setsState.status === 'success') {
      setSelectedPeriod(periodOptions[0])
    }
  }, [selectedPeriod, sessionsState.status, setsState.status, periodOptions])

  const volumeData = useMemo(() => {
    if (sessionsState.status !== 'success' || setsState.status !== 'success') return []
    return getWeeklyVolumeData(sessionsState.data || [], setsState.data || [], selectedChartPeriod === 'week' ? 4 : 12)
  }, [sessionsState, setsState, selectedChartPeriod])

  const intensityData = useMemo(() => {
    if (sessionsState.status !== 'success' || setsState.status !== 'success') return []
    return getDailyIntensityData(sessionsState.data || [], setsState.data || [], selectedChartPeriod === 'week' ? 7 : 30)
  }, [sessionsState, setsState, selectedChartPeriod])

  const muscleVolumeData = useMemo(() => {
    if (sessionsState.status !== 'success' || setsState.status !== 'success' || exercisesState.status !== 'success') return []
    const { monday, sunday } = getWeekBounds(new Date())
    return getWeeklyVolumeByMuscle(sessionsState.data || [], setsState.data || [], exercisesState.data || [], monday, sunday)
  }, [sessionsState, setsState, exercisesState])

  const filteredSessions = useMemo(() => {
    const currentSessions = sessionsState.data || []
    if (!selectedPeriod) return currentSessions
    return currentSessions
      .filter(s => {
        const sDate = new Date(s.date)
        return sDate >= selectedPeriod.start && sDate <= selectedPeriod.end
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [sessionsState.data, selectedPeriod])

  const exToPlanDay = useMemo(() => {
    const map = new Map<string, string>()
    if (planState.status !== 'success') return map
    ;(planState.data || []).forEach((r: PlanRow) => {
      if (r.exerciseId && r.day && !map.has(r.exerciseId)) {
        map.set(r.exerciseId, String(r.day))
      }
    })
    return map
  }, [planState])

  const sessionsWithStats = useMemo(() => {
    const currentSets = setsState.data || []
    const exercisesList = exercisesState.data || []
    return filteredSessions
      .map(session => {
        const sessionSets = currentSets.filter(s => s.sessionId === session.id)
        if (sessionSets.length === 0) return null
        let volume = 0, intensitySum = 0, intensityCount = 0
        const exerciseMap = new Map<string, { name: string; sets: any[] }>()
        const dayHits = new Map<string, number>()
        sessionSets.forEach(set => {
          const w = Number(set.weight), r = Number(set.reps)
          if (w && r) {
            volume += w * r
            const e1 = epley1RM(w, r)
            if (e1) { intensitySum += (w / e1); intensityCount++ }
          }
          const exName = exerciseNames.get(set.exerciseId) || set.exerciseId
          if (!exerciseMap.has(set.exerciseId)) {
            exerciseMap.set(set.exerciseId, { name: exName, sets: [] })
          }
          exerciseMap.get(set.exerciseId)!.sets.push(set)
          const planDay = exToPlanDay.get(set.exerciseId)
          if (planDay) dayHits.set(planDay, (dayHits.get(planDay) || 0) + 1)
        })
        const planDay = Array.from(dayHits.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null
        const muscleData = calculateSessionMuscleStatus(sessionSets, exercisesList)
        return {
          ...session,
          volume: Math.round(volume),
          avgIntensity: intensityCount ? Math.round((intensitySum / intensityCount) * 100) : null,
          totalSets: sessionSets.length,
          exercises: Array.from(exerciseMap.values()),
          muscleData,
          planDay,
        }
      })
      .filter((session): session is NonNullable<typeof session> => session !== null)
  }, [filteredSessions, setsState.data, exerciseNames, exercisesState.data, exToPlanDay])

  function handleCustomPeriod() {
    if (!customStart || !customEnd) return
    const start = new Date(customStart)
    const end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    if (start < sixMonthsAgo) {
      alert(t.history.maxRangeAlert)
      return
    }
    setSelectedPeriod({
      start, end,
      label: `${start.toLocaleDateString(LOCALE[lang])} - ${end.toLocaleDateString(LOCALE[lang])}`,
    })
    setShowCustom(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl">{t.history.eyebrow}</h1>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4">
              <div className="skeleton h-6 w-1/3 mb-2" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">{t.history.eyebrow}</div>
        <h1 className="display text-[44px] leading-[0.95] tracking-tight2 mt-2">
          {t.history.titleLine1}<br /><span className="italic text-muted">{t.history.titleLine2}</span>
        </h1>
      </header>

      <div className="seg w-full grid grid-cols-2">
        <button
          className={`seg-btn ${selectedChartPeriod === 'week' ? 'active' : ''}`}
          onClick={() => setSelectedChartPeriod('week')}
        >{t.history.chartWeek}</button>
        <button
          className={`seg-btn ${selectedChartPeriod === 'month' ? 'active' : ''}`}
          onClick={() => setSelectedChartPeriod('month')}
        >{t.history.chartMonth}</button>
      </div>

      <VolumeChart weeklyData={volumeData} muscleVolumeData={muscleVolumeData} period={selectedChartPeriod} trainingMode={trainingMode} />
      <IntensityChart dailyData={intensityData} period={selectedChartPeriod} />

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">{t.history.periodTitle}</h2>
          <button className="btn-ghost text-xs" onClick={() => setShowCustom(!showCustom)}>
            {showCustom ? t.history.periodCancel : t.history.periodCustom}
          </button>
        </div>

        {!showCustom ? (
          <div className="grid grid-cols-2 gap-2">
            {periodOptions.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedPeriod(option)}
                className={`text-left rounded-xl px-3 py-2 text-[13px] font-medium transition-colors
                  ${selectedPeriod?.label === option.label
                    ? 'bg-ink text-white'
                    : 'bg-paper-sunken text-ink-soft hover:bg-paper-card'
                  }`}
              >{option.label}</button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="date" className="input flex-1" value={customStart}
              onChange={e => setCustomStart(e.target.value)} max={new Date().toISOString().split('T')[0]} />
            <input type="date" className="input flex-1" value={customEnd}
              onChange={e => setCustomEnd(e.target.value)} max={new Date().toISOString().split('T')[0]} />
            <button className="btn-primary" onClick={handleCustomPeriod}>{t.history.periodApply}</button>
          </div>
        )}

        {selectedPeriod && (
          <div className="mt-3 text-xs text-muted">
            {sessionsWithStats.length} {sessionsWithStats.length === 1 ? t.history.sessionsCountSingular : t.history.sessionsCountPlural}
          </div>
        )}
      </section>

      <section>
        <div className="label mb-3">{t.history.timelineLabel}</div>
        <div className="relative">
          {sessionsWithStats.length > 1 && (
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-ink/[0.08]" />
          )}

          <div className="space-y-5">
            {sessionsWithStats.map((session, idx) => {
              const date = new Date(session.date)
              const dayName = shortDay(date, lang)
              const dayNum = date.getDate()
              const monthName = shortMonth(date, lang)
              const hh = String(date.getHours()).padStart(2, '0')
              const mm = String(date.getMinutes()).padStart(2, '0')
              const isFirst = idx === 0

              const title = session.planDay
                || (session.exercises[0]?.name ?? t.history.emptySession)
              const subtitle = session.planDay
                ? `${session.exercises.length} ${t.history.exercisesCount}`
                : (session.exercises.length > 1
                  ? `+${session.exercises.length - 1} ${t.history.moreExercises}`
                  : null)

              return (
                <article key={session.id} className="relative pl-8">
                  <div className={`absolute left-[3px] top-1 w-[10px] h-[10px] rounded-full
                                  ${isFirst ? 'bg-accent-500' : 'bg-muted-2'}`} />

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                        {dayName} · {dayNum} {monthName} · <span className="num">{hh}:{mm}</span>
                      </div>

                      <h3 className="display text-2xl leading-tight mt-1 truncate">
                        {title}
                      </h3>

                      {subtitle && (
                        <div className="text-xs text-muted mt-0.5">{subtitle}</div>
                      )}

                      <div className="flex gap-4 mt-2 text-[12px] text-muted">
                        <span><span className="text-ink font-semibold num mr-0.5">{session.volume.toLocaleString(LOCALE[lang])}</span>kg·rep</span>
                        <span><span className="text-ink font-semibold num mr-0.5">{session.totalSets}</span>{t.history.setsSuffix}</span>
                        {session.avgIntensity != null && (
                          <span><span className="text-ink font-semibold num mr-0.5">{session.avgIntensity}%</span>{t.history.rpeSuffix}</span>
                        )}
                      </div>
                    </div>

                    {session.muscleData.size > 0 && (
                      <div className="shrink-0 -mt-1 opacity-90">
                        <BodyMap muscleData={session.muscleData} compact />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {session.exercises.slice(0, 4).map((exercise: any) => {
                      const topSet = exercise.sets[0]
                      return (
                        <Link
                          key={exercise.name}
                          href={`/exercise/${topSet?.exerciseId}`}
                          className="chip hover:bg-paper-card transition-colors"
                        >
                          {exercise.name}
                          {topSet && (
                            <span className="text-muted ml-1 font-normal">
                              {topSet.weight}×{topSet.reps}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                    {session.exercises.length > 4 && (
                      <span className="chip">{t.history.morePrefix}{session.exercises.length - 4} {t.history.morePlural}</span>
                    )}
                  </div>

                  {session.note && (
                    <div className="text-xs text-muted mt-2 italic">{session.note}</div>
                  )}
                </article>
              )
            })}
          </div>
        </div>

        {sessionsWithStats.length === 0 && (
          <div className="card p-8 text-center text-muted">
            {t.history.emptyState}
          </div>
        )}
      </section>
    </div>
  )
}
