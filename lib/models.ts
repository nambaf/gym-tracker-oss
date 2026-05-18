/**
 * Muscle contribution with involvement percentage.
 * `percentage`: 0–100 (how much the muscle is involved in the exercise).
 */
export type MuscleContribution = {
  muscle: string
  percentage: number
}

/**
 * `primaryMuscles` is a structured array (stored as-is in DynamoDB).
 * Percentages sum to 100 but are normalised by the parser.
 */
export type Exercise = {
  id: string
  name: string
  primaryMuscles?: MuscleContribution[]
}

export type Session = {
  id: string
  date: string
  note?: string
  startTime?: string
  endTime?: string
  duration?: number
}

export type SetEntry = {
  id: string
  sessionId: string
  exerciseId: string
  weight: number
  reps: number
  rpe?: number
  note?: string
  ts: string
}

/**
 * A plan row: one exercise assigned to a day. Rows are embedded in `Plan.rows`.
 */
export type PlanRow = {
  id?: string
  day: string
  exerciseId: string
  targetSets: number
  targetReps: string
  targetRpe?: number
  note?: string
  order?: number
}

/**
 * A full training programme (one prototype week).
 * Multiple plans can coexist; the one with `isActive=true` is the current one.
 */
export type Plan = {
  id: string
  name: string
  createdAt: string
  isActive: boolean
  description?: string
  rows: PlanRow[]
}
