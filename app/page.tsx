'use client'
import Link from 'next/link'
import WeeklyReviewCard from '@/components/WeeklyReviewCard'
import ActivityLogger from '@/components/ActivityLogger'
import { useEffect, useMemo } from 'react'
import { useDataStore } from '@/store/data'
import { strengthSessions } from '@/lib/sessions'
import { BodyMap } from '@/components/BodyMap'
import { calculateMuscleStatus, getMissingExercises } from '@/lib/bodyMapUtils'
import { analyzePlanCompleteness } from '@/lib/planAnalysis'
import { WorkoutAIChat } from '@/components/WorkoutAIChat'
import { ArrowRight } from 'lucide-react'
import type { Session } from '@/lib/models'
import { localDayKey, weekBounds } from '@/lib/dateUtils'
import { planDays } from '@/lib/plan/days'
import { usePlanDayOrder } from '@/lib/usePlanDayOrder'
import { deriveNextWorkout, setsPerDay, type NextWorkout } from '@/lib/workout/nextWorkout'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Lang } from '@/lib/i18n'

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }

function weekdayName(d: Date, lang: Lang): string {
  const name = new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long' }).format(d)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function formatDateLong(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(d)
}

function heatLevel(sets: number): number {
  if (sets >= 18) return 4
  if (sets >= 12) return 3
  if (sets >= 6) return 2
  return sets > 0 ? 1 : 0
}

/** Consecutive weeks (Mon–Sun) with at least one logged session. */
function calcStreakWeeks(sessions: Session[]): number {
  const weeks = new Set<string>()
  sessions.forEach(s => {
    if (!s.date) return
    const d = new Date(s.date)
    if (isNaN(d.getTime())) return
    weeks.add(localDayKey(weekBounds(d).monday))
  })
  let cursor = weekBounds(new Date()).monday
  let streak = 0
  // If this week is empty but last week was full, treat the streak as ongoing.
  if (!weeks.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 7)
  }
  while (weeks.has(localDayKey(cursor))) {
    streak++
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

export default function Dashboard() {
  const t = useT()
  const lang = useLang()
  const { sessions, sets, exercises, plan, loadAll, trainingMode, storedSettings } = useDataStore()

  useEffect(() => { loadAll() }, [loadAll])

  const dayOrder = usePlanDayOrder(plan.data)
  const days = useMemo(
    () => planDays({ rows: plan.data || [], dayOrder }),
    [plan.data, dayOrder]
  )

  const today = new Date()

  const muscleData = useMemo(() => {
    if (exercises.status !== 'success' || plan.status !== 'success' ||
        sets.status !== 'success' || sessions.status !== 'success') return new Map()
    const { monday, sunday } = weekBounds(new Date())
    return calculateMuscleStatus(
      exercises.data || [], plan.data || [], sets.data || [], sessions.data || [],
      monday, sunday
    )
  }, [exercises, plan, sets, sessions])

  const weeklyData = useMemo(() => {
    if (sessions.status !== 'success' || sets.status !== 'success') {
      return { weekSessions: [], weekSets: [], totalVolume: 0, sessionsCount: 0 }
    }
    const { monday, sunday } = weekBounds(new Date())
    // Activities are logged in the same table but are not training: counting a
    // Wednesday run here would show 4 sessions on a 3-day plan.
    const weekSessions = strengthSessions(sessions.data || []).filter(s => {
      const d = new Date(s.date)
      return d >= monday && d <= sunday
    })
    const sessionIds = new Set(weekSessions.map(s => s.id))
    const weekSets = (sets.data || []).filter(s => sessionIds.has(s.sessionId))
    const totalVolume = weekSets.reduce(
      (acc, s) => acc + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0,
    )
    return { weekSessions, weekSets, totalVolume, sessionsCount: weekSessions.length }
  }, [sessions, sets])

  const weeklyProgress = useMemo(() => {
    if (plan.status !== 'success') return 0
    const target = days.length
    if (target === 0) return 0
    return Math.min(100, Math.round((weeklyData.sessionsCount / target) * 100))
  }, [plan.status, days, weeklyData.sessionsCount])

  const heat = useMemo(() => {
    if (sessions.status !== 'success' || sets.status !== 'success') return []
    return setsPerDay(sessions.data || [], sets.data || [], 14)
      .map(d => ({ date: d.date, level: heatLevel(d.sets) }))
  }, [sessions, sets])

  const streakWeeks = useMemo(() => {
    if (sessions.status !== 'success') return 0
    // A lifting streak: a week where the only entry was a run is a week off.
    return calcStreakWeeks(strengthSessions(sessions.data || []))
  }, [sessions])

  const topLift = useMemo(() => {
    if (exercises.status !== 'success' || sets.status !== 'success') return null
    const setsArr = sets.data || []
    if (setsArr.length === 0) return null
    const counts = new Map<string, number>()
    setsArr.forEach(s => counts.set(s.exerciseId, (counts.get(s.exerciseId) || 0) + 1))
    const topId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!topId) return null
    const ex = (exercises.data || []).find(e => e.id === topId)
    if (!ex) return null
    const exSets = setsArr.filter(s => s.exerciseId === topId && s.weight && s.reps)
    if (exSets.length === 0) return null
    const e1rms = exSets.map(s => {
      const w = Number(s.weight), r = Number(s.reps)
      return Math.round(w * (1 + r / 30))
    })
    const firstWord = ex.name.split(/[ ()-]/)[0].toLowerCase()
    return { name: firstWord, value: Math.max(...e1rms) }
  }, [exercises, sets])

  const nextWorkout = useMemo<NextWorkout | null>(() => {
    if (plan.status !== 'success' || sessions.status !== 'success' || sets.status !== 'success') return null
    return deriveNextWorkout({
      days, planRows: plan.data || [], sessions: sessions.data || [], sets: sets.data || [],
    })
  }, [plan, days, sessions, sets])

  const planSummary = useMemo(() => {
    if (exercises.status !== 'success' || plan.status !== 'success') return []
    const planRows = (plan.data || []).map(r => ({
      day: r.day, exerciseId: r.exerciseId,
      targetSets: typeof r.targetSets === 'string' ? parseFloat(r.targetSets) : r.targetSets,
      targetReps: r.targetReps, targetRpe: r.targetRpe,
    }))
    return analyzePlanCompleteness(planRows, exercises.data || [], trainingMode, {
      recommendedSets: storedSettings.recommendedSets,
    })
  }, [exercises, plan, trainingMode, storedSettings.recommendedSets])

  const missingExercisesForAI = useMemo(() => {
    if (exercises.status !== 'success' || plan.status !== 'success' ||
        sets.status !== 'success' || sessions.status !== 'success' ||
        muscleData.size === 0) return []
    const { monday, sunday } = weekBounds(new Date())
    return getMissingExercises(
      exercises.data || [], plan.data || [], sets.data || [], sessions.data || [],
      muscleData, monday, sunday
    ).map(e => ({
      exerciseName: e.exerciseName, plannedSets: e.plannedSets,
      completedSets: e.completedSets, remainingSets: e.remainingSets,
    }))
  }, [exercises, plan, sets, sessions, muscleData])

  const showFreshInstallBanner =
    exercises.status === 'success' && plan.status === 'success' &&
    (exercises.data || []).length === 0 && (plan.data || []).length === 0

  return (
    <div className="space-y-7">
      <WeeklyReviewCard dayOrder={dayOrder} />
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">{formatDateLong(today, lang)}</div>
          <h1 className="display text-5xl leading-[0.95] mt-2">
            {weekdayName(today, lang)}
          </h1>
          <p className="text-sm text-muted mt-2 max-w-[260px]">
            <span className="num font-medium text-ink-soft">{weeklyData.sessionsCount}</span>{' '}
            {t.home.sessionsThisWeek} ·{' '}
            <span className="text-ink-soft font-medium num">
              {(weeklyData.totalVolume / 1000).toFixed(1)}k
            </span> {t.home.volumeTotalUnit}
          </p>
        </div>
        <ProgressAvatar percent={weeklyProgress} />
      </header>

      {showFreshInstallBanner && (
        <Link href="/setup" className="block group">
          <section className="card p-4 border border-accent-500/30 bg-accent-500/5">
            <div className="eyebrow text-accent-500">{t.home.freshInstall.eyebrow}</div>
            <h3 className="text-sm font-semibold mt-1">{t.home.freshInstall.title}</h3>
            <p className="text-xs text-muted mt-1 mb-3">{t.home.freshInstall.body}</p>
            <div className="inline-flex items-center gap-1.5 text-accent-500 text-sm font-medium">
              {t.home.freshInstall.cta} <ArrowRight size={14} strokeWidth={2.2} />
            </div>
          </section>
        </Link>
      )}

      <NextWorkoutCard workout={nextWorkout} />

      <section className="flex items-end justify-between gap-3">
        <Stat
          label={t.home.statStreak}
          value={streakWeeks}
          unit={streakWeeks === 1 ? t.home.statWeekSingular : t.home.statWeekPlural}
        />
        <div className="divider-v my-2" />
        <Stat
          label={t.home.statVolume}
          value={(weeklyData.totalVolume / 1000).toFixed(1)}
          unit={t.home.statVolumeUnit}
          accent
        />
        <div className="divider-v my-2" />
        {topLift ? (
          <Stat label={t.home.stat1RM} value={topLift.value} unit={`kg · ${topLift.name}`} />
        ) : (
          <Stat label={t.home.stat1RM} value="—" unit={t.home.stat1RMNoData} />
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold">{t.home.activityTitle}</h3>
          <span className="text-[11px] text-muted">
            {heat.filter(h => h.level > 0).length} {t.home.activityOf}
          </span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
          {heat.map((cell, i) => (
            <div
              key={i}
              className={`aspect-square rounded-[4px] ${heatColor(cell.level)}`}
              title={cell.date.toLocaleDateString(LOCALE[lang])}
            />
          ))}
        </div>
        <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
          {heat.map((cell, i) => (
            <div key={i} className="text-[9px] text-center text-muted-2 font-semibold uppercase tracking-wider">
              {t.home.weekDayInitials[cell.date.getDay()]}
            </div>
          ))}
        </div>
      </section>

      <BodyMap muscleData={muscleData} />

      <ActivityLogger />

      {exercises.status === 'success' && plan.status === 'success' && planSummary.length > 0 && (
        <WorkoutAIChat
          mode="weekly"
          planSummary={planSummary}
          exercises={exercises.data || []}
          plan={plan.data || []}
          weekSessions={weeklyData.weekSessions}
          weekSets={weeklyData.weekSets}
          missingExercises={missingExercisesForAI}
          trainingMode={trainingMode}
          dayOrder={dayOrder}
        />
      )}
    </div>
  )
}

function NextWorkoutCard({ workout }: { workout: NextWorkout | null }) {
  const t = useT()
  if (!workout) {
    return (
      <Link href="/plan" className="block group">
        <div className="card p-6">
          <div className="eyebrow">{t.home.next.planEyebrow}</div>
          <div className="display text-2xl mt-2 leading-tight">{t.home.next.noPlanTitle}</div>
          <div className="text-sm text-muted mt-2">{t.home.next.noPlanSubtitle}</div>
          <div className="inline-flex items-center gap-1.5 text-accent-500 text-sm font-medium mt-4">
            {t.home.next.goToPlan} <ArrowRight size={14} strokeWidth={2.2} />
          </div>
        </div>
      </Link>
    )
  }

  const completed = workout.state === 'doneToday'
  const eyebrow = completed
    ? t.home.next.todayCompleted
    : workout.state === 'weekDone'
      ? t.home.next.weekDone.replace('{day}', workout.day)
      : `${t.home.next.otherNextPrefix}${workout.day}`

  return (
    <Link href="/workout" className="block group">
      <div className="card-dark relative overflow-hidden p-6 pb-5 transition-transform group-active:scale-[0.99]">
        <div className="text-[10px] tracking-[0.16em] uppercase font-semibold opacity-55">
          {eyebrow}
        </div>
        <div className="display text-3xl mt-2 leading-none">{workout.day}</div>

        <div className="flex items-end justify-between mt-5">
          <div className="text-xs opacity-65">
            <span className="text-lg font-medium mr-1 num">{workout.exerciseCount}</span>{t.home.next.exercisesSuffix}
            <span className="mx-2.5 opacity-40">·</span>
            <span className="text-lg font-medium mr-1 num">{workout.estimatedMinutes}</span>{t.home.next.minutesSuffix}
          </div>
          <div className="inline-flex items-center gap-1.5 bg-accent-500 text-white
                          text-[13px] font-medium rounded-full px-4 py-2">
            {completed ? t.home.next.reviewBtn : t.home.next.startBtn} <ArrowRight size={14} strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </Link>
  )
}

function Stat({ label, value, unit, accent }: {
  label: string; value: string | number; unit: string; accent?: boolean
}) {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="label">{label}</div>
      <div className="display text-[36px] leading-none tracking-tight3 mt-1.5 num">
        {value}
      </div>
      <div className={`text-[11px] mt-1 ${accent ? 'text-accent-500 font-semibold' : 'text-muted'}`}>
        {unit}
      </div>
    </div>
  )
}

function ProgressAvatar({ percent }: { percent: number }) {
  const circ = 2 * Math.PI * 24
  const safe = Math.max(0, Math.min(100, percent))
  const offset = circ - (safe / 100) * circ
  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0">
        <circle cx="28" cy="28" r="24" stroke="rgba(26,25,22,0.08)" strokeWidth="2.5" fill="none" />
        <circle cx="28" cy="28" r="24" stroke="#d6492a" strokeWidth="2.5" fill="none"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-90 28 28)" />
      </svg>
      <span className="text-[13px] font-semibold num">{safe}%</span>
    </div>
  )
}

function heatColor(level: number) {
  switch (level) {
    case 4: return 'bg-ink'
    case 3: return 'bg-ink/65'
    case 2: return 'bg-ink/35'
    case 1: return 'bg-ink/15'
    default: return 'bg-paper-sunken'
  }
}
