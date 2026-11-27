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
import { buildChatPrompt } from './prompts/chat'
import { buildAlternativesPrompt } from './prompts/alternatives'
import { buildExerciseDebriefPrompt } from './prompts/exerciseDebrief'
import { buildAthleteContext, formatInZone } from './prompts/context'
import {
    buildSessionPlanBlock,
    type PlannedExerciseState,
    type PerformedExercise,
    type SessionPosition,
} from './prompts/sessionPlan'
import { buildWeeklyReview, type ClientWeek } from '../coach/weeklyReview'
import { commentOf, intensityOf, isFailureSet, INTENSITY_KEYS } from '../setNotes'
import type { Prescription } from './prescription'

export type ChatMessage = {
    role: 'user' | 'assistant'
    content: string
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
        /** `Plan.dayOrder` of the active plan. */
        dayOrder?: string[]
        /** The browser's clock and week (`clientWeek()`); the server's are UTC. */
        week?: ClientWeek
    },
): Promise<string> {
    const { exercises = [], plan = [], weekSessions = [], weekSets = [], trainingMode = 'mixed', lang = 'it' } = context
    const settings = await getServerEffectiveSettings()

    const clientNow = context.week ? new Date(context.week.now) : null
    const now = clientNow && !Number.isNaN(clientNow.getTime()) ? clientNow : new Date()
    const todayString = formatInZone(now, lang === 'en' ? 'en-US' : 'it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }, context.week?.timeZone)

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
        dayOrder: context.dayOrder,
        week: context.week,
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

/**
 * Where an exercise sat in the order of a given session, read off the set
 * timestamps. Returns null when the exercise was not trained in that session.
 */
function positionInSession(
    sets: SetEntry[],
    sessionId: string,
    exerciseId: string,
): SessionPosition | null {
    const order: string[] = []
    for (const s of sets.filter(x => x.sessionId === sessionId)
        .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))) {
        if (!order.includes(s.exerciseId)) order.push(s.exerciseId)
    }
    const idx = order.indexOf(exerciseId)
    return idx === -1 ? null : { position: idx + 1, total: order.length }
}

export type ExerciseDebriefContext = {
    exerciseName: string
    /** Needed to place the exercise in the plan and map it to muscle groups. */
    exerciseId?: string
    /** Plan day being trained, as stored on the rows. */
    planDay?: string
    /**
     * Today's plan rows in planned order, with how far each one got. Without
     * this the coach cannot tell a reshuffled session from a plan followed to
     * the letter, and treats an exercise done last as if it had been done first.
     */
    plannedToday?: PlannedExerciseState[]
    /** Planned exercise id → the exercise done in its place today. */
    substitutions?: Record<string, string>
    /** Every set done on this exercise today, in order. */
    todaySets: SetEntry[]
    /** The same exercise in its previous session. */
    previousSets: SetEntry[]
    targetSets: number
    targetReps: string
    targetRpe?: number
    /** True when the exercise was added during the session, off plan. */
    offPlan?: boolean
    /** Progress through today's plan slots (extras excluded), so the coach can pace what it says. */
    exercisesDone: number
    exercisesTotal: number
    /**
     * Every exercise touched today with its sets, in workout order. The coach
     * used to see only the exercise that just ended, so it could not notice
     * fatigue building across the session or a pattern spanning two exercises.
     */
    sessionSoFar?: Array<{ exerciseId?: string; exerciseName: string; sets: SetEntry[] }>
    sessions: Session[]
    sets: SetEntry[]
    exercises: Exercise[]
    plan: PlanRow[]
    /** `Plan.dayOrder` of the active plan. */
    dayOrder?: string[]
    /** The browser's clock and week (`clientWeek()`); the server's are UTC. */
    week?: ClientWeek
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

    // ── Plan vs reality ──────────────────────────────────────────────────────
    // The performed order comes from the set timestamps, never from the order
    // the exercises appear on screen: the carousel keeps plan order even when
    // the athlete worked through it in a completely different sequence.
    const performed: PerformedExercise[] = (ctx.sessionSoFar || [])
        .filter(b => b.exerciseId && b.sets.length > 0)
        .map(b => ({
            entry: {
                exerciseId: b.exerciseId as string,
                exerciseName: b.exerciseName,
                setsDone: b.sets.length,
            },
            firstTs: b.sets.map(s => String(s.ts)).sort()[0] || '',
        }))
        .sort((a, b) => a.firstTs.localeCompare(b.firstTs))
        .map(p => p.entry)

    const currentId = ctx.exerciseId
    const currentIdx = currentId ? performed.findIndex(p => p.exerciseId === currentId) : -1
    const currentPosition: SessionPosition | null =
        currentIdx === -1 ? null : { position: currentIdx + 1, total: performed.length }
    // Same exercise, previous session: where it sat then. A load comparison
    // between an opener and a closer is not a comparison.
    const previousSessionId = ctx.previousSets[0]?.sessionId
    const previousPosition = currentId && previousSessionId
        ? positionInSession(ctx.sets, previousSessionId, currentId)
        : null

    const review = buildWeeklyReview(ctx.sessions, ctx.sets, ctx.exercises, ctx.plan, {
        trainingMode,
        thresholdsByMode: settings.thresholdsByMode,
        maxFailurePct: settings.maxFailurePct,
        targetRpeWhenReducing: settings.targetRpeWhenReducing,
        dayOrder: ctx.dayOrder,
        week: ctx.week,
    })

    const planContext = currentId
        ? buildSessionPlanBlock({
            lang,
            planDay: ctx.planDay,
            currentExerciseId: currentId,
            planned: ctx.plannedToday || [],
            performed,
            substitutions: ctx.substitutions,
            currentPosition,
            previousPosition,
            exercises: ctx.exercises,
            coverage: review?.coverage || [],
        })
        : ''

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
        dayOrder: ctx.dayOrder,
        week: ctx.week,
    })

    return callModel(buildExerciseDebriefPrompt({
        lang,
        trainingMode,
        athleteProfile: settings.athleteProfile,
        athleteNotes: settings.athleteNotes,
        athleteContext,
        situation: lines.join('\n'),
        sessionSoFar: soFar.join('\n'),
        planContext,
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
