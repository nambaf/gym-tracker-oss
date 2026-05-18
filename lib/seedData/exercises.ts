import type { MuscleContribution } from '../models'

/**
 * Default exercise list seeded into a fresh DynamoDB `exercises` table.
 *
 * `primaryMuscles` keys must match the Italian names in `MUSCLE_MAP`
 * (see `lib/bodyMapUtils.ts`) so that volume/coverage calculations work.
 *
 * CUSTOMIZE: add, remove, or re-weight exercises here. The seed runs only
 * when the `exercises` table is empty, so editing this file does not affect
 * an already-populated deployment.
 */
export interface SeedExercise {
  name: string
  primaryMuscles: MuscleContribution[]
}

export const SEED_EXERCISES: SeedExercise[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  { name: 'Panca piana bilanciere', primaryMuscles: [{ muscle: 'Petto', percentage: 70 }, { muscle: 'Tricipiti', percentage: 20 }, { muscle: 'Spalle', percentage: 10 }] },
  { name: 'Panca inclinata manubri', primaryMuscles: [{ muscle: 'Petto', percentage: 65 }, { muscle: 'Spalle', percentage: 20 }, { muscle: 'Tricipiti', percentage: 15 }] },
  { name: 'Croci ai cavi', primaryMuscles: [{ muscle: 'Petto', percentage: 90 }, { muscle: 'Spalle', percentage: 10 }] },
  { name: 'Dips', primaryMuscles: [{ muscle: 'Petto', percentage: 50 }, { muscle: 'Tricipiti', percentage: 40 }, { muscle: 'Spalle', percentage: 10 }] },

  // ── Back ─────────────────────────────────────────────────────────────────
  { name: 'Trazioni alla sbarra', primaryMuscles: [{ muscle: 'Dorsali', percentage: 70 }, { muscle: 'Bicipiti', percentage: 20 }, { muscle: 'Avambracci', percentage: 10 }] },
  { name: 'Rematore bilanciere', primaryMuscles: [{ muscle: 'Dorsali', percentage: 70 }, { muscle: 'Bicipiti', percentage: 15 }, { muscle: 'Trapezi', percentage: 15 }] },
  { name: 'Lat machine presa larga', primaryMuscles: [{ muscle: 'Dorsali', percentage: 75 }, { muscle: 'Bicipiti', percentage: 15 }, { muscle: 'Avambracci', percentage: 10 }] },
  { name: 'Pulley basso', primaryMuscles: [{ muscle: 'Dorsali', percentage: 70 }, { muscle: 'Bicipiti', percentage: 15 }, { muscle: 'Trapezi', percentage: 15 }] },

  // ── Shoulders ────────────────────────────────────────────────────────────
  { name: 'Military press manubri', primaryMuscles: [{ muscle: 'Spalle', percentage: 70 }, { muscle: 'Tricipiti', percentage: 20 }, { muscle: 'Trapezi', percentage: 10 }] },
  { name: 'Alzate laterali', primaryMuscles: [{ muscle: 'Spalle', percentage: 95 }, { muscle: 'Trapezi', percentage: 5 }] },
  { name: 'Face pull', primaryMuscles: [{ muscle: 'Spalle', percentage: 60 }, { muscle: 'Trapezi', percentage: 25 }, { muscle: 'Dorsali', percentage: 15 }] },

  // ── Arms ─────────────────────────────────────────────────────────────────
  { name: 'Curl bilanciere', primaryMuscles: [{ muscle: 'Bicipiti', percentage: 85 }, { muscle: 'Avambracci', percentage: 15 }] },
  { name: 'Hammer curl', primaryMuscles: [{ muscle: 'Bicipiti', percentage: 70 }, { muscle: 'Avambracci', percentage: 30 }] },
  { name: 'Pushdown ai cavi', primaryMuscles: [{ muscle: 'Tricipiti', percentage: 95 }, { muscle: 'Avambracci', percentage: 5 }] },
  { name: 'French press', primaryMuscles: [{ muscle: 'Tricipiti', percentage: 95 }, { muscle: 'Spalle', percentage: 5 }] },

  // ── Legs ─────────────────────────────────────────────────────────────────
  { name: 'Squat bilanciere', primaryMuscles: [{ muscle: 'Quadricipiti', percentage: 55 }, { muscle: 'Glutei', percentage: 30 }, { muscle: 'Femorali', percentage: 15 }] },
  { name: 'Leg press', primaryMuscles: [{ muscle: 'Quadricipiti', percentage: 60 }, { muscle: 'Glutei', percentage: 25 }, { muscle: 'Femorali', percentage: 15 }] },
  { name: 'Affondi manubri', primaryMuscles: [{ muscle: 'Quadricipiti', percentage: 45 }, { muscle: 'Glutei', percentage: 40 }, { muscle: 'Femorali', percentage: 15 }] },
  { name: 'Stacchi rumeni', primaryMuscles: [{ muscle: 'Femorali', percentage: 55 }, { muscle: 'Glutei', percentage: 35 }, { muscle: 'Dorsali', percentage: 10 }] },
  { name: 'Leg curl', primaryMuscles: [{ muscle: 'Femorali', percentage: 95 }, { muscle: 'Polpacci', percentage: 5 }] },
  { name: 'Hip thrust', primaryMuscles: [{ muscle: 'Glutei', percentage: 75 }, { muscle: 'Femorali', percentage: 25 }] },
  { name: 'Calf raise in piedi', primaryMuscles: [{ muscle: 'Polpacci', percentage: 100 }] },
  { name: 'Adductor machine', primaryMuscles: [{ muscle: 'Adduttori', percentage: 100 }] },

  // ── Core / accessories ───────────────────────────────────────────────────
  { name: 'Plank', primaryMuscles: [{ muscle: 'Core', percentage: 100 }] },
  { name: 'Crunch a terra', primaryMuscles: [{ muscle: 'Core', percentage: 100 }] },
  { name: 'Shrug manubri', primaryMuscles: [{ muscle: 'Trapezi', percentage: 95 }, { muscle: 'Avambracci', percentage: 5 }] },
  { name: 'Wrist curl', primaryMuscles: [{ muscle: 'Avambracci', percentage: 100 }] },
]
