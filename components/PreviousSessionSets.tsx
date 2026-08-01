'use client'
import { useMemo } from 'react'
import type { LoadState } from '@/lib/fetchJson'
import type { SetEntry } from '@/lib/models'
import { ArrowUp, ArrowDown, Minus, CornerUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'
import { isFailureSet, formatSetNoteOf } from '@/lib/setNotes'
import { compareToPrevious } from '@/lib/records'
import { daysBetweenLocal } from '@/lib/dateUtils'

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
      const maxTs = sets.reduce((max, s) => (String(s.ts) > max ? String(s.ts) : max), '')
      if (maxTs > latestTs) { latestTs = maxTs; latestSessionId = sid }
    }
    if (!latestSessionId) return []
    return (bySession.get(latestSessionId) || [])
      .sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')))
  }, [exerciseId, currentSessionId, setsState])

  /**
   * The instruction the athlete left for themselves last time, if any. This is
   * the whole point of recording one: it used to be written into a free-text
   * note and then never shown again, so the same "continue at 59" was retyped
   * week after week.
   */
  const carryOver = useMemo(() => {
    for (let i = previousSets.length - 1; i >= 0; i--) {
      const intent = previousSets[i].nextIntent
      if (intent?.action) return intent
    }
    return null
  }, [previousSets])

  if (previousSets.length === 0) return null

  const prevDate = previousSets[0]?.ts ? new Date(previousSets[0].ts) : null
  const dayAgo = prevDate ? daysBetweenLocal(prevDate) : 0

  // Group identical notes so "Very hard" on every set renders once, not N times.
  const noteGroups: { note: string; indices: number[] }[] = []
  previousSets.forEach((s, i) => {
    const note = formatSetNoteOf(s, t.setRow.intensityOpts)
    if (!note) return
    const group = noteGroups.find(g => g.note === note)
    if (group) group.indices.push(i + 1)
    else noteGroups.push({ note, indices: [i + 1] })
  })

  /** Compress 1-based set indices into ranges: [1,2,3] → "1–3", [1,3] → "1, 3". */
  function formatIndices(indices: number[]): string {
    const parts: string[] = []
    let start = indices[0]
    let prev = indices[0]
    for (const n of indices.slice(1).concat(NaN)) {
      if (n === prev + 1) { prev = n; continue }
      parts.push(start === prev ? `${start}` : `${start}–${prev}`)
      start = prev = n
    }
    return parts.join(', ')
  }

  function carryOverText(intent: NonNullable<typeof carryOver>): string {
    const label = t.setRow.nextTimeOpts[intent.action]
    return intent.weight ? `${label} · ${intent.weight} kg` : label
  }

  return (
    <div className="space-y-2">
      {carryOver && (
        <div className="rounded-2xl bg-accent-50 text-accent-600 px-4 py-2.5 flex items-start gap-2">
          <CornerUpRight size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="label !text-[9px] !text-accent-600 opacity-70">{t.previousSession.carryOverLabel}</div>
            <div className="text-[13px] font-medium break-words">{carryOverText(carryOver)}</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-ink/[0.12] p-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label">{t.previousSession.label}</span>
          <span className="text-[10px] text-muted-2 num">
            {dayAgo === 0 ? t.previousSession.today : dayAgo === 1 ? t.previousSession.yesterday : `${dayAgo}${t.previousSession.daysAgoSuffix}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {previousSets.map((s, i) => {
            // Comparison is positional by design (set 1 vs set 1); it only
            // applies while today's set count has reached that position.
            const cmp = i < currentSets.length
              ? compareToPrevious(currentSets[i], s)
              : null
            return (
              <span key={s.id} className="inline-flex items-center gap-1 text-[13px] num text-ink-soft">
                <span className="text-muted text-[10px] uppercase tracking-wide">{i + 1}</span>
                <span>{s.weight}×{s.reps}</span>
                {isFailureSet(s) && (
                  <span className="text-[10px] text-accent-500 font-bold" title={t.setRow.failureToggle}>★</span>
                )}
                {cmp?.direction === 'up' && <ArrowUp size={11} className="text-success" strokeWidth={2.6} />}
                {cmp?.direction === 'down' && <ArrowDown size={11} className="text-accent-500" strokeWidth={2.6} />}
                {cmp?.direction === 'same' && <Minus size={11} className="text-muted-2" strokeWidth={2.6} />}
              </span>
            )
          })}
        </div>
        {noteGroups.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-ink/[0.06] space-y-1">
            {noteGroups.map(g => (
              <div key={g.note} className="flex items-baseline gap-1.5 text-[11px]">
                <span className="shrink-0 text-muted text-[10px] num uppercase tracking-wide">
                  {g.indices.length === previousSets.length ? t.previousSession.allSets : formatIndices(g.indices)}
                </span>
                <span className="text-ink-soft italic break-words">{g.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
