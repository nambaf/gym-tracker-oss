import type { Exercise, PlanRow, Session, SetEntry } from '@/lib/models'

/** A local-time instant: `at(2026, 11, 24, 18)` is 24 Nov 2026, 18:00 local. */
export function at(y: number, m: number, d: number, h = 12): Date {
  return new Date(y, m - 1, d, h, 0, 0, 0)
}

export function session(id: string, when: Date, extra: Partial<Session> = {}): Session {
  return { id, date: when.toISOString(), kind: 'strength', ...extra }
}

let n = 0
export function sets(sessionId: string, exerciseId: string, count: number, when: Date = new Date()): SetEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `set-${++n}`, sessionId, exerciseId, weight: 50, reps: 8,
    ts: new Date(when.getTime() + i * 60_000).toISOString(),
  }))
}

export function row(day: string, exerciseId: string, targetSets = 3, order = 0): PlanRow {
  return { id: `${day}-${exerciseId}`, day, exerciseId, targetSets, targetReps: '8', order }
}

export function exercise(id: string, muscles: Record<string, number>): Exercise {
  return { id, name: id, primaryMuscles: Object.entries(muscles).map(([muscle, percentage]) => ({ muscle, percentage })) }
}
