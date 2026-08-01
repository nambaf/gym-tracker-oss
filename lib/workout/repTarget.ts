/**
 * Parsing of the free-text `targetReps` field on a plan row.
 *
 * The plan stores rep targets as a string because they are not always a single
 * number: real rows in use include "6-8" (a range), "10-8-8-6" (a ramp, one
 * value per set) and "30" meaning seconds for an isometric hold. Every consumer
 * used to do `parseInt(targetReps) || 8`, which silently reduces "12-15" to 12
 * and turns a 30-second plank into 30 repetitions.
 */

export type RepTarget = {
  kind: 'reps' | 'ramp' | 'seconds'
  /** Lowest rep target — the value to beat before adding load. */
  min: number
  /** Highest rep target — the value that triggers a load increase. */
  max: number
  /** One entry per set, when the row spells out a ramp. */
  perSet?: number[]
  /** The original string, for display. */
  raw: string
}

const SECONDS_RE = /(\d+)\s*(?:s|sec|secondi|seconds)\b/i

/**
 * Parse a target. Returns null when nothing numeric can be found, so callers
 * can fall back to their own default rather than silently getting 8.
 */
export function parseRepTarget(raw: string | number | undefined | null): RepTarget | null {
  if (raw === undefined || raw === null) return null
  const text = String(raw).trim()
  if (!text) return null

  const secondsMatch = SECONDS_RE.exec(text)
  if (secondsMatch) {
    const n = Number(secondsMatch[1])
    if (Number.isFinite(n) && n > 0) return { kind: 'seconds', min: n, max: n, raw: text }
  }

  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) || [])
    .map(n => Number(n.replace(',', '.')))
    .filter(n => Number.isFinite(n) && n > 0)
  if (numbers.length === 0) return null
  if (numbers.length === 1) {
    return { kind: 'reps', min: numbers[0], max: numbers[0], raw: text }
  }

  // Two numbers separated by a dash is a range ("6-8"); three or more is a
  // per-set ramp ("10-8-8-6"), where the order carries meaning.
  if (numbers.length === 2) {
    const [a, b] = numbers
    return { kind: 'reps', min: Math.min(a, b), max: Math.max(a, b), raw: text }
  }
  return {
    kind: 'ramp',
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    perSet: numbers,
    raw: text,
  }
}

/**
 * Reps to aim for on a given set (0-based index).
 * A ramp gives the value for that position; anything else gives the top of the
 * range, which is the number that has to be reached before adding load.
 */
export function repsForSet(target: RepTarget | null, setIndex: number, fallback: number): number {
  if (!target) return fallback
  if (target.kind === 'ramp' && target.perSet && target.perSet.length > 0) {
    return target.perSet[Math.min(setIndex, target.perSet.length - 1)]
  }
  return target.max
}
