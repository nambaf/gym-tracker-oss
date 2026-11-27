import type { Plan } from '../models'
import { sortDays } from '../dayUtils'

/**
 * A plan's days in the order the athlete trains them — the only place that
 * answers "which days, in which order".
 *
 * `dayOrder` wins where it exists. Days found only on the rows (a plan saved
 * before `dayOrder` existed, or a row added by another writer) follow in
 * `sortDays` order, so an old plan reads exactly as it always did. A day listed
 * in `dayOrder` with no rows yet is kept: that is how an empty day survives a
 * save.
 */
export function planDays(plan: Pick<Plan, 'rows' | 'dayOrder'> | null | undefined): string[] {
  if (!plan) return []
  const fromRows = Array.from(new Set((plan.rows || []).map(r => String(r.day ?? '')).filter(Boolean)))
  const ordered = Array.from(new Set((plan.dayOrder || []).filter(d => typeof d === 'string' && d)))
  const known = new Set(ordered)
  return [...ordered, ...sortDays(fromRows.filter(d => !known.has(d)))]
}
