import type { TrainingMode } from '../../hypertrophyThresholds'
import type { Lang } from '../../i18n'
import { ATHLETE_PROFILE, ATHLETE_NOTES } from './profile'
import { TRAINING_MODE_DESC, THRESHOLDS_BY_MODE } from './training-modes'

export interface WeeklyPromptInput {
  lang: Lang
  trainingMode: TrainingMode
  weekSessionsCount: number
  weekSetsCount: number
  /** Per-muscle summary, e.g. "chest: 12 sets (complete)". */
  volumeSummary: string
  /** Missing exercises summary, e.g. "- Squat: 4 sets remaining". */
  missingSummary: string
}

/**
 * Prompt for `analyzeWeeklyProgress`: short comment on the user's weekly progress.
 *
 * CUSTOMIZE: tweak tone/length in the INSTRUCTIONS block below. Keep
 * `${input.*}` placeholders if you change structure.
 */
export function buildWeeklyAnalysisPrompt(input: WeeklyPromptInput): string {
  if (input.lang === 'en') return buildEn(input)
  return buildIt(input)
}

function buildIt(input: WeeklyPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? `\nNOTE UTENTE: ${ATHLETE_NOTES}` : ''
  return `
Sei un coach di bodybuilding esperto in ipertrofia. Analizza i progressi settimanali dell'utente.

PROFILO ATLETA: ${ATHLETE_PROFILE}${notesBlock}
APPROCCIO: ${TRAINING_MODE_DESC.it[input.trainingMode]}

DATI SETTIMANA CORRENTE:
- Sessioni completate: ${input.weekSessionsCount}
- Set totali eseguiti: ${input.weekSetsCount}

VOLUME PER GRUPPO MUSCOLARE (completato vs pianificato):
${input.volumeSummary}

SOGLIE DI RIFERIMENTO (hard set settimanali per modalità ${input.trainingMode}):
${THRESHOLDS_BY_MODE.it[input.trainingMode]}

ESERCIZI MANCANTI DAL PIANO:
${input.missingSummary}

ISTRUZIONI:
1. Commenta brevemente come sta andando la settimana (2-3 frasi)
2. Se ci sono muscoli sotto-allenati, suggerisci cosa prioritizzare
3. Tieni conto dell'approccio scelto dall'utente
4. Usa un tono amichevole e diretto, in italiano
5. Massimo 150 parole
`
}

function buildEn(input: WeeklyPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? `\nUSER NOTES: ${ATHLETE_NOTES}` : ''
  return `
You are a hypertrophy-focused bodybuilding coach. Analyze the user's weekly progress.

ATHLETE PROFILE: ${ATHLETE_PROFILE}${notesBlock}
APPROACH: ${TRAINING_MODE_DESC.en[input.trainingMode]}

CURRENT WEEK DATA:
- Sessions completed: ${input.weekSessionsCount}
- Total sets done: ${input.weekSetsCount}

VOLUME PER MUSCLE GROUP (done vs planned):
${input.volumeSummary}

REFERENCE THRESHOLDS (weekly hard sets, ${input.trainingMode} mode):
${THRESHOLDS_BY_MODE.en[input.trainingMode]}

MISSING EXERCISES FROM PLAN:
${input.missingSummary}

INSTRUCTIONS:
1. Briefly comment on how the week is going (2-3 sentences)
2. If any muscles are under-trained, suggest what to prioritize
3. Account for the user's chosen approach
4. Use a friendly, direct tone, in English
5. Max 150 words
`
}
