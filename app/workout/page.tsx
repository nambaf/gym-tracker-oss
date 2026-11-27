"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
import DeloadBanner from '@/components/DeloadBanner'
import ExerciseDebrief from '@/components/ExerciseDebrief'
import MuscleChips from '@/components/MuscleChips'
import { Plan, PlanRow, Session, SetEntry, IntensityLevel, NextIntent, SetFlag } from '@/lib/models'
import { getRestPresetForExercise } from '@/lib/restTimerPresets'
import { localDayKey } from '@/lib/dateUtils'
import { strengthSessions } from '@/lib/sessions'
import { apiFetch, apiJson } from '@/lib/api'
import { planDays } from '@/lib/plan/days'
import { getThresholdsForMode } from '@/lib/hypertrophyThresholds'
import {
  DEFAULT_TARGET_SETS, DEFAULT_TARGET_REPS, DEFAULT_AUTO_START_REST_TIMER,
  DEFAULT_PROGRESSION_STEP_KG, DEFAULT_DELOAD_LOAD_FACTOR,
} from '@/lib/settings/defaults'
import { parseRepTarget, repsForSet } from '@/lib/workout/repTarget'
import { suggestNextLoad } from '@/lib/workout/prescription'
import { detectPR, previousSessionSetsFor, type PrResult } from '@/lib/records'
import ExercisePicker from '@/components/ExercisePicker'
import { pickPlanDay, weekDayStatus } from '@/lib/workout/planDay'
import { clientWeek } from '@/lib/coach/weeklyReview'
import { buildWorkoutList, type WorkoutItem } from '@/lib/workout/workoutList'
import { isItemFinished, sessionProgress } from '@/lib/workout/progress'
import { exerciseWeekUsage } from '@/lib/workout/weekUsage'
import { countedMuscles, weekCoverage, type MuscleCoverage } from '@/lib/workout/alternatives'
import { effectiveSubstitutions } from '@/lib/workout/impactLabel'
import { ArrowLeftRight, Check, Plus, CheckCircle2, Trophy } from 'lucide-react'
import { useT, useLang } from '@/lib/i18n/I18nProvider'

/** True when `isoDate` falls on the same local calendar day as `dayKey`. */
function isSameLocalDay(isoDate: string | undefined, dayKey: string): boolean {
  if (!isoDate) return false
  const d = new Date(isoDate)
  return !Number.isNaN(d.getTime()) && localDayKey(d) === dayKey
}

/**
 * Today's strength session, created if there is none. `seed` is what the
 * athlete already decided before the row existed — the day and any swap — so a
 * new row is born with it instead of needing a second write.
 */
async function findOrCreateTodaySession(
  seed: Pick<Session, 'startTime' | 'planDay' | 'substitutions'>,
): Promise<{ row: Session; created: boolean }> {
  const today = localDayKey()
  const sessions = await apiJson<Session[]>('/api/data/sessions')
  // Skip activity rows: a run logged this morning shares the date but has no
  // sets, and attaching today's lifting to it would hide the workout from
  // every count that filters activities out.
  const todaySession = Array.isArray(sessions)
    ? strengthSessions(sessions).find(s => isSameLocalDay(s.date, today))
    : undefined
  if (todaySession) return { row: todaySession, created: false }
  const now = new Date().toISOString()
  const payload = {
    date: now,
    note: '',
    kind: 'strength' as const,
    startTime: seed.startTime || now,
    ...(seed.planDay ? { planDay: seed.planDay } : {}),
    ...(seed.substitutions && Object.keys(seed.substitutions).length > 0
      ? { substitutions: seed.substitutions }
      : {}),
  }
  const { id } = await apiJson<{ id: string }>('/api/data/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!id) throw new Error('create session: missing id')
  return { row: { id, ...payload }, created: true }
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

/** `Intl` formatting that never throws on a missing or malformed timestamp. */
function formatDate(fmt: Intl.DateTimeFormat, value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? '' : fmt.format(d)
}

/** A 'YYYY-MM-DD' local day key as a local date (`new Date(key)` would read it as UTC). */
function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

type PickerState = { mode: 'add' } | { mode: 'replace'; plannedId: string }

const NO_SESSIONS: Session[] = []
const NO_SETS: SetEntry[] = []

export default function WorkoutPage() {
  const t = useT()
  const lang = useLang()
  const [session, setSession] = useState<Session | null>(null)
  const [planRows, setPlanRows] = useState<PlanRow[]>([])
  const [days, setDays] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string>('')
  // The card on screen is tracked by exercise, not by position: the list is
  // derived, and an extra moves once its first set gives it a timestamp.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [plansLoaded, setPlansLoaded] = useState(false)
  const dayPickedRef = useRef(false)
  const [isFinishing, setIsFinishing] = useState(false)

  const [lastSavedSetId, setLastSavedSetId] = useState<string | null>(null)
  const [restSignal, setRestSignal] = useState(0)
  const [lastPr, setLastPr] = useState<PrResult | null>(null)
  // Set when the athlete declares an exercise finished; identifies that
  // completion uniquely so the coach is asked once per exercise per session.
  const [debriefTrigger, setDebriefTrigger] = useState<string | null>(null)
  // Exercises the athlete closed by hand. Reaching the target set count is not
  // the same as being done: they may stop at 2 of 3, or add a fourth set.
  // Mirrors `session.closedExercises`, like `substitutions` below.
  const [closedExercises, setClosedExercises] = useState<Set<string>>(new Set())
  /** Planned exercise id → the exercise done in its place today. */
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({})
  /** Extras picked but not yet logged; once they have a set the sets carry them. */
  const [pendingExtras, setPendingExtras] = useState<string[]>([])
  const prTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  // Holds the in-flight "find or create today's session" promise so two quick
  // taps reuse one request instead of racing into two sessions for one day.
  const sessionPromiseRef = useRef<Promise<Session> | null>(null)
  // Session whose stored swaps and closed exercises are already in state.
  const hydratedSessionRef = useRef<string | null>(null)
  // The PATCH route reads the row, merges and writes it back, so two requests
  // in flight together can each overwrite the other's field. One at a time.
  const patchQueueRef = useRef<Promise<unknown>>(Promise.resolve())

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

  function patchSessionRow(id: string, updates: Partial<Session>): Promise<void> {
    const run = patchQueueRef.current
      .catch(() => undefined)
      .then(() => apiFetch(`/api/data/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }))
      .then(() => undefined)
    patchQueueRef.current = run
    return run
  }

  /**
   * Write session fields the athlete just changed (day, swaps, closed
   * exercises). With no session yet there is nothing to write: the values stay
   * in state and go out with the row when the first set creates it.
   */
  async function saveSessionFields(updates: Partial<Session>) {
    const target = session ?? (await sessionPromiseRef.current?.catch(() => null)) ?? null
    if (!target?.id) return
    setSession(prev => (prev && prev.id === target.id ? { ...prev, ...updates } : prev))
    updateSessionOptimistic(target.id, updates)
    try {
      await patchSessionRow(target.id, updates)
    } catch (e) {
      console.error('Failed to update session:', e)
      toast.error(t.common.saveFailed)
    }
  }

  /**
   * Resolve today's session, creating it (and stamping `startTime`) if needed.
   * Concurrent callers share one in-flight request.
   */
  async function ensureSession(): Promise<Session> {
    const startTime = new Date().toISOString()
    if (session?.id) {
      if (session.startTime) return session
      await patchSessionRow(session.id, { startTime })
      const updated = { ...session, startTime }
      setSession(updated)
      updateSessionOptimistic(session.id, { startTime })
      return updated
    }
    if (!sessionPromiseRef.current) {
      const localSubs = substitutions
      sessionPromiseRef.current = findOrCreateTodaySession({
        startTime, planDay: selectedDay || undefined, substitutions: localSubs,
      })
        .then(({ row, created }) => {
          let next = row
          if (!created) {
            // The row was already there (the sessions slice had not loaded
            // yet): what it stores comes in, and swaps picked meanwhile win.
            const merged = { ...(row.substitutions || {}), ...localSubs }
            next = { ...row, substitutions: merged }
            setSubstitutions(prev => ({ ...(row.substitutions || {}), ...prev }))
            setClosedExercises(prev => new Set([...(row.closedExercises || []), ...prev]))
            if (Object.keys(localSubs).length > 0) {
              patchSessionRow(row.id, { substitutions: merged })
                .catch(() => toast.error(t.common.saveFailed))
            }
          }
          hydratedSessionRef.current = next.id
          setSession(next)
          if (created) addSessionOptimistic(next)
          return next
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
      toast.error(t.common.saveFailed)
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
      await patchSessionRow(session.id, { endTime, duration })
      setSession({ ...session, endTime, duration })
      updateSessionOptimistic(session.id, { endTime, duration })
      setShowSummary(true)
    } catch (e) {
      // No summary for a workout that was not closed: it would read as saved.
      console.error('Failed to finish workout:', e)
      toast.error(t.common.saveFailed)
    } finally {
      setIsFinishing(false)
    }
  }

  const exercises = useMemo(
    () => (exercisesState.status === 'success' ? exercisesState.data || [] : []),
    [exercisesState]
  )
  const allSessions = sessionsState.status === 'success' ? sessionsState.data || NO_SESSIONS : NO_SESSIONS
  const allSets = setsState.status === 'success' ? setsState.data || NO_SETS : NO_SETS

  useEffect(() => {
    loadSessions(); loadSets(); loadExercises(); loadSettings()
    ;(async () => {
      const plans = await apiJson<Plan[]>('/api/data/plans').catch(() => [] as Plan[])
      const active = Array.isArray(plans) ? (plans.find(p => p.isActive) || plans[0]) : null
      setPlanRows(active?.rows || [])
      setDays(planDays(active))
      setPlansLoaded(true)
    })()
  }, [loadSessions, loadSets, loadExercises, loadSettings])

  // Choose the day once, when the history it depends on has arrived; after
  // that the selection belongs to the athlete.
  useEffect(() => {
    if (dayPickedRef.current || days.length === 0) return
    const settled = (s: { status: string }) => s.status === 'success' || s.status === 'error'
    if (!settled(sessionsState) || !settled(setsState)) return
    dayPickedRef.current = true
    setSelectedDay(pickPlanDay({ days, planRows, sessions: allSessions, sets: allSets }))
  }, [days, planRows, sessionsState, setsState, allSessions, allSets])

  useEffect(() => {
    if (sessionsState.status !== 'success') return
    const today = localDayKey()
    const existing = strengthSessions(sessionsState.data || [])
      .find(x => isSameLocalDay(x.date, today)) || null
    // Never downgrade a session we already hold: a reload of the sessions slice
    // that momentarily lacks the row just created would otherwise blank out the
    // active session, leaving the workout impossible to finish.
    setSession(prev => existing || prev)
  }, [sessionsState])

  // Swaps and closed exercises come back from today's row once, when it first
  // loads. From then on state is ahead of the row, never behind it.
  useEffect(() => {
    if (!session?.id || hydratedSessionRef.current === session.id) return
    hydratedSessionRef.current = session.id
    setSubstitutions(session.substitutions || {})
    setClosedExercises(new Set(session.closedExercises || []))
  }, [session])

  // The day on screen is the day of the session. This covers a row that has
  // none stored yet: without it a reload re-guesses the day from whatever was
  // trained, extras included, and flips which exercises count as planned.
  useEffect(() => {
    if (!session?.id || !selectedDay || session.planDay === selectedDay) return
    saveSessionFields({ planDay: selectedDay })
    // `saveSessionFields` is rebuilt every render; these are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.planDay, selectedDay])

  // Single source of truth: today's sets are derived from the store, not copied
  // into local state. The copy used to be overwritten whenever loadSets
  // completed, which silently dropped a set that had just been added.
  const sets = useMemo(() => {
    if (!session?.id) return NO_SETS
    return allSets.filter(x => x.sessionId === session.id).sort(byTimestamp)
  }, [allSets, session?.id])

  // Today's list is derived too. Kept in state it had to be rebuilt by an
  // effect, which is where swapped and extra exercises ended up counted as
  // plan work still owed.
  const workoutExercises = useMemo(() => {
    if (exercises.length === 0) return []
    return buildWorkoutList({
      day: selectedDay, planRows, exercises, sets, substitutions, pendingExtras,
      fallbackTargetSets, fallbackTargetReps,
    })
  }, [selectedDay, planRows, exercises, sets, substitutions, pendingExtras, fallbackTargetSets, fallbackTargetReps])

  const progress = useMemo(
    () => sessionProgress(workoutExercises, closedExercises),
    [workoutExercises, closedExercises]
  )
  const planCount = progress.planExercisesTotal
  const extraCount = progress.extraExercises

  const activeExIndex = Math.max(0, workoutExercises.findIndex(e => e.id === activeId))
  const activeEx: WorkoutItem | undefined = workoutExercises[activeExIndex]
  const activeExerciseId = activeEx?.id

  const inWorkoutIds = useMemo(() => new Set(workoutExercises.map(e => e.id)), [workoutExercises])
  const doneTodayIds = useMemo(() => new Set(sets.map(s => s.exerciseId)), [sets])

  const dayStatus = useMemo(
    () => weekDayStatus({ days, planRows, sessions: allSessions, sets: allSets }),
    [days, planRows, allSessions, allSets]
  )
  /** Exercises already trained earlier this week — today's session excluded. */
  const weekUsage = useMemo(
    () => exerciseWeekUsage({ sessions: allSessions, sets: allSets, excludeSessionId: session?.id }),
    [allSessions, allSets, session?.id]
  )
  const coverage = useMemo(
    () => weekCoverage({
      sessions: allSessions, sets: allSets, exercises,
      thresholds: getThresholdsForMode(trainingMode, storedSettings.thresholdsByMode),
    }),
    [allSessions, allSets, exercises, trainingMode, storedSettings.thresholdsByMode]
  )
  const weekdayFmt = useMemo(() => new Intl.DateTimeFormat(lang, { weekday: 'short' }), [lang])
  const dayDoneFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }),
    [lang]
  )

  const activeExerciseData = useMemo(
    () => exercises.find(e => e.id === activeExerciseId),
    [exercises, activeExerciseId]
  )
  /** Where the week stands on the muscles the exercise on screen counts for. */
  const activeVolume = useMemo(() => {
    const byMuscle = new Map(coverage.map(c => [c.muscle, c]))
    return [...countedMuscles(activeExerciseData).keys()]
      .map(m => byMuscle.get(m))
      .filter((c): c is MuscleCoverage => !!c)
  }, [coverage, activeExerciseData])
  const activeUsage = activeExerciseId ? weekUsage.get(activeExerciseId) : undefined

  useEffect(() => { setLastPr(null) }, [activeExerciseId])

  useEffect(() => {
    if (!carouselRef.current) return
    const el = carouselRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeExerciseId])

  const currentExerciseHistory = useMemo(() => {
    if (!activeExerciseId) return NO_SETS
    return allSets
      .filter(s => s.exerciseId === activeExerciseId && s.sessionId !== session?.id)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  }, [activeExerciseId, allSets, session?.id])

  /**
   * Load and reps for the set about to be performed. Derived here rather than
   * inside SetRow because it needs the full exercise history and the tunables.
   */
  const prescription = useMemo(() => {
    if (!activeEx) return null
    const target = parseRepTarget(activeEx.targetReps)
    const reps = repsForSet(target, activeEx.completedSets.length, Number(fallbackTargetReps) || 8)
    return suggestNextLoad(currentExerciseHistory, reps, {
      targetRpe: activeEx.targetRpe,
      isDeload: deloadActive,
      increment: storedSettings.progressionStepKg ?? DEFAULT_PROGRESSION_STEP_KG,
      deloadFactor: storedSettings.deloadLoadFactor ?? DEFAULT_DELOAD_LOAD_FACTOR,
    })
  }, [activeEx, currentExerciseHistory, deloadActive, storedSettings, fallbackTargetReps])

  /** A real day switch: what the athlete closed belonged to the day being left. */
  function switchDay(day: string) {
    if (day === selectedDay) return
    // A swap that never got a set goes with the old day; one that was trained
    // stays, so tapping the wrong day cannot turn done plan work into extras.
    const kept = Object.fromEntries(
      Object.entries(substitutions).filter(([, substitute]) => doneTodayIds.has(substitute))
    )
    setSelectedDay(day)
    setActiveId(null)
    setClosedExercises(new Set())
    setSubstitutions(kept)
    saveSessionFields({ planDay: day, closedExercises: [], substitutions: kept })
  }

  /** Returns false when the set could not be persisted, so SetRow keeps the input. */
  async function addSet(
    ex: WorkoutItem,
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
      const { id } = await apiJson<{ id?: string }>('/api/data/sets', { method: 'POST', body: JSON.stringify(newSet) })
      if (!id) throw new Error('save set: missing id')

      // The card must stay under the athlete's hands while the list re-derives.
      setActiveId(ex.id)
      addSetOptimistic({ id, ...newSet })
      // `addSetOptimistic` is a no-op unless the slice already loaded; refetch so
      // the set the athlete just saved cannot go missing from the screen.
      if (setsState.status !== 'success') loadSets(true)
      setLastSavedSetId(id)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setLastSavedSetId(null), 800)

      // Tell the athlete they beat their own record while they are still at the
      // rack. `currentExerciseHistory` excludes today, so the set just saved is
      // compared only against previous sessions.
      const pr = detectPR({ exerciseId: ex.id, weight: p.weight, reps: p.reps }, currentExerciseHistory)
      setLastPr(pr)
      if (prTimerRef.current) clearTimeout(prTimerRef.current)
      if (pr) prTimerRef.current = setTimeout(() => setLastPr(null), 6000)

      if (autoStartRest) setRestSignal(n => n + 1)

      // Saving a set does not move the athlete anywhere and does not wake the
      // coach. Hitting the target set count is a guess about being done — the
      // athlete says so explicitly with `finishExercise`.
      return true
    } catch (e) {
      console.error('Failed to save set:', e)
      return false
    }
  }

  function saveClosed(next: Set<string>) {
    setClosedExercises(next)
    saveSessionFields({ closedExercises: [...next] })
  }

  /**
   * The athlete declaring an exercise over. This is the only thing that wakes
   * the coach and the only thing that moves the carousel: the app cannot tell
   * a finished exercise from one that merely reached its planned set count.
   */
  function finishExercise(ex: WorkoutItem) {
    if (ex.completedSets.length === 0 || !session?.id) return

    const closed = new Set(closedExercises).add(ex.id)
    saveClosed(closed)
    setDebriefTrigger(`${session.id}:${ex.id}`)

    // Next exercise still owing work, scanning forward and wrapping around, so
    // an exercise skipped earlier isn't stranded behind the current one.
    const n = workoutExercises.length
    const index = workoutExercises.findIndex(e => e.id === ex.id)
    for (let step = 1; step < n; step++) {
      const next = workoutExercises[(index + step) % n]
      if (!isItemFinished(next, closed)) {
        setActiveId(next.id)
        return
      }
    }
    setActiveId(ex.id)
  }

  function reopenExercise(exId: string) {
    const next = new Set(closedExercises)
    next.delete(exId)
    saveClosed(next)
  }

  function removeExercise(exId: string) {
    setPendingExtras(prev => prev.filter(id => id !== exId))
    setActiveId(null)
  }

  async function removeSet(setId: string) {
    const removed = sets.find(s => s.id === setId)
    const item = removed && workoutExercises.find(e => e.id === removed.exerciseId)
    // An extra exists on the list only through its sets: keep the card when
    // the last one goes, or it would vanish from under the athlete's finger.
    if (item && !item.fromPlan) {
      setActiveId(item.id)
      setPendingExtras(prev => (prev.includes(item.id) ? prev : [...prev, item.id]))
    }
    removeSetOptimistic(setId)
    try {
      await apiFetch(`/api/data/sets/${setId}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Failed to delete set:', e)
      // Still in the database: put it back rather than show a deletion that
      // did not happen.
      if (removed) addSetOptimistic(removed)
      else loadSets(true)
      toast.error(t.common.saveFailed)
    }
  }

  function saveSubstitutions(next: Record<string, string>) {
    setSubstitutions(next)
    saveSessionFields({ substitutions: next })
  }

  function undoSubstitution(plannedId: string) {
    const next = { ...substitutions }
    delete next[plannedId]
    saveSubstitutions(next)
    setActiveId(plannedId)
  }

  /** `pickedId` takes the slot of `plannedId` for today. */
  function substitute(plannedId: string, pickedId: string) {
    if (pickedId === plannedId) {
      if (substitutions[plannedId]) undoSubstitution(plannedId)
      else setActiveId(plannedId)
      return
    }
    // An exercise that holds a slot of its own today cannot fill another one.
    const plannedToday = planRows.some(r => String(r.day) === String(selectedDay) && r.exerciseId === pickedId)
    if (plannedToday || workoutExercises.some(e => e.fromPlan && e.id === pickedId)) {
      if (inWorkoutIds.has(pickedId)) setActiveId(pickedId)
      return
    }
    saveSubstitutions({ ...substitutions, [plannedId]: pickedId })
    setPendingExtras(prev => prev.filter(id => id !== pickedId))
    setActiveId(pickedId)
  }

  function addExerciseToWorkout(exId: string) {
    // Already in today's list (from the plan or added earlier)? Jump to it
    // instead of appending a duplicate that would split the same exercise
    // across two cards and double-count it in the progress header.
    if (inWorkoutIds.has(exId)) {
      setActiveId(exId)
      return
    }
    // Picking the planned exercise back while its substitute is untouched is
    // an undo, not an extra.
    const slot = workoutExercises.find(e => e.replaces === exId)
    if (slot && slot.completedSets.length === 0) {
      undoSubstitution(exId)
      return
    }
    setPendingExtras(prev => [...prev, exId])
    setActiveId(exId)
  }

  function handlePick(exId: string) {
    const mode = picker
    setPicker(null)
    if (!exercises.some(e => e.id === exId)) return
    if (mode?.mode === 'replace') substitute(mode.plannedId, exId)
    else addExerciseToWorkout(exId)
  }

  const hasCompletedSets = sets.length > 0

  /** The exercise the pending debrief is about — not the one now on screen. */
  const debriefExercise = useMemo(() => {
    if (!debriefTrigger) return undefined
    const exId = debriefTrigger.slice(debriefTrigger.indexOf(':') + 1)
    return workoutExercises.find(e => e.id === exId)
  }, [debriefTrigger, workoutExercises])

  const replaceFor = picker?.mode === 'replace'
    ? exercises.find(e => e.id === picker.plannedId)
    : undefined
  // A swap is sized by the slot it fills, an extra by the default set count.
  const pickerSets = picker?.mode === 'replace'
    ? workoutExercises.find(e => (e.replaces ?? e.id) === picker.plannedId)?.targetSets ?? fallbackTargetSets
    : fallbackTargetSets

  return (
    <div className="space-y-5 -mt-2">
      <DeloadBanner />

      {/* Top bar: day picker + timer / start */}
      <header className="flex items-center justify-between gap-3">
        {days.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
            {dayStatus.map(({ day, doneOn }) => {
              const selected = day === selectedDay
              const doneLabel = doneOn
                ? t.workout.dayDoneOn.replace('{date}', formatDate(dayDoneFmt, dayKeyToDate(doneOn)))
                : undefined
              return (
                <button
                  key={day}
                  onClick={() => switchDay(day)}
                  aria-pressed={selected}
                  aria-label={doneLabel ? `${day}, ${doneLabel}` : day}
                  title={doneLabel}
                  className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 border
                    text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors
                    ${selected ? 'bg-ink text-white border-ink' : 'text-muted border-ink/10'}`}
                >
                  {day}
                  {doneOn && (
                    <Check size={11} strokeWidth={2.8} className={selected ? '' : 'text-success'} />
                  )}
                </button>
              )
            })}
          </div>
        ) : <span className="eyebrow">{t.workout.eyebrowDay}</span>}

        {/* Always mounted: when there is no startTime the component renders its
            own Start button. Gating the mount on `startTime` meant the button
            could never appear and `startWorkout` was unreachable — the timer
            only ever began as a side effect of saving the first set. */}
        <div className="shrink-0">
          <WorkoutTimer startTime={session?.startTime ?? null} onStart={startWorkout} />
        </div>
      </header>

      {/* Hero: progress + exercise carousel */}
      {workoutExercises.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            {/* Plan slots and extras are numbered apart: an extra is not the
                sixth exercise of a five-exercise plan. */}
            <div className="text-[13px] num text-muted">
              {activeEx?.fromPlan ? (
                <>
                  {t.workout.exerciseLabel}{' '}
                  <span className="text-ink font-semibold">{String(activeExIndex + 1).padStart(2, '0')}</span>{' '}
                  {t.workout.ofConnector}{' '}
                  <span className="text-ink font-semibold">{String(planCount).padStart(2, '0')}</span>
                </>
              ) : (
                <>
                  {t.workout.offPlanBadge}
                  {extraCount > 1 && (
                    <>
                      {' '}
                      <span className="text-ink font-semibold">{String(activeExIndex - planCount + 1).padStart(2, '0')}</span>{' '}
                      {t.workout.ofConnector}{' '}
                      <span className="text-ink font-semibold">{String(extraCount).padStart(2, '0')}</span>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="text-[11px] num text-muted">
              {planCount > 0 && (
                <>
                  <span className="text-ink font-semibold">{progress.planSetsDone}</span>/{progress.planSetsTarget} {t.workout.planSetsSuffix}
                </>
              )}
              {progress.extraSets > 0 && (
                <>
                  {planCount > 0 && <span className="opacity-30 mx-1.5">·</span>}
                  +<span className="text-ink font-semibold">{progress.extraSets}</span> {t.workout.extraSetsSuffix}
                </>
              )}
            </div>
          </div>

          <div ref={carouselRef} className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
            {workoutExercises.map((ex, i) => {
              const isActive = i === activeExIndex
              const isDone = isItemFinished(ex, closedExercises)
              const isPending = !isActive && !isDone && ex.completedSets.length === 0
              return (
                <button
                  key={ex.id}
                  data-active={isActive}
                  onClick={() => setActiveId(ex.id)}
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
                    {ex.fromPlan ? String(i + 1).padStart(2, '0') : '+'}
                  </span>
                  <span className="truncate max-w-[120px]">{ex.name}</span>
                  {isDone && !isActive && <Check size={11} strokeWidth={2.6} />}
                </button>
              )
            })}
            <button
              onClick={() => setPicker({ mode: 'add' })}
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-2
                         text-[12px] font-medium text-muted border border-dashed border-ink/15"
            >
              <Plus size={12} strokeWidth={2.4} /> {t.workout.addExerciseShort}
            </button>
          </div>
        </section>
      )}

      {/* The carousel above hosts the add button, but it only renders once the
          day has exercises: a day with no plan rows had no way to add any. */}
      {workoutExercises.length === 0 && plansLoaded && exercises.length > 0 && (
        <button
          onClick={() => setPicker({ mode: 'add' })}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-full py-3.5
                     text-[14px] font-medium text-muted border border-dashed border-ink/15"
        >
          <Plus size={14} strokeWidth={2.4} /> {t.workout.pickerTitle}
        </button>
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
            {activeEx.replaces && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeftRight size={12} strokeWidth={2.2} />
                  {t.workout.substituteFor.replace('{name}', activeEx.replacesName || activeEx.replaces)}
                </span>
                {activeEx.completedSets.length === 0 && (
                  <button
                    onClick={() => undoSubstitution(activeEx.replaces!)}
                    className="underline underline-offset-2 text-ink-soft"
                  >
                    {t.workout.undoSubstituteBtn.replace('{name}', activeEx.replacesName || activeEx.replaces)}
                  </button>
                )}
              </div>
            )}
            <div className="mt-2.5 space-y-1.5">
              <MuscleChips primaryMuscles={activeExerciseData?.primaryMuscles} />
              {activeVolume.length > 0 && (
                <div className="text-[12px] text-muted num">
                  <span className="label !text-[9px] mr-1.5">{t.workout.weekVolumeLabel}</span>
                  {activeVolume.map((c, i) => (
                    <span key={c.muscle}>
                      {i > 0 && <span className="opacity-30 mx-1.5">·</span>}
                      <span className={c.target === null ? '' : c.sets >= c.target ? 'text-success' : 'text-warning'}>
                        {t.muscles[c.muscle] || c.muscle} {c.sets}{c.target !== null && `/${c.target}`}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {activeUsage && (
              <div className="mt-2.5 rounded-xl bg-warning/10 text-warning px-3.5 py-2 text-[12px] font-medium">
                {t.workout.doneThisWeekNotice
                  .replace('{day}', formatDate(weekdayFmt, activeUsage.lastTs))
                  .replace('{sets}', String(activeUsage.sets))}
              </div>
            )}
            {activeEx.note && (
              <div className="mt-3 rounded-xl bg-paper-card border border-ink/[0.06] px-3.5 py-2.5 text-[13px] text-ink-soft leading-snug">
                <span className="label !text-[9px] block mb-1">{t.workout.planNote}</span>
                {activeEx.note}
              </div>
            )}
            {activeEx.fromPlan && activeEx.completedSets.length === 0 && (
              <button
                onClick={() => setPicker({ mode: 'replace', plannedId: activeEx.replaces ?? activeEx.id })}
                className="btn-ghost text-[13px] text-muted mt-2 -ml-2"
              >
                <ArrowLeftRight size={14} strokeWidth={2.2} /> {t.workout.substituteBtn}
              </button>
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
              onSave={(p) => addSet(activeEx, p)}
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
                exerciseId: ex.id,
                planDay: selectedDay,
                // Today's plan in its own order, with how far each row got. The
                // coach reads the reshuffles off this: a busy station turns a
                // planned opener into a closer, and the loads follow.
                // Slots are named after the PLANNED exercise; `substitutions`
                // says which ones were filled by something else.
                plannedToday: workoutExercises
                  .filter(e => e.fromPlan)
                  .map((e, idx) => ({
                    exerciseId: e.replaces ?? e.id,
                    exerciseName: e.replacesName ?? e.name,
                    position: idx + 1,
                    targetSets: e.targetSets,
                    targetReps: e.targetReps,
                    targetRpe: e.targetRpe,
                    note: e.note,
                    setsDone: e.completedSets.length,
                    done: isItemFinished(e, closedExercises),
                  })),
                substitutions: effectiveSubstitutions(workoutExercises),
                todaySets: ex.completedSets,
                previousSets: previousSessionSetsFor(allSets, ex.id, session?.id),
                targetSets: ex.targetSets,
                targetReps: ex.targetReps,
                targetRpe: ex.targetRpe,
                offPlan: !ex.fromPlan,
                exercisesDone: progress.planExercisesDone,
                exercisesTotal: progress.planExercisesTotal,
                // The coach sees the whole session, growing with every exercise
                // closed — not just the one that triggered this debrief.
                sessionSoFar: workoutExercises
                  .filter(e => e.completedSets.length > 0)
                  .map(e => ({ exerciseId: e.id, exerciseName: e.name, sets: e.completedSets })),
                sessions: allSessions,
                sets: allSets,
                exercises,
                plan: planRows,
                dayOrder: days,
                week: clientWeek(),
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
                {activeEx.completedSets.map((s, j) => {
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
                onClick={() => reopenExercise(activeEx.id)}
                className="btn-ghost text-sm w-full justify-center text-muted"
              >
                {t.workout.reopenExerciseBtn}
              </button>
            ) : (
              <button
                onClick={() => finishExercise(activeEx)}
                className={`w-full justify-center py-3.5 rounded-full text-[14px] ${
                  activeEx.completedSets.length >= activeEx.targetSets ? 'btn-primary' : 'btn'
                }`}
              >
                <Check size={16} strokeWidth={2.2} /> {t.workout.finishExerciseBtn}
              </button>
            )
          )}

          {(() => {
            const restPreset = getRestPresetForExercise(activeExerciseData?.primaryMuscles, {
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
              onClick={() => removeExercise(activeEx.id)}
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

      {picker && (
        <ExercisePicker
          exercises={exercises}
          sessions={allSessions}
          sets={allSets}
          planRows={planRows}
          days={days}
          selectedDay={selectedDay}
          inWorkoutIds={inWorkoutIds}
          doneTodayIds={doneTodayIds}
          weekUsage={weekUsage}
          coverage={coverage}
          impactSets={pickerSets}
          replaceFor={replaceFor}
          currentExerciseId={activeEx?.id}
          onPick={handlePick}
          onClose={() => setPicker(null)}
        />
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
