"use client"
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Exercise, PlanRow, Session, SetEntry } from '@/lib/models'
import { mainMuscleGroup, usualExtrasForDay } from '@/lib/workout/planDay'
import { useT, useLang } from '@/lib/i18n/I18nProvider'

const MAX_SUGGESTIONS = 6

/** Case- and accent-insensitive form for search: "panca" matches "Pancà". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

type Props = {
  exercises: Exercise[]
  sessions: Session[]
  sets: SetEntry[]
  planRows: PlanRow[]
  days: string[]
  selectedDay: string
  /** Exercises already on today's list: picking one jumps to it. */
  inWorkoutIds: Set<string>
  /** The exercise on screen, used to offer same-muscle alternatives. */
  currentExerciseId?: string
  onPick: (exerciseId: string) => void
  onClose: () => void
}

export default function ExercisePicker({
  exercises, sessions, sets, planRows, days, selectedDay,
  inWorkoutIds, currentExerciseId, onPick, onClose,
}: Props) {
  const t = useT()
  const lang = useLang()
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises])

  /** Most recent set per exercise: the "last time" hint and the recency order. */
  const lastSet = useMemo(() => {
    const out = new Map<string, SetEntry>()
    for (const s of sets) {
      const prev = out.get(s.exerciseId)
      if (!prev || String(s.ts || '') > String(prev.ts || '')) out.set(s.exerciseId, s)
    }
    return out
  }, [sets])

  const alphabetical = useMemo(
    () => [...exercises].sort((a, b) => a.name.localeCompare(b.name, lang)),
    [exercises, lang]
  )

  const usual = useMemo(() => {
    if (!selectedDay) return []
    return usualExtrasForDay({ day: selectedDay, days, planRows, sessions, sets })
      .filter(id => byId.has(id) && !inWorkoutIds.has(id))
      .slice(0, MAX_SUGGESTIONS)
  }, [selectedDay, days, planRows, sessions, sets, byId, inWorkoutIds])

  const current = currentExerciseId ? byId.get(currentExerciseId) : undefined
  const currentGroup = mainMuscleGroup(current?.primaryMuscles)

  // Alternatives for a busy station: same main muscle, most recently used first.
  const sameMuscle = useMemo(() => {
    if (!current || !currentGroup) return []
    const shown = new Set(usual)
    return exercises
      .filter(e => e.id !== current.id && !shown.has(e.id) && !inWorkoutIds.has(e.id)
        && mainMuscleGroup(e.primaryMuscles) === currentGroup)
      .sort((a, b) =>
        String(lastSet.get(b.id)?.ts || '').localeCompare(String(lastSet.get(a.id)?.ts || ''))
        || a.name.localeCompare(b.name, lang))
      .slice(0, MAX_SUGGESTIONS)
  }, [current, currentGroup, exercises, usual, inWorkoutIds, lastSet, lang])

  const matches = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    return alphabetical.filter(e => fold(e.name).includes(q) || fold(e.id).includes(q))
  }, [alphabetical, query])

  function row(ex: Exercise) {
    const group = mainMuscleGroup(ex.primaryMuscles)
    const last = lastSet.get(ex.id)
    return (
      <button
        key={ex.id}
        onClick={() => onPick(ex.id)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left
                   bg-paper-card border border-ink/[0.06] active:bg-paper-sunken"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-ink truncate">{ex.name}</span>
          {group && <span className="block text-[11px] text-muted">{t.muscles[group] || group}</span>}
        </span>
        {inWorkoutIds.has(ex.id) ? (
          <span className="chip !text-[10px] shrink-0">{t.workout.pickerInWorkout}</span>
        ) : last ? (
          <span className="num text-[12px] text-muted shrink-0">{last.weight} kg × {last.reps}</span>
        ) : null}
      </button>
    )
  }

  function section(title: string, list: Exercise[]) {
    if (list.length === 0) return null
    return (
      <div className="space-y-1.5">
        <div className="label">{title}</div>
        {list.map(row)}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center justify-between mb-3">
            <h3 className="display text-2xl">{t.workout.pickerTitle}</h3>
            <button onClick={onClose} className="btn-icon"><X size={16} /></button>
          </div>
          {/* No autoFocus: on a phone the keyboard would cover the suggestions,
              which are what the athlete usually wants. */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-10"
              placeholder={t.workout.pickerPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="p-4 space-y-5">
          {query.trim() ? (
            matches.length > 0
              ? <div className="space-y-1.5">{matches.map(row)}</div>
              : <div className="text-sm text-muted text-center py-6">{t.workout.pickerEmpty}</div>
          ) : (
            <>
              {section(
                t.workout.pickerUsualTitle.replace('{day}', selectedDay),
                usual.map(id => byId.get(id)!),
              )}
              {currentGroup && section(
                t.workout.pickerSameMuscleTitle.replace('{muscle}', t.muscles[currentGroup] || currentGroup),
                sameMuscle,
              )}
              {section(t.workout.pickerAllTitle, alphabetical)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
