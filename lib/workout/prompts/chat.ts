import type { TrainingMode } from '../../hypertrophyThresholds'
import type { Lang } from '../../i18n'
import { ATHLETE_PROFILE, ATHLETE_NOTES } from './profile'
import { TRAINING_MODE_DESC } from './training-modes'

export interface ChatPromptInput {
  lang: Lang
  trainingMode: TrainingMode
  todayString: string
  /** Optional pre-formatted extra context (volume done, last session, plan). */
  contextBlock?: string
  /** Formatted conversation history: "USER: ...\n\nCOACH: ...". */
  history: string
}

/**
 * Prompt for `chatWithCoach`: free chat with the coach.
 */
export function buildChatPrompt(input: ChatPromptInput): string {
  if (input.lang === 'en') return buildEn(input)
  return buildIt(input)
}

function buildIt(input: ChatPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? `\nNOTE UTENTE: ${ATHLETE_NOTES}` : ''
  const extra = input.contextBlock ? `\n${input.contextBlock}` : ''
  return `
Sei un coach di bodybuilding esperto. Rispondi alle domande dell'utente sul suo allenamento.

CONTESTO UTENTE:
OGGI: ${input.todayString}
PROFILO: ${ATHLETE_PROFILE}${notesBlock}
APPROCCIO: ${TRAINING_MODE_DESC.it[input.trainingMode]}${extra}

CONVERSAZIONE:
${input.history}

ISTRUZIONI:
1. Rispondi in modo specifico e utile
2. Usa le informazioni sulla settimana corrente (se disponibili) per contestualizzare
3. Tieni conto dell'approccio scelto dall'utente
4. Se ti chiedono alternative a esercizi, suggerisci 2-3 opzioni con pro/contro
5. Se ti chiedono di modificare il piano, sii specifico su cosa cambiare
6. Usa un tono amichevole e diretto, in italiano
7. Massimo 200 parole
`
}

function buildEn(input: ChatPromptInput): string {
  const notesBlock = ATHLETE_NOTES ? `\nUSER NOTES: ${ATHLETE_NOTES}` : ''
  const extra = input.contextBlock ? `\n${input.contextBlock}` : ''
  return `
You are an experienced bodybuilding coach. Answer the user's training questions.

USER CONTEXT:
TODAY: ${input.todayString}
PROFILE: ${ATHLETE_PROFILE}${notesBlock}
APPROACH: ${TRAINING_MODE_DESC.en[input.trainingMode]}${extra}

CONVERSATION:
${input.history}

INSTRUCTIONS:
1. Answer specifically and usefully
2. Use the current-week data (when available) to contextualise
3. Account for the user's chosen approach
4. If asked for exercise alternatives, suggest 2-3 options with pros/cons
5. If asked to tweak the plan, be specific about what to change
6. Use a friendly, direct tone, in English
7. Max 200 words
`
}
