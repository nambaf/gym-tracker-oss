import type { MuscleContribution } from '../models'

/**
 * Default exercise list seeded into a fresh DynamoDB `exercises` table.
 *
 * Each entry carries the name in both supported languages. The seed endpoint
 * picks the one matching the active locale at insertion time, so a row in the
 * `exercises` table always has a single `name` string (matching `Exercise.name`).
 *
 * `primaryMuscles[].muscle` keys must match the Italian names in `MUSCLE_MAP`
 * (see `lib/bodyMapUtils.ts`) — those are stored values, not UI strings, so
 * they stay in Italian regardless of the user's locale.
 *
 * CUSTOMIZE: add, remove, or re-weight exercises here. The seed runs only
 * when the `exercises` table is empty, so editing this file does not affect
 * an already-populated deployment.
 */
export interface SeedExercise {
  name_it: string
  name_en: string
  primaryMuscles: MuscleContribution[]
}

export const SEED_EXERCISES: SeedExercise[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  { name_it: 'Panca piana bilanciere', name_en: 'Barbell bench press', primaryMuscles: [{ muscle: 'Petto', percentage: 70 }, { muscle: 'Tricipiti', percentage: 20 }, { muscle: 'Spalle', percentage: 10 }] },
  { name_it: 'Panca inclinata manubri', name_en: 'Incline dumbbell press', primaryMuscles: [{ muscle: 'Petto', percentage: 65 }, { muscle: 'Spalle', percentage: 20 }, { muscle: 'Tricipiti', percentage: 15 }] },
  { name_it: 'Croci ai cavi', name_en: 'Cable chest fly', primaryMuscles: [{ muscle: 'Petto', percentage: 90 }, { muscle: 'Spalle', percentage: 10 }] },
  { name_it: 'Dips', name_en: 'Dips', primaryMuscles: [{ muscle: 'Petto', percentage: 50 }, { muscle: 'Tricipiti', percentage: 40 }, { muscle: 'Spalle', percentage: 10 }] },

  // ── Back ─────────────────────────────────────────────────────────────────
  { name_it: 'Trazioni alla sbarra', name_en: 'Pull-ups', primaryMuscles: [{ muscle: 'Dorsali', percentage: 70 }, { muscle: 'Bicipiti', percentage: 20 }, { muscle: 'Avambracci', percentage: 10 }] },
  { name_it: 'Rematore bilanciere', name_en: 'Barbell row', primaryMuscles: [{ muscle: 'Dorsali', percentage: 70 }, { muscle: 'Bicipiti', percentage: 15 }, { muscle: 'Trapezi', percentage: 15 }] },
  { name_it: 'Lat machine presa larga', name_en: 'Wide-grip lat pulldown', primaryMuscles: [{ muscle: 'Dorsali', percentage: 75 }, { muscle: 'Bicipiti', percentage: 15 }, { muscle: 'Avambracci', percentage: 10 }] },
  { name_it: 'Pulley basso', name_en: 'Seated cable row', primaryMuscles: [{ muscle: 'Dorsali', percentage: 70 }, { muscle: 'Bicipiti', percentage: 15 }, { muscle: 'Trapezi', percentage: 15 }] },

  // ── Shoulders ────────────────────────────────────────────────────────────
  { name_it: 'Military press manubri', name_en: 'Dumbbell shoulder press', primaryMuscles: [{ muscle: 'Spalle', percentage: 70 }, { muscle: 'Tricipiti', percentage: 20 }, { muscle: 'Trapezi', percentage: 10 }] },
  { name_it: 'Alzate laterali', name_en: 'Lateral raises', primaryMuscles: [{ muscle: 'Spalle', percentage: 95 }, { muscle: 'Trapezi', percentage: 5 }] },
  { name_it: 'Face pull', name_en: 'Face pull', primaryMuscles: [{ muscle: 'Spalle', percentage: 60 }, { muscle: 'Trapezi', percentage: 25 }, { muscle: 'Dorsali', percentage: 15 }] },

  // ── Arms ─────────────────────────────────────────────────────────────────
  { name_it: 'Curl bilanciere', name_en: 'Barbell curl', primaryMuscles: [{ muscle: 'Bicipiti', percentage: 85 }, { muscle: 'Avambracci', percentage: 15 }] },
  { name_it: 'Hammer curl', name_en: 'Hammer curl', primaryMuscles: [{ muscle: 'Bicipiti', percentage: 70 }, { muscle: 'Avambracci', percentage: 30 }] },
  { name_it: 'Pushdown ai cavi', name_en: 'Cable tricep pushdown', primaryMuscles: [{ muscle: 'Tricipiti', percentage: 95 }, { muscle: 'Avambracci', percentage: 5 }] },
  { name_it: 'French press', name_en: 'Skull crushers', primaryMuscles: [{ muscle: 'Tricipiti', percentage: 95 }, { muscle: 'Spalle', percentage: 5 }] },

  // ── Legs ─────────────────────────────────────────────────────────────────
  { name_it: 'Squat bilanciere', name_en: 'Barbell back squat', primaryMuscles: [{ muscle: 'Quadricipiti', percentage: 55 }, { muscle: 'Glutei', percentage: 30 }, { muscle: 'Femorali', percentage: 15 }] },
  { name_it: 'Leg press', name_en: 'Leg press', primaryMuscles: [{ muscle: 'Quadricipiti', percentage: 60 }, { muscle: 'Glutei', percentage: 25 }, { muscle: 'Femorali', percentage: 15 }] },
  { name_it: 'Affondi manubri', name_en: 'Dumbbell lunges', primaryMuscles: [{ muscle: 'Quadricipiti', percentage: 45 }, { muscle: 'Glutei', percentage: 40 }, { muscle: 'Femorali', percentage: 15 }] },
  { name_it: 'Stacchi rumeni', name_en: 'Romanian deadlift', primaryMuscles: [{ muscle: 'Femorali', percentage: 55 }, { muscle: 'Glutei', percentage: 35 }, { muscle: 'Dorsali', percentage: 10 }] },
  { name_it: 'Leg curl', name_en: 'Leg curl', primaryMuscles: [{ muscle: 'Femorali', percentage: 95 }, { muscle: 'Polpacci', percentage: 5 }] },
  { name_it: 'Hip thrust', name_en: 'Hip thrust', primaryMuscles: [{ muscle: 'Glutei', percentage: 75 }, { muscle: 'Femorali', percentage: 25 }] },
  { name_it: 'Calf raise in piedi', name_en: 'Standing calf raise', primaryMuscles: [{ muscle: 'Polpacci', percentage: 100 }] },
  { name_it: 'Adductor machine', name_en: 'Adductor machine', primaryMuscles: [{ muscle: 'Adduttori', percentage: 100 }] },

  // ── Core / accessories ───────────────────────────────────────────────────
  { name_it: 'Plank', name_en: 'Plank', primaryMuscles: [{ muscle: 'Core', percentage: 100 }] },
  { name_it: 'Crunch a terra', name_en: 'Floor crunch', primaryMuscles: [{ muscle: 'Core', percentage: 100 }] },
  { name_it: 'Shrug manubri', name_en: 'Dumbbell shrugs', primaryMuscles: [{ muscle: 'Trapezi', percentage: 95 }, { muscle: 'Avambracci', percentage: 5 }] },
  { name_it: 'Wrist curl', name_en: 'Wrist curl', primaryMuscles: [{ muscle: 'Avambracci', percentage: 100 }] },
]
