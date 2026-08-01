'use client'
import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { epley1RM } from '@/lib/progress'
import { buildExerciseBests, relativeIntensity } from '@/lib/records'
import { weekBounds, parseLocalDate, localDayKey } from '@/lib/dateUtils'
import { DEFAULT_MAX_HISTORY_MONTHS } from '@/lib/settings/defaults'
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

/**
 * `n` months back, clamped to the end of the target month. Plain
 * `setMonth(getMonth() - n)` overflows: on 31 March, minus one month lands on
 * 3 March, silently shortening the window.
 */
function monthsAgo(from: Date, n: number): Date {
  const d = new Date(from)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTarget))
  return d
}

function generatePeriodOptions(t: Dictionary): DateRange[] {
  const now = new Date()
  const opts: DateRange[] = []
  const { monday: thisMonday, sunday: thisSunday } = weekBounds(now)
  opts.push({ start: thisMonday, end: thisSunday, label: t.history.periodThisWeek })
  const { monday: lastMonday, sunday: lastSunday } = weekBounds(
    new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
  )
  opts.push({ start: lastMonday, end: lastSunday, label: t.history.periodLastWeek })
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)
  opts.push({ start: thirtyDaysAgo, end: now, label: t.history.periodLast30 })
  opts.push({ start: monthsAgo(now, 3), end: now, label: t.history.periodLast3m })
  opts.push({ start: monthsAgo(now, 6), end: now, label: t.history.periodLast6m })
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
    plan: planState, loadAll, trainingMode, storedSettings,
  } = useDataStore()

  const maxHistoryMonths = storedSettings.maxHistoryMonths ?? DEFAULT_MAX_HISTORY_MONTHS

  useEffect(() => { loadAll() }, [loadAll])

  const hasError =
    sessionsState.status === 'error' ||
    setsState.status === 'error' ||
    exercisesState.status === 'error'
  // 'error' used to satisfy `!== 'success'` too, so an expired token left the
  // page on its skeleton forever with no way to retry.
  const loading = !hasError && (
    sessionsState.status !== 'success' ||
    setsState.status !== 'success' ||
    exercisesState.status !== 'success'
  )

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
    const { monday, sunday } = weekBounds(new Date())
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

  /**
   * exerciseId -> every plan day that contains it. The old map kept only the
   * first day seen, so on an A/B split the second day never won a vote and
   * every session was labelled with the first.
   */
  const exToPlanDays = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (planState.status !== 'success') return map
    ;(planState.data || []).forEach((r: PlanRow) => {
      if (!r.exerciseId || !r.day) return
      const key = String(r.day)
      const cur = map.get(r.exerciseId)
      if (cur) cur.add(key)
      else map.set(r.exerciseId, new Set([key]))
    })
    return map
  }, [planState])

  /** Best e1RM per exercise across the whole history, for relative intensity. */
  const exerciseBests = useMemo(
    () => buildExerciseBests(setsState.data || []),
    [setsState.data]
  )

  const sessionsWithStats = useMemo(() => {
    const currentSets = setsState.data || []
    const exercisesList = exercisesState.data || []
    return filteredSessions
      .map(session => {
        // Scan order is arbitrary; sort so "first exercise" and set numbering
        // reflect the order the work was actually done in.
        const sessionSets = currentSets
          .filter(s => s.sessionId === session.id)
          .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')))
        if (sessionSets.length === 0) return null
        let volume = 0, intensitySum = 0, intensityCount = 0
        const exerciseMap = new Map<string, { id: string; name: string; sets: any[]; topSet: any }>()
        const dayVotes = new Map<string, Set<string>>()
        sessionSets.forEach(set => {
          const w = Number(set.weight), r = Number(set.reps)
          if (Number.isFinite(w) && Number.isFinite(r) && r > 0) volume += w * r
          const rel = relativeIntensity(set, exerciseBests)
          if (rel !== null) { intensitySum += rel; intensityCount++ }

          const exName = exerciseNames.get(set.exerciseId) || set.exerciseId
          let entry = exerciseMap.get(set.exerciseId)
          if (!entry) {
            entry = { id: set.exerciseId, name: exName, sets: [], topSet: set }
            exerciseMap.set(set.exerciseId, entry)
          }
          entry.sets.push(set)
          // The chip is labelled "top set", so show the heaviest effort rather
          // than whichever set the database happened to return first — usually
          // a warm-up.
          if (epley1RM(w, r) > epley1RM(Number(entry.topSet.weight), Number(entry.topSet.reps))) {
            entry.topSet = set
          }

          for (const day of exToPlanDays.get(set.exerciseId) || []) {
            const seen = dayVotes.get(day)
            if (seen) seen.add(set.exerciseId)
            else dayVotes.set(day, new Set([set.exerciseId]))
          }
        })
        // Vote by distinct exercises matched, not by set count: an eight-set
        // session on one exercise used to outvote four exercises of the day
        // actually being trained.
        const ranked = Array.from(dayVotes.entries()).sort((a, b) => b[1].size - a[1].size)
        const planDay = ranked.length && (ranked.length === 1 || ranked[0][1].size > ranked[1][1].size)
          ? ranked[0][0]
          : null
        const muscleData = calculateSessionMuscleStatus(sessionSets, exercisesList)
        return {
          ...session,
          volume: Math.round(volume),
          avgIntensity: intensityCount ? Math.round(intensitySum / intensityCount) : null,
          totalSets: sessionSets.length,
          exercises: Array.from(exerciseMap.values()),
          muscleData,
          planDay,
        }
      })
      .filter((session): session is NonNullable<typeof session> => session !== null)
  }, [filteredSessions, setsState.data, exerciseNames, exercisesState.data, exToPlanDays, exerciseBests])

  const [customError, setCustomError] = useState('')

  function handleCustomPeriod() {
    setCustomError('')
    if (!customStart || !customEnd) return
    // `new Date('2026-07-01')` parses as UTC midnight, which is the previous
    // day west of Greenwich and 02:00 local in Rome — either way the range
    // silently missed sessions at its edges.
    let start = parseLocalDate(customStart)
    let end = parseLocalDate(customEnd, true)
    if (!start || !end) { setCustomError(t.history.invalidRange); return }
    // Accept an inverted range instead of showing an empty list.
    if (start > end) {
      const swapped = parseLocalDate(customEnd)
      const swappedEnd = parseLocalDate(customStart, true)
      if (!swapped || !swappedEnd) { setCustomError(t.history.invalidRange); return }
      start = swapped
      end = swappedEnd
    }
    const earliest = monthsAgo(new Date(), maxHistoryMonths)
    if (start < earliest) {
      setCustomError(t.history.maxRangeAlert.replace('{n}', String(maxHistoryMonths)))
      return
    }
    setSelectedPeriod({
      start, end,
      label: `${start.toLocaleDateString(LOCALE[lang])} - ${end.toLocaleDateString(LOCALE[lang])}`,
    })
    setShowCustom(false)
  }

  if (hasError) {
    return (
      <div className="space-y-4">
        <h1 className="display text-4xl">{t.history.eyebrow}</h1>
        <div className="card p-8 text-center space-y-3">
          <div className="text-muted">{t.history.errorLoad}</div>
          <button className="btn-primary" onClick={() => loadAll(true)}>{t.common.retry}</button>
        </div>
      </div>
    )
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
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="date" className="input flex-1" value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                min={localDayKey(monthsAgo(new Date(), maxHistoryMonths))}
                max={localDayKey()} />
              <input type="date" className="input flex-1" value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                min={localDayKey(monthsAgo(new Date(), maxHistoryMonths))}
                max={localDayKey()} />
              <button className="btn-primary" onClick={handleCustomPeriod}>{t.history.periodApply}</button>
            </div>
            {customError && (
              <div className="text-xs text-danger" role="alert">{customError}</div>
            )}
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
                          <span><span className="text-ink font-semibold num mr-0.5">{session.avgIntensity}%</span>{t.history.intensitySuffix}</span>
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
                    {session.exercises.slice(0, 4).map((exercise: any) => (
                      <Link
                        key={exercise.id}
                        href={`/exercise/${exercise.id}`}
                        className="chip hover:bg-paper-card transition-colors"
                      >
                        {exercise.name}
                        {exercise.topSet && (
                          <span className="text-muted ml-1 font-normal">
                            {exercise.topSet.weight}×{exercise.topSet.reps}
                          </span>
                        )}
                      </Link>
                    ))}
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
