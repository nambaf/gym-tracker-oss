import type { Exercise, PlanRow } from './models'
import {
  MuscleGroup,
  MUSCLE_LABELS,
  MUSCLE_CONTRIBUTION_THRESHOLD,
  normalizeMuscle,
  parsePrimaryMuscles,
} from './bodyMapUtils'
import { type TrainingMode, MAX_SETS_PER_SESSION_PER_MUSCLE } from './hypertrophyThresholds'

export interface MuscleGroupSummary {
    muscle: MuscleGroup
    totalSets: number
    exercises: Array<{ id: string; name: string; sets: number }>
    status: 'complete' | 'minimal' | 'insufficient'
}

/**
 * Recommended weekly sets per muscle group, used for the "plan completeness"
 * view (setup-time check, before any training happens).
 *
 * Distinct from `THRESHOLDS_BY_MODE` in `hypertrophyThresholds.ts`:
 *  - here: minimal/optimal (UX "does the plan cover the muscles?")
 *  - there: maintenance/hypertrophy (runtime "are you doing enough?")
 *
 * CUSTOMIZE: values tuned for intermediate lifters.
 */
const RECOMMENDED_SETS: Record<TrainingMode, Record<MuscleGroup, { minimal: number; optimal: number }>> = {
    intensity: {
        petto: { minimal: 5, optimal: 10 },
        dorsali: { minimal: 5, optimal: 10 },
        spalle: { minimal: 5, optimal: 10 },
        bicipiti: { minimal: 4, optimal: 8 },
        tricipiti: { minimal: 4, optimal: 8 },
        quadricipiti: { minimal: 5, optimal: 10 },
        femorali: { minimal: 5, optimal: 10 },
        glutei: { minimal: 5, optimal: 10 },
        polpacci: { minimal: 4, optimal: 8 },
        core: { minimal: 4, optimal: 8 },
        trapezi: { minimal: 3, optimal: 6 },
        avambracci: { minimal: 3, optimal: 6 },
        adduttori: { minimal: 2, optimal: 4 },
    },
    volume: {
        petto: { minimal: 10, optimal: 16 },
        dorsali: { minimal: 12, optimal: 18 },
        spalle: { minimal: 10, optimal: 16 },
        bicipiti: { minimal: 8, optimal: 14 },
        tricipiti: { minimal: 8, optimal: 14 },
        quadricipiti: { minimal: 12, optimal: 18 },
        femorali: { minimal: 10, optimal: 16 },
        glutei: { minimal: 10, optimal: 16 },
        polpacci: { minimal: 8, optimal: 12 },
        core: { minimal: 8, optimal: 12 },
        trapezi: { minimal: 6, optimal: 10 },
        avambracci: { minimal: 6, optimal: 8 },
        adduttori: { minimal: 4, optimal: 8 },
    },
    // Mixed: intensity for upper body, volume for lower body
    mixed: {
        petto: { minimal: 5, optimal: 10 },
        dorsali: { minimal: 5, optimal: 10 },
        spalle: { minimal: 5, optimal: 10 },
        bicipiti: { minimal: 4, optimal: 8 },
        tricipiti: { minimal: 4, optimal: 8 },
        quadricipiti: { minimal: 12, optimal: 18 },
        femorali: { minimal: 10, optimal: 16 },
        glutei: { minimal: 10, optimal: 16 },
        polpacci: { minimal: 8, optimal: 12 },
        core: { minimal: 8, optimal: 12 },
        trapezi: { minimal: 3, optimal: 6 },
        avambracci: { minimal: 3, optimal: 6 },
        adduttori: { minimal: 4, optimal: 8 },
    },
}

function getMuscleGroupStatus(sets: number, muscle: MuscleGroup, mode: TrainingMode = 'mixed'): 'complete' | 'minimal' | 'insufficient' {
    const thresholds = RECOMMENDED_SETS[mode][muscle]

    if (sets >= thresholds.optimal) {
        return 'complete'
    } else if (sets >= thresholds.minimal) {
        return 'minimal'
    } else {
        return 'insufficient'
    }
}

/**
 * Analyse the plan for per-muscle-group completeness.
 * Uses muscle contribution percentages for a more accurate estimate.
 */
export function analyzePlanCompleteness(
    plan: PlanRow[],
    exercises: Exercise[],
    mode: TrainingMode = 'mixed'
): MuscleGroupSummary[] {
    const muscleMap = new Map<MuscleGroup, {
        totalSets: number
        exercises: Map<string, { name: string; sets: number }>
    }>()

    for (const planRow of plan) {
        const exercise = exercises.find(e => e.id === planRow.exerciseId)
        if (!exercise) continue

        const musclesWithWeights = parsePrimaryMuscles(exercise.primaryMuscles)

        if (musclesWithWeights.length === 0) continue

        for (const { muscle: muscleName, weight } of musclesWithWeights) {
            const muscleGroup = normalizeMuscle(muscleName)
            if (!muscleGroup) continue

            // targetSets may come as a string from the API
            const targetSets = typeof planRow.targetSets === 'string'
                ? parseFloat(planRow.targetSets)
                : planRow.targetSets
            const setsForMuscle = weight >= MUSCLE_CONTRIBUTION_THRESHOLD ? (targetSets || 0) : 0

            const current = muscleMap.get(muscleGroup) || {
                totalSets: 0,
                exercises: new Map()
            }

            current.totalSets += setsForMuscle

            const exerciseData = current.exercises.get(exercise.id) || {
                name: exercise.name,
                sets: 0
            }
            exerciseData.sets += setsForMuscle
            current.exercises.set(exercise.id, exerciseData)

            muscleMap.set(muscleGroup, current)
        }
    }

    return Array.from(muscleMap.entries())
        .map(([muscle, data]) => ({
            muscle,
            totalSets: Math.round(data.totalSets * 10) / 10,
            exercises: Array.from(data.exercises.entries()).map(([id, ex]) => ({
                id,
                name: ex.name,
                sets: Math.round(ex.sets * 10) / 10
            })),
            status: getMuscleGroupStatus(data.totalSets, muscle, mode)
        }))
        .sort((a, b) => b.totalSets - a.totalSets)
}

/**
 * Warning for excessive per-session per-muscle volume.
 * Source: Remer et al. (Zordos lab) — diminishing returns past ~10 sets/session/muscle.
 */
export interface SessionVolumeWarning {
    day: string
    muscle: MuscleGroup
    muscleName: string
    sets: number
    limit: number
    exercises: Array<{ name: string; sets: number }>
}

export function analyzeSessionVolume(
    plan: PlanRow[],
    exercises: Exercise[]
): SessionVolumeWarning[] {
    const warnings: SessionVolumeWarning[] = []
    const days = Array.from(new Set(plan.map(r => r.day))).filter(Boolean)

    for (const day of days) {
        const dayRows = plan.filter(r => r.day === day)
        const muscleInSession = new Map<MuscleGroup, {
            sets: number
            exercises: Map<string, { name: string; sets: number }>
        }>()

        for (const planRow of dayRows) {
            const exercise = exercises.find(e => e.id === planRow.exerciseId)
            if (!exercise) continue

            const musclesWithWeights = parsePrimaryMuscles(exercise.primaryMuscles)
            if (musclesWithWeights.length === 0) continue

            for (const { muscle: muscleName, weight } of musclesWithWeights) {
                const muscleGroup = normalizeMuscle(muscleName)
                if (!muscleGroup) continue

                const targetSets = typeof planRow.targetSets === 'string'
                    ? parseFloat(planRow.targetSets)
                    : planRow.targetSets
                const setsForMuscle = weight >= MUSCLE_CONTRIBUTION_THRESHOLD ? (targetSets || 0) : 0

                const current = muscleInSession.get(muscleGroup) || {
                    sets: 0,
                    exercises: new Map()
                }
                current.sets += setsForMuscle

                const exData = current.exercises.get(exercise.id) || { name: exercise.name, sets: 0 }
                exData.sets += setsForMuscle
                current.exercises.set(exercise.id, exData)

                muscleInSession.set(muscleGroup, current)
            }
        }

        for (const [muscle, data] of muscleInSession) {
            if (data.sets > MAX_SETS_PER_SESSION_PER_MUSCLE) {
                warnings.push({
                    day,
                    muscle,
                    muscleName: MUSCLE_LABELS[muscle] || muscle,
                    sets: Math.round(data.sets * 10) / 10,
                    limit: MAX_SETS_PER_SESSION_PER_MUSCLE,
                    exercises: Array.from(data.exercises.values()).map(ex => ({
                        name: ex.name,
                        sets: Math.round(ex.sets * 10) / 10
                    }))
                })
            }
        }
    }

    return warnings.sort((a, b) => b.sets - a.sets)
}

export function getCompletenessStatusBadge(status: 'complete' | 'minimal' | 'insufficient'): string {
    switch (status) {
        case 'complete':
            return '✅'
        case 'minimal':
            return '⚠️'
        case 'insufficient':
            return '❌'
    }
}
