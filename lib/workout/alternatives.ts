import type { Exercise, Session, SetEntry } from '@/lib/models'
import {
  MUSCLE_CONTRIBUTION_THRESHOLD, normalizeMuscle, parsePrimaryMuscles, type MuscleGroup,
} from '@/lib/bodyMapUtils'
import { weekBounds } from '@/lib/dateUtils'
import { strengthSessions } from '@/lib/sessions'

type ExerciseLike = Pick<Exercise, 'id' | 'primaryMuscles'>

/** Share of the exercise going to each muscle group; shares sum to 1. */
export function muscleProfile(ex: ExerciseLike | undefined): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>()
  for (const { muscle, weight } of parsePrimaryMuscles(ex?.primaryMuscles)) {
    const group = normalizeMuscle(muscle)
    if (group) out.set(group, (out.get(group) || 0) + weight)
  }
  return out
}

/**
 * Sets credited per muscle group for ONE set of the exercise, by the rule every
 * volume figure in the app uses: a full set for each muscle at or above
 * `MUSCLE_CONTRIBUTION_THRESHOLD`, nothing below it.
 */
export function countedMuscles(ex: ExerciseLike | undefined): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>()
  for (const { muscle, weight } of parsePrimaryMuscles(ex?.primaryMuscles)) {
    if (weight < MUSCLE_CONTRIBUTION_THRESHOLD) continue
    const group = normalizeMuscle(muscle)
    if (group) out.set(group, (out.get(group) || 0) + 1)
  }
  return out
}

/** Cosine similarity of two muscle profiles: 1 = same split, 0 = nothing shared. */
export function muscleSimilarity(a: ExerciseLike | undefined, b: ExerciseLike | undefined): number {
  const pa = muscleProfile(a)
  const pb = muscleProfile(b)
  let dot = 0, na = 0, nb = 0
  for (const [g, w] of pa) { na += w * w; dot += w * (pb.get(g) || 0) }
  for (const w of pb.values()) nb += w * w
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0
}

/**
 * Exercises that could stand in for `target`, closest muscle split first.
 * Only candidates sharing some muscle are returned; ties keep input order.
 */
export function rankAlternatives<T extends ExerciseLike>(
  target: ExerciseLike | undefined,
  exercises: T[],
  exclude: ReadonlySet<string> = new Set(),
): Array<{ exercise: T; similarity: number }> {
  if (!target) return []
  return exercises
    .filter(e => e.id !== target.id && !exclude.has(e.id))
    .map(exercise => ({ exercise, similarity: muscleSimilarity(target, exercise) }))
    .filter(x => x.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
}

export type MuscleCoverage = { muscle: MuscleGroup; sets: number; target: number | null }

/**
 * Sets per muscle group logged in the week containing `now`, against the
 * hypertrophy threshold of the active training mode. Every muscle with a
 * threshold is listed, at zero if untouched.
 */
export function weekCoverage(input: {
  sessions: Pick<Session, 'id' | 'date' | 'kind'>[]
  sets: Pick<SetEntry, 'sessionId' | 'exerciseId'>[]
  exercises: ExerciseLike[]
  thresholds?: Partial<Record<MuscleGroup, { hypertrophy: number }>>
  now?: Date
}): MuscleCoverage[] {
  const { sessions, sets, exercises, thresholds = {}, now = new Date() } = input
  const { monday, sunday } = weekBounds(now)
  const inWeek = new Set(
    strengthSessions(sessions)
      .filter(s => { const d = new Date(s.date); return !Number.isNaN(d.getTime()) && d >= monday && d <= sunday })
      .map(s => s.id)
  )
  const byId = new Map(exercises.map(e => [e.id, e]))
  const perExercise = new Map<string, Map<MuscleGroup, number>>()
  const done = new Map<MuscleGroup, number>()
  for (const s of sets) {
    if (!inWeek.has(s.sessionId)) continue
    let counted = perExercise.get(s.exerciseId)
    if (!counted) { counted = countedMuscles(byId.get(s.exerciseId)); perExercise.set(s.exerciseId, counted) }
    for (const [g, n] of counted) done.set(g, (done.get(g) || 0) + n)
  }
  const muscles = new Set<MuscleGroup>([...done.keys(), ...(Object.keys(thresholds) as MuscleGroup[])])
  return [...muscles].map(muscle => ({
    muscle,
    sets: done.get(muscle) || 0,
    target: thresholds[muscle]?.hypertrophy ?? null,
  }))
}

export type MuscleImpact = {
  muscle: MuscleGroup
  /** Sets this week before doing the candidate. */
  before: number
  /** Sets this week after doing `sets` sets of the candidate. */
  after: number
  target: number | null
  /** after − what the week would reach doing the planned exercise instead. */
  vsPlan: number
}

/**
 * What `sets` sets of `candidate` do to the week's volume, muscle by muscle.
 *
 * With `planned` given, `vsPlan` compares against doing the planned exercise
 * for the same sets: a muscle the swap leaves short is negative, one it adds is
 * positive, and all zeros means the swap changes nothing. Muscles untouched by
 * both exercises are omitted.
 */
export function volumeImpact(input: {
  coverage: MuscleCoverage[]
  candidate: ExerciseLike | undefined
  planned?: ExerciseLike
  sets: number
}): MuscleImpact[] {
  const { coverage, candidate, planned, sets } = input
  const cand = countedMuscles(candidate)
  const plan = planned ? countedMuscles(planned) : new Map<MuscleGroup, number>()
  const cov = new Map(coverage.map(c => [c.muscle, c]))
  const muscles = new Set<MuscleGroup>([...cand.keys(), ...plan.keys()])
  return [...muscles]
    .map(muscle => {
      const before = cov.get(muscle)?.sets || 0
      const gain = (cand.get(muscle) || 0) * sets
      return {
        muscle,
        before,
        after: before + gain,
        target: cov.get(muscle)?.target ?? null,
        vsPlan: planned ? gain - (plan.get(muscle) || 0) * sets : 0,
      }
    })
    .sort((a, b) => Math.abs(b.vsPlan) - Math.abs(a.vsPlan) || (b.after - b.before) - (a.after - a.before))
}

/** True when swapping `planned` for the candidate leaves every muscle's week unchanged. */
export function sameVolumeAsPlan(impact: MuscleImpact[]): boolean {
  return impact.every(i => i.vsPlan === 0)
}
