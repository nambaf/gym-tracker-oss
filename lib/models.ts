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

/** Perceived intensity, 1 = very easy … 5 = very hard. Labels come from the dictionary. */
export type IntensityLevel = 1 | 2 | 3 | 4 | 5

/**
 * What the athlete decided to do next time on this exercise. Written during the
 * set, read at the top of the next session — the app used to lose this in free
 * text ("continue at 59", "you can go up next time") and the athlete had to
 * rewrite it every week.
 */
export type NextIntent = {
  action: 'hold' | 'increase' | 'decrease' | 'retry'
  weight?: number
  reps?: number
}

/** Short, closed vocabulary for things worth filtering and aggregating on. */
export type SetFlag = 'pain' | 'technique' | 'interrupted' | 'fatigued'

/**
 * A logged set.
 *
 * `note` is the legacy field: a single positional string of the form
 * `cedimento[ - <italian intensity tag>][ - <free text>]`. It is still written
 * for backward compatibility, but every consumer should read the structured
 * fields below — `normalizeSet` derives them from `note` for older rows, so
 * both shapes look identical from the application's point of view.
 */
export type SetEntry = {
  id: string
  sessionId: string
  exerciseId: string
  weight: number
  reps: number
  rpe?: number
  note?: string
  ts: string
  // ── structured fields (all optional, derived for legacy rows) ──
  toFailure?: boolean
  intensity?: IntensityLevel
  /** Free text only — no tags, no separators. */
  comment?: string
  nextIntent?: NextIntent
  flags?: SetFlag[]
  /** 1-based position of this set within the exercise, in this session. */
  setIndex?: number
  /** Schema marker: 2 means the structured fields were written directly. */
  schemaV?: number
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
