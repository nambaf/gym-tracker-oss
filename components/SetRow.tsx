'use client'
import { useEffect, useState, useMemo } from 'react'
import { epley1RM } from '@/lib/progress'
import { Minus, Plus, Lightbulb, Battery } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

const toNum = (s: string) => parseFloat(s.replace(',', '.'))
const FAILURE_TAG = 'cedimento'

/**
 * Canonical intensity tag stored verbatim in `Set.note` (Italian, for data
 * backward compat). Display labels come from the dictionary.
 */
type IntensityKey = 'veryEasy' | 'easy' | 'medium' | 'hard' | 'veryHard'
const INTENSITY_KEYS: { key: IntensityKey; tag: string }[] = [
  { key: 'veryEasy', tag: 'Molto facile' },
  { key: 'easy', tag: 'Facile' },
  { key: 'medium', tag: 'Medio' },
  { key: 'hard', tag: 'Difficile' },
  { key: 'veryHard', tag: 'Molto difficile' },
]

export function SetRow({
  onSave,
  lastSet,
  targetReps,
  exerciseHistory,
  targetRpe,
  isDeload,
}: {
  onSave: (p: { weight: number; reps: number; toFailure?: boolean; note?: string }) => void
  lastSet?: any
  targetReps?: number
  exerciseHistory?: any[]
  targetRpe?: number
  isDeload?: boolean
}) {
  const t = useT()
  const [weightStr, setWeightStr] = useState('')
  const [repsStr, setRepsStr] = useState('')
  const [toFailure, setToFailure] = useState(false)
  const [intensityTag, setIntensityTag] = useState('')
  const [customNote, setCustomNote] = useState('')
  const [showNote, setShowNote] = useState(false)

  useEffect(() => {
    if (lastSet) {
      setWeightStr(String(lastSet.weight || ''))
      setRepsStr(String(targetReps || lastSet.reps || ''))
      setToFailure(lastSet.note?.includes(FAILURE_TAG) || lastSet.rpe === 10)
      if (lastSet.note) {
        const found = INTENSITY_KEYS.find(i => lastSet.note.includes(i.tag))
        if (found) setIntensityTag(found.tag)
      }
    } else if (targetReps) {
      setRepsStr(String(targetReps))
    }
  }, [lastSet, targetReps])

  const suggestedWeights = useMemo(() => {
    if (!exerciseHistory || exerciseHistory.length === 0) return []
    const counts = new Map<number, number>()
    exerciseHistory.forEach((s: any) => {
      const w = Number(s.weight)
      if (w > 0) counts.set(w, (counts.get(w) || 0) + 1)
    })
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([w]) => w).sort((a, b) => a - b)
    if (lastSet?.weight) {
      const lw = Number(lastSet.weight)
      const variations = [lw - 5, lw - 2.5, lw, lw + 2.5, lw + 5].filter(w => w > 0)
      return [...new Set([...sorted, ...variations])].sort((a, b) => a - b).slice(0, 6)
    }
    return sorted
  }, [exerciseHistory, lastSet])

  const recommendedWeight = useMemo(() => {
    if (!exerciseHistory || exerciseHistory.length === 0 || !targetReps) return null
    const recent = exerciseHistory.slice(0, 5)
    const e1rms = recent.map((s: any) => epley1RM(Number(s.weight), Number(s.reps))).filter(e => e > 0)
    if (e1rms.length === 0) return null
    const avgE1 = e1rms.reduce((a, b) => a + b, 0) / e1rms.length
    const rpeIntensity: Record<number, number> = {
      10: 1.00, 9.5: 0.98, 9: 0.96, 8.5: 0.94, 8: 0.92,
      7.5: 0.89, 7: 0.86, 6.5: 0.84, 6: 0.82, 5.5: 0.79, 5: 0.77,
    }
    const intensityFactor = targetRpe ? (rpeIntensity[targetRpe] || 0.85) : 0.85
    const rec = avgE1 * intensityFactor / (1 + targetReps / 30)
    return Math.round(rec / 2.5) * 2.5
  }, [exerciseHistory, targetReps, targetRpe])

  function save() {
    const w = toNum(weightStr), r = toNum(repsStr)
    if (!w || !r) return
    let combinedNote = intensityTag || customNote || ''
    if (intensityTag && customNote) combinedNote = `${intensityTag} - ${customNote}`
    onSave({ weight: w, reps: Math.round(r), toFailure, note: combinedNote })
    setRepsStr(String(targetReps || ''))
    setToFailure(false)
    setIntensityTag('')
    setCustomNote('')
    setShowNote(false)
  }

  function adjustWeight(d: number) {
    setWeightStr(String(Math.max(0, (toNum(weightStr) || 0) + d)))
  }
  function adjustReps(d: number) {
    setRepsStr(String(Math.max(1, (parseInt(repsStr) || 0) + d)))
  }

  return (
    <div className="space-y-4">
      {recommendedWeight && (
        <button
          type="button"
          onClick={() => setWeightStr(String(recommendedWeight))}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs
            ${isDeload
              ? 'bg-warning/10 text-warning'
              : 'bg-accent-50 text-accent-600'}`}
        >
          {isDeload
            ? <Battery size={13} strokeWidth={2} />
            : <Lightbulb size={13} strokeWidth={2} />}
          <span>
            {t.setRow.recommendedFor} {targetReps} {t.setRow.repsSuffix}
            {targetRpe && ` @ ${t.setRow.rpeSuffix} ${targetRpe}`}:{' '}
            <strong className="num">{recommendedWeight} kg</strong>
            {isDeload && <span className="ml-1 opacity-70">{t.setRow.deloadSuffix}</span>}
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-paper-sunken rounded-2xl p-4">
          <div className="label">{t.setRow.weightLabel}</div>
          <div className="flex items-baseline mt-1">
            <input
              className="bg-transparent w-full text-[40px] font-medium leading-none tracking-tight2 num focus:outline-none"
              inputMode="decimal"
              value={weightStr}
              onChange={e => setWeightStr(e.target.value)}
              placeholder={recommendedWeight ? String(recommendedWeight) : '—'}
            />
            <span className="text-sm text-muted ml-1">kg</span>
          </div>
          <div className="flex gap-1.5 mt-3">
            <button type="button" onClick={() => adjustWeight(-2.5)}
              className="flex-1 h-9 rounded-lg bg-paper-card text-ink-soft text-xs font-semibold border border-ink/10 hover:bg-white">
              −2.5
            </button>
            <button type="button" onClick={() => adjustWeight(2.5)}
              className="flex-1 h-9 rounded-lg bg-paper-card text-ink-soft text-xs font-semibold border border-ink/10 hover:bg-white">
              +2.5
            </button>
          </div>
        </div>

        <div className="bg-paper-sunken rounded-2xl p-4">
          <div className="label">{t.setRow.repsLabel}</div>
          <div className="flex items-baseline mt-1">
            <input
              className="bg-transparent w-full text-[40px] font-medium leading-none tracking-tight2 num focus:outline-none"
              inputMode="numeric"
              value={repsStr}
              onChange={e => setRepsStr(e.target.value)}
              placeholder={String(targetReps || '—')}
            />
            <span className="text-sm text-muted ml-1">×</span>
          </div>
          <div className="flex gap-1.5 mt-3">
            <button type="button" onClick={() => adjustReps(-1)}
              className="flex-1 h-9 rounded-lg bg-paper-card text-ink-soft text-xs font-semibold border border-ink/10 hover:bg-white">
              <Minus size={12} strokeWidth={2.4} className="inline" />
            </button>
            <button type="button" onClick={() => adjustReps(1)}
              className="flex-1 h-9 rounded-lg bg-paper-card text-ink-soft text-xs font-semibold border border-ink/10 hover:bg-white">
              <Plus size={12} strokeWidth={2.4} className="inline" />
            </button>
          </div>
        </div>
      </div>

      {suggestedWeights.length > 0 && (
        <div className="space-y-1.5">
          <div className="label">{t.setRow.frequentWeights}</div>
          <div className="flex gap-1.5 flex-wrap">
            {suggestedWeights.map(w => (
              <button
                key={w} type="button"
                onClick={() => setWeightStr(String(w))}
                className={`chip ${weightStr === String(w)
                  ? '!bg-ink !text-white'
                  : 'hover:bg-paper-card'}`}
              >
                <span className="num">{w}</span>kg
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="label">{t.setRow.intensityLabel}</div>
        <div className="flex gap-1.5 flex-wrap">
          {INTENSITY_KEYS.map(opt => {
            const active = intensityTag === opt.tag
            return (
              <button
                key={opt.tag}
                type="button"
                onClick={() => setIntensityTag(active ? '' : opt.tag)}
                className={`chip ${active
                  ? '!bg-ink !text-white'
                  : 'hover:bg-paper-card'}`}
              >{t.setRow.intensityOpts[opt.key]}</button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setToFailure(!toFailure)}
          className={`chip ${toFailure ? '!bg-accent-500 !text-white' : ''}`}
        >
          {t.setRow.failureToggle}
        </button>
        <button
          type="button"
          onClick={() => setShowNote(!showNote)}
          className="text-xs text-muted hover:text-ink underline-offset-2 hover:underline"
        >
          {showNote ? t.setRow.hideNote : t.setRow.addNote}
        </button>
      </div>

      {showNote && (
        <input
          className="input"
          placeholder={t.setRow.notePlaceholder}
          value={customNote}
          onChange={e => setCustomNote(e.target.value)}
        />
      )}

      <button
        onClick={save}
        disabled={!weightStr || !repsStr}
        className="btn-accent w-full py-4 rounded-full text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t.setRow.saveBtn}
        {toFailure && <span className="opacity-90"> {t.setRow.saveBtnFailureSuffix}</span>}
      </button>

      {lastSet && (
        <div className="text-xs text-muted text-center">
          {t.setRow.lastSetLabel} <span className="num text-ink-soft">{lastSet.weight} kg × {lastSet.reps}</span>
        </div>
      )}
    </div>
  )
}
