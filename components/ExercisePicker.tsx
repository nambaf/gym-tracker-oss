"use client"
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Exercise, PlanRow, Session, SetEntry } from '@/lib/models'
import { usualExtrasForDay } from '@/lib/workout/planDay'
import {
  rankAlternatives, sameVolumeAsPlan, volumeImpact, type MuscleCoverage,
} from '@/lib/workout/alternatives'
import type { ExerciseWeekUsage } from '@/lib/workout/weekUsage'
import { formatGainImpact, formatSwapImpact } from '@/lib/workout/impactLabel'
import MuscleChips from '@/components/MuscleChips'
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
  /** Exercises with at least one set logged today. */
  doneTodayIds: Set<string>
  /** Exercises trained earlier this week, today excluded. */
  weekUsage: Map<string, ExerciseWeekUsage>
  /** Sets per muscle group so far this week, today included. */
  coverage: MuscleCoverage[]
  /** Sets the picked exercise would be done for: the slot's target, or the default. */
  impactSets: number
  /** Replace mode: the planned exercise a substitute is being chosen for. */
  replaceFor?: Exercise
  /** The exercise on screen, used to offer alternatives in add mode. */
  currentExerciseId?: string
  onPick: (exerciseId: string) => void
  onClose: () => void
}

export default function ExercisePicker({
  exercises, sessions, sets, planRows, days, selectedDay,
  inWorkoutIds, doneTodayIds, weekUsage, coverage, impactSets,
  replaceFor, currentExerciseId, onPick, onClose,
}: Props) {
  const t = useT()
  const lang = useLang()
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises])
  const weekdayFmt = useMemo(() => new Intl.DateTimeFormat(lang, { weekday: 'short' }), [lang])

  /** Most recent set per exercise: the "last time" hint. */
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

  // What to rank against: the exercise being replaced, or the one on screen.
  const reference = replaceFor ?? (currentExerciseId ? byId.get(currentExerciseId) : undefined)

  const alternatives = useMemo(
    () => rankAlternatives(reference, exercises, inWorkoutIds).slice(0, MAX_SUGGESTIONS),
    [reference, exercises, inWorkoutIds]
  )
  const similarity = useMemo(
    () => new Map(alternatives.map(a => [a.exercise.id, a.similarity])),
    [alternatives]
  )

  const usual = useMemo(() => {
    if (!selectedDay) return []
    const shown = new Set(alternatives.map(a => a.exercise.id))
    return usualExtrasForDay({ day: selectedDay, days, planRows, sessions, sets })
      .filter(id => byId.has(id) && !inWorkoutIds.has(id) && !shown.has(id))
      .slice(0, MAX_SUGGESTIONS)
  }, [selectedDay, days, planRows, sessions, sets, byId, inWorkoutIds, alternatives])

  const matches = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    return alphabetical.filter(e => fold(e.name).includes(q) || fold(e.id).includes(q))
  }, [alphabetical, query])

  /** What picking `ex` does to the week's volume, as one line of text. */
  function impactText(ex: Exercise): string {
    const impact = volumeImpact({ coverage, candidate: ex, planned: replaceFor, sets: impactSets })
    if (!replaceFor) return formatGainImpact(impact, t.muscles)
    if (impact.length === 0) return ''
    return sameVolumeAsPlan(impact) ? t.workout.impactSameAsPlan : formatSwapImpact(impact, t.muscles)
  }

  function row(ex: Exercise) {
    const last = lastSet.get(ex.id)
    const usage = weekUsage.get(ex.id)
    const similar = similarity.get(ex.id)
    const impact = ex.id === replaceFor?.id ? '' : impactText(ex)
    const usageDay = usage ? new Date(usage.lastTs) : null
    return (
      <button
        key={ex.id}
        onClick={() => onPick(ex.id)}
        className="w-full flex items-start justify-between gap-3 px-3.5 py-3 rounded-xl text-left
                   bg-paper-card border border-ink/[0.06] active:bg-paper-sunken"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-[14px] font-medium text-ink truncate">{ex.name}</span>
          <MuscleChips primaryMuscles={ex.primaryMuscles} size="sm" />
          {(similar !== undefined || impact) && (
            <span className="block text-[11px] text-muted num">
              {similar !== undefined && t.workout.similarityLabel.replace('{pct}', String(Math.round(similar * 100)))}
              {similar !== undefined && impact && <span className="opacity-40 mx-1">·</span>}
              {impact}
            </span>
          )}
          {usage && (
            <span className="chip !text-[10px] !bg-warning/10 !text-warning">
              {t.workout.pickerDoneThisWeek
                .replace('{day}', usageDay && !Number.isNaN(usageDay.getTime()) ? weekdayFmt.format(usageDay) : '')
                .replace('{sets}', String(usage.sets))}
            </span>
          )}
        </span>
        {doneTodayIds.has(ex.id) ? (
          <span className="chip !text-[10px] shrink-0">{t.workout.pickerInWorkout}</span>
        ) : inWorkoutIds.has(ex.id) ? (
          <span className="chip !text-[10px] shrink-0">{t.workout.pickerInList}</span>
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="display text-2xl min-w-0 truncate">
              {replaceFor
                ? t.workout.pickerReplaceTitle.replace('{name}', replaceFor.name)
                : t.workout.pickerTitle}
            </h3>
            <button onClick={onClose} className="btn-icon shrink-0" aria-label={t.common.close}><X size={16} /></button>
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
              {replaceFor && section(
                t.workout.pickerAlternativesTitle.replace('{name}', replaceFor.name),
                alternatives.map(a => a.exercise),
              )}
              {section(
                t.workout.pickerUsualTitle.replace('{day}', selectedDay),
                usual.map(id => byId.get(id)!),
              )}
              {!replaceFor && reference && section(
                t.workout.pickerAlternativesTitle.replace('{name}', reference.name),
                alternatives.map(a => a.exercise),
              )}
              {section(t.workout.pickerAllTitle, alphabetical)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
