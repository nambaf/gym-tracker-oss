import type { TrainingMode } from '../../hypertrophyThresholds'
import type { Lang } from '../../i18n'
import { ATHLETE_PROFILE, ATHLETE_NOTES } from './profile'
import { TRAINING_MODE_DESC, THRESHOLDS_BY_MODE } from './training-modes'

export interface PlanPromptInput {
  lang: Lang
  trainingMode: TrainingMode
  /** Per-muscle summary, e.g. "chest: 12 sets (complete)". */
  volumeSummary: string
  /** Plan rows, e.g. "Monday: Squat - 4x8 @RPE8". */
  planStructure: string
}

/**
 * Prompt for `analyzePlan`: critical review of the weekly plan.
 */
export function buildPlanAnalysisPrompt(input: PlanPromptInput): string {
  if (input.lang === 'en') return buildEn(input)
  return buildIt(input)
}

function buildIt(input: PlanPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? `\nNOTE UTENTE: ${ATHLETE_NOTES}` : ''
  return `
Sei un coach di bodybuilding esperto in programmazione per ipertrofia. Analizza questo piano di allenamento.

PROFILO ATLETA: ${ATHLETE_PROFILE}${notesBlock}
APPROCCIO: ${TRAINING_MODE_DESC.it[input.trainingMode]}

VOLUME SETTIMANALE PER GRUPPO MUSCOLARE:
${input.volumeSummary}

STRUTTURA DEL PIANO:
${input.planStructure}

SOGLIE DI RIFERIMENTO (hard set settimanali per modalità ${input.trainingMode}):
${THRESHOLDS_BY_MODE.it[input.trainingMode]}

REGOLA IMPORTANTE: Max ~10 set per muscolo per sessione (Remer et al.). Se un muscolo ha più di 10 set in un giorno, suggerire di dividere su più sessioni.

ISTRUZIONI:
1. Valuta il bilanciamento del piano (punti di forza e debolezza)
2. Verifica che il volume per sessione per muscolo non superi 10 set
3. Identifica i 2-3 problemi principali se presenti
4. Suggerisci modifiche concrete e specifiche
5. Usa un tono professionale ma accessibile, in italiano
6. Massimo 200 parole
`
}

function buildEn(input: PlanPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? `\nUSER NOTES: ${ATHLETE_NOTES}` : ''
  return `
You are a bodybuilding coach experienced in hypertrophy programming. Analyze this training plan.

ATHLETE PROFILE: ${ATHLETE_PROFILE}${notesBlock}
APPROACH: ${TRAINING_MODE_DESC.en[input.trainingMode]}

WEEKLY VOLUME PER MUSCLE GROUP:
${input.volumeSummary}

PLAN STRUCTURE:
${input.planStructure}

REFERENCE THRESHOLDS (weekly hard sets, ${input.trainingMode} mode):
${THRESHOLDS_BY_MODE.en[input.trainingMode]}

IMPORTANT RULE: Max ~10 sets per muscle per session (Remer et al.). If any muscle has more than 10 sets in a day, suggest splitting across sessions.

INSTRUCTIONS:
1. Assess overall plan balance (strengths and weaknesses)
2. Check no per-session muscle volume exceeds 10 sets
3. Identify 2-3 main issues if any
4. Suggest concrete, specific changes
5. Use a professional but accessible tone, in English
6. Max 200 words
`
}
