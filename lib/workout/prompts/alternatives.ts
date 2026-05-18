import type { Lang } from '../../i18n'
import { ATHLETE_PROFILE, ATHLETE_NOTES } from './profile'

export interface AlternativesPromptInput {
  lang: Lang
  exerciseName: string
  /** CSV of available exercise names from the local DB. */
  availableExercises: string
  reason?: string
}

/**
 * Prompt for `suggestExerciseAlternatives`: alternatives to a given exercise.
 */
export function buildAlternativesPrompt(input: AlternativesPromptInput): string {
  if (input.lang === 'en') return buildEn(input)
  return buildIt(input)
}

function buildIt(input: AlternativesPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? ` Note: ${ATHLETE_NOTES}.` : ''
  const reasonBlock = input.reason ? ` perché ${input.reason}` : ''
  return `
Sei un coach di bodybuilding. L'utente (${ATHLETE_PROFILE})${notesBlock} cerca alternative all'esercizio "${input.exerciseName}"${reasonBlock}.

ESERCIZI DISPONIBILI NEL DATABASE:
${input.availableExercises}

ISTRUZIONI:
1. Suggerisci 3 alternative valide dall'elenco sopra (se presenti)
2. Spiega brevemente perché sono buone alternative (stesso pattern di movimento, muscoli simili)
3. Se non trovi alternative nel database, suggerisci esercizi comuni
4. Indica quale alternativa è la migliore per ipertrofia
5. Massimo 150 parole, in italiano
`
}

function buildEn(input: AlternativesPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? ` Notes: ${ATHLETE_NOTES}.` : ''
  const reasonBlock = input.reason ? ` because ${input.reason}` : ''
  return `
You are a bodybuilding coach. The user (${ATHLETE_PROFILE})${notesBlock} is looking for alternatives to "${input.exerciseName}"${reasonBlock}.

EXERCISES AVAILABLE IN THE DATABASE:
${input.availableExercises}

INSTRUCTIONS:
1. Suggest 3 valid alternatives from the list above (when present)
2. Briefly explain why they are good alternatives (same movement pattern, similar muscles)
3. If no good alternatives are in the DB, suggest common ones
4. Indicate which alternative is best for hypertrophy
5. Max 150 words, in English
`
}
