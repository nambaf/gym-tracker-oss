import { epley1RM } from './progress'
import type { SetEntry } from './models'

export type ExerciseProgress = {
    exerciseId: string
    trend: number // percentage change in e1RM
    status: 'improving' | 'stable' | 'declining'
    lastE1RM: number
    avgE1RM: number
}

/**
 * Track an exercise's progress over the last N weeks.
 * Used to spot trends and decide whether a deload is needed.
 */
export function getExerciseProgress(
    exerciseId: string,
    sets: SetEntry[],
    weeksBack: number = 4
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

    const avgE1RMs = Array.from(sessionE1RMs.values()).map(
        vals => vals.reduce((a, b) => a + b, 0) / vals.length
    )

    if (avgE1RMs.length < 1) return null

    const lastE1RM = avgE1RMs[avgE1RMs.length - 1]
    const firstE1RM = avgE1RMs[0]
    const avgE1RM = avgE1RMs.reduce((a, b) => a + b, 0) / avgE1RMs.length

    const trend = firstE1RM > 0 ? ((lastE1RM - firstE1RM) / firstE1RM) * 100 : 0

    let status: 'improving' | 'stable' | 'declining' = 'stable'
    if (trend > 2) status = 'improving'
    else if (trend < -2) status = 'declining'

    return {
        exerciseId,
        trend: Math.round(trend * 10) / 10,
        status,
        lastE1RM: Math.round(lastE1RM * 10) / 10,
        avgE1RM: Math.round(avgE1RM * 10) / 10
    }
}
