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
 * Defaults live in `lib/settings/defaults.ts`. Runtime overrides can be
 * passed via the `overrides` parameter (sourced from the settings store
 * on the client, or from `getServerEffectiveSettings()` on the server).
 */
import type { MuscleContribution } from './models'
import { parsePrimaryMuscleNames } from './bodyMapUtils'
import {
  DEFAULT_COMPOUND_MUSCLES,
  DEFAULT_ISOLATION_MUSCLES,
  DEFAULT_REST_COMPOUND_SEC,
  DEFAULT_REST_STANDARD_SEC,
  DEFAULT_REST_ISOLATION_SEC,
} from './settings/defaults'

export type RestPresetKey = 'compound' | 'standard' | 'isolation'

export interface RestPreset {
  defaultSec: number
  labelKey: RestPresetKey
}

export interface RestPresetOverrides {
  compoundMuscles?: string[]
  isolationMuscles?: string[]
  restCompoundSec?: number
  restStandardSec?: number
  restIsolationSec?: number
}

/**
 * Most appropriate rest preset for an exercise.
 * Priority: multi-muscle compound > single-muscle isolation > default.
 */
export function getRestPresetForExercise(
  primaryMuscles: MuscleContribution[] | undefined,
  overrides?: RestPresetOverrides,
): RestPreset {
  const compoundMuscles = overrides?.compoundMuscles ?? DEFAULT_COMPOUND_MUSCLES
  const isolationMuscles = overrides?.isolationMuscles ?? DEFAULT_ISOLATION_MUSCLES
  const restCompoundSec = overrides?.restCompoundSec ?? DEFAULT_REST_COMPOUND_SEC
  const restStandardSec = overrides?.restStandardSec ?? DEFAULT_REST_STANDARD_SEC
  const restIsolationSec = overrides?.restIsolationSec ?? DEFAULT_REST_ISOLATION_SEC

  const muscles = parsePrimaryMuscleNames(primaryMuscles).map(m => m.toLowerCase())

  if (muscles.length === 0) {
    return { defaultSec: restStandardSec, labelKey: 'standard' }
  }

  const hasCompound = muscles.some(m => compoundMuscles.some(c => m.includes(c)))
  const isMultiMuscle = muscles.length > 1

  if (hasCompound && isMultiMuscle) {
    return { defaultSec: restCompoundSec, labelKey: 'compound' }
  }

  const isIsolation =
    muscles.length === 1 ||
    muscles.every(m => isolationMuscles.some(c => m.includes(c)))
  if (isIsolation) {
    return { defaultSec: restIsolationSec, labelKey: 'isolation' }
  }

  return { defaultSec: restStandardSec, labelKey: 'standard' }
}
