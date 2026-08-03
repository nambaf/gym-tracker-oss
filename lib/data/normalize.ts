/**
 * Row normalisation at the read boundary.
 *
 * Rows written before the 2026-04 write-path change store `weight`, `reps` and
 * `rpe` as DynamoDB strings; later rows store them as numbers. A handful of very
 * old rows even store `rpe` as a boolean. Left alone, the mix survives only by
 * accident of JavaScript coercion and breaks the moment any code uses strict
 * equality, `Array.sort` without a comparator, or a `Map` key — exactly what
 * PR detection and RIR comparison do.
 *
 * Normalising here means every consumer (server aggregates, API responses, the
 * client store) sees one shape, and no data migration is required. The same
 * pass also derives the structured note fields from the legacy `note` string.
 */
import { parseLegacyNote } from '../setNotes'

/** Coerce to a finite number, or `undefined` when the value carries no number. */
export function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return undefined
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Coerce to a finite number with a fallback — for fields that must always exist. */
export function numOr(value: unknown, fallback: number): number {
  const n = num(value)
  return n === undefined ? fallback : n
}

function normalizeSet(row: Record<string, any>): Record<string, any> {
  const out = { ...row }
  out.weight = numOr(row.weight, 0)
  out.reps = numOr(row.reps, 0)

  const rpe = num(row.rpe)
  if (rpe === undefined) {
    // `rpe: true` was how the very first build flagged a set taken to failure,
    // before the note tag existed. Those rows have an empty note, so dropping
    // the boolean would lose the only failure marker they carry.
    if (row.rpe === true) out.rpe = 10
    else delete out.rpe
  } else {
    out.rpe = rpe
  }

  if (row.note !== undefined && row.note !== null) out.note = String(row.note)

  // Derive the structured fields for rows written before they existed, so the
  // rest of the app never has to know which era a row comes from. Values
  // already present win — a row written by the current build is authoritative.
  const parsed = parseLegacyNote(out.note)
  out.toFailure = typeof row.toFailure === 'boolean'
    ? row.toFailure
    : (out.rpe === 10 || parsed.toFailure)

  const intensity = num(row.intensity)
  if (intensity !== undefined && intensity >= 1 && intensity <= 5) out.intensity = intensity
  else if (parsed.intensity) out.intensity = parsed.intensity
  else delete out.intensity

  out.comment = typeof row.comment === 'string' ? row.comment : parsed.comment
  if (!out.comment) delete out.comment

  const setIndex = num(row.setIndex)
  if (setIndex === undefined) delete out.setIndex
  else out.setIndex = setIndex

  if (row.nextIntent && typeof row.nextIntent === 'object') {
    const ni: Record<string, any> = { action: String(row.nextIntent.action || 'hold') }
    const w = num(row.nextIntent.weight)
    const r = num(row.nextIntent.reps)
    if (w !== undefined) ni.weight = w
    if (r !== undefined) ni.reps = r
    out.nextIntent = ni
  } else {
    delete out.nextIntent
  }

  if (Array.isArray(row.flags) && row.flags.length) out.flags = row.flags.map(String)
  else delete out.flags

  return out
}

const ACTIVITY_KEYS = new Set(['run', 'bike', 'swim', 'walk', 'sport', 'other'])

function normalizeSession(row: Record<string, any>): Record<string, any> {
  const out = { ...row }
  const duration = num(row.duration)
  if (duration === undefined) delete out.duration
  else out.duration = duration

  // Every row predating activity logging is a strength session. Filling `kind`
  // in here means consumers can compare it directly instead of each one having
  // to remember that `undefined` means "gym".
  out.kind = row.kind === 'activity' ? 'activity' : 'strength'
  if (out.kind === 'activity') {
    out.activity = ACTIVITY_KEYS.has(String(row.activity)) ? String(row.activity) : 'other'
    const km = num(row.distanceKm)
    if (km === undefined || km <= 0) delete out.distanceKm
    else out.distanceKm = km
    const effort = num(row.effort)
    if (effort !== undefined && effort >= 1 && effort <= 5) out.effort = effort
    else delete out.effort
  } else {
    delete out.activity
    delete out.distanceKm
    delete out.effort
  }
  return out
}

function normalizePlan(row: Record<string, any>): Record<string, any> {
  if (!Array.isArray(row.rows)) return row
  return {
    ...row,
    rows: row.rows.map((r: Record<string, any>) => {
      const out = { ...r }
      out.targetSets = numOr(r.targetSets, 3)
      // `targetReps` stays a string on purpose: it holds ranges ("6-8") and
      // seconds for isometric holds. See lib/workout/repTarget.ts for parsing.
      if (r.targetReps !== undefined && r.targetReps !== null) out.targetReps = String(r.targetReps)
      const rpe = num(r.targetRpe)
      if (rpe === undefined) delete out.targetRpe
      else out.targetRpe = rpe
      const order = num(r.order)
      if (order === undefined) delete out.order
      else out.order = order
      return out
    }),
  }
}

const NORMALIZERS: Record<string, (row: Record<string, any>) => Record<string, any>> = {
  sets: normalizeSet,
  sessions: normalizeSession,
  plans: normalizePlan,
}

/** Normalise a single row for the given logical table. Unknown tables pass through. */
export function normalizeRow<T = any>(table: string, row: T): T {
  const fn = NORMALIZERS[table]
  if (!fn || !row || typeof row !== 'object') return row
  return fn(row as Record<string, any>) as T
}

/** Normalise every row of a table read. */
export function normalizeRows<T = any>(table: string, rows: T[]): T[] {
  const fn = NORMALIZERS[table]
  if (!fn) return rows
  return rows.map(r => (r && typeof r === 'object' ? (fn(r as Record<string, any>) as T) : r))
}
