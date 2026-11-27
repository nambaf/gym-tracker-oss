import type { Session, SetEntry } from '@/lib/models'
import { localDayKey, weekBounds } from '@/lib/dateUtils'
import { strengthSessions } from '@/lib/sessions'

export type ExerciseWeekUsage = {
  /** Sets logged on the exercise this week, outside the excluded session. */
  sets: number
  /** Timestamp of the most recent of those sets. */
  lastTs: string
  /** Local day key ('YYYY-MM-DD') of that set. */
  lastDayKey: string
}

/**
 * Which exercises were already trained in the week containing `now`, so the
 * athlete can be told before repeating one. Pass today's session as
 * `excludeSessionId` to ask "earlier this week" rather than "this week".
 */
export function exerciseWeekUsage(input: {
  sessions: Pick<Session, 'id' | 'date' | 'kind'>[]
  sets: Pick<SetEntry, 'sessionId' | 'exerciseId' | 'ts'>[]
  now?: Date
  excludeSessionId?: string
}): Map<string, ExerciseWeekUsage> {
  const { sessions, sets, now = new Date(), excludeSessionId } = input
  const { monday, sunday } = weekBounds(now)
  const inWeek = new Set<string>()
  const sessionDate = new Map<string, string>()
  for (const s of strengthSessions(sessions)) {
    if (s.id === excludeSessionId) continue
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime()) || d < monday || d > sunday) continue
    inWeek.add(s.id)
    sessionDate.set(s.id, s.date)
  }
  const out = new Map<string, ExerciseWeekUsage>()
  for (const s of sets) {
    if (!inWeek.has(s.sessionId)) continue
    // Legacy rows may lack `ts`; the session date is the next best thing.
    const ts = String(s.ts || sessionDate.get(s.sessionId) || '')
    const prev = out.get(s.exerciseId)
    if (!prev) out.set(s.exerciseId, { sets: 1, lastTs: ts, lastDayKey: '' })
    else {
      prev.sets += 1
      if (ts > prev.lastTs) prev.lastTs = ts
    }
  }
  for (const usage of out.values()) {
    const d = new Date(usage.lastTs)
    usage.lastDayKey = Number.isNaN(d.getTime()) ? '' : localDayKey(d)
  }
  return out
}
