/**
 * Set notes: the legacy string format and the structured fields that replace it.
 *
 * Historically everything the athlete recorded about a set was crammed into one
 * positional string:
 *
 *     cedimento[ - <italian intensity tag>][ - <free text>]
 *
 * Five orthogonal things shared that field — failure flag, perceived intensity,
 * which machine the load refers to, an instruction for next time, and fatigue
 * context — and none of them could be read by any metric. `parseLegacyNote`
 * pulls back out what can be recovered unambiguously; the rest stays as a
 * comment rather than being guessed at.
 *
 * New sets write the structured fields directly AND keep `note` in the old
 * format, so a rollback of the app does not orphan the data.
 */
import type { IntensityLevel, SetEntry } from './models'

export const FAILURE_TAG = 'cedimento'

export type IntensityKey = 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard'

/** Canonical intensity tags as stored in `Set.note` (Italian, backward compat). */
export const INTENSITY_KEYS: { key: IntensityKey; tag: string; level: IntensityLevel }[] = [
  { key: 'veryEasy', tag: 'Molto facile', level: 1 },
  { key: 'easy', tag: 'Facile', level: 2 },
  { key: 'medium', tag: 'Medio', level: 3 },
  { key: 'hard', tag: 'Difficile', level: 4 },
  { key: 'veryHard', tag: 'Molto difficile', level: 5 },
]

/** Longest tag first: "Molto difficile" must win over "Difficile". */
const TAGS_BY_LENGTH = [...INTENSITY_KEYS].sort((a, b) => b.tag.length - a.tag.length)

const INTENSITY_BY_LEVEL = new Map<IntensityLevel, { key: IntensityKey; tag: string }>(
  INTENSITY_KEYS.map(i => [i.level, { key: i.key, tag: i.tag }])
)

export function intensityKeyOf(level: IntensityLevel | undefined): IntensityKey | null {
  if (!level) return null
  return INTENSITY_BY_LEVEL.get(level)?.key ?? null
}

export function intensityTagOf(level: IntensityLevel | undefined): string {
  if (!level) return ''
  return INTENSITY_BY_LEVEL.get(level)?.tag ?? ''
}

/** Strip stray separators left by hand-editing: "- - Continua a 59" → "Continua a 59". */
function stripSeparators(s: string): string {
  return s.replace(/^[\s–—-]+/, '').replace(/[\s–—-]+$/, '').trim()
}

export type ParsedNote = {
  toFailure: boolean
  intensity?: IntensityLevel
  comment: string
}

/**
 * Recover structure from the legacy note string.
 *
 * Matching is case-insensitive, because the real data contains both "Facile"
 * and "facile". A tag only counts when it is the whole remaining text or is
 * followed by a separator: "Molto difficile tosto" is a comment, not the
 * "very hard" tag plus noise — promoting it would invent data.
 */
export function parseLegacyNote(note?: string | null): ParsedNote {
  const raw = stripSeparators(String(note ?? ''))
  if (!raw) return { toFailure: false, comment: '' }

  let rest = raw
  let toFailure = false
  const lower = rest.toLocaleLowerCase('it')
  if (lower === FAILURE_TAG) {
    return { toFailure: true, comment: '' }
  }
  if (lower.startsWith(`${FAILURE_TAG} -`)) {
    toFailure = true
    rest = stripSeparators(rest.slice(FAILURE_TAG.length))
  }

  let intensity: IntensityLevel | undefined
  const restLower = rest.toLocaleLowerCase('it')
  for (const { tag, level } of TAGS_BY_LENGTH) {
    const tagLower = tag.toLocaleLowerCase('it')
    if (restLower === tagLower) {
      intensity = level
      rest = ''
      break
    }
    if (restLower.startsWith(`${tagLower} -`)) {
      intensity = level
      rest = stripSeparators(rest.slice(tag.length))
      break
    }
  }

  return { toFailure, intensity, comment: stripSeparators(rest) }
}

/**
 * Build the legacy note string from structured input, so rows stay readable by
 * any older build of the app.
 */
export function buildLegacyNote(p: {
  toFailure?: boolean
  intensity?: IntensityLevel
  comment?: string
}): string {
  const parts: string[] = []
  if (p.toFailure) parts.push(FAILURE_TAG)
  const tag = intensityTagOf(p.intensity)
  if (tag) parts.push(tag)
  const comment = (p.comment || '').trim()
  if (comment) parts.push(comment)
  return parts.join(' - ')
}

/**
 * Single source of truth for "was this set taken to failure?".
 *
 * Four divergent inline versions of this check used to exist, and the ones that
 * omitted the `rpe` branch missed the oldest rows entirely. Read the normalised
 * field first; fall back to the raw shapes so the helper is also correct when
 * handed a row that never went through `normalizeSet`.
 */
export function isFailureSet(set: { toFailure?: boolean; rpe?: unknown; note?: string }): boolean {
  if (typeof set.toFailure === 'boolean') return set.toFailure
  // `rpe` may be a number, the string "10", or the boolean `true` in the
  // oldest rows — hence the loose check rather than a strict comparison.
  if (set.rpe === true || Number(set.rpe) === 10) return true
  return parseLegacyNote(set.note).toFailure
}

/** Perceived intensity of a set, structured field first, legacy note second. */
export function intensityOf(set: Partial<SetEntry>): IntensityLevel | undefined {
  if (set.intensity) return set.intensity
  return parseLegacyNote(set.note).intensity
}

/** The athlete's own words about a set, with tags removed. */
export function commentOf(set: Partial<SetEntry>): string {
  if (typeof set.comment === 'string') return set.comment
  return parseLegacyNote(set.note).comment
}

/**
 * Localised one-line rendering of a note: intensity label plus free text.
 * The failure flag is rendered separately as a marker, so it is stripped here.
 */
export function formatSetNote(
  note: string | undefined,
  intensityLabels: Record<IntensityKey, string>,
): string {
  const { intensity, comment } = parseLegacyNote(note)
  const key = intensityKeyOf(intensity)
  const label = key ? intensityLabels[key] : ''
  if (label && comment) return `${label} · ${comment}`
  return label || comment
}

/** Same as `formatSetNote`, but for a set that may already carry structured fields. */
export function formatSetNoteOf(
  set: Partial<SetEntry>,
  intensityLabels: Record<IntensityKey, string>,
): string {
  const key = intensityKeyOf(intensityOf(set))
  const label = key ? intensityLabels[key] : ''
  const comment = commentOf(set)
  if (label && comment) return `${label} · ${comment}`
  return label || comment
}
