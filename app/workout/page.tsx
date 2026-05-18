"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Plan, PlanRow } from '@/lib/models'
import { getRestPresetForExercise } from '@/lib/restTimerPresets'
import { Check, Plus, X, Search, CheckCircle2 } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

/**
 * Internal tag stored in `Set.note` when the user marks a set as "to failure".
 * Kept as a fixed Italian string for data backward compatibility — display
 * is localized via `t.workout.chipFailure`.
 */
const FAILURE_TAG = 'cedimento'

async function findOrCreateTodaySession(startTime?: string): Promise<any> {
  const today = new Date().toISOString().slice(0, 10)
  const sessionsRes = await fetch('/api/data/sessions')
  const sessions = await sessionsRes.json()
  const todaySession = sessions.find((s: any) => (s.date || '').slice(0, 10) === today)
  if (todaySession) return todaySession
  const payload = {
    date: new Date().toISOString(),
    note: '',
    startTime: startTime || new Date().toISOString(),
  }
  const res = await fetch('/api/data/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const { id } = await res.json()
  return { id, ...payload }
}

/**
 * Today's weekday name in both IT and EN. Plan rows store the day as
 * free text, so matching both locales keeps the workout page working
 * regardless of UI language.
 */
function todayCandidateNames(): string[] {
  const d = new Date()
  return [
    new Intl.DateTimeFormat('it-IT', { weekday: 'long', timeZone: 'Europe/Rome' }).format(d).toLowerCase(),
    new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d).toLowerCase(),
  ]
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
  const [session, setSession] = useState<any | null>(null)
  const [sets, setSets] = useState<any[]>([])
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
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const {
    sessions: sessionsState,
    sets: setsState,
    exercises: exercisesState,
    loadSessions, loadSets, loadExercises, loadSettings,
    addSessionOptimistic, addSetOptimistic, removeSetOptimistic,
    updateSessionOptimistic, deloadActive,
    storedSettings,
  } = useDataStore()

  useWakeLock(true)

  async function startWorkout() {
    const startTime = new Date().toISOString()
    let currentSession = session
    if (!currentSession) {
      currentSession = await findOrCreateTodaySession(startTime)
      setSession(currentSession)
      addSessionOptimistic(currentSession)
    } else if (!currentSession.startTime) {
      await fetch(`/api/data/sessions/${currentSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ startTime }),
      })
      const updatedSession = { ...currentSession, startTime }
      setSession(updatedSession)
      updateSessionOptimistic(currentSession.id, { startTime })
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
    if (sessionsState.status === 'success') {
      const today = new Date().toISOString().slice(0, 10)
      const existing = sessionsState.data?.find((x: any) => (x.date || '').slice(0, 10) === today) || null
      setSession(existing)
    }
  }, [sessionsState])

  useEffect(() => {
    if (setsState.status === 'success' && session) {
      setSets((setsState.data || []).filter((x: any) => x.sessionId === session.id))
    }
  }, [setsState, session])

  useEffect(() => {
    if (!selectedDay || exercises.length === 0) return
    const exMap = new Map(exercises.map((e: any) => [e.id, e]))
    let planWorkout: WorkoutExercise[] = []
    const planForDay = planRows
      .filter(r => String(r.day) === String(selectedDay))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    planWorkout = planForDay.map((p) => {
      const ex = exMap.get(p.exerciseId) as { name?: string } | undefined
      return {
        id: p.exerciseId,
        name: ex?.name || p.exerciseId,
        targetSets: p.targetSets || 3,
        targetReps: p.targetReps || '8',
        fromPlan: true, completedSets: [], isActive: false,
        note: p.note, targetRpe: p.targetRpe,
      } as WorkoutExercise
    })
    setWorkoutExercises(prev => {
      const planIds = new Set(planWorkout.map(e => e.id))
      const extras = (prev || []).filter(e => !e.fromPlan && !planIds.has(e.id))
      const merged = [...planWorkout, ...extras]
      return merged.map(e => ({
        ...e,
        completedSets: sets.filter(s => s.exerciseId === e.id)
      }))
    })
  }, [selectedDay, exercises, planRows, sets])

  useEffect(() => {
    if (!workoutExercises.length) return
    setWorkoutExercises(prev => prev.map(e => ({
      ...e,
      completedSets: sets.filter(s => s.exerciseId === e.id)
    })))
  }, [sets, workoutExercises.length])

  useEffect(() => {
    const cur = workoutExercises[activeExIndex]
    if (!cur) return
    if (cur.completedSets.length >= cur.targetSets) {
      const next = workoutExercises.findIndex(
        (e, i) => i > activeExIndex && e.completedSets.length < e.targetSets
      )
      if (next !== -1) setActiveExIndex(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutExercises])

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

  async function addSet(exIndex: number, p: { weight: number; reps: number; toFailure?: boolean; note?: string }) {
    let currentSession = session
    if (!currentSession) {
      const startTime = new Date().toISOString()
      currentSession = await findOrCreateTodaySession(startTime)
      setSession(currentSession)
      addSessionOptimistic(currentSession)
    } else if (!currentSession.startTime) {
      const startTime = new Date().toISOString()
      await fetch(`/api/data/sessions/${currentSession.id}`, {
        method: 'PATCH', body: JSON.stringify({ startTime }),
      })
      const updatedSession = { ...currentSession, startTime }
      setSession(updatedSession)
      updateSessionOptimistic(currentSession.id, { startTime })
      currentSession = updatedSession
    }
    if (!workoutExercises[exIndex]) return
    const ex = workoutExercises[exIndex]
    let noteStr = ''
    if (p.toFailure) noteStr = FAILURE_TAG
    if (p.note) noteStr = noteStr ? `${noteStr} - ${p.note}` : p.note
    const newSet = {
      sessionId: currentSession.id,
      exerciseId: ex.id,
      ts: new Date().toISOString(),
      weight: p.weight, reps: p.reps,
      rpe: p.toFailure ? 10 : undefined,
      note: noteStr,
    }
    const res = await fetch('/api/data/sets', { method: 'POST', body: JSON.stringify(newSet) })
    const { id } = await res.json()
    const fullNewSet = { id, ...newSet }
    setSets(prev => [...prev, fullNewSet])
    addSetOptimistic(fullNewSet)
    setWorkoutExercises(prev => prev.map((e, i) =>
      i === exIndex ? { ...e, completedSets: [...e.completedSets, fullNewSet] } : e
    ))
    setLastSavedSetId(id)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setLastSavedSetId(null), 800)
  }

  function removeExercise(index: number) {
    setWorkoutExercises(prev => prev.filter((_, i) => i !== index))
    if (activeExIndex >= index && activeExIndex > 0) {
      setActiveExIndex(activeExIndex - 1)
    }
  }

  async function removeSet(setId: string) {
    setSets(prev => prev.filter(s => s.id !== setId))
    removeSetOptimistic(setId)
    try { await fetch(`/api/data/sets/${setId}`, { method: 'DELETE' }) }
    catch (e) { console.error('Failed to delete set:', e) }
  }

  function addExerciseToWorkout(exId: string) {
    const ex = exercises.find((e: any) => e.id === exId)
    if (!ex) return
    const newEx: WorkoutExercise = {
      id: ex.id, name: ex.name, targetSets: 3, targetReps: '8',
      fromPlan: false, completedSets: sets.filter(s => s.exerciseId === ex.id), isActive: false,
    }
    setWorkoutExercises(prev => {
      const arr = [...prev, newEx]
      setActiveExIndex(arr.length - 1)
      return arr
    })
    setShowExercisePicker(false)
    setSearchQuery('')
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

        {session?.startTime ? (
          <WorkoutTimer startTime={session.startTime} onStart={startWorkout} />
        ) : (
          <span className="eyebrow">{t.workout.eyebrowReady}</span>
        )}
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
              const isDone = ex.completedSets.length >= ex.targetSets
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
            <div className="eyebrow">
              {t.workout.setLabel} <span className="num">{activeEx.completedSets.length + 1}</span> {t.workout.ofConnector}{' '}
              <span className="num">{activeEx.targetSets}</span>
              {activeEx.targetRpe && (
                <>
                  <span className="opacity-30 mx-1.5">·</span> {t.workout.targetLabel}{' '}
                  <span className="num">{activeEx.targetReps}</span> {t.workout.repsLabel}
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
              targetReps={parseInt(activeEx.targetReps) || 8}
              exerciseHistory={currentExerciseHistory}
              targetRpe={activeEx.targetRpe ? (deloadActive ? Math.max(1, activeEx.targetRpe - 2) : activeEx.targetRpe) : undefined}
              isDeload={deloadActive}
            />
          </div>

          {activeEx.completedSets.length > 0 && (
            <div className="space-y-2">
              <div className="label">{t.workout.setsToday}</div>
              <div className="space-y-1.5">
                {activeEx.completedSets.map((s: any, j: number) => (
                  <SwipeableSetRow key={s.id} onDelete={() => removeSet(s.id)}>
                    <div className={`flex items-center justify-between bg-paper-card rounded-xl px-4 py-3
                                    border border-ink/[0.06] text-sm ${
                      lastSavedSetId === s.id ? 'animate-flash-accent' : ''
                    }`}>
                      <span className="label !text-[10px]">{t.workout.setPrefix} {j + 1}</span>
                      <span className="num font-medium text-ink">
                        {s.weight} kg × {s.reps}
                        {s.note?.includes(FAILURE_TAG) && (
                          <span className="ml-2 chip-accent !text-[10px]">{t.workout.chipFailure}</span>
                        )}
                      </span>
                    </div>
                  </SwipeableSetRow>
                ))}
              </div>
            </div>
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
                />
              </div>
            )
          })()}

          {!activeEx.fromPlan && (
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
