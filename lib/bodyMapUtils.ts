import type { Exercise, PlanRow, Session, SetEntry, MuscleContribution } from './models'
import { epley1RM } from './progress'

/**
 * Binary threshold for set counting: a muscle with ≥ 40% contribution counts
 * as 1 full set; below 40% it is not counted. Mirrors the standard way coaches
 * count hypertrophy volume.
 *
 * CUSTOMIZE: raise to 50% to be stricter (primary target only),
 * lower to 30% to include secondary muscles.
 */
export const MUSCLE_CONTRIBUTION_THRESHOLD = 0.4

// ── Muscle group enum ───────────────────────────────────────────────────────

export enum MuscleGroup {
  Petto = 'petto',
  Dorsali = 'dorsali',
  Spalle = 'spalle',
  Bicipiti = 'bicipiti',
  Tricipiti = 'tricipiti',
  Quadricipiti = 'quadricipiti',
  Femorali = 'femorali',
  Glutei = 'glutei',
  Polpacci = 'polpacci',
  Core = 'core',
  Trapezi = 'trapezi',
  Avambracci = 'avambracci',
  Adduttori = 'adduttori',
}

/**
 * Italian UI labels for muscle groups.
 *
 * CUSTOMIZE: to localise, replace the values. Keys must stay equal to the
 * `MuscleGroup` enum values. Note: i18n dictionaries (`lib/i18n`) take over
 * for user-facing rendering; this map is mostly used by legacy code paths
 * and AI prompts that still inline labels.
 */
export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  [MuscleGroup.Petto]: 'Petto',
  [MuscleGroup.Dorsali]: 'Dorsali',
  [MuscleGroup.Spalle]: 'Spalle',
  [MuscleGroup.Bicipiti]: 'Bicipiti',
  [MuscleGroup.Tricipiti]: 'Tricipiti',
  [MuscleGroup.Quadricipiti]: 'Quadricipiti',
  [MuscleGroup.Femorali]: 'Femorali',
  [MuscleGroup.Glutei]: 'Glutei',
  [MuscleGroup.Polpacci]: 'Polpacci',
  [MuscleGroup.Core]: 'Core',
  [MuscleGroup.Trapezi]: 'Trapezi',
  [MuscleGroup.Avambracci]: 'Avambracci',
  [MuscleGroup.Adduttori]: 'Adduttori',
}

export interface MuscleWithWeight {
  muscle: string
  weight: number // 0-1 (normalised percentage)
}

export type ColorCode = 'green' | 'yellow' | 'red' | 'gray'

export interface MuscleStatus {
  planned: number
  actual: number
  percentage: number
  volume: number       // kg·rep
  color: ColorCode
}

// ========================================
// MUSCLE NAME MAPPING
// ========================================
// Keys are the Italian names persisted in DynamoDB (`exercise.primaryMuscles`).
// Stable on the data side — display labels live in `lib/i18n/dictionaries`.

export const MUSCLE_MAP: Record<string, MuscleGroup | null> = {
  // Chest
  'Petto': MuscleGroup.Petto,
  'Torace': MuscleGroup.Petto,

  // Back
  'Dorsali': MuscleGroup.Dorsali,
  'Trapezi': MuscleGroup.Trapezi,
  'Erettori spinali': MuscleGroup.Dorsali,

  // Shoulders
  'Spalle': MuscleGroup.Spalle,
  'Deltoidi': MuscleGroup.Spalle,
  'Deltoidi laterali': MuscleGroup.Spalle,
  'Deltoidi anteriori': MuscleGroup.Spalle,
  'Deltoidi posteriori': MuscleGroup.Spalle,

  // Arms
  'Bicipiti': MuscleGroup.Bicipiti,
  'Tricipiti': MuscleGroup.Tricipiti,
  'Brachioradiale': MuscleGroup.Avambracci,
  'Avambracci': MuscleGroup.Avambracci,

  // Legs
  'Quadricipiti': MuscleGroup.Quadricipiti,
  'Femorali': MuscleGroup.Femorali,
  'Glutei': MuscleGroup.Glutei,
  'Polpacci': MuscleGroup.Polpacci,

  // Core
  'Core': MuscleGroup.Core,
  'Addominali': MuscleGroup.Core,
  'Obliqui': MuscleGroup.Core,

  // Adductors
  'Adduttori': MuscleGroup.Adduttori,

  // Exclusions (not rendered on the body map)
  'Cardiovascolare': null,
  'Mobilità': null,
}

// ========================================
// HELPERS
// ========================================

export function normalizeMuscle(muscle: string): MuscleGroup | null {
  const trimmed = muscle.trim()
  return MUSCLE_MAP[trimmed] ?? null
}

/**
 * Parse `primaryMuscles` with weights normalised so they sum to 1.
 * Input: `[{ muscle: "Petto", percentage: 70 }, { muscle: "Tricipiti", percentage: 30 }]`
 * Output: `[{ muscle: "Petto", weight: 0.7 }, { muscle: "Tricipiti", weight: 0.3 }]`
 */
export function parsePrimaryMuscles(primaryMuscles: MuscleContribution[] | undefined): MuscleWithWeight[] {
  if (!primaryMuscles || primaryMuscles.length === 0) return []

  const total = primaryMuscles.reduce((sum, m) => sum + m.percentage, 0)
  if (total <= 0) return []

  return primaryMuscles
    .map(m => ({ muscle: m.muscle.trim(), weight: m.percentage / total }))
    .filter(m => m.muscle)
}

export function parsePrimaryMuscleNames(primaryMuscles: MuscleContribution[] | undefined): string[] {
  return parsePrimaryMuscles(primaryMuscles).map(m => m.muscle)
}

/**
 * CUSTOMIZE: 80% means "on track", below 50% means "undertrained".
 * Tweak the thresholds to be stricter or more lenient.
 */
export function getColorForPercentage(percentage: number, plannedSets: number): ColorCode {
  if (plannedSets === 0) return 'gray'
  if (percentage >= 80) return 'green'
  if (percentage >= 50) return 'yellow'
  return 'red'
}

// ========================================
// WEEKLY PLAN AGGREGATION
// ========================================

/**
 * Planned sets per muscle, summed across the whole weekly plan.
 * Uses muscle contribution percentages for a more accurate estimate.
 */
export function getWeeklyPlanByMuscle(
  plan: PlanRow[],
  exercises: Exercise[]
): Map<MuscleGroup, number> {
  const muscleToSets = new Map<MuscleGroup, number>()

  for (const planRow of plan) {
    const exercise = exercises.find(e => e.id === planRow.exerciseId)
    if (!exercise) continue

    const muscles = parsePrimaryMuscles(exercise.primaryMuscles)

    if (muscles.length === 0) continue

    for (const { muscle, weight } of muscles) {
      const group = normalizeMuscle(muscle)
      if (group) {
        // targetSets may come as a string from the API
        const targetSets = typeof planRow.targetSets === 'string'
          ? parseFloat(planRow.targetSets as unknown as string)
          : planRow.targetSets
        const setsForMuscle = weight >= MUSCLE_CONTRIBUTION_THRESHOLD ? (targetSets || 0) : 0
        muscleToSets.set(group, (muscleToSets.get(group) || 0) + setsForMuscle)
      }
    }
  }

  return muscleToSets
}

// ========================================
// ACTUAL VOLUME
// ========================================

/**
 * Actual sets and volume per muscle in a given period.
 * Uses muscle contribution percentages for a more accurate estimate.
 */
export function getActualWeeklyVolume(
  sessions: Session[],
  sets: SetEntry[],
  exercises: Exercise[],
  weekStart: Date,
  weekEnd: Date
): Map<MuscleGroup, { sets: number; volume: number }> {
  const muscleData = new Map<MuscleGroup, { sets: number; volume: number }>()

  const weekSessions = sessions.filter(s => {
    const d = new Date(s.date)
    return d >= weekStart && d <= weekEnd
  })

  const sessionIds = new Set(weekSessions.map(s => s.id))
  const weekSets = sets.filter(s => sessionIds.has(s.sessionId))

  for (const set of weekSets) {
    const exercise = exercises.find(e => e.id === set.exerciseId)
    if (!exercise) continue

    const muscles = parsePrimaryMuscles(exercise.primaryMuscles)
    if (muscles.length === 0) continue

    const totalVolume = set.weight * set.reps

    // 1 full set for each muscle with contribution >= threshold, rest ignored.
    for (const { muscle, weight } of muscles) {
      const group = normalizeMuscle(muscle)
      if (group && weight >= MUSCLE_CONTRIBUTION_THRESHOLD) {
        const current = muscleData.get(group) || { sets: 0, volume: 0 }
        muscleData.set(group, {
          sets: current.sets + 1,
          volume: current.volume + totalVolume
        })
      }
    }
  }

  return muscleData
}

// ========================================
// PLAN VS ACTUAL
// ========================================

export function calculateMuscleStatus(
  exercises: Exercise[],
  plan: PlanRow[],
  sets: SetEntry[],
  sessions: Session[],
  weekStart: Date,
  weekEnd: Date
): Map<MuscleGroup, MuscleStatus> {
  const planned = getWeeklyPlanByMuscle(plan, exercises)
  const actual = getActualWeeklyVolume(sessions, sets, exercises, weekStart, weekEnd)

  const status = new Map<MuscleGroup, MuscleStatus>()

  // Include every muscle, even those not in the plan
  const allMuscles = new Set([...planned.keys(), ...actual.keys()])

  for (const muscle of allMuscles) {
    const plannedSets = planned.get(muscle) || 0
    const actualData = actual.get(muscle) || { sets: 0, volume: 0 }
    const actualSets = actualData.sets

    const percentage = plannedSets > 0 ? Math.round((actualSets / plannedSets) * 100) : 0
    const color = getColorForPercentage(percentage, plannedSets)

    status.set(muscle, {
      planned: Math.round(plannedSets * 10) / 10,
      actual: Math.round(actualSets * 10) / 10,
      percentage,
      volume: Math.round(actualData.volume),
      color
    })
  }

  return status
}

/**
 * Per-muscle status for a single session, with no plan comparison.
 * Every trained muscle gets rendered as "green".
 */
export function calculateSessionMuscleStatus(
  sessionSets: SetEntry[],
  exercises: Exercise[]
): Map<MuscleGroup, MuscleStatus> {
  const muscleData = new Map<MuscleGroup, { sets: number; volume: number }>()

  for (const set of sessionSets) {
    const exercise = exercises.find(e => e.id === set.exerciseId)
    if (!exercise) continue

    const muscles = parsePrimaryMuscles(exercise.primaryMuscles)
    if (muscles.length === 0) continue

    const totalVolume = set.weight * set.reps

    for (const { muscle, weight } of muscles) {
      const group = normalizeMuscle(muscle)
      if (group && weight >= MUSCLE_CONTRIBUTION_THRESHOLD) {
        const current = muscleData.get(group) || { sets: 0, volume: 0 }
        muscleData.set(group, {
          sets: current.sets + 1,
          volume: current.volume + totalVolume
        })
      }
    }
  }

  const status = new Map<MuscleGroup, MuscleStatus>()
  for (const [muscle, data] of muscleData) {
    status.set(muscle, {
      planned: 0,
      actual: Math.round(data.sets * 10) / 10,
      percentage: 100, // Force "trained" rendering
      volume: Math.round(data.volume),
      color: 'green'
    })
  }

  return status
}

// ========================================
// CHART HELPERS
// ========================================

export interface WeeklyVolumeData {
  week: string
  volume: number
  sets: number
}

/**
 * Aggregate volume by week (used by the BarChart).
 */
export function getWeeklyVolumeData(
  sessions: Session[],
  sets: SetEntry[],
  weeksBack: number = 12
): WeeklyVolumeData[] {
  const data: WeeklyVolumeData[] = []
  const now = new Date()

  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() - (i * 7))

    // Snap to monday → sunday of this week
    const weekStart = new Date(weekEnd)
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    const sunday = new Date(weekStart)
    sunday.setDate(weekStart.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const weekSessions = sessions.filter(s => {
      const d = new Date(s.date)
      return d >= weekStart && d <= sunday
    })

    const sessionIds = new Set(weekSessions.map(s => s.id))
    const weekSets = sets.filter(s => sessionIds.has(s.sessionId))

    const volume = weekSets.reduce((sum, s) => sum + (s.weight * s.reps), 0)

    data.push({
      week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      volume: Math.round(volume),
      sets: weekSets.length
    })
  }

  return data
}

export interface MuscleVolumeData {
  muscle: MuscleGroup
  volume: number
  sets: number
}

/**
 * Weekly volume broken down by muscle group.
 */
export function getWeeklyVolumeByMuscle(
  sessions: Session[],
  sets: SetEntry[],
  exercises: Exercise[],
  weekStart: Date,
  weekEnd: Date
): MuscleVolumeData[] {
  const muscleData = getActualWeeklyVolume(sessions, sets, exercises, weekStart, weekEnd)

  return Array.from(muscleData.entries())
    .map(([muscle, data]) => ({
      muscle,
      volume: data.volume,
      sets: data.sets
    }))
    .sort((a, b) => b.volume - a.volume)
}

export interface DailyIntensityData {
  date: string
  avgRPE: number
  avgIntensity: number
  sessions: number
}

export interface MissingExercise {
  exerciseId: string
  exerciseName: string
  plannedSets: number
  completedSets: number
  remainingSets: number
  muscles: string[]
  impact: number                          // Impact on under-trained muscles
  muscleDeficit: Map<MuscleGroup, number> // How much each muscle improves
}

/**
 * Exercises still missing from the weekly plan, sorted by impact.
 */
export function getMissingExercises(
  exercises: Exercise[],
  plan: PlanRow[],
  sets: SetEntry[],
  sessions: Session[],
  muscleStatus: Map<MuscleGroup, MuscleStatus>,
  weekStart: Date,
  weekEnd: Date
): MissingExercise[] {
  const missingExercises: MissingExercise[] = []

  const planByExercise = new Map<string, PlanRow[]>()
  for (const planRow of plan) {
    const existing = planByExercise.get(planRow.exerciseId) || []
    existing.push(planRow)
    planByExercise.set(planRow.exerciseId, existing)
  }

  const weekSessions = sessions.filter(s => {
    const d = new Date(s.date)
    return d >= weekStart && d <= weekEnd
  })
  const sessionIds = new Set(weekSessions.map(s => s.id))
  const weekSets = sets.filter(s => sessionIds.has(s.sessionId))

  const completedSetsByExercise = new Map<string, number>()
  for (const set of weekSets) {
    completedSetsByExercise.set(
      set.exerciseId,
      (completedSetsByExercise.get(set.exerciseId) || 0) + 1
    )
  }

  for (const [exerciseId, planRows] of planByExercise.entries()) {
    const exercise = exercises.find(e => e.id === exerciseId)
    if (!exercise) continue

    const plannedSets = planRows.reduce((sum, row) => {
      const sets = typeof row.targetSets === 'string'
        ? parseFloat(row.targetSets as unknown as string)
        : row.targetSets
      return sum + (sets || 0)
    }, 0)
    const completedSets = completedSetsByExercise.get(exerciseId) || 0
    const remainingSets = Math.max(0, plannedSets - completedSets)

    if (remainingSets === 0) continue

    const musclesWithWeights = parsePrimaryMuscles(exercise.primaryMuscles)
    const muscles = musclesWithWeights.map(m => m.muscle)
    const muscleGroups = musclesWithWeights
      .map(m => ({ group: normalizeMuscle(m.muscle), weight: m.weight }))
      .filter((m): m is { group: MuscleGroup; weight: number } => m.group !== null)

    // Impact = how much each under-trained muscle would improve.
    let impact = 0
    const muscleDeficit = new Map<MuscleGroup, number>()

    for (const { group: muscleGroup, weight } of muscleGroups) {
      const status = muscleStatus.get(muscleGroup)
      if (!status) continue

      // Lagging muscles weigh more.
      const deficit = Math.max(0, 100 - status.percentage)
      const setsForMuscle = weight >= MUSCLE_CONTRIBUTION_THRESHOLD ? remainingSets : 0

      const improvement = status.planned > 0
        ? (setsForMuscle / status.planned) * 100
        : 0

      const muscleImpact = (deficit / 100) * improvement
      impact += muscleImpact

      muscleDeficit.set(muscleGroup, improvement)
    }

    missingExercises.push({
      exerciseId,
      exerciseName: exercise.name,
      plannedSets,
      completedSets,
      remainingSets,
      muscles,
      impact,
      muscleDeficit
    })
  }

  return missingExercises.sort((a, b) => b.impact - a.impact)
}

/**
 * Average daily RPE and intensity (used by the LineChart).
 */
export function getDailyIntensityData(
  sessions: Session[],
  sets: SetEntry[],
  daysBack: number = 30
): DailyIntensityData[] {
  const data: DailyIntensityData[] = []
  const now = new Date()

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const daySessions = sessions.filter(s => {
      const sDate = new Date(s.date)
      sDate.setHours(0, 0, 0, 0)
      return sDate.getTime() === date.getTime()
    })

    const sessionIds = new Set(daySessions.map(s => s.id))
    const daySets = sets.filter(s => sessionIds.has(s.sessionId))

    if (daySets.length === 0) continue

    const setsWithRPE = daySets.filter(s => s.rpe !== undefined && s.rpe > 0)
    const avgRPE = setsWithRPE.length > 0
      ? setsWithRPE.reduce((sum, s) => sum + (s.rpe || 0), 0) / setsWithRPE.length
      : 0

    // Average intensity (% of e1RM)
    let intensitySum = 0
    let intensityCount = 0

    for (const s of daySets) {
      const w = Number(s.weight)
      const r = Number(s.reps)
      if (w && r) {
        const e1rm = epley1RM(w, r)
        if (e1rm) {
          intensitySum += (w / e1rm) * 100
          intensityCount++
        }
      }
    }

    const avgIntensity = intensityCount > 0 ? intensitySum / intensityCount : 0

    data.push({
      date: `${date.getDate()}/${date.getMonth() + 1}`,
      avgRPE: Math.round(avgRPE * 10) / 10,
      avgIntensity: Math.round(avgIntensity),
      sessions: daySessions.length
    })
  }

  return data
}
