/**
 * Shared helpers for set notes and failure detection.
 *
 * `Set.note` stores tags verbatim in Italian for data backward compat:
 * "cedimento[ - <intensity tag>][ - <free text>]". Display labels come
 * from the dictionary; use `formatSetNote` to localize before rendering.
 */
export const FAILURE_TAG = 'cedimento'

export type IntensityKey = 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard'

/** Canonical intensity tags as stored in `Set.note` (Italian, backward compat). */
export const INTENSITY_KEYS: { key: IntensityKey; tag: string }[] = [
  { key: 'veryEasy', tag: 'Molto facile' },
  { key: 'easy', tag: 'Facile' },
  { key: 'medium', tag: 'Medio' },
  { key: 'hard', tag: 'Difficile' },
  { key: 'veryHard', tag: 'Molto difficile' },
]

/** A set counts as failure if flagged via note tag OR logged at RPE 10 (legacy rows may have either). */
export function isFailureSet(set: { rpe?: number; note?: string }): boolean {
  return set.rpe === 10 || !!set.note?.includes(FAILURE_TAG)
}

/**
 * Localize a stored note for display: strips the failure tag (rendered
 * separately as a marker) and maps the Italian intensity tag to its
 * dictionary label. Returns '' when nothing remains to show.
 */
export function formatSetNote(
  note: string | undefined,
  intensityLabels: Record<IntensityKey, string>,
): string {
  if (!note) return ''
  let rest = note.trim()
  if (rest === FAILURE_TAG) return ''
  if (rest.startsWith(`${FAILURE_TAG} - `)) rest = rest.slice(FAILURE_TAG.length + 3)
  const found = INTENSITY_KEYS.find(i => rest === i.tag || rest.startsWith(`${i.tag} - `))
  if (!found) return rest
  const custom = rest === found.tag ? '' : rest.slice(found.tag.length + 3)
  const label = intensityLabels[found.key]
  return custom ? `${label} · ${custom}` : label
}
