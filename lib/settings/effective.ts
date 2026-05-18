import type { Settings, EffectiveSettings } from './types'
import {
  DEFAULT_ATHLETE_PROFILE,
  DEFAULT_ATHLETE_NOTES,
  DEFAULT_TRAINING_MODE,
  DEFAULT_DELOAD_ACTIVE,
  DEFAULT_MAX_SETS_PER_SESSION_PER_MUSCLE,
  DEFAULT_REST_COMPOUND_SEC,
  DEFAULT_REST_STANDARD_SEC,
  DEFAULT_REST_ISOLATION_SEC,
  DEFAULT_COMPOUND_MUSCLES,
  DEFAULT_ISOLATION_MUSCLES,
  DEFAULT_THRESHOLDS_BY_MODE,
  DEFAULT_RECOMMENDED_SETS,
} from './defaults'

/**
 * Merge stored overrides with defaults. Matrices and arrays are all-or-nothing:
 * if `stored.thresholdsByMode` is present, it replaces the default entirely.
 * Scalars use `??` so `false` / `0` / `""` are valid overrides.
 */
export function mergeWithDefaults(stored: Partial<Settings> | null | undefined): EffectiveSettings {
  const s = stored ?? {}
  return {
    id: 'global',
    athleteProfile: s.athleteProfile ?? DEFAULT_ATHLETE_PROFILE,
    athleteNotes: s.athleteNotes ?? DEFAULT_ATHLETE_NOTES,
    trainingMode: s.trainingMode ?? DEFAULT_TRAINING_MODE,
    deloadActive: s.deloadActive ?? DEFAULT_DELOAD_ACTIVE,
    maxSetsPerSessionPerMuscle: s.maxSetsPerSessionPerMuscle ?? DEFAULT_MAX_SETS_PER_SESSION_PER_MUSCLE,
    restCompoundSec: s.restCompoundSec ?? DEFAULT_REST_COMPOUND_SEC,
    restStandardSec: s.restStandardSec ?? DEFAULT_REST_STANDARD_SEC,
    restIsolationSec: s.restIsolationSec ?? DEFAULT_REST_ISOLATION_SEC,
    compoundMuscles: s.compoundMuscles ?? DEFAULT_COMPOUND_MUSCLES,
    isolationMuscles: s.isolationMuscles ?? DEFAULT_ISOLATION_MUSCLES,
    thresholdsByMode: s.thresholdsByMode ?? DEFAULT_THRESHOLDS_BY_MODE,
    recommendedSets: s.recommendedSets ?? DEFAULT_RECOMMENDED_SETS,
  }
}
