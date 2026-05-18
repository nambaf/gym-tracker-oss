/**
 * Suggested rest-time presets based on the type of exercise.
 *
 * Guidelines used (literature summary — Schoenfeld 2016, de Salles 2009):
 *  - Heavy multi-joint compound lifts (squat, bench, deadlift, pull-ups): 2–3 min
 *  - Mixed / heavy single-joint moves: 1.5–2 min
 *  - Pure isolation (curls, raises, pushdowns, calves): 60–90 sec
 *
 * The classifier below is a heuristic over the exercise's PRIMARY MUSCLES,
 * not the movement itself. It works for most cases but does not replace a
 * per-exercise custom note (PlanRow.note can override at the UI layer).
 *
 * CUSTOMIZE: timings and muscle sets are opinionated. Tune for strength
 * athletes (3–5 min on compounds) or cardio-friendly training (45–60 s).
 */
import type { MuscleContribution } from './models'
import { parsePrimaryMuscleNames } from './bodyMapUtils'

// CUSTOMIZE: compound muscles (heavy multi-joint movements).
// Lowercase, matched against normalised primaryMuscles names.
const COMPOUND_MUSCLES = ['quadricipiti', 'glutei', 'femorali', 'dorsali', 'pettorali', 'petto']

// CUSTOMIZE: isolation muscles (single-joint, local fatigue).
const ISOLATION_MUSCLES = [
  'bicipiti', 'tricipiti', 'polpacci', 'avambracci',
  'deltoidi laterali', 'deltoidi posteriori',
]

// CUSTOMIZE: rest times in seconds.
const REST_COMPOUND_SEC = 150  // 2:30
const REST_STANDARD_SEC = 120  // 2:00
const REST_ISOLATION_SEC = 75  // 1:15

export type RestPresetKey = 'compound' | 'standard' | 'isolation'

export interface RestPreset {
  defaultSec: number
  labelKey: RestPresetKey
}

/**
 * Most appropriate rest preset for an exercise.
 * Priority: multi-muscle compound > single-muscle isolation > default.
 */
export function getRestPresetForExercise(
  primaryMuscles: MuscleContribution[] | undefined,
): RestPreset {
  const muscles = parsePrimaryMuscleNames(primaryMuscles).map(m => m.toLowerCase())

  if (muscles.length === 0) {
    return { defaultSec: REST_STANDARD_SEC, labelKey: 'standard' }
  }

  const hasCompound = muscles.some(m => COMPOUND_MUSCLES.some(c => m.includes(c)))
  const isMultiMuscle = muscles.length > 1

  if (hasCompound && isMultiMuscle) {
    return { defaultSec: REST_COMPOUND_SEC, labelKey: 'compound' }
  }

  const isIsolation =
    muscles.length === 1 ||
    muscles.every(m => ISOLATION_MUSCLES.some(c => m.includes(c)))
  if (isIsolation) {
    return { defaultSec: REST_ISOLATION_SEC, labelKey: 'isolation' }
  }

  return { defaultSec: REST_STANDARD_SEC, labelKey: 'standard' }
}
