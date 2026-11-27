import type { Exercise, PlanRow, SetEntry } from '@/lib/models'

/**
 * One card on the workout screen. `id` is always the exercise actually being
 * performed, so sets are logged and read against it.
 */
export type WorkoutItem = {
  id: string
  name: string
  targetSets: number
  targetReps: string
  /** Fills a slot of today's plan — the planned exercise or its substitute. */
  fromPlan: boolean
  /** Planned exercise this one stands in for (busy machine). */
  replaces?: string
  replacesName?: string
  completedSets: SetEntry[]
  note?: string
  targetRpe?: number
}

function byTimestamp(a: { ts?: string }, b: { ts?: string }): number {
  return String(a.ts || '').localeCompare(String(b.ts || ''))
}

/**
 * Today's list: the plan slots of `day` in planned order, then the extras.
 *
 * A substitute takes the planned exercise's slot — its position, its target
 * sets and reps — instead of being appended with a target of its own, which is
 * what made a swapped exercise read as unfinished plan work plus extra work.
 *
 * A substitution is ignored when the planned exercise already has sets today:
 * the slot is then genuinely the planned exercise's, and the other one is an
 * extra. It is also ignored when the substitute is itself planned today.
 *
 * Extras are whatever has sets today outside the slots, plus `pendingExtras`
 * (picked but not yet logged). They never count toward the plan.
 */
export function buildWorkoutList(input: {
  day: string
  planRows: PlanRow[]
  exercises: Pick<Exercise, 'id' | 'name'>[]
  /** Today's sets only. */
  sets: SetEntry[]
  substitutions?: Record<string, string>
  pendingExtras?: string[]
  fallbackTargetSets: number
  fallbackTargetReps: string
}): WorkoutItem[] {
  const { day, planRows, exercises, sets, substitutions = {}, pendingExtras = [] } = input
  const nameOf = new Map(exercises.map(e => [e.id, e.name]))
  const setsBy = new Map<string, SetEntry[]>()
  for (const s of [...sets].sort(byTimestamp)) {
    const arr = setsBy.get(s.exerciseId)
    if (arr) arr.push(s)
    else setsBy.set(s.exerciseId, [s])
  }

  const dayRows = planRows
    .filter(r => String(r.day) === String(day))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const plannedIds = new Set(dayRows.map(r => r.exerciseId))

  const items: WorkoutItem[] = []
  const used = new Set<string>()
  for (const row of dayRows) {
    if (used.has(row.exerciseId)) continue
    const sub = substitutions[row.exerciseId]
    const swapped = !!sub && sub !== row.exerciseId && !plannedIds.has(sub) && !used.has(sub)
      && !(setsBy.get(row.exerciseId)?.length)
    const id = swapped ? sub : row.exerciseId
    used.add(row.exerciseId)
    used.add(id)
    items.push({
      id,
      name: nameOf.get(id) || id,
      targetSets: row.targetSets || input.fallbackTargetSets,
      targetReps: row.targetReps || input.fallbackTargetReps,
      fromPlan: true,
      ...(swapped ? { replaces: row.exerciseId, replacesName: nameOf.get(row.exerciseId) || row.exerciseId } : {}),
      completedSets: setsBy.get(id) || [],
      note: row.note,
      targetRpe: row.targetRpe,
    })
  }

  const extraIds = [...setsBy.keys(), ...pendingExtras]
  for (const id of extraIds) {
    if (used.has(id)) continue
    used.add(id)
    items.push({
      id,
      name: nameOf.get(id) || id,
      targetSets: input.fallbackTargetSets,
      targetReps: input.fallbackTargetReps,
      fromPlan: false,
      completedSets: setsBy.get(id) || [],
    })
  }
  return items
}
