import type { MuscleContribution, PlanRow, Session, SetEntry } from '@/lib/models'
import { localDayKey } from '@/lib/dateUtils'
import { strengthSessions } from '@/lib/sessions'
import { normalizeMuscle, type MuscleGroup } from '@/lib/bodyMapUtils'

type SessionLike = Pick<Session, 'id' | 'date' | 'kind'>
type SetLike = Pick<SetEntry, 'sessionId' | 'exerciseId'>

function dayKeyOf(isoDate: string | undefined): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  return Number.isNaN(d.getTime()) ? null : localDayKey(d)
}

function exercisesByDay(planRows: PlanRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const r of planRows) {
    const day = String(r.day)
    const set = out.get(day)
    if (set) set.add(r.exerciseId)
    else out.set(day, new Set([r.exerciseId]))
  }
  return out
}

/**
 * The plan day a performed session was, judged by which day shares the most
 * exercises with it. Sessions carry no day label: the athlete trains on
 * whatever weekday they can, so the weekday says nothing about the workout.
 */
function planDayOf(exerciseIds: Set<string>, days: string[], byDay: Map<string, Set<string>>): string | null {
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

/** Strength sessions that have sets, newest first, with the exercises performed. */
function performedSessions(sessions: SessionLike[], sets: SetLike[]) {
  const bySession = new Map<string, Set<string>>()
  for (const s of sets) {
    const ids = bySession.get(s.sessionId)
    if (ids) ids.add(s.exerciseId)
    else bySession.set(s.sessionId, new Set([s.exerciseId]))
  }
  return strengthSessions(sessions)
    .map(s => ({ dayKey: dayKeyOf(s.date), exerciseIds: bySession.get(s.id) }))
    .filter((s): s is { dayKey: string; exerciseIds: Set<string> } => !!s.dayKey && !!s.exerciseIds)
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
}

/**
 * Which plan day to open the workout on. In order:
 *   1. the day today's sets already belong to (a reload mid-workout),
 *   2. the plan day named after today's weekday,
 *   3. the day after the one last trained, so a schedule that drifted off its
 *      weekdays (Tue/Thu instead of Mon/Wed) still rotates through the plan,
 *   4. the first day.
 */
export function pickPlanDay(input: {
  days: string[]
  planRows: PlanRow[]
  sessions: SessionLike[]
  sets: SetLike[]
  todayNames: string[]
  todayKey?: string
}): string {
  const { days, planRows, sessions, sets, todayNames } = input
  if (days.length === 0) return ''
  const todayKey = input.todayKey ?? localDayKey()
  const byDay = exercisesByDay(planRows)
  const performed = performedSessions(sessions, sets)

  const today = performed.find(s => s.dayKey === todayKey)
  const todayDay = today && planDayOf(today.exerciseIds, days, byDay)
  if (todayDay) return todayDay

  const weekday = days.find(d => todayNames.includes(d.toLowerCase()))
  if (weekday) return weekday

  for (const s of performed) {
    if (s.dayKey >= todayKey) continue
    const last = planDayOf(s.exerciseIds, days, byDay)
    if (last) return days[(days.indexOf(last) + 1) % days.length]
  }
  return days[0]
}

/**
 * Off-plan exercises the athlete keeps adding on this plan day, most frequent
 * first (ties broken by recency), over the last `window` sessions of that day.
 */
export function usualExtrasForDay(input: {
  day: string
  days: string[]
  planRows: PlanRow[]
  sessions: SessionLike[]
  sets: SetLike[]
  todayKey?: string
  window?: number
}): string[] {
  const { day, days, planRows, sessions, sets, window = 10 } = input
  const todayKey = input.todayKey ?? localDayKey()
  const byDay = exercisesByDay(planRows)
  const planned = byDay.get(day)
  if (!planned) return []

  const sameDay = performedSessions(sessions, sets)
    .filter(s => s.dayKey < todayKey && planDayOf(s.exerciseIds, days, byDay) === day)
    .slice(0, window)

  const count = new Map<string, number>()
  const firstSeen = new Map<string, number>()
  sameDay.forEach((s, i) => {
    for (const id of s.exerciseIds) {
      if (planned.has(id)) continue
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
