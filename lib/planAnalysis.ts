import type { Exercise, PlanRow } from './models'
import {
  MuscleGroup,
  MUSCLE_LABELS,
  MUSCLE_CONTRIBUTION_THRESHOLD,
  normalizeMuscle,
  parsePrimaryMuscles,
} from './bodyMapUtils'
import type { TrainingMode, RecommendedSetsMatrix } from './settings/types'
import {
  DEFAULT_RECOMMENDED_SETS,
  DEFAULT_MAX_SETS_PER_SESSION_PER_MUSCLE,
} from './settings/defaults'

export interface MuscleGroupSummary {
    muscle: MuscleGroup
    totalSets: number
    exercises: Array<{ id: string; name: string; sets: number }>
    status: 'complete' | 'minimal' | 'insufficient'
}

export interface PlanCompletenessOverrides {
    recommendedSets?: RecommendedSetsMatrix
}

export interface SessionVolumeOverrides {
    maxSetsPerSessionPerMuscle?: number
}

function getMuscleGroupStatus(
    sets: number,
    muscle: MuscleGroup,
    mode: TrainingMode,
    recommendedSets: RecommendedSetsMatrix,
): 'complete' | 'minimal' | 'insufficient' {
    const thresholds = recommendedSets[mode][muscle]

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
    mode: TrainingMode = 'mixed',
    overrides?: PlanCompletenessOverrides,
): MuscleGroupSummary[] {
    const recommendedSets = overrides?.recommendedSets ?? DEFAULT_RECOMMENDED_SETS
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
            status: getMuscleGroupStatus(data.totalSets, muscle, mode, recommendedSets)
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
    exercises: Exercise[],
    overrides?: SessionVolumeOverrides,
): SessionVolumeWarning[] {
    const limit = overrides?.maxSetsPerSessionPerMuscle ?? DEFAULT_MAX_SETS_PER_SESSION_PER_MUSCLE
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
            if (data.sets > limit) {
                warnings.push({
                    day,
                    muscle,
                    muscleName: MUSCLE_LABELS[muscle] || muscle,
                    sets: Math.round(data.sets * 10) / 10,
                    limit,
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
