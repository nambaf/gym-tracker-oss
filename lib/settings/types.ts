import type { MuscleGroup } from '../bodyMapUtils'

/**
 * Training modes.
 * - intensity: few sets to failure (RPE 10) — 5-12 sets/week per muscle
 * - volume:    more sets with 2-3 RIR (RPE 7-8) — 12-20 sets/week per muscle
 * - mixed:     intensity for upper body, volume for lower body
 */
export type TrainingMode = 'intensity' | 'volume' | 'mixed'

export type ThresholdsMatrix = Record<TrainingMode, Record<MuscleGroup, { maintenance: number; hypertrophy: number }>>
export type RecommendedSetsMatrix = Record<TrainingMode, Record<MuscleGroup, { minimal: number; optimal: number }>>

/**
 * Singleton runtime overrides. Stored as a single DynamoDB row at
 * `settings/global`. Every field is optional — when absent, the value
 * falls back to the corresponding `DEFAULT_*` in `./defaults.ts`.
 */
export type Settings = {
  id: 'global'
  // basic
  athleteProfile?: string
  athleteNotes?: string
  trainingMode?: TrainingMode
  deloadActive?: boolean
  // advanced simple
  maxSetsPerSessionPerMuscle?: number
  restCompoundSec?: number
  restStandardSec?: number
  restIsolationSec?: number
  compoundMuscles?: string[]
  isolationMuscles?: string[]
  // advanced matrices
  thresholdsByMode?: ThresholdsMatrix
  recommendedSets?: RecommendedSetsMatrix
}

/** Result of merging stored overrides with code defaults — every field populated. */
export type EffectiveSettings = Required<Settings>
