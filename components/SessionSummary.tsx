"use client"
import { useMemo } from 'react'
import { epley1RM } from '@/lib/progress'
import { parsePrimaryMuscleNames } from '@/lib/bodyMapUtils'
import type { LoadState } from '@/lib/fetchJson'
import type { Exercise } from '@/lib/models'
import { useT } from '@/lib/i18n/I18nProvider'

const FAILURE_TAG = 'cedimento'

type SetRow = { sessionId: string; exerciseId: string; weight: string | number; reps: string | number; rpe?: string | number; note?: string }

export default function SessionSummary({
  sessionId,
  onClose,
  setsState,
  exercisesState,
}: {
  sessionId: string
  onClose: () => void
  setsState: LoadState<any[]>
  exercisesState: LoadState<any[]>
}) {
  const t = useT()
  const sets = useMemo(() => {
    if (setsState.status !== 'success') return [] as SetRow[]
    return (setsState.data || []).filter((s: any) => s.sessionId === sessionId)
  }, [setsState, sessionId])

  const exs = useMemo(
    () => (exercisesState.status === 'success' ? (exercisesState.data as Exercise[]) : []),
    [exercisesState]
  )

  const exById = useMemo(() => new Map(exs.map(e => [e.id, e])), [exs])

  const { volume, failureSets, totalSets, avgIntensity, musclesTop, perExercise } = useMemo(() => {
    let vol = 0, failureCount = 0, totalSetCount = 0, intSum = 0, intCount = 0
    const muscleMap = new Map<string, number>()
    const perEx = new Map<string, { name: string; sets: number; failureSets: number; top: string; topE1: number }>()

    for (const s of sets) {
      const w = Number(s.weight), r = Number(s.reps)
      if (!w || !r) continue
      const e1 = epley1RM(w, r)
      vol += w * r
      totalSetCount++

      const isFailure = s.rpe === 10 || (typeof s.note === 'string' && s.note.includes(FAILURE_TAG))
      if (isFailure) failureCount++

      if (e1) { intSum += (w / e1); intCount++ }

      const ex = exById.get(s.exerciseId)
      const muscles = parsePrimaryMuscleNames(ex?.primaryMuscles)
      const share = muscles.length || 1
      for (const m of (muscles.length ? muscles : ['_misc'])) {
        muscleMap.set(m, (muscleMap.get(m) || 0) + (w * r) / share)
      }

      const cur = perEx.get(s.exerciseId) || {
        name: ex?.name || s.exerciseId,
        sets: 0,
        failureSets: 0,
        top: '',
        topE1: 0,
      }
      cur.sets += 1
      if (isFailure) cur.failureSets += 1
      const e1r = Math.round(e1)
      if (e1r > cur.topE1) {
        cur.topE1 = e1r
        cur.top = `${w}×${r}${isFailure ? ' 💀' : ''}`
      }
      perEx.set(s.exerciseId, cur)
    }

    const musclesTop = Array.from(muscleMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([m, v]) => ({ muscle: m === '_misc' ? t.sessionSummary.miscMuscle : m, volume: Math.round(v) }))

    return {
      volume: Math.round(vol),
      failureSets: failureCount,
      totalSets: totalSetCount,
      avgIntensity: intCount ? +((intSum / intCount) * 100).toFixed(1) : null,
      musclesTop,
      perExercise: Array.from(perEx.values()),
    }
  }, [sets, exById, t.sessionSummary.miscMuscle])

  async function persistSummary() {
    const payload = {
      volume,
      failureSets,
      totalSets,
      avgIntensity,
      musclesTop: musclesTop.map(m => m.muscle).join(','),
    }
    const res = await fetch(`/api/data/sessions/${sessionId}`, { method: 'PUT', body: JSON.stringify(payload) })
    if (!res.ok) console.warn('PUT /sessions failed')
  }

  if (setsState.status === 'loading' || exercisesState.status === 'loading') {
    return (
      <div className="modal-overlay">
        <div className="card p-5">{t.sessionSummary.loading}</div>
      </div>
    )
  }

  if (setsState.status === 'error' || exercisesState.status === 'error') {
    return (
      <div className="modal-overlay">
        <div className="card p-5 text-danger">{t.sessionSummary.error}</div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-5 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="display text-2xl">{t.sessionSummary.title}</h2>
          <button className="btn" onClick={onClose}>{t.sessionSummary.closeBtn}</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card-sunken p-3">
            <div className="label">{t.sessionSummary.volume}</div>
            <div className="text-xl font-semibold num">{volume} <span className="text-xs text-muted font-normal">kg·rep</span></div>
          </div>
          <div className="card-sunken p-3">
            <div className="label">{t.sessionSummary.avgIntensity}</div>
            <div className="text-xl font-semibold num">{avgIntensity ?? '—'}<span className="text-xs text-muted font-normal">%</span></div>
          </div>
          <div className="card-sunken p-3">
            <div className="label">{t.sessionSummary.failureSets}</div>
            <div className="text-xl font-semibold num">
              {failureSets}/{totalSets}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="label mb-2">{t.sessionSummary.musclesTitle}</div>
          <ul className="text-sm grid sm:grid-cols-2 gap-1.5">
            {musclesTop.slice(0, 8).map(m => (
              <li key={m.muscle} className="flex justify-between">
                <span>{t.muscles[m.muscle] || m.muscle}</span>
                <span className="text-muted num">{m.volume} kg·rep</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="label mb-2">{t.sessionSummary.exercisesTitle}</div>
          <ul className="text-sm space-y-2">
            {perExercise.map(x => (
              <li key={x.name} className="border-b border-ink/[0.06] pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{x.name}</div>
                    <div className="text-muted">
                      <span className="num">{x.sets}</span> {t.sessionSummary.setsTotal}
                      {x.failureSets > 0 && <> • <span className="num">{x.failureSets}</span> {t.sessionSummary.failureCountSuffix}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num">{t.sessionSummary.topPrefix} {x.top}</div>
                    <div className="text-muted num">{t.sessionSummary.e1rmPrefix} {x.topE1}kg</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          className="btn-primary w-full mt-5 py-3"
          onClick={async () => { await persistSummary(); onClose() }}
        >
          {t.sessionSummary.cta}
        </button>
      </div>
    </div>
  )
}
