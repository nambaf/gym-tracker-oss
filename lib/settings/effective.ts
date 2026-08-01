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
  DEFAULT_TARGET_SETS,
  DEFAULT_TARGET_REPS,
  DEFAULT_AUTO_START_REST_TIMER,
  DEFAULT_PROGRESS_WINDOW_WEEKS,
  DEFAULT_PROGRESS_TREND_THRESHOLD_PCT,
  DEFAULT_MAX_HISTORY_MONTHS,
  DEFAULT_PROGRESSION_STEP_KG,
  DEFAULT_DELOAD_LOAD_FACTOR,
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
    autoStartRestTimer: s.autoStartRestTimer ?? DEFAULT_AUTO_START_REST_TIMER,
    maxSetsPerSessionPerMuscle: s.maxSetsPerSessionPerMuscle ?? DEFAULT_MAX_SETS_PER_SESSION_PER_MUSCLE,
    restCompoundSec: s.restCompoundSec ?? DEFAULT_REST_COMPOUND_SEC,
    restStandardSec: s.restStandardSec ?? DEFAULT_REST_STANDARD_SEC,
    restIsolationSec: s.restIsolationSec ?? DEFAULT_REST_ISOLATION_SEC,
    defaultTargetSets: s.defaultTargetSets ?? DEFAULT_TARGET_SETS,
    defaultTargetReps: s.defaultTargetReps ?? DEFAULT_TARGET_REPS,
    progressionStepKg: s.progressionStepKg ?? DEFAULT_PROGRESSION_STEP_KG,
    deloadLoadFactor: s.deloadLoadFactor ?? DEFAULT_DELOAD_LOAD_FACTOR,
    progressWindowWeeks: s.progressWindowWeeks ?? DEFAULT_PROGRESS_WINDOW_WEEKS,
    progressTrendThresholdPct: s.progressTrendThresholdPct ?? DEFAULT_PROGRESS_TREND_THRESHOLD_PCT,
    maxHistoryMonths: s.maxHistoryMonths ?? DEFAULT_MAX_HISTORY_MONTHS,
    compoundMuscles: s.compoundMuscles ?? DEFAULT_COMPOUND_MUSCLES,
    isolationMuscles: s.isolationMuscles ?? DEFAULT_ISOLATION_MUSCLES,
    thresholdsByMode: s.thresholdsByMode ?? DEFAULT_THRESHOLDS_BY_MODE,
    recommendedSets: s.recommendedSets ?? DEFAULT_RECOMMENDED_SETS,
  }
}
