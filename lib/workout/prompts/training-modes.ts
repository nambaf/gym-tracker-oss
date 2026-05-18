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
