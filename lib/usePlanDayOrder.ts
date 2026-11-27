'use client'
import { useEffect, useState } from 'react'
import type { Plan, PlanRow } from '@/lib/models'

/**
 * `dayOrder` of the active plan, for `planDays`.
 *
 * The store's `plan` slice holds rows only, so the order is read from the plan
 * itself, again whenever the rows are reloaded. Undefined until it arrives and
 * for plans saved before `dayOrder` existed — `planDays` then falls back to
 * `sortDays`, which is what those plans always showed.
 */
export function usePlanDayOrder(planRows: PlanRow[] | undefined): string[] | undefined {
  const [order, setOrder] = useState<string[]>()
  useEffect(() => {
    if (!planRows) return
    let cancelled = false
    fetch('/api/data/plans', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((plans: Plan[]) => {
        if (cancelled || !Array.isArray(plans)) return
        setOrder((plans.find(p => p.isActive) || plans[0])?.dayOrder)
      })
      .catch(() => { /* keep the fallback order */ })
    return () => { cancelled = true }
  }, [planRows])
  return order
}
