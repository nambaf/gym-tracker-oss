/**
 * What to load on the next set.
 *
 * The previous suggestion averaged the estimated 1RM of the last five sets and
 * scaled it by an RPE factor. Both steps push the number down: later sets in a
 * session are fatigued and drag the mean below the athlete's actual capacity,
 * and the factor then takes another 8-15% off. On the real data that produced a
 * recommendation *below* the last session's working weight on 19 of 21 planned
 * exercises — the coach telling the athlete to regress.
 *
 * This uses double progression instead, which is what the suggestion was
 * pretending to be: hold the load until the top of the rep range is reached,
 * then add one increment. The estimated 1RM is only a fallback for an exercise
 * with no comparable recent work.
 */
import { epley1RM } from '../progress'
import { MAX_REPS_FOR_E1RM } from '../records'
import type { NextIntent, SetEntry } from '../models'

export type Prescription = {
  weight: number
  /** Why this number — the UI turns this into a localised sentence. */
  reason: 'progress' | 'hold' | 'repeat' | 'estimate' | 'deload' | 'intent'
  /** Set when the number comes from what the athlete decided last time. */
  intentAction?: NextIntent['action']
  /** Reps the athlete is aiming for; the top of the range when there is one. */
  targetReps: number
  /** Load of the reference set this was derived from, when there is one. */
  previousWeight?: number
}

/**
 * Snap to the equipment's step grid. Only correct when there is no previous
 * load to build on: applied to `previous + increment` it silently rewrites the
 * jump, because the athlete's own working weight rarely sits on the grid —
 * 26 + 2.5 came back as 27.5 (+1.5) and 57 + 2.5 as 60 (+3).
 */
function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) return Math.round(weight * 10) / 10
  return Math.round(weight / increment) * increment
}

/** Half-kilo precision: readable without pretending the grid is finer. */
function roundToHalf(weight: number): number {
  return Math.round(weight * 2) / 2
}

/** The most recent instruction the athlete left themselves, if still standing. */
function lastIntent(sets: { nextIntent?: NextIntent; ts: string }[]): NextIntent | null {
  let latest: { ts: string; intent: NextIntent } | null = null
  for (const s of sets) {
    if (s.nextIntent?.action && (!latest || s.ts > latest.ts)) {
      latest = { ts: s.ts, intent: s.nextIntent }
    }
  }
  return latest?.intent ?? null
}

/**
 * Suggest the load for the next set.
 *
 * @param history sets for this exercise, excluding the current session
 * @param targetReps reps being aimed for (top of the range, when a range)
 */
export function suggestNextLoad(
  history: SetEntry[],
  targetReps: number,
  opts: {
    targetRpe?: number
    isDeload?: boolean
    increment: number
    deloadFactor: number
  }
): Prescription | null {
  if (!targetReps || targetReps < 1) return null

  const usable = history
    .map(s => ({ ...s, w: Number(s.weight), r: Number(s.reps), ts: String(s.ts || '') }))
    .filter(s => Number.isFinite(s.w) && Number.isFinite(s.r) && s.r >= 1)
  if (usable.length === 0) return null

  // Most recent session that touched this exercise.
  const lastTs = usable.reduce((max, s) => (s.ts > max ? s.ts : max), '')
  const lastSessionId = usable.find(s => s.ts === lastTs)?.sessionId
  const lastSession = usable.filter(s => s.sessionId === lastSessionId)

  if (lastSession.length > 0) {
    // The working set is the heaviest of that session; warm-ups sit below it.
    const top = lastSession.reduce((best, s) => (s.w > best.w ? s : best))
    // Best reps achieved at that load, across the session.
    const repsAtTop = lastSession.filter(s => s.w === top.w).reduce((m, s) => Math.max(m, s.r), 0)

    if (opts.isDeload) {
      return {
        weight: roundToHalf(top.w * opts.deloadFactor),
        reason: 'deload',
        targetReps,
        previousWeight: top.w,
      }
    }
    if (top.w === 0) {
      // Bodyweight work: the load is not the variable, the reps are.
      return { weight: 0, reason: 'repeat', targetReps: Math.max(targetReps, repsAtTop + 1), previousWeight: 0 }
    }

    // What the athlete decided beats what the algorithm infers. They were the
    // one under the bar; the note existed precisely to be acted on.
    const intent = lastIntent(lastSession)
    if (intent) {
      const explicit = Number(intent.weight)
      const hasExplicit = Number.isFinite(explicit) && explicit > 0
      let weight = top.w
      if (intent.action === 'increase') weight = hasExplicit ? explicit : top.w + opts.increment
      else if (intent.action === 'decrease') weight = hasExplicit ? explicit : Math.max(0, top.w - opts.increment)
      else if (hasExplicit) weight = explicit
      return {
        weight: roundToHalf(weight),
        reason: 'intent',
        intentAction: intent.action,
        targetReps,
        previousWeight: top.w,
      }
    }

    if (repsAtTop >= targetReps) {
      // Add the step to the weight actually used, without snapping to the grid:
      // the previous load is achievable by definition, so previous + step is too.
      return {
        weight: roundToHalf(top.w + opts.increment),
        reason: 'progress',
        targetReps,
        previousWeight: top.w,
      }
    }
    return { weight: top.w, reason: 'hold', targetReps, previousWeight: top.w }
  }

  // No usable session: fall back to the best estimated 1RM on record.
  const best = usable
    .filter(s => s.r <= MAX_REPS_FOR_E1RM)
    .reduce((m, s) => Math.max(m, epley1RM(s.w, s.r)), 0)
  if (best <= 0) return null
  const rpeFactor = opts.targetRpe ? RPE_INTENSITY[opts.targetRpe] ?? 0.9 : 0.9
  return {
    weight: roundToIncrement((best * rpeFactor) / (1 + targetReps / 30), opts.increment),
    reason: 'estimate',
    targetReps,
  }
}

/** Fraction of 1RM sustainable at a given RPE. */
const RPE_INTENSITY: Record<number, number> = {
  10: 1.0, 9.5: 0.98, 9: 0.96, 8.5: 0.94, 8: 0.92,
  7.5: 0.89, 7: 0.86, 6.5: 0.84, 6: 0.82, 5.5: 0.79, 5: 0.77,
}
