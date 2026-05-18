'use client'
import { useMemo } from 'react'
import type { LoadState } from '@/lib/fetchJson'
import type { SetEntry } from '@/lib/models'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

const FAILURE_TAG = 'cedimento'

interface Props {
  exerciseId: string
  currentSessionId?: string
  currentSets: any[]
  setsState: LoadState<SetEntry[]>
}

export default function PreviousSessionSets({ exerciseId, currentSessionId, currentSets, setsState }: Props) {
  const t = useT()
  const previousSets = useMemo(() => {
    if (setsState.status !== 'success' || !setsState.data) return []
    const exerciseSets = setsState.data
      .filter(s => s.exerciseId === exerciseId && s.sessionId !== currentSessionId)
    if (exerciseSets.length === 0) return []
    const bySession = new Map<string, SetEntry[]>()
    for (const s of exerciseSets) {
      const arr = bySession.get(s.sessionId) || []
      arr.push(s); bySession.set(s.sessionId, arr)
    }
    let latestSessionId = ''
    let latestTs = ''
    for (const [sid, sets] of bySession) {
      const maxTs = sets.reduce((max, s) => s.ts > max ? s.ts : max, '')
      if (maxTs > latestTs) { latestTs = maxTs; latestSessionId = sid }
    }
    if (!latestSessionId) return []
    return (bySession.get(latestSessionId) || []).sort((a, b) =>
      new Date(a.ts).getTime() - new Date(b.ts).getTime()
    )
  }, [exerciseId, currentSessionId, setsState])

  if (previousSets.length === 0) return null

  function getComparison(prevSet: SetEntry, index: number): 'up' | 'down' | 'same' | null {
    if (index >= currentSets.length) return null
    const curr = currentSets[index]
    if (curr.weight > prevSet.weight) return 'up'
    if (curr.weight < prevSet.weight) return 'down'
    if (curr.reps > prevSet.reps) return 'up'
    if (curr.reps < prevSet.reps) return 'down'
    return 'same'
  }

  const prevDate = previousSets[0]?.ts ? new Date(previousSets[0].ts) : null
  const dayAgo = prevDate ? Math.floor((Date.now() - prevDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div className="rounded-2xl border border-dashed border-ink/[0.12] p-3 px-4">
      <div className="flex items-center justify-between mb-2">
        <span className="label">{t.previousSession.label}</span>
        <span className="text-[10px] text-muted-2 num">
          {dayAgo === 0 ? t.previousSession.today : dayAgo === 1 ? t.previousSession.yesterday : `${dayAgo}${t.previousSession.daysAgoSuffix}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {previousSets.map((s, i) => {
          const cmp = getComparison(s, i)
          return (
            <span key={s.id} className="inline-flex items-center gap-1 text-[13px] num text-ink-soft">
              <span className="text-muted text-[10px] uppercase tracking-wide">{i + 1}</span>
              <span>{s.weight}×{s.reps}</span>
              {s.note?.includes(FAILURE_TAG) && (
                <span className="text-[9px] text-accent-500 font-bold">★</span>
              )}
              {cmp === 'up'   && <ArrowUp   size={11} className="text-success" strokeWidth={2.6} />}
              {cmp === 'down' && <ArrowDown size={11} className="text-accent-500" strokeWidth={2.6} />}
              {cmp === 'same' && <Minus     size={11} className="text-muted-2" strokeWidth={2.6} />}
            </span>
          )
        })}
      </div>
    </div>
  )
}
