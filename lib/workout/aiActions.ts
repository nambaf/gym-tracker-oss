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
    const { planSummary, exercises, plan, weekSessions, weekSets, trainingMode = 'mixed', lang = 'it' } = context
    const settings = await getServerEffectiveSettings()

    const todayString = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const actualVolume = new Map<string, number>()
    if (weekSets && weekSets.length > 0 && exercises) {
        for (const set of weekSets) {
            const ex = exercises.find(e => e.id === set.exerciseId)
            if (!ex?.primaryMuscles) continue
            for (const m of ex.primaryMuscles) {
                const norm = m.muscle.toLowerCase().trim()
                actualVolume.set(norm, (actualVolume.get(norm) || 0) + 1)
            }
        }
    }

    const contextLines: string[] = []
    if (weekSessions) {
        contextLines.push(`Sessions this week: ${weekSessions.length}`)
        const lastSession = weekSessions[weekSessions.length - 1]
        if (lastSession?.note) contextLines.push(`Last session note: "${lastSession.note}"`)
    }
    if (actualVolume.size > 0) {
        contextLines.push(
            'Volume done this week (sets per muscle):',
            ...Array.from(actualVolume.entries()).map(([m, s]) => `- ${m}: ${s}`),
        )
    }
    if (planSummary && planSummary.length > 0) {
        contextLines.push(
            'Planned weekly volume (target):',
            planSummary.map(m => `${m.muscle}: ${m.totalSets}`).join(', '),
        )
    }
    if (exercises && plan) {
        const planExercises = plan.slice(0, 20).map(p => {
            const ex = exercises.find(e => e.id === p.exerciseId)
            return ex?.name || p.exerciseId
        }).join(', ')
        contextLines.push('Exercises in plan:', planExercises)
    }

    const history = messages
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
        .join('\n\n')

    const prompt = buildChatPrompt({
        lang,
        trainingMode,
        todayString,
        contextBlock: contextLines.join('\n'),
        history,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
    })

    return callModel(prompt)
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
