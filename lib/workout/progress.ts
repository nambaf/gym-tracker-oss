import type { WorkoutItem } from './workoutList'

type ItemLike = Pick<WorkoutItem, 'id' | 'fromPlan' | 'targetSets'> & { completedSets: unknown[] }

/** Done = the athlete closed it, or it reached its planned set count. */
export function isItemFinished(item: ItemLike, closed: ReadonlySet<string>): boolean {
  return closed.has(item.id) || item.completedSets.length >= item.targetSets
}

export type SessionProgress = {
  /** Sets done on plan slots, capped at each slot's target. */
  planSetsDone: number
  planSetsTarget: number
  planExercisesDone: number
  planExercisesTotal: number
  /** Sets on exercises outside the plan. Reported, never counted as plan work. */
  extraSets: number
  extraExercises: number
}

/**
 * Progress against today's plan.
 *
 * Only plan slots count, and each one only up to its target: a fourth set on a
 * three-set exercise is real work but does not make up for an exercise never
 * started, and an extra exercise does not move the plan forward at all.
 */
export function sessionProgress(items: ItemLike[], closed: ReadonlySet<string> = new Set()): SessionProgress {
  const out: SessionProgress = {
    planSetsDone: 0, planSetsTarget: 0, planExercisesDone: 0, planExercisesTotal: 0,
    extraSets: 0, extraExercises: 0,
  }
  for (const item of items) {
    const done = item.completedSets.length
    if (item.fromPlan) {
      out.planSetsTarget += item.targetSets
      out.planSetsDone += Math.min(done, item.targetSets)
      out.planExercisesTotal += 1
      if (isItemFinished(item, closed)) out.planExercisesDone += 1
    } else {
      out.extraSets += done
      out.extraExercises += 1
    }
  }
  return out
}
