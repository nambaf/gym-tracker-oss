import type { MuscleImpact } from './alternatives'

type Labels = Record<string, string>

function standing(i: MuscleImpact): string {
  return i.target === null ? `(${i.after})` : `(${i.after}/${i.target})`
}

/**
 * One line saying what a swap does to the week compared with the planned
 * exercise: "Dorsali −3 (5/12) · Bicipiti +3 (7/8)". Only the muscles the swap
 * changes are named; the figure in brackets is where the week would land.
 * Empty when the swap changes nothing.
 */
export function formatSwapImpact(impact: MuscleImpact[], labels: Labels): string {
  return impact
    .filter(i => i.vsPlan !== 0)
    .map(i => `${labels[i.muscle] || i.muscle} ${i.vsPlan > 0 ? '+' : '−'}${Math.abs(i.vsPlan)} ${standing(i)}`)
    .join(' · ')
}

/** One line saying what an added exercise brings to the week: "+3 Petto (11/12)". */
export function formatGainImpact(impact: MuscleImpact[], labels: Labels): string {
  return impact
    .filter(i => i.after > i.before)
    .map(i => `+${i.after - i.before} ${labels[i.muscle] || i.muscle} ${standing(i)}`)
    .join(' · ')
}

/**
 * The substitutions actually in force on today's list, planned id → substitute
 * id. A stored swap stops applying once the planned exercise is trained after
 * all, and the coach must not be told about a swap that did not happen.
 */
export function effectiveSubstitutions(items: Array<{ id: string; replaces?: string }>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of items) if (item.replaces) out[item.replaces] = item.id
  return out
}
