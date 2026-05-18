import type { TrainingMode } from '../../hypertrophyThresholds'
import type { Lang } from '../../i18n'

/**
 * Descriptions of the training modes included in AI prompts so the model
 * knows the user's approach. Localized for IT/EN.
 */
export const TRAINING_MODE_DESC: Record<Lang, Record<TrainingMode, string>> = {
  it: {
    intensity: 'Metodo intensità: pochi set (5-12/muscolo) tutti a cedimento (RPE 10)',
    volume: 'Metodo volume: più set (12-20/muscolo) con 2-3 RIR (RPE 7-8)',
    mixed: 'Metodo misto: intensità per upper body (pochi set a cedimento), volume per lower body (più set con RIR)',
  },
  en: {
    intensity: 'Intensity method: few sets (5-12/muscle), all to failure (RPE 10)',
    volume: 'Volume method: more sets (12-20/muscle) with 2-3 RIR (RPE 7-8)',
    mixed: 'Mixed: intensity for upper body (few sets to failure), volume for lower body (more sets with RIR)',
  },
}

/**
 * Weekly hard-set threshold cheat-sheets included as reference in prompts.
 *
 * CUSTOMIZE: numbers are aligned with `lib/hypertrophyThresholds.ts`.
 * If you change those, update these strings as well.
 */
export const THRESHOLDS_BY_MODE: Record<Lang, Record<TrainingMode, string>> = {
  it: {
    intensity: `- Petto/Dorsali/Spalle/Quad/Femorali/Glutei: 5-10
- Bicipiti/Tricipiti/Polpacci/Core: 4-8
- Trapezi/Avambracci: 3-6`,
    volume: `- Petto/Spalle: 10-16
- Dorsali/Quadricipiti: 12-18
- Femorali/Glutei: 10-16
- Bicipiti/Tricipiti: 8-14
- Polpacci/Core: 8-12
- Trapezi: 6-10`,
    mixed: `UPPER BODY (intensità - a cedimento):
- Petto/Dorsali/Spalle: 5-10
- Bicipiti/Tricipiti: 4-8
- Trapezi/Avambracci: 3-6
LOWER BODY (volume - 2-3 RIR):
- Quadricipiti: 12-18
- Femorali/Glutei: 10-16
- Polpacci: 8-12
- Core: 8-12`,
  },
  en: {
    intensity: `- Chest/Back/Shoulders/Quads/Hamstrings/Glutes: 5-10
- Biceps/Triceps/Calves/Core: 4-8
- Traps/Forearms: 3-6`,
    volume: `- Chest/Shoulders: 10-16
- Back/Quads: 12-18
- Hamstrings/Glutes: 10-16
- Biceps/Triceps: 8-14
- Calves/Core: 8-12
- Traps: 6-10`,
    mixed: `UPPER BODY (intensity - to failure):
- Chest/Back/Shoulders: 5-10
- Biceps/Triceps: 4-8
- Traps/Forearms: 3-6
LOWER BODY (volume - 2-3 RIR):
- Quads: 12-18
- Hamstrings/Glutes: 10-16
- Calves: 8-12
- Core: 8-12`,
  },
}
