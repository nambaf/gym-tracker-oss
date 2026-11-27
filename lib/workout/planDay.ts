import type { MuscleContribution, PlanRow, Session, SetEntry } from '../models'
import { localDayKey, weekBounds } from '../dateUtils'
import { strengthSessions } from '../sessions'
import { normalizeMuscle, type MuscleGroup } from '../bodyMapUtils'

type SessionLike = Pick<Session, 'id' | 'date' | 'kind' | 'planDay' | 'substitutions'>
type SetLike = Pick<SetEntry, 'sessionId' | 'exerciseId'>

function dayKeyOf(isoDate: string | undefined): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  return Number.isNaN(d.getTime()) ? null : localDayKey(d)
}

/** Exercise ids planned on each day. */
export function exercisesByDay(planRows: PlanRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const r of planRows) {
    const day = String(r.day)
    const set = out.get(day)
    if (set) set.add(r.exerciseId)
    else out.set(day, new Set([r.exerciseId]))
  }
  return out
}

/** The plan day sharing the most exercises with what was performed. */
function inferPlanDay(exerciseIds: Set<string>, days: string[], byDay: Map<string, Set<string>>): string | null {
  let best: string | null = null
  let bestOverlap = 0
  for (const day of days) {
    const planned = byDay.get(day)
    if (!planned) continue
    let overlap = 0
    for (const id of exerciseIds) if (planned.has(id)) overlap++
    if (overlap > bestOverlap) { best = day; bestOverlap = overlap }
  }
  return best
}

/**
 * Which plan day a session was — the single answer every screen shares.
 *
 * The day the athlete chose is stored on the session and wins as long as the
 * plan still has it. Rows written before it was stored, and sessions whose day
 * was since renamed or removed, are inferred from the exercises performed.
 */
export function resolveSessionPlanDay(
  session: Pick<Session, 'planDay'>,
  exerciseIds: Set<string>,
  days: string[],
  byDay: Map<string, Set<string>>,
): string | null {
  if (session.planDay && days.includes(session.planDay)) return session.planDay
  return inferPlanDay(exerciseIds, days, byDay)
}

type Performed = { id: string; dayKey: string; exerciseIds: Set<string>; planDay: string | null; substitutes: Set<string> }

/** Strength sessions that have sets, newest first, each with its plan day. */
function performedSessions(sessions: SessionLike[], sets: SetLike[], days: string[], byDay: Map<string, Set<string>>): Performed[] {
  const bySession = new Map<string, Set<string>>()
  for (const s of sets) {
    const ids = bySession.get(s.sessionId)
    if (ids) ids.add(s.exerciseId)
    else bySession.set(s.sessionId, new Set([s.exerciseId]))
  }
  const out: Performed[] = []
  for (const s of strengthSessions(sessions)) {
    const dayKey = dayKeyOf(s.date)
    const exerciseIds = bySession.get(s.id)
    if (!dayKey || !exerciseIds) continue
    out.push({
      id: s.id,
      dayKey,
      exerciseIds,
      planDay: resolveSessionPlanDay(s, exerciseIds, days, byDay),
      substitutes: new Set(Object.values(s.substitutions || {})),
    })
  }
  return out.sort((a, b) => b.dayKey.localeCompare(a.dayKey))
}

export type PlanDayStatus = {
  day: string
  /** Local day key ('YYYY-MM-DD') it was last trained on this week, or null. */
  doneOn: string | null
}

/**
 * Each plan day and whether it already happened in the week containing `now`.
 * A day counts as done once a session with at least one set resolves to it —
 * today's session included, so a workout in progress shows as done.
 */
export function weekDayStatus(input: {
  days: string[]
  planRows: PlanRow[]
  sessions: SessionLike[]
  sets: SetLike[]
  now?: Date
}): PlanDayStatus[] {
  const { days, planRows, sessions, sets, now = new Date() } = input
  const { monday, sunday } = weekBounds(now)
  const from = localDayKey(monday)
  const to = localDayKey(sunday)
  const doneOn = new Map<string, string>()
  for (const s of performedSessions(sessions, sets, days, exercisesByDay(planRows))) {
    if (!s.planDay || s.dayKey < from || s.dayKey > to) continue
    if (!doneOn.has(s.planDay)) doneOn.set(s.planDay, s.dayKey)
  }
  return days.map(day => ({ day, doneOn: doneOn.get(day) ?? null }))
}

/**
 * Which plan day to open the workout on. The calendar weekday plays no part:
 * the plan is a sequence done once a week, on whatever days the athlete can.
 *
 *   1. the day stored on today's session (a reload, or a day picked by hand),
 *   2. the day today's sets point to, for a session with no stored day,
 *   3. the first day in plan order not yet done this week,
 *   4. with the whole week done, the day after the one last trained.
 */
export function pickPlanDay(input: {
  days: string[]
  planRows: PlanRow[]
  sessions: SessionLike[]
  sets: SetLike[]
  now?: Date
}): string {
  const { planRows, sessions, sets, now = new Date() } = input
  if (input.days.length === 0) return ''
  const todayKey = localDayKey(now)
  const byDay = exercisesByDay(planRows)
  // A day with no exercises yet can never be trained, so proposing it would
  // park the athlete on an empty screen every time they open the workout.
  const withRows = input.days.filter(d => byDay.has(d))
  const days = withRows.length ? withRows : input.days

  const stored = strengthSessions(sessions)
    .find(s => dayKeyOf(s.date) === todayKey && s.planDay && days.includes(s.planDay))
  if (stored?.planDay) return stored.planDay

  const performed = performedSessions(sessions, sets, days, byDay)
  const today = performed.find(s => s.dayKey === todayKey)
  if (today?.planDay) return today.planDay

  const { monday } = weekBounds(now)
  const weekStart = localDayKey(monday)
  const earlier = performed.filter(s => s.dayKey < todayKey && s.planDay)
  const doneThisWeek = new Set(earlier.filter(s => s.dayKey >= weekStart).map(s => s.planDay))
  const open = days.find(d => !doneThisWeek.has(d))
  if (open) return open

  const last = earlier[0]?.planDay
  return last ? days[(days.indexOf(last) + 1) % days.length] : days[0]
}

/**
 * Off-plan exercises the athlete keeps adding on this plan day, most frequent
 * first (ties broken by recency), over the last `window` sessions of that day.
 * Substitutes are left out: they stood in for a planned exercise, they were
 * not added on top.
 */
export function usualExtrasForDay(input: {
  day: string
  days: string[]
  planRows: PlanRow[]
  sessions: SessionLike[]
  sets: SetLike[]
  now?: Date
  window?: number
}): string[] {
  const { day, days, planRows, sessions, sets, now = new Date(), window = 10 } = input
  const todayKey = localDayKey(now)
  const byDay = exercisesByDay(planRows)
  const planned = byDay.get(day)
  if (!planned) return []

  const sameDay = performedSessions(sessions, sets, days, byDay)
    .filter(s => s.dayKey < todayKey && s.planDay === day)
    .slice(0, window)

  const count = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  sameDay.forEach((s, i) => {
    for (const id of s.exerciseIds) {
      if (planned.has(id) || s.substitutes.has(id)) continue
      count.set(id, (count.get(id) || 0) + 1)
      if (!firstSeen.has(id)) firstSeen.set(id, i)
    }
  })
  return [...count.keys()].sort((a, b) =>
    (count.get(b)! - count.get(a)!) || (firstSeen.get(a)! - firstSeen.get(b)!)
  )
}

/** The muscle group an exercise mostly trains, or null when it has no data. */
export function mainMuscleGroup(primaryMuscles: MuscleContribution[] | undefined): MuscleGroup | null {
  if (!primaryMuscles?.length) return null
  const top = [...primaryMuscles].sort((a, b) => b.percentage - a.percentage)[0]
  return normalizeMuscle(top.muscle)
}
