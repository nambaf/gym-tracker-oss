"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildLegacyNote, formatSetNoteOf, isFailureSet } from '@/lib/setNotes'
import { SetRow } from '@/components/SetRow'
import { RestTimer } from '@/components/RestTimer'
import SessionSummary from '@/components/SessionSummary'
import ExerciseHistory from '@/components/ExerciseHistory'
import PreviousSessionSets from '@/components/PreviousSessionSets'
import SwipeableSetRow from '@/components/SwipeableSetRow'
import { useDataStore } from '@/store/data'
import { useWakeLock } from '@/lib/useWakeLock'
import { WorkoutTimer } from '@/components/WorkoutTimer'
import { sortDays } from '@/lib/dayUtils'
import DeloadBanner from '@/components/DeloadBanner'
import ExerciseDebrief from '@/components/ExerciseDebrief'
import { Plan, PlanRow, IntensityLevel, NextIntent, SetFlag } from '@/lib/models'
import { getRestPresetForExercise } from '@/lib/restTimerPresets'
import { localDayKey } from '@/lib/dateUtils'
import { strengthSessions } from '@/lib/sessions'
import {
  DEFAULT_TARGET_SETS, DEFAULT_TARGET_REPS, DEFAULT_AUTO_START_REST_TIMER,
  DEFAULT_PROGRESSION_STEP_KG, DEFAULT_DELOAD_LOAD_FACTOR,
} from '@/lib/settings/defaults'
import { parseRepTarget, repsForSet } from '@/lib/workout/repTarget'
import { suggestNextLoad } from '@/lib/workout/prescription'
import { detectPR, previousSessionSetsFor, type PrResult } from '@/lib/records'
import { Check, Plus, X, Search, CheckCircle2, Trophy } from 'lucide-react'
import { useT, useLang } from '@/lib/i18n/I18nProvider'

/** True when `isoDate` falls on the same local calendar day as `dayKey`. */
function isSameLocalDay(isoDate: string | undefined, dayKey: string): boolean {
  if (!isoDate) return false
  const d = new Date(isoDate)
  return !Number.isNaN(d.getTime()) && localDayKey(d) === dayKey
}

async function findOrCreateTodaySession(startTime?: string): Promise<any> {
  const today = localDayKey()
  const sessionsRes = await fetch('/api/data/sessions')
  if (!sessionsRes.ok) throw new Error(`sessions ${sessionsRes.status}`)
  const sessions = await sessionsRes.json()
  // Skip activity rows: a run logged this morning shares the date but has no
  // sets, and attaching today's lifting to it would hide the workout from
  // every count that filters activities out.
  const todaySession = Array.isArray(sessions)
    ? strengthSessions(sessions).find((s: any) => isSameLocalDay(s.date, today))
    : null
  if (todaySession) return todaySession
  const payload = {
    date: new Date().toISOString(),
    note: '',
    kind: 'strength' as const,
    startTime: startTime || new Date().toISOString(),
  }
  const res = await fetch('/api/data/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`create session ${res.status}`)
  const { id } = await res.json()
  return { id, ...payload }
}

/**
 * Today's weekday name in both IT and EN. Plan rows store the day as
 * free text, so matching both locales keeps the workout page working
 * regardless of UI language. Both use the browser's own timezone: pinning
 * the Italian name to Europe/Rome made the two candidates disagree about
 * which day it was for anyone training outside that zone.
 */
function todayCandidateNames(): string[] {
  const d = new Date()
  return [
    new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(d).toLowerCase(),
    new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d).toLowerCase(),
  ]
}

/** Human-readable size of a record improvement: kg for load PRs, reps otherwise. */
function formatPrDelta(pr: { kind: string; delta: number }): string {
  const n = Math.round(pr.delta * 10) / 10
  return pr.kind === 'reps-at-weight' ? String(n) : `${n} kg`
}

/** Sets in the order they were performed. DynamoDB Scan order is arbitrary. */
function byTimestamp(a: { ts?: string }, b: { ts?: string }): number {
  return String(a.ts || '').localeCompare(String(b.ts || ''))
}

/** Done = the athlete closed it, or it reached its planned set count. */
function isExerciseFinished(ex: WorkoutExercise, closed: Set<string>): boolean {
  return closed.has(ex.id) || ex.completedSets.length >= ex.targetSets
}

type WorkoutExercise = {
  id: string
  name: string
  targetSets: number
  targetReps: string
  fromPlan: boolean
  completedSets: any[]
  isActive: boolean
  note?: string
  targetRpe?: number
}

export default function WorkoutPage() {
  const t = useT()
  const lang = useLang()
  const [session, setSession] = useState<any | null>(null)
  const [planRows, setPlanRows] = useState<any[]>([])
  const [days, setDays] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([])
  const [activeExIndex, setActiveExIndex] = useState<number>(0)
  const [showSummary, setShowSummary] = useState(false)
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFinishing, setIsFinishing] = useState(false)

  const [lastSavedSetId, setLastSavedSetId] = useState<string | null>(null)
  const [restSignal, setRestSignal] = useState(0)
  const [lastPr, setLastPr] = useState<PrResult | null>(null)
  // Set when the athlete declares an exercise finished; identifies that
  // completion uniquely so the coach is asked once per exercise per session.
  const [debriefTrigger, setDebriefTrigger] = useState<string | null>(null)
  // Exercises the athlete closed by hand. Reaching the target set count is not
  // the same as being done: they may stop at 2 of 3, or add a fourth set.
  const [closedExercises, setClosedExercises] = useState<Set<string>>(new Set())
  const prTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  // Holds the in-flight "find or create today's session" promise so two quick
  // taps reuse one request instead of racing into two sessions for one day.
  const sessionPromiseRef = useRef<Promise<any> | null>(null)

  const {
    sessions: sessionsState,
    sets: setsState,
    exercises: exercisesState,
    loadSessions, loadSets, loadExercises, loadSettings,
    addSessionOptimistic, addSetOptimistic, removeSetOptimistic,
    updateSessionOptimistic, deloadActive, trainingMode,
    storedSettings,
  } = useDataStore()

  useWakeLock(true)

  const fallbackTargetSets = storedSettings.defaultTargetSets ?? DEFAULT_TARGET_SETS
  const fallbackTargetReps = storedSettings.defaultTargetReps ?? DEFAULT_TARGET_REPS
  const autoStartRest = storedSettings.autoStartRestTimer ?? DEFAULT_AUTO_START_REST_TIMER

  /**
   * Resolve today's session, creating it (and stamping `startTime`) if needed.
   * Concurrent callers share one in-flight request.
   */
  async function ensureSession(): Promise<any> {
    const startTime = new Date().toISOString()
    if (session?.id) {
      if (session.startTime) return session
      const res = await fetch(`/api/data/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ startTime }),
      })
      if (!res.ok) throw new Error(`patch session ${res.status}`)
      const updated = { ...session, startTime }
      setSession(updated)
      updateSessionOptimistic(session.id, { startTime })
      return updated
    }
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = findOrCreateTodaySession(startTime)
        .then(created => {
          setSession(created)
          addSessionOptimistic(created)
          return created
        })
        .finally(() => { sessionPromiseRef.current = null })
    }
    return sessionPromiseRef.current
  }

  async function startWorkout() {
    try {
      await ensureSession()
    } catch (e) {
      console.error('Failed to start workout:', e)
    }
  }

  async function finishWorkout() {
    if (!session?.id || !session?.startTime) return
    setIsFinishing(true)
    try {
      const endTime = new Date().toISOString()
      const startMs = new Date(session.startTime).getTime()
      const endMs = new Date(endTime).getTime()
      const duration = Math.floor((endMs - startMs) / 1000)
      await fetch(`/api/data/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ endTime, duration }),
      })
      const updatedSession = { ...session, endTime, duration }
      setSession(updatedSession)
      updateSessionOptimistic(session.id, { endTime, duration })
      setShowSummary(true)
    } finally {
      setIsFinishing(false)
    }
  }

  const exercises = useMemo(
    () => (exercisesState.status === 'success' ? exercisesState.data || [] : []),
    [exercisesState]
  )

  useEffect(() => {
    loadSessions(); loadSets(); loadExercises(); loadSettings()
    ;(async () => {
      const plans: Plan[] = await fetch('/api/data/plans').then(r => r.ok ? r.json() : [])
      const active = Array.isArray(plans) ? (plans.find(p => p.isActive) || plans[0]) : null
      const rows: PlanRow[] = active?.rows || []
      setPlanRows(rows)
      const ds = sortDays(Array.from(new Set(rows.map(r => String(r.day)))).filter(Boolean))
      setDays(ds)
      const todayNames = todayCandidateNames()
      const match = ds.find(d => todayNames.includes(d.toLowerCase())) || ds[0] || ''
      setSelectedDay(match)
    })()
  }, [loadSessions, loadSets, loadExercises, loadSettings])

  useEffect(() => {
    if (sessionsState.status !== 'success') return
    const today = localDayKey()
    const existing = strengthSessions(sessionsState.data || [])
      .find((x: any) => isSameLocalDay(x.date, today)) || null
    // Never downgrade a session we already hold: a reload of the sessions slice
    // that momentarily lacks the row just created would otherwise blank out the
    // active session, leaving the workout impossible to finish.
    setSession((prev: any) => existing || prev)
  }, [sessionsState])

  // Single source of truth: today's sets are derived from the store, not copied
  // into local state. The copy used to be overwritten whenever loadSets
  // completed, which silently dropped a set that had just been added.
  const sets = useMemo(() => {
    if (setsState.status !== 'success' || !session?.id) return []
    return (setsState.data || [])
      .filter((x: any) => x.sessionId === session.id)
      .sort(byTimestamp)
  }, [setsState, session])

  useEffect(() => {
    if (!selectedDay || exercises.length === 0) return
    const exMap = new Map(exercises.map((e: any) => [e.id, e]))
    const planForDay = planRows
      .filter(r => String(r.day) === String(selectedDay))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const planWorkout: WorkoutExercise[] = planForDay.map((p) => {
      const ex = exMap.get(p.exerciseId) as { name?: string } | undefined
      return {
        id: p.exerciseId,
        name: ex?.name || p.exerciseId,
        targetSets: p.targetSets || fallbackTargetSets,
        targetReps: p.targetReps || fallbackTargetReps,
        fromPlan: true, completedSets: [], isActive: false,
        note: p.note, targetRpe: p.targetRpe,
      } as WorkoutExercise
    })
    const planIds = new Set(planWorkout.map(e => e.id))

    setWorkoutExercises(prev => {
      const extras = new Map<string, WorkoutExercise>()
      // Off-plan exercises added earlier in this session, still in React state.
      for (const e of prev || []) {
        if (!e.fromPlan && !planIds.has(e.id)) extras.set(e.id, e)
      }
      // Off-plan exercises reconstructed from the sets already logged today.
      // Without this an added exercise vanished on reload (and on any day
      // switch), taking its logged sets out of sight even though they were
      // safely in the database.
      for (const s of sets) {
        if (planIds.has(s.exerciseId) || extras.has(s.exerciseId)) continue
        const ex = exMap.get(s.exerciseId) as { name?: string } | undefined
        extras.set(s.exerciseId, {
          id: s.exerciseId,
          name: ex?.name || s.exerciseId,
          targetSets: fallbackTargetSets,
          targetReps: fallbackTargetReps,
          fromPlan: false, completedSets: [], isActive: false,
        })
      }
      const byExercise = new Map<string, any[]>()
      for (const s of sets) {
        const arr = byExercise.get(s.exerciseId)
        if (arr) arr.push(s)
        else byExercise.set(s.exerciseId, [s])
      }
      return [...planWorkout, ...extras.values()].map(e => ({
        ...e,
        completedSets: byExercise.get(e.id) || [],
      }))
    })
  }, [selectedDay, exercises, planRows, sets, fallbackTargetSets, fallbackTargetReps])

  // Keep the active index inside the list. Switching day, removing an exercise
  // or dropping an off-plan one can shorten the array, and an index past the end
  // rendered a blank screen with no way back.
  useEffect(() => {
    setActiveExIndex(i => Math.min(i, Math.max(0, workoutExercises.length - 1)))
  }, [workoutExercises.length])

  useEffect(() => {
    setActiveExIndex(0)
    setClosedExercises(new Set())
  }, [selectedDay])

  useEffect(() => { setLastPr(null) }, [activeExIndex])

  useEffect(() => {
    if (!carouselRef.current) return
    const el = carouselRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeExIndex])

  const currentExerciseHistory = useMemo(() => {
    if (!workoutExercises[activeExIndex] || setsState.status !== 'success') return []
    const currentEx = workoutExercises[activeExIndex]
    return (setsState.data || [])
      .filter((s: any) => s.exerciseId === currentEx.id && s.sessionId !== session?.id)
      .sort((a: any, b: any) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  }, [workoutExercises, activeExIndex, setsState, session])

  /** Returns false when the set could not be persisted, so SetRow keeps the input. */
  /**
   * Load and reps for the set about to be performed. Derived here rather than
   * inside SetRow because it needs the full exercise history and the tunables.
   */
  const prescription = useMemo(() => {
    const ex = workoutExercises[activeExIndex]
    if (!ex) return null
    const target = parseRepTarget(ex.targetReps)
    const reps = repsForSet(target, ex.completedSets.length, Number(fallbackTargetReps) || 8)
    return suggestNextLoad(currentExerciseHistory as any, reps, {
      targetRpe: ex.targetRpe,
      isDeload: deloadActive,
      increment: storedSettings.progressionStepKg ?? DEFAULT_PROGRESSION_STEP_KG,
      deloadFactor: storedSettings.deloadLoadFactor ?? DEFAULT_DELOAD_LOAD_FACTOR,
    })
  }, [workoutExercises, activeExIndex, currentExerciseHistory, deloadActive, storedSettings, fallbackTargetReps])

  /** The same exercise in its previous session — the coach's comparison point. */
  const previousSessionSets = useMemo(() => {
    const ex = workoutExercises[activeExIndex]
    if (!ex || setsState.status !== 'success') return []
    return previousSessionSetsFor(setsState.data || [], ex.id, session?.id)
  }, [workoutExercises, activeExIndex, setsState, session])

  async function addSet(
    exIndex: number,
    p: {
      weight: number
      reps: number
      toFailure?: boolean
      intensity?: IntensityLevel
      comment?: string
      nextIntent?: NextIntent
      flags?: SetFlag[]
    }
  ): Promise<boolean> {
    const ex = workoutExercises[exIndex]
    if (!ex) return false
    try {
      const currentSession = await ensureSession()
      if (!currentSession?.id) return false

      const newSet = {
        sessionId: currentSession.id,
        exerciseId: ex.id,
        ts: new Date().toISOString(),
        weight: p.weight, reps: p.reps,
        rpe: p.toFailure ? 10 : undefined,
        // Structured fields are the ones every consumer reads…
        toFailure: !!p.toFailure,
        intensity: p.intensity,
        comment: p.comment || undefined,
        nextIntent: p.nextIntent,
        flags: p.flags,
        setIndex: ex.completedSets.length + 1,
        schemaV: 2,
        // …while `note` keeps the legacy string shape so older builds, and the
        // rows already in DynamoDB, stay mutually readable.
        note: buildLegacyNote({ toFailure: p.toFailure, intensity: p.intensity, comment: p.comment }),
      }
      const res = await fetch('/api/data/sets', { method: 'POST', body: JSON.stringify(newSet) })
      if (!res.ok) throw new Error(`save set ${res.status}`)
      const { id } = await res.json()
      if (!id) throw new Error('save set: missing id')

      const fullNewSet = { id, ...newSet }
      addSetOptimistic(fullNewSet)
      // `addSetOptimistic` is a no-op unless the slice already loaded; refetch so
      // the set the athlete just saved cannot go missing from the screen.
      if (setsState.status !== 'success') loadSets(true)
      setLastSavedSetId(id)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setLastSavedSetId(null), 800)

      // Tell the athlete they beat their own record while they are still at the
      // rack. `currentExerciseHistory` excludes today, so the set just saved is
      // compared only against previous sessions.
      const pr = detectPR({ exerciseId: ex.id, weight: p.weight, reps: p.reps }, currentExerciseHistory as any)
      setLastPr(pr)
      if (prTimerRef.current) clearTimeout(prTimerRef.current)
      if (pr) prTimerRef.current = setTimeout(() => setLastPr(null), 6000)

      if (autoStartRest) setRestSignal(n => n + 1)

      // Saving a set no longer moves the athlete anywhere, and no longer wakes
      // the coach. Hitting the target set count is a guess about being done —
      // the athlete says so explicitly with `finishExercise`. Auto-advancing on
      // the last set also meant the coach read a stale `workoutExercises`, so
      // its debrief was missing the very set that had just triggered it.
      return true
    } catch (e) {
      console.error('Failed to save set:', e)
      return false
    }
  }

  /**
   * The athlete declaring an exercise over. This is the only thing that wakes
   * the coach and the only thing that moves the carousel: the app cannot tell
   * a finished exercise from one that merely reached its planned set count.
   */
  function finishExercise(index: number) {
    const ex = workoutExercises[index]
    if (!ex || ex.completedSets.length === 0 || !session?.id) return

    const closed = new Set(closedExercises).add(ex.id)
    setClosedExercises(closed)
    setDebriefTrigger(`${session.id}:${ex.id}`)

    // Next exercise still owing work, scanning forward and wrapping around, so
    // an exercise skipped earlier isn't stranded behind the current one.
    const n = workoutExercises.length
    for (let step = 1; step < n; step++) {
      const i = (index + step) % n
      if (!isExerciseFinished(workoutExercises[i], closed)) {
        setActiveExIndex(i)
        return
      }
    }
  }

  function removeExercise(index: number) {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== index))
  }

  async function removeSet(setId: string) {
    removeSetOptimistic(setId)
    try { await fetch(`/api/data/sets/${setId}`, { method: 'DELETE' }) }
    catch (e) { console.error('Failed to delete set:', e) }
  }

  function addExerciseToWorkout(exId: string) {
    const ex = exercises.find((e: any) => e.id === exId)
    if (!ex) return
    setShowExercisePicker(false)
    setSearchQuery('')

    // Already in today's list (from the plan or added earlier)? Jump to it
    // instead of appending a duplicate that would split the same exercise
    // across two cards and double-count it in the progress header.
    const existing = workoutExercises.findIndex(e => e.id === ex.id)
    if (existing !== -1) {
      setActiveExIndex(existing)
      return
    }

    const newEx: WorkoutExercise = {
      id: ex.id,
      name: ex.name,
      targetSets: fallbackTargetSets,
      targetReps: fallbackTargetReps,
      fromPlan: false,
      completedSets: sets.filter(s => s.exerciseId === ex.id).sort(byTimestamp),
      isActive: false,
    }
    setWorkoutExercises(prev => {
      const arr = [...prev, newEx]
      setActiveExIndex(arr.length - 1)
      return arr
    })
  }

  const filteredExercises = useMemo(() => {
    if (!searchQuery) return exercises
    const q = searchQuery.toLowerCase()
    return exercises.filter((e: any) =>
      e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    )
  }, [exercises, searchQuery])

  const hasCompletedSets = workoutExercises.some(ex => ex.completedSets.length > 0)
  const activeEx = workoutExercises[activeExIndex]

  /** The exercise the pending debrief is about — not the one now on screen. */
  const debriefExercise = useMemo(() => {
    if (!debriefTrigger) return undefined
    const exId = debriefTrigger.slice(debriefTrigger.indexOf(':') + 1)
    return workoutExercises.find(e => e.id === exId)
  }, [debriefTrigger, workoutExercises])

  const totalSets = workoutExercises.reduce((acc, e) => acc + e.targetSets, 0)
  const doneSets = workoutExercises.reduce((acc, e) => acc + e.completedSets.length, 0)

  return (
    <div className="space-y-5 -mt-2">
      <DeloadBanner />

      {/* Top bar: day picker + timer / start */}
      <header className="flex items-center justify-between gap-3">
        {days.length > 0 ? (
          <select
            value={selectedDay}
            onChange={e => setSelectedDay(e.target.value)}
            className="appearance-none bg-transparent text-[11px] uppercase tracking-[0.14em] font-semibold text-muted pr-5 cursor-pointer"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\'%3E%3Cpath d=\'M1 1l4 4 4-4\' stroke=\'%236b6962\' stroke-width=\'1.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '10px 6px',
            }}
          >
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        ) : <span className="eyebrow">{t.workout.eyebrowDay}</span>}

        {/* Always mounted: when there is no startTime the component renders its
            own Start button. Gating the mount on `startTime` meant the button
            could never appear and `startWorkout` was unreachable — the timer
            only ever began as a side effect of saving the first set. */}
        <WorkoutTimer startTime={session?.startTime ?? null} onStart={startWorkout} />
      </header>

      {/* Hero: progress + exercise carousel */}
      {workoutExercises.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] num text-muted">
              {t.workout.exerciseLabel}{' '}
              <span className="text-ink font-semibold">
                {String(activeExIndex + 1).padStart(2, '0')}
              </span>{' '}
              {t.workout.ofConnector}{' '}
              <span className="text-ink font-semibold">
                {String(workoutExercises.length).padStart(2, '0')}
              </span>
            </div>
            <div className="text-[11px] num text-muted">
              <span className="text-ink font-semibold">{doneSets}</span>/{totalSets} {t.workout.setsTotalSuffix}
            </div>
          </div>

          <div ref={carouselRef} className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
            {workoutExercises.map((ex, i) => {
              const isActive = i === activeExIndex
              const isDone = isExerciseFinished(ex, closedExercises)
              const isPending = !isActive && !isDone && ex.completedSets.length === 0
              return (
                <button
                  key={`${ex.id}-${i}`}
                  data-active={isActive}
                  onClick={() => setActiveExIndex(i)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium px-3 py-2 transition-all
                    ${isActive
                      ? 'bg-ink text-white'
                      : isDone
                        ? 'bg-paper-card text-muted line-through border border-ink/10'
                        : isPending
                          ? 'bg-transparent text-muted-2 border border-ink/10'
                          : 'bg-paper-card text-ink-soft border border-ink/10'
                    }`}
                >
                  <span className={`text-[9px] font-bold num px-1 py-0.5 rounded
                    ${isActive ? 'bg-white/15 text-white/85' : 'bg-paper-sunken text-muted-2'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate max-w-[120px]">{ex.name}</span>
                  {isDone && !isActive && <Check size={11} strokeWidth={2.6} />}
                </button>
              )
            })}
            <button
              onClick={() => setShowExercisePicker(true)}
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-2
                         text-[12px] font-medium text-muted border border-dashed border-ink/15"
            >
              <Plus size={12} strokeWidth={2.4} /> {t.workout.addExerciseShort}
            </button>
          </div>
        </section>
      )}

      {/* Active exercise focus */}
      {activeEx && (
        <section className="space-y-4">
          <div>
            {/* Target reps used to render only when the plan row also carried a
                target RPE, so plans without RPE showed no rep target at all. */}
            <div className="eyebrow">
              {t.workout.setLabel} <span className="num">{activeEx.completedSets.length + 1}</span> {t.workout.ofConnector}{' '}
              <span className="num">{activeEx.targetSets}</span>
              {activeEx.targetReps && (
                <>
                  <span className="opacity-30 mx-1.5">·</span> {t.workout.targetLabel}{' '}
                  <span className="num">{activeEx.targetReps}</span> {t.workout.repsLabel}
                </>
              )}
              {activeEx.targetRpe != null && (
                <>
                  <span className="opacity-30 mx-1.5">·</span> {t.workout.rpeLabel}{' '}
                  <span className="num">
                    {deloadActive ? Math.max(1, activeEx.targetRpe - 2) : activeEx.targetRpe}
                  </span>
                </>
              )}
            </div>
            <h1 className="display text-[44px] leading-[0.95] mt-2 tracking-tight2">
              {activeEx.name}
            </h1>
            {!activeEx.fromPlan && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 chip !text-[10px]">
                {t.workout.offPlanBadge}
              </div>
            )}
            {activeEx.note && (
              <div className="mt-3 rounded-xl bg-paper-card border border-ink/[0.06] px-3.5 py-2.5 text-[13px] text-ink-soft leading-snug">
                <span className="label !text-[9px] block mb-1">{t.workout.planNote}</span>
                {activeEx.note}
              </div>
            )}
          </div>

          <PreviousSessionSets
            exerciseId={activeEx.id}
            currentSessionId={session?.id}
            currentSets={activeEx.completedSets}
            setsState={setsState}
          />

          <ExerciseHistory
            exerciseId={activeEx.id}
            exerciseName={activeEx.name}
            setsState={setsState}
            currentSessionId={session?.id}
          />

          <div className="card p-4">
            <SetRow
              onSave={(p) => addSet(activeExIndex, p)}
              lastSet={activeEx.completedSets[activeEx.completedSets.length - 1]}
              targetReps={repsForSet(
                parseRepTarget(activeEx.targetReps),
                activeEx.completedSets.length,
                Number(fallbackTargetReps) || 8
              )}
              prescription={prescription}
              exerciseHistory={currentExerciseHistory}
              targetRpe={activeEx.targetRpe ? (deloadActive ? Math.max(1, activeEx.targetRpe - 2) : activeEx.targetRpe) : undefined}
              isDeload={deloadActive}
            />
          </div>

          <ExerciseDebrief
            trigger={debriefTrigger}
            exerciseName={debriefExercise?.name}
            buildContext={() => {
              // Read from the exercise the trigger refers to, not the one now on
              // screen: finishing an exercise moves the athlete on.
              const ex = debriefExercise
              if (!ex) return null
              return {
                exerciseName: ex.name,
                todaySets: ex.completedSets,
                previousSets: previousSessionSetsFor(setsState.data || [], ex.id, session?.id),
                targetSets: ex.targetSets,
                targetReps: ex.targetReps,
                targetRpe: ex.targetRpe,
                offPlan: !ex.fromPlan,
                exercisesDone: workoutExercises.filter(e => isExerciseFinished(e, closedExercises)).length,
                exercisesTotal: workoutExercises.length,
                // The coach sees the whole session, growing with every exercise
                // closed — not just the one that triggered this debrief.
                sessionSoFar: workoutExercises
                  .filter(e => e.completedSets.length > 0)
                  .map(e => ({ exerciseName: e.name, sets: e.completedSets })),
                sessions: sessionsState.data || [],
                sets: setsState.data || [],
                exercises,
                plan: planRows,
                trainingMode,
                lang,
              }
            }}
          />

          {lastPr && (
            <div className="rounded-2xl bg-success/10 text-success px-4 py-3 flex items-center gap-2">
              <Trophy size={16} strokeWidth={2.2} className="shrink-0" />
              <span className="text-[13px] font-medium">
                {t.workout.prTitle}{' '}
                <span className="font-normal opacity-90">
                  {t.workout.prKind[lastPr.kind].replace('{delta}', formatPrDelta(lastPr))}
                </span>
              </span>
            </div>
          )}

          {activeEx.completedSets.length > 0 && (
            <div className="space-y-2">
              <div className="label">{t.workout.setsToday}</div>
              <div className="space-y-1.5">
                {activeEx.completedSets.map((s: any, j: number) => {
                  // The note was written but never shown back: until now the
                  // athlete had no way to check what they had just recorded.
                  const noteText = formatSetNoteOf(s, t.setRow.intensityOpts)
                  return (
                    <SwipeableSetRow key={s.id} onDelete={() => removeSet(s.id)}>
                      <div className={`bg-paper-card rounded-xl px-4 py-3
                                      border border-ink/[0.06] text-sm ${
                        lastSavedSetId === s.id ? 'animate-flash-accent' : ''
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="label !text-[10px]">{t.workout.setPrefix} {j + 1}</span>
                          <span className="num font-medium text-ink">
                            {s.weight} kg × {s.reps}
                            {isFailureSet(s) && (
                              <span className="ml-2 chip-accent !text-[10px]">{t.workout.chipFailure}</span>
                            )}
                          </span>
                        </div>
                        {noteText && (
                          <div className="text-[11px] text-ink-soft italic mt-1 break-words">{noteText}</div>
                        )}
                        {Array.isArray(s.flags) && s.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {s.flags.map((f: SetFlag) => (
                              <span key={f} className="chip !text-[10px] !py-0.5">{t.setRow.flagOpts[f]}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </SwipeableSetRow>
                  )
                })}
              </div>
            </div>
          )}

          {/* Closing the exercise is a deliberate act: it is what asks the coach
              for a debrief and what moves the carousel on. Reopening exists for
              the athlete who decides to add one more set after all. */}
          {activeEx.completedSets.length > 0 && (
            closedExercises.has(activeEx.id) ? (
              <button
                onClick={() => setClosedExercises(prev => {
                  const next = new Set(prev)
                  next.delete(activeEx.id)
                  return next
                })}
                className="btn-ghost text-sm w-full justify-center text-muted"
              >
                {t.workout.reopenExerciseBtn}
              </button>
            ) : (
              <button
                onClick={() => finishExercise(activeExIndex)}
                className={`w-full justify-center py-3.5 rounded-full text-[14px] ${
                  activeEx.completedSets.length >= activeEx.targetSets ? 'btn-primary' : 'btn'
                }`}
              >
                <Check size={16} strokeWidth={2.2} /> {t.workout.finishExerciseBtn}
              </button>
            )
          )}

          {(() => {
            const exData = exercises.find((e: any) => e.id === activeEx.id) as { primaryMuscles?: any } | undefined
            const restPreset = getRestPresetForExercise(exData?.primaryMuscles, {
              compoundMuscles: storedSettings.compoundMuscles,
              isolationMuscles: storedSettings.isolationMuscles,
              restCompoundSec: storedSettings.restCompoundSec,
              restStandardSec: storedSettings.restStandardSec,
              restIsolationSec: storedSettings.restIsolationSec,
            })
            const mins = Math.floor(restPreset.defaultSec / 60)
            const secs = (restPreset.defaultSec % 60).toString().padStart(2, '0')
            const presetLabel = `${t.restTimer.presets[restPreset.labelKey]} (${mins}:${secs})`
            return (
              <div className="card p-4">
                <RestTimer
                  defaultSec={restPreset.defaultSec}
                  suggestedLabel={presetLabel}
                  startSignal={restSignal}
                />
              </div>
            )
          })()}

          {/* Only offer removal while nothing has been logged: once sets exist
              they live in the database and the exercise is rebuilt from them,
              so "remove" would silently do nothing. Delete the sets instead. */}
          {!activeEx.fromPlan && activeEx.completedSets.length === 0 && (
            <button
              onClick={() => removeExercise(activeExIndex)}
              className="btn-ghost text-sm text-danger w-full justify-center"
            >
              {t.workout.removeExerciseBtn}
            </button>
          )}
        </section>
      )}

      {/* Finish */}
      <div className="pt-2">
        <button
          onClick={finishWorkout}
          disabled={!hasCompletedSets || isFinishing}
          className="btn-primary w-full py-4 rounded-full text-[15px] disabled:opacity-40"
        >
          {isFinishing ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t.workout.saving}
            </>
          ) : (
            <>
              <CheckCircle2 size={18} strokeWidth={2} /> {t.workout.finishBtn}
            </>
          )}
        </button>
      </div>

      {/* Exercise picker modal */}
      {showExercisePicker && (
        <div className="modal-overlay" onClick={() => { setShowExercisePicker(false); setSearchQuery('') }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center justify-between mb-3">
                <h3 className="display text-2xl">{t.workout.pickerTitle}</h3>
                <button
                  onClick={() => { setShowExercisePicker(false); setSearchQuery('') }}
                  className="btn-icon"
                ><X size={16} /></button>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-10"
                  placeholder={t.workout.pickerPlaceholder}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {filteredExercises.map((ex: any) => (
                <button
                  key={ex.id}
                  className="btn text-sm text-left justify-start"
                  onClick={() => addExerciseToWorkout(ex.id)}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSummary && session?.id && (
        <SessionSummary
          sessionId={session.id}
          onClose={() => setShowSummary(false)}
          setsState={setsState}
          exercisesState={exercisesState}
        />
      )}
    </div>
  )
}
