import type { ThresholdsMatrix, RecommendedSetsMatrix, TrainingMode } from './types'

/**
 * Source of truth for every adopter-tunable default value.
 *
 * Adopters tune these constants at fork time (`// CUSTOMIZE:` markers).
 * Power users override them at runtime via the `/profile` page — the
 * overrides are stored as the `settings/global` DynamoDB row and merged
 * with these defaults at read time (see `./effective.ts`).
 *
 * Do NOT inline-define these constants anywhere else: every consumer
 * must either import from here or accept the value as a parameter.
 */

// CUSTOMIZE: athlete profile included as context in every AI coach prompt.
// Examples: "female, 60kg, beginner, strength goal" / "master athlete 50+,
// focus on mobility and light hypertrophy".
export const DEFAULT_ATHLETE_PROFILE = 'intermediate athlete, hypertrophy goal'

// CUSTOMIZE: extra notes the AI coach should always keep in mind —
// physical limitations, methodological preferences, exercises you can't do.
export const DEFAULT_ATHLETE_NOTES = ''

export const DEFAULT_TRAINING_MODE: TrainingMode = 'mixed'

export const DEFAULT_DELOAD_ACTIVE = false

// CUSTOMIZE: per-session per-muscle set cap.
// Above this value returns diminish significantly (junk volume).
// Reference: Remer et al. — ~10-11 sets/session/muscle.
// Raise to 12-14 for advanced athletes specialising on a group,
// lower to 6-8 for beginners.
export const DEFAULT_MAX_SETS_PER_SESSION_PER_MUSCLE = 10

// CUSTOMIZE: rest times in seconds.
// Strength athletes: 180-300 on compounds. Cardio-friendly: 45-60.
export const DEFAULT_REST_COMPOUND_SEC = 150  // 2:30
export const DEFAULT_REST_STANDARD_SEC = 120  // 2:00
export const DEFAULT_REST_ISOLATION_SEC = 75  // 1:15

// CUSTOMIZE: compound muscles (heavy multi-joint movements).
// Lowercase, matched against normalised primaryMuscles names.
export const DEFAULT_COMPOUND_MUSCLES: string[] = [
  'quadricipiti', 'glutei', 'femorali', 'dorsali', 'pettorali', 'petto',
]

// CUSTOMIZE: isolation muscles (single-joint, local fatigue).
export const DEFAULT_ISOLATION_MUSCLES: string[] = [
  'bicipiti', 'tricipiti', 'polpacci', 'avambracci',
  'deltoidi laterali', 'deltoidi posteriori',
]

/**
 * Weekly hard-set thresholds for hypertrophy.
 * Scientific basis: Schoenfeld et al. 2017, Krieger 2010, Pelland meta-regression.
 *
 * A "hard set" has RPE ≥ 7 (≤ 3 RIR).
 *  - maintenance: minimum to preserve muscle mass
 *  - hypertrophy: threshold for active muscle growth
 *
 * CUSTOMIZE: values tuned for an intermediate lifter.
 * Beginners can reduce by 20-30%; advanced lifters can push higher.
 */
export const DEFAULT_THRESHOLDS_BY_MODE: ThresholdsMatrix = {
  intensity: {
    petto: { maintenance: 4, hypertrophy: 10 },
    dorsali: { maintenance: 4, hypertrophy: 10 },
    spalle: { maintenance: 4, hypertrophy: 10 },
    bicipiti: { maintenance: 3, hypertrophy: 8 },
    tricipiti: { maintenance: 3, hypertrophy: 8 },
    quadricipiti: { maintenance: 4, hypertrophy: 10 },
    femorali: { maintenance: 4, hypertrophy: 10 },
    glutei: { maintenance: 4, hypertrophy: 10 },
    polpacci: { maintenance: 4, hypertrophy: 8 },
    core: { maintenance: 3, hypertrophy: 8 },
    trapezi: { maintenance: 3, hypertrophy: 6 },
    avambracci: { maintenance: 2, hypertrophy: 6 },
    adduttori: { maintenance: 2, hypertrophy: 4 },
  },
  volume: {
    petto: { maintenance: 8, hypertrophy: 16 },
    dorsali: { maintenance: 10, hypertrophy: 18 },
    spalle: { maintenance: 8, hypertrophy: 16 },
    bicipiti: { maintenance: 6, hypertrophy: 14 },
    tricipiti: { maintenance: 6, hypertrophy: 14 },
    quadricipiti: { maintenance: 10, hypertrophy: 18 },
    femorali: { maintenance: 8, hypertrophy: 16 },
    glutei: { maintenance: 8, hypertrophy: 16 },
    polpacci: { maintenance: 6, hypertrophy: 12 },
    core: { maintenance: 6, hypertrophy: 12 },
    trapezi: { maintenance: 4, hypertrophy: 10 },
    avambracci: { maintenance: 4, hypertrophy: 8 },
    adduttori: { maintenance: 3, hypertrophy: 8 },
  },
  // Mixed: intensity for upper body, volume for lower body
  mixed: {
    petto: { maintenance: 4, hypertrophy: 10 },
    dorsali: { maintenance: 4, hypertrophy: 10 },
    spalle: { maintenance: 4, hypertrophy: 10 },
    bicipiti: { maintenance: 3, hypertrophy: 8 },
    tricipiti: { maintenance: 3, hypertrophy: 8 },
    quadricipiti: { maintenance: 10, hypertrophy: 18 },
    femorali: { maintenance: 8, hypertrophy: 16 },
    glutei: { maintenance: 8, hypertrophy: 16 },
    polpacci: { maintenance: 6, hypertrophy: 12 },
    core: { maintenance: 6, hypertrophy: 12 },
    trapezi: { maintenance: 3, hypertrophy: 6 },
    avambracci: { maintenance: 2, hypertrophy: 6 },
    adduttori: { maintenance: 3, hypertrophy: 8 },
  },
}

/**
 * Recommended weekly sets per muscle, used by the "plan completeness" view
 * (setup-time check, before any training happens). Distinct from
 * `DEFAULT_THRESHOLDS_BY_MODE`:
 *  - here: minimal/optimal (UX "does the plan cover the muscles?")
 *  - there: maintenance/hypertrophy (runtime "are you doing enough?")
 *
 * CUSTOMIZE: values tuned for intermediate lifters.
 */
export const DEFAULT_RECOMMENDED_SETS: RecommendedSetsMatrix = {
  intensity: {
    petto: { minimal: 5, optimal: 10 },
    dorsali: { minimal: 5, optimal: 10 },
    spalle: { minimal: 5, optimal: 10 },
    bicipiti: { minimal: 4, optimal: 8 },
    tricipiti: { minimal: 4, optimal: 8 },
    quadricipiti: { minimal: 5, optimal: 10 },
    femorali: { minimal: 5, optimal: 10 },
    glutei: { minimal: 5, optimal: 10 },
    polpacci: { minimal: 4, optimal: 8 },
    core: { minimal: 4, optimal: 8 },
    trapezi: { minimal: 3, optimal: 6 },
    avambracci: { minimal: 3, optimal: 6 },
    adduttori: { minimal: 2, optimal: 4 },
  },
  volume: {
    petto: { minimal: 10, optimal: 16 },
    dorsali: { minimal: 12, optimal: 18 },
    spalle: { minimal: 10, optimal: 16 },
    bicipiti: { minimal: 8, optimal: 14 },
    tricipiti: { minimal: 8, optimal: 14 },
    quadricipiti: { minimal: 12, optimal: 18 },
    femorali: { minimal: 10, optimal: 16 },
    glutei: { minimal: 10, optimal: 16 },
    polpacci: { minimal: 8, optimal: 12 },
    core: { minimal: 8, optimal: 12 },
    trapezi: { minimal: 6, optimal: 10 },
    avambracci: { minimal: 6, optimal: 8 },
    adduttori: { minimal: 4, optimal: 8 },
  },
  // Mixed: intensity for upper body, volume for lower body
  mixed: {
    petto: { minimal: 5, optimal: 10 },
    dorsali: { minimal: 5, optimal: 10 },
    spalle: { minimal: 5, optimal: 10 },
    bicipiti: { minimal: 4, optimal: 8 },
    tricipiti: { minimal: 4, optimal: 8 },
    quadricipiti: { minimal: 12, optimal: 18 },
    femorali: { minimal: 10, optimal: 16 },
    glutei: { minimal: 10, optimal: 16 },
    polpacci: { minimal: 8, optimal: 12 },
    core: { minimal: 8, optimal: 12 },
    trapezi: { minimal: 3, optimal: 6 },
    avambracci: { minimal: 3, optimal: 6 },
    adduttori: { minimal: 4, optimal: 8 },
  },
}
