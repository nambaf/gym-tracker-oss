import type { PlanRow, Session, SetEntry } from '@/lib/models'
import { localDayKey } from '@/lib/dateUtils'
import { pickPlanDay, weekDayStatus } from '@/lib/workout/planDay'

export type NextWorkout = {
  day: string
  /**
   * `doneToday`: a session with sets ran this plan day today.
   * `weekDone`: every plan day already happened this week, so `day` restarts the sequence.
   * `next`: the day to train next, on whatever calendar day that turns out to be.
   */
  state: 'doneToday' | 'weekDone' | 'next'
  exerciseCount: number
  estimatedMinutes: number
}

/** Rough session length: every planned set with its rest. */
const MINUTES_PER_SET = 3.5

/**
 * The plan day the dashboard announces. Same pick as the workout page
 * (`pickPlanDay`), so the two can never name different days.
 */
export function deriveNextWorkout(input: {
  days: string[]
  planRows: PlanRow[]
  sessions: Pick<Session, 'id' | 'date' | 'kind' | 'planDay' | 'substitutions'>[]
  sets: Pick<SetEntry, 'sessionId' | 'exerciseId'>[]
  now?: Date
}): NextWorkout | null {
  const { days, planRows, sessions, sets, now = new Date() } = input
  if (days.length === 0 || planRows.length === 0) return null

  const day = pickPlanDay({ days, planRows, sessions, sets, now })
  const status = weekDayStatus({ days, planRows, sessions, sets, now })
  const doneToday = status.find(s => s.day === day)?.doneOn === localDayKey(now)

  const rows = planRows.filter(r => String(r.day) === day)
  const totalSets = rows.reduce((acc, r) => {
    const n = Number(r.targetSets)
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)

  return {
    day,
    state: doneToday ? 'doneToday' : status.every(s => s.doneOn) ? 'weekDone' : 'next',
    exerciseCount: new Set(rows.map(r => r.exerciseId)).size,
    estimatedMinutes: Math.max(20, Math.round(totalSets * MINUTES_PER_SET)),
  }
}

/**
 * Sets logged on each of the last `count` local days, oldest first. Sessions
 * are bucketed by the local day of their timestamp: comparing against the UTC
 * date put an evening session on the wrong square.
 */
export function setsPerDay(
  sessions: Pick<Session, 'id' | 'date'>[],
  sets: Pick<SetEntry, 'sessionId'>[],
  count: number,
  now: Date = new Date(),
): { date: Date; sets: number }[] {
  const dayOfSession = new Map<string, string>()
  for (const s of sessions) {
    const d = new Date(s.date)
    if (!Number.isNaN(d.getTime())) dayOfSession.set(s.id, localDayKey(d))
  }
  const perDay = new Map<string, number>()
  for (const s of sets) {
    const key = dayOfSession.get(s.sessionId)
    if (key) perDay.set(key, (perDay.get(key) || 0) + 1)
  }
  const out: { date: Date; sets: number }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push({ date, sets: perDay.get(localDayKey(date)) || 0 })
  }
  return out
}
