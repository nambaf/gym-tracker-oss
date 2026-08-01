import { epley1RM } from './progress'
import type { SetEntry } from './models'
import { DEFAULT_PROGRESS_WINDOW_WEEKS, DEFAULT_PROGRESS_TREND_THRESHOLD_PCT } from './settings/defaults'

export type ExerciseProgress = {
    exerciseId: string
    trend: number // percentage change in e1RM
    status: 'improving' | 'stable' | 'declining'
    lastE1RM: number
    avgE1RM: number
    /** Sessions the trend is computed from — a verdict on 2 is weaker than on 6. */
    sessionCount: number
}

/**
 * Track an exercise's progress over the last N weeks.
 * Used to spot trends and decide whether a deload is needed.
 */
export function getExerciseProgress(
    exerciseId: string,
    sets: SetEntry[],
    weeksBack: number = DEFAULT_PROGRESS_WINDOW_WEEKS,
    thresholdPct: number = DEFAULT_PROGRESS_TREND_THRESHOLD_PCT
): ExerciseProgress | null {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeksBack * 7)

    const exerciseSets = sets
        .filter(s => s.exerciseId === exerciseId && new Date(s.ts) >= cutoff)
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    if (exerciseSets.length === 0) return null

    // Group sets per session so we get one avg e1RM per session.
    const sessionE1RMs: Map<string, number[]> = new Map()
    exerciseSets.forEach(s => {
        const e1rm = epley1RM(s.weight, s.reps)
        if (e1rm > 0) {
            const existing = sessionE1RMs.get(s.sessionId) || []
            existing.push(e1rm)
            sessionE1RMs.set(s.sessionId, existing)
        }
    })

    // Best effort per session, not the mean: two warm-up sets logged alongside
    // the working sets used to drag the average down far enough to report a
    // decline on a session where the athlete actually got stronger.
    const avgE1RMs = Array.from(sessionE1RMs.values()).map(vals => Math.max(...vals))

    // A single session is a data point, not a trend: it used to report
    // "stable, 0%" for every exercise tried once.
    if (avgE1RMs.length < 2) return null

    const lastE1RM = avgE1RMs[avgE1RMs.length - 1]
    const firstE1RM = avgE1RMs[0]
    const avgE1RM = avgE1RMs.reduce((a, b) => a + b, 0) / avgE1RMs.length

    const trend = firstE1RM > 0 ? ((lastE1RM - firstE1RM) / firstE1RM) * 100 : 0

    let status: 'improving' | 'stable' | 'declining' = 'stable'
    if (trend > thresholdPct) status = 'improving'
    else if (trend < -thresholdPct) status = 'declining'

    return {
        exerciseId,
        trend: Math.round(trend * 10) / 10,
        status,
        lastE1RM: Math.round(lastE1RM * 10) / 10,
        avgE1RM: Math.round(avgE1RM * 10) / 10,
        sessionCount: avgE1RMs.length
    }
}
