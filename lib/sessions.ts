/**
 * Telling training sessions apart from everything else the athlete does.
 *
 * A run logged on Wednesday is real and belongs in the record, but counting it
 * as a gym session would corrupt every number that matters: adherence would
 * read 4 of 3 while muscle coverage stayed at zero, and the weekly review would
 * invent findings about work that was never planned. So activity rows live in
 * the same table — same date, same note, same duration — and are excluded
 * anywhere the question is "did you train?".
 *
 * Rows written before activity logging existed carry no `kind`; they are all
 * strength sessions.
 */
import type { ActivityType, Session } from './models'

/** Every activity key, in the order the picker shows them. */
export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'run', 'bike', 'swim', 'walk', 'sport', 'other',
] as const

export function isActivitySession(s: Pick<Session, 'kind'>): boolean {
  return s.kind === 'activity'
}

/** The sessions that count as training. */
export function strengthSessions<T extends Pick<Session, 'kind'>>(sessions: T[]): T[] {
  return sessions.filter(s => !isActivitySession(s))
}

/** The sessions that don't. */
export function activitySessions<T extends Pick<Session, 'kind'>>(sessions: T[]): T[] {
  return sessions.filter(isActivitySession)
}

/** Minutes, from the seconds a session stores. Null when nothing was recorded. */
export function activityMinutes(s: Pick<Session, 'duration'>): number | null {
  const secs = Number(s.duration)
  if (!Number.isFinite(secs) || secs <= 0) return null
  return Math.round(secs / 60)
}
