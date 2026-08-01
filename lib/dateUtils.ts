/**
 * Local-calendar date helpers.
 *
 * The app used to key "today" off `toISOString().slice(0, 10)`, which is the
 * UTC day. For anyone east of Greenwich an evening session logged after 22:00
 * local time already belongs to the next UTC day, so the app would create a
 * second session for a workout still in progress. Everything that answers
 * "which day is this?" must use the local calendar instead.
 */

/** 'YYYY-MM-DD' for the local calendar day of `d`. */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a date-input value ('YYYY-MM-DD') as local midnight, not UTC midnight. */
export function parseLocalDate(value: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null
  if (endOfDay) d.setHours(23, 59, 59, 999)
  else d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Whole calendar days between two instants, counted on the local calendar.
 * `Math.floor(ms / 86400000)` counts 24-hour spans instead: a set logged
 * yesterday at 20:00 and read today at 08:00 came out as "0 days ago".
 */
export function daysBetweenLocal(from: Date | string, to: Date | string = new Date()): number {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const sa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const sb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((sb - sa) / 86400000)
}

/** Monday 00:00 and Sunday 23:59:59.999 of the local week containing `date`. */
export function weekBounds(date: Date = new Date()): { monday: Date; sunday: Date } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay(): 0 = Sunday. Shift so Monday is the first day of the week.
  const offset = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - offset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}
