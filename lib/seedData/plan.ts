import type { Lang } from '../i18n'

/**
 * Beginner 2-day full-body starter plan (A/B split).
 *
 * Each row references an exercise by the same `name_it` / `name_en` pair used
 * in `SEED_EXERCISES` — at insertion time the seed route resolves the row's
 * exerciseId by looking up the inserted exercises in the active locale.
 *
 * Day labels are localised (e.g. "Lunedì A" / "Monday A") to match how plan
 * rows store days as user-entered free text (see `app/page.tsx` weekday
 * matching). The two days map to weekday-1 / weekday-2 of the user's week.
 *
 * CUSTOMIZE: edit `STARTER_PLAN_ROWS` to change the prescription. Each row is
 * a [seedExerciseKey, targetSets, targetReps, targetRpe?] tuple.
 */
export interface StarterPlanRow {
  /** Day label, localised below. */
  day: 'A' | 'B'
  /** Must match a `name_it` from `SEED_EXERCISES`. */
  exerciseName_it: string
  targetSets: number
  targetReps: string
  targetRpe?: number
  order: number
}

export interface StarterPlan {
  name_it: string
  name_en: string
  description_it: string
  description_en: string
  /** Day label per locale, indexed by 'A' / 'B'. */
  dayLabels: Record<Lang, Record<'A' | 'B', string>>
  rows: StarterPlanRow[]
}

export const STARTER_PLAN_FULL_BODY_2D: StarterPlan = {
  name_it: 'Full body 2 giorni — Starter',
  name_en: 'Full body 2-day — Starter',
  description_it: 'Piano A/B di partenza, 2 sessioni a settimana, fondamentali a basso volume. Modifica come preferisci.',
  description_en: 'A/B starter plan, 2 sessions per week, compound lifts at low volume. Edit as you like.',
  dayLabels: {
    it: { A: 'Giorno A', B: 'Giorno B' },
    en: { A: 'Day A', B: 'Day B' },
  },
  rows: [
    // Day A: squat-focused full body
    { day: 'A', exerciseName_it: 'Squat bilanciere',       targetSets: 3, targetReps: '6-8',  targetRpe: 7, order: 1 },
    { day: 'A', exerciseName_it: 'Panca piana bilanciere', targetSets: 3, targetReps: '6-8',  targetRpe: 7, order: 2 },
    { day: 'A', exerciseName_it: 'Rematore bilanciere',    targetSets: 3, targetReps: '8-10', targetRpe: 7, order: 3 },
    { day: 'A', exerciseName_it: 'Curl bilanciere',        targetSets: 2, targetReps: '10-12', targetRpe: 8, order: 4 },
    { day: 'A', exerciseName_it: 'Plank',                  targetSets: 3, targetReps: '30s',  order: 5 },

    // Day B: deadlift-focused full body
    { day: 'B', exerciseName_it: 'Stacchi rumeni',           targetSets: 3, targetReps: '6-8',   targetRpe: 7, order: 1 },
    { day: 'B', exerciseName_it: 'Military press manubri',   targetSets: 3, targetReps: '8-10',  targetRpe: 7, order: 2 },
    { day: 'B', exerciseName_it: 'Lat machine presa larga',  targetSets: 3, targetReps: '8-10',  targetRpe: 7, order: 3 },
    { day: 'B', exerciseName_it: 'Pushdown ai cavi',         targetSets: 2, targetReps: '10-12', targetRpe: 8, order: 4 },
    { day: 'B', exerciseName_it: 'Affondi manubri',          targetSets: 2, targetReps: '10-12', targetRpe: 7, order: 5 },
  ],
}
