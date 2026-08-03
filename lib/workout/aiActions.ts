'use server'

/**
 * Server actions for the workout AI coach.
 *
 * Prompts live in `lib/workout/prompts/` (one builder per feature).
 * Model dispatch is provider-agnostic via `lib/ai/` (Bedrock | Gemini |
 * OpenAI | Anthropic | off), selected by the `AI_PROVIDER` env var.
 *
 * Athlete profile + notes come from `getServerEffectiveSettings()` so the
 * runtime `/profile` overrides flow into every prompt without each route
 * needing to know about the settings table.
 */

import type { Exercise, PlanRow, Session, SetEntry } from '../models'
import type { MuscleGroupSummary } from '../planAnalysis'
import type { TrainingMode } from '../hypertrophyThresholds'
import type { Lang } from '../i18n'
import { generateText, AIDisabledError, AIConfigError } from '../ai'
import { getServerEffectiveSettings } from '../settings/server'
import { buildWeeklyAnalysisPrompt } from './prompts/weekly'
import { buildPlanAnalysisPrompt } from './prompts/plan'
import { buildChatPrompt } from './prompts/chat'
import { buildAlternativesPrompt } from './prompts/alternatives'
import { buildExerciseDebriefPrompt } from './prompts/exerciseDebrief'
import { buildAthleteContext } from './prompts/context'
import { commentOf, intensityOf, isFailureSet, INTENSITY_KEYS } from '../setNotes'
import type { Prescription } from './prescription'

export type ChatMessage = {
    role: 'user' | 'assistant'
    content: string
}

export type WeeklyAnalysisContext = {
    planSummary: MuscleGroupSummary[]
    weekSessions: Session[]
    weekSets: SetEntry[]
    exercises: Exercise[]
    plan: PlanRow[]
    missingExercises: Array<{
        exerciseName: string
        plannedSets: number
        completedSets: number
        remainingSets: number
    }>
    trainingMode?: TrainingMode
    lang?: Lang
}

export type PlanAnalysisContext = {
    planSummary: MuscleGroupSummary[]
    exercises: Exercise[]
    plan: PlanRow[]
    trainingMode?: TrainingMode
    lang?: Lang
}

async function callModel(prompt: string): Promise<string> {
    try {
        return await generateText(prompt)
    } catch (err) {
        if (err instanceof AIDisabledError) {
            throw new Error('Coach AI not enabled (AI_PROVIDER=off)')
        }
        if (err instanceof AIConfigError) {
            throw new Error(`Coach AI not configured: ${err.message}`)
        }
        throw err
    }
}

/**
 * Comment on weekly progress for the current week.
 */
export async function analyzeWeeklyProgress(context: WeeklyAnalysisContext): Promise<string> {
    const { planSummary, weekSessions, weekSets, missingExercises, trainingMode = 'mixed', lang = 'it' } = context
    const settings = await getServerEffectiveSettings()

    const volumeSummary = planSummary
        .map(m => `${m.muscle}: ${m.totalSets} set (${m.status})`)
        .join('\n')

    const missingSummary = missingExercises.length > 0
        ? missingExercises.map(e => `- ${e.exerciseName}: ${e.remainingSets}`).join('\n')
        : '-'

    const prompt = buildWeeklyAnalysisPrompt({
        lang,
        trainingMode,
        weekSessionsCount: weekSessions.length,
        weekSetsCount: weekSets.length,
        volumeSummary,
        missingSummary,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
    })

    return callModel(prompt)
}

/**
 * Analyse the current plan and suggest programming tweaks.
 */
export async function analyzePlan(context: PlanAnalysisContext): Promise<string> {
    const { planSummary, exercises, plan, trainingMode = 'mixed', lang = 'it' } = context
    const settings = await getServerEffectiveSettings()

    const volumeSummary = planSummary
        .map(m => `${m.muscle}: ${m.totalSets} set (${m.status})`)
        .join('\n')

    const planStructure = plan
        .map(p => {
            const ex = exercises.find(e => e.id === p.exerciseId)
            return `${p.day}: ${ex?.name || p.exerciseId} - ${p.targetSets}x${p.targetReps}${p.targetRpe ? ` @RPE${p.targetRpe}` : ''}`
        })
        .join('\n')

    const prompt = buildPlanAnalysisPrompt({
        lang,
        trainingMode,
        volumeSummary,
        planStructure,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
    })
    return callModel(prompt)
}

/**
 * Free chat with the AI coach about the current workout.
 */
export async function chatWithCoach(
    messages: ChatMessage[],
    context: {
        planSummary?: MuscleGroupSummary[]
        exercises?: Exercise[]
        plan?: PlanRow[]
        weekSessions?: Session[]
        weekSets?: SetEntry[]
        trainingMode?: TrainingMode
        lang?: Lang
    },
): Promise<string> {
    const { exercises = [], plan = [], weekSessions = [], weekSets = [], trainingMode = 'mixed', lang = 'it' } = context
    const settings = await getServerEffectiveSettings()

    const todayString = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    // One shared context instead of a per-caller tally: the old inline version
    // normalised muscle names by lowercasing them, so it never matched the
    // groups the rest of the app uses, and it counted every contribution
    // regardless of how marginal.
    const athleteContext = buildAthleteContext({
        lang,
        sessions: weekSessions,
        sets: weekSets,
        exercises,
        planRows: plan,
        trainingMode,
        thresholdsByMode: settings.thresholdsByMode,
        maxFailurePct: settings.maxFailurePct,
        targetRpeWhenReducing: settings.targetRpeWhenReducing,
        progressWindowWeeks: settings.progressWindowWeeks,
        progressTrendThresholdPct: settings.progressTrendThresholdPct,
    })

    const history = messages
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
        .join('\n\n')

    const prompt = buildChatPrompt({
        lang,
        trainingMode,
        todayString,
        contextBlock: athleteContext,
        history,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
    })

    return callModel(prompt)
}

/** Render one set the way a coach would read it aloud. */
function describeSet(s: SetEntry, lang: Lang): string {
    const bits = [`${s.weight}x${s.reps}`]
    const lvl = intensityOf(s)
    if (lvl) {
        const key = INTENSITY_KEYS.find(i => i.level === lvl)?.key
        if (key) bits.push(key)
    }
    if (isFailureSet(s)) bits.push(lang === 'en' ? 'to failure' : 'a cedimento')
    if (s.flags?.length) bits.push(s.flags.join('/'))
    const c = commentOf(s)
    if (c) bits.push(`"${c}"`)
    return bits.join(' · ')
}

export type ExerciseDebriefContext = {
    exerciseName: string
    /** Every set done on this exercise today, in order. */
    todaySets: SetEntry[]
    /** The same exercise in its previous session. */
    previousSets: SetEntry[]
    targetSets: number
    targetReps: string
    targetRpe?: number
    /** True when the exercise was added during the session, off plan. */
    offPlan?: boolean
    /** Whole-session progress, so the coach can pace what it says. */
    exercisesDone: number
    exercisesTotal: number
    /**
     * Every exercise touched today with its sets, in workout order. The coach
     * used to see only the exercise that just ended, so it could not notice
     * fatigue building across the session or a pattern spanning two exercises.
     */
    sessionSoFar?: Array<{ exerciseName: string; sets: SetEntry[] }>
    sessions: Session[]
    sets: SetEntry[]
    exercises: Exercise[]
    plan: PlanRow[]
    trainingMode?: TrainingMode
    lang?: Lang
}

/**
 * Unprompted comment when an exercise is completed.
 *
 * Deliberately narrow: it gets the exercise that just ended plus the shared
 * athlete context, and is told not to repeat what is already on screen.
 */
export async function coachExerciseDebrief(ctx: ExerciseDebriefContext): Promise<string> {
    const { trainingMode = 'mixed', lang = 'it' } = ctx
    const settings = await getServerEffectiveSettings()
    const en = lang === 'en'

    const lines: string[] = []
    lines.push(`${ctx.exerciseName}${ctx.offPlan ? (en ? ' (off plan)' : ' (fuori piano)') : ''}`)
    lines.push(en
        ? `Target: ${ctx.targetSets} sets x ${ctx.targetReps} reps${ctx.targetRpe ? ` @RPE ${ctx.targetRpe}` : ''}`
        : `Target: ${ctx.targetSets} serie x ${ctx.targetReps} ripetizioni${ctx.targetRpe ? ` @RPE ${ctx.targetRpe}` : ''}`)

    lines.push(en ? 'Sets just done:' : 'Serie appena fatte:')
    lines.push(...ctx.todaySets.map((s, i) => `  ${i + 1}. ${describeSet(s, lang)}`))

    if (ctx.previousSets.length > 0) {
        lines.push(en ? 'Same exercise, previous session:' : 'Stesso esercizio, seduta precedente:')
        lines.push(...ctx.previousSets.map((s, i) => `  ${i + 1}. ${describeSet(s, lang)}`))
        const prevVol = ctx.previousSets.reduce((v, s) => v + Number(s.weight) * Number(s.reps), 0)
        const nowVol = ctx.todaySets.reduce((v, s) => v + Number(s.weight) * Number(s.reps), 0)
        const delta = prevVol > 0 ? Math.round(((nowVol - prevVol) / prevVol) * 100) : null
        if (delta !== null) {
            lines.push(en
                ? `Volume on this exercise vs last session: ${delta > 0 ? '+' : ''}${delta}%`
                : `Volume su questo esercizio rispetto alla seduta scorsa: ${delta > 0 ? '+' : ''}${delta}%`)
        }
    } else {
        lines.push(en ? 'No previous session on this exercise to compare with.'
                      : 'Nessuna seduta precedente su questo esercizio con cui confrontare.')
    }

    lines.push(en
        ? `Session progress: ${ctx.exercisesDone}/${ctx.exercisesTotal} exercises done`
        : `Avanzamento seduta: ${ctx.exercisesDone}/${ctx.exercisesTotal} esercizi completati`)

    // The whole session up to now, not just the exercise that ended: what the
    // athlete did in the first half is the only way to read the second half.
    const soFar: string[] = []
    for (const block of ctx.sessionSoFar || []) {
        if (block.sets.length === 0) continue
        soFar.push(block.exerciseName)
        soFar.push(...block.sets.map((s, i) => `  ${i + 1}. ${describeSet(s, lang)}`))
    }

    const athleteContext = buildAthleteContext({
        lang,
        sessions: ctx.sessions,
        sets: ctx.sets,
        exercises: ctx.exercises,
        planRows: ctx.plan,
        trainingMode,
        thresholdsByMode: settings.thresholdsByMode,
        maxFailurePct: settings.maxFailurePct,
        targetRpeWhenReducing: settings.targetRpeWhenReducing,
        progressWindowWeeks: settings.progressWindowWeeks,
        progressTrendThresholdPct: settings.progressTrendThresholdPct,
    })

    return callModel(buildExerciseDebriefPrompt({
        lang,
        trainingMode,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
        athleteContext,
        situation: lines.join('\n'),
        sessionSoFar: soFar.join('\n'),
    }))
}

/**
 * Suggest alternatives for a given exercise.
 */
export async function suggestExerciseAlternatives(
    exerciseName: string,
    exercises: Exercise[],
    reason?: string,
    lang: Lang = 'it',
): Promise<string> {
    const settings = await getServerEffectiveSettings()
    const prompt = buildAlternativesPrompt({
        lang,
        exerciseName,
        availableExercises: exercises.map(e => e.name).join(', '),
        reason,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
    })
    return callModel(prompt)
}
