/**
 * Personal records and relative intensity.
 *
 * Two things live here because they share one prerequisite — the best set ever
 * performed on an exercise:
 *
 *  - PR detection, so a set that beats history is called out while the athlete
 *    is still standing at the rack rather than never.
 *  - Relative intensity, i.e. how heavy today's set was compared with what the
 *    athlete can actually lift. The app used to compute `weight / epley1RM(weight, reps)`,
 *    which cancels the weight out entirely and reduces to `1 / (1 + reps/30)` —
 *    a number that depends only on the rep count. Going from 60 kg × 8 to
 *    120 kg × 8 left it unchanged at 79%.
 */
import { epley1RM } from './progress'
import type { SetEntry } from './models'

/**
 * Epley loses accuracy past ~10 reps, so high-rep sets are not allowed to
 * define a 1RM estimate. They are still eligible for a rep PR.
 *
 * CUSTOMIZE: code-only. Raise only if you routinely train and test above
 * 10 reps and accept the extra error.
 */
export const MAX_REPS_FOR_E1RM = 12

export type BestSet = {
  e1rm: number
  weight: number
  reps: number
  ts: string
  sessionId: string
}

export type ExerciseBests = Map<string, { byE1rm: BestSet; byWeight: BestSet }>

function toSet(s: SetEntry): BestSet | null {
  const weight = Number(s.weight)
  const reps = Number(s.reps)
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps < 1) return null
  return {
    e1rm: reps <= MAX_REPS_FOR_E1RM ? epley1RM(weight, reps) : 0,
    weight,
    reps,
    ts: String(s.ts || ''),
    sessionId: String(s.sessionId || ''),
  }
}

/**
 * Best set per exercise, by estimated 1RM and by absolute load.
 * `upTo` restricts the scan to sets performed strictly before that timestamp —
 * used to ask "was this a record *at the time*?".
 */
export function buildExerciseBests(sets: SetEntry[], upTo?: string): ExerciseBests {
  const out: ExerciseBests = new Map()
  for (const s of sets) {
    if (upTo && String(s.ts || '') >= upTo) continue
    const cand = toSet(s)
    if (!cand) continue
    const cur = out.get(s.exerciseId)
    if (!cur) {
      out.set(s.exerciseId, { byE1rm: cand, byWeight: cand })
      continue
    }
    if (cand.e1rm > cur.byE1rm.e1rm) cur.byE1rm = cand
    if (cand.weight > cur.byWeight.weight) cur.byWeight = cand
  }
  return out
}

/**
 * Intensity of a set relative to the athlete's best estimated 1RM on that
 * exercise, as a percentage. Returns null when there is no reference yet, or
 * when the exercise is bodyweight-only (every set at 0 kg), where a percentage
 * of load is meaningless.
 */
export function relativeIntensity(
  set: { exerciseId: string; weight: number | string },
  bests: ExerciseBests
): number | null {
  const ref = bests.get(set.exerciseId)?.byE1rm
  if (!ref || ref.e1rm <= 0) return null
  const w = Number(set.weight)
  if (!Number.isFinite(w) || w <= 0) return null
  return (w / ref.e1rm) * 100
}

export type PrKind = 'e1rm' | 'weight' | 'reps-at-weight'

export type PrResult = {
  kind: PrKind
  /** Improvement over the previous best, in kg for load PRs and reps otherwise. */
  delta: number
  previous: number
  current: number
}

/**
 * Does `set` beat everything done before it on the same exercise?
 * `history` must contain only sets performed before this one.
 *
 * Checks, in order of significance: estimated 1RM, absolute load, and reps at a
 * load already used before (the "double progression" record that a pure e1RM
 * check misses when the athlete adds reps instead of weight).
 */
export function detectPR(
  set: { exerciseId: string; weight: number | string; reps: number | string },
  history: SetEntry[]
): PrResult | null {
  const weight = Number(set.weight)
  const reps = Number(set.reps)
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps < 1) return null

  const same = history.filter(h => h.exerciseId === set.exerciseId)
  if (same.length === 0) return null

  let bestE1rm = 0
  let bestWeight = -Infinity
  let bestRepsAtWeight = 0
  for (const h of same) {
    const hw = Number(h.weight)
    const hr = Number(h.reps)
    if (!Number.isFinite(hw) || !Number.isFinite(hr) || hr < 1) continue
    if (hr <= MAX_REPS_FOR_E1RM) bestE1rm = Math.max(bestE1rm, epley1RM(hw, hr))
    bestWeight = Math.max(bestWeight, hw)
    if (hw === weight) bestRepsAtWeight = Math.max(bestRepsAtWeight, hr)
  }

  if (reps <= MAX_REPS_FOR_E1RM && bestE1rm > 0) {
    const e1rm = epley1RM(weight, reps)
    // A hair above the previous best is rounding noise, not a record.
    if (e1rm > bestE1rm * 1.001) {
      return { kind: 'e1rm', delta: e1rm - bestE1rm, previous: bestE1rm, current: e1rm }
    }
  }
  if (Number.isFinite(bestWeight) && weight > bestWeight && weight > 0) {
    return { kind: 'weight', delta: weight - bestWeight, previous: bestWeight, current: weight }
  }
  if (bestRepsAtWeight > 0 && reps > bestRepsAtWeight) {
    return { kind: 'reps-at-weight', delta: reps - bestRepsAtWeight, previous: bestRepsAtWeight, current: reps }
  }
  return null
}

/**
 * Compare a set against the same-numbered set of the previous session on that
 * exercise — the comparison the workout screen shows as an up/down arrow.
 * Returns null when there is nothing to compare against.
 */
export function compareToPrevious(
  current: { weight: number | string; reps: number | string },
  previous: { weight: number | string; reps: number | string } | undefined
): { direction: 'up' | 'down' | 'same'; deltaWeight: number; deltaReps: number } | null {
  if (!previous) return null
  const cw = Number(current.weight)
  const cr = Number(current.reps)
  const pw = Number(previous.weight)
  const pr = Number(previous.reps)
  if (![cw, cr, pw, pr].every(Number.isFinite)) return null
  const deltaWeight = cw - pw
  const deltaReps = cr - pr
  // Volume decides when load and reps disagree (heavier for fewer reps, say):
  // comparing weight first called 100 kg x 3 an improvement over 95 kg x 10.
  const direction =
    deltaWeight === 0 && deltaReps === 0
      ? 'same'
      : cw * cr > pw * pr
        ? 'up'
        : cw * cr < pw * pr
          ? 'down'
          : deltaWeight > 0 ? 'up' : deltaWeight < 0 ? 'down' : 'same'
  return { direction, deltaWeight, deltaReps }
}
