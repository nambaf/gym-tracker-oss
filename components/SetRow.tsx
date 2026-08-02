'use client'
import { useEffect, useState, useMemo } from 'react'
import { Minus, Plus, Lightbulb, Battery } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'
import { INTENSITY_KEYS } from '@/lib/setNotes'
import type { IntensityLevel, NextIntent, SetFlag } from '@/lib/models'
import type { Prescription } from '@/lib/workout/prescription'

const toNum = (s: string) => parseFloat(s.replace(',', '.'))

const NEXT_ACTIONS: NextIntent['action'][] = ['hold', 'increase', 'decrease', 'retry']

const SET_FLAGS: SetFlag[] = ['pain', 'technique', 'interrupted', 'fatigued']

export function SetRow({
  onSave,
  lastSet,
  targetReps,
  exerciseHistory,
  targetRpe,
  isDeload,
  prescription,
}: {
  onSave: (p: {
    weight: number
    reps: number
    toFailure?: boolean
    intensity?: IntensityLevel
    comment?: string
    nextIntent?: NextIntent
    flags?: SetFlag[]
  }) => Promise<boolean> | boolean | void
  lastSet?: any
  targetReps?: number
  exerciseHistory?: any[]
  targetRpe?: number
  isDeload?: boolean
  prescription?: Prescription | null
}) {
  const t = useT()
  const [weightStr, setWeightStr] = useState('')
  const [repsStr, setRepsStr] = useState('')
  const [toFailure, setToFailure] = useState(false)
  const [intensity, setIntensity] = useState<IntensityLevel | undefined>(undefined)
  const [customNote, setCustomNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [nextAction, setNextAction] = useState<NextIntent['action'] | ''>('')
  const [nextWeight, setNextWeight] = useState('')
  const [flags, setFlags] = useState<SetFlag[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Prefill carries over weight and reps only. `toFailure` and the intensity tag
  // describe one specific set: restoring them here re-armed the toggle after
  // every save (the effect re-runs because `lastSet` changes), so every set
  // after the first failure was silently stored as a failure too.
  useEffect(() => {
    if (lastSet) {
      setWeightStr(String(lastSet.weight ?? ''))
      setRepsStr(String(targetReps || lastSet.reps || ''))
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


  // Bodyweight work is logged at 0 kg, so 0 is a valid weight — only a missing
  // or negative value is invalid. Reps must still be at least 1.
  const w = toNum(weightStr)
  const r = toNum(repsStr)
  const canSave = Number.isFinite(w) && w >= 0 && Number.isFinite(r) && Math.round(r) >= 1

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setSaveError('')
    try {
      // Clear the form only once the set is actually persisted. Resetting first
      // made a failed save look identical to a successful one, and the set was
      // gone with no way to recover what had just been typed.
      const ok = await onSave({
        weight: w,
        reps: Math.round(r),
        toFailure,
        intensity,
        comment: customNote.trim(),
        nextIntent: nextAction
          ? {
              action: nextAction,
              ...(Number.isFinite(toNum(nextWeight)) && toNum(nextWeight) > 0
                ? { weight: toNum(nextWeight) }
                : {}),
            }
          : undefined,
        flags: flags.length ? flags : undefined,
      })
      if (ok === false) {
        setSaveError(t.setRow.saveFailed)
        return
      }
      setRepsStr(String(targetReps || ''))
      setToFailure(false)
      setIntensity(undefined)
      setCustomNote('')
      setShowNote(false)
      setNextAction('')
      setNextWeight('')
      setFlags([])
    } finally {
      setSaving(false)
    }
  }

  function adjustWeight(d: number) {
    setWeightStr(String(Math.max(0, (toNum(weightStr) || 0) + d)))
  }
  function adjustReps(d: number) {
    setRepsStr(String(Math.max(1, (parseInt(repsStr) || 0) + d)))
  }

  return (
    <div className="space-y-4">
      {prescription && (
        <button
          type="button"
          onClick={() => setWeightStr(String(prescription.weight))}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs
            ${isDeload
              ? 'bg-warning/10 text-warning'
              : 'bg-accent-50 text-accent-600'}`}
        >
          {isDeload
            ? <Battery size={13} strokeWidth={2} />
            : <Lightbulb size={13} strokeWidth={2} />}
          <span>
            <strong className="num">{prescription.weight} kg</strong>
            {' × '}<span className="num">{prescription.targetReps}</span>
            {' — '}
            {t.setRow.prescriptionReason[prescription.reason]
              .replace('{prev}', String(prescription.previousWeight ?? ''))
              .replace('{intent}', prescription.intentAction
                ? t.setRow.nextTimeOpts[prescription.intentAction].toLocaleLowerCase()
                : '')}
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
              placeholder={prescription ? String(prescription.weight) : '—'}
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
            const active = intensity === opt.level
            return (
              <button
                key={opt.level}
                type="button"
                onClick={() => setIntensity(active ? undefined : opt.level)}
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
          onClick={() => {
            // Hiding the field used to leave the text in state, so a note the
            // athlete had visibly discarded was saved anyway.
            if (showNote) { setCustomNote(''); setNextAction(''); setNextWeight(''); setFlags([]) }
            setShowNote(!showNote)
          }}
          className="text-xs text-muted hover:text-ink underline-offset-2 hover:underline"
        >
          {showNote ? t.setRow.hideNote : t.setRow.addNote}
        </button>
      </div>

      {showNote && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder={t.setRow.notePlaceholder}
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
          />

          {/* Short, closed vocabulary for the context that explains a set —
              pain, sloppy technique, an interruption, pre-existing fatigue.
              These are the things worth filtering on later; everything else
              stays free text. */}
          <div className="space-y-1.5">
            <div className="label">{t.setRow.flagsLabel}</div>
            <div className="flex gap-1.5 flex-wrap">
              {SET_FLAGS.map(f => {
                const active = flags.includes(f)
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlags(prev => active ? prev.filter(x => x !== f) : [...prev, f])}
                    className={`chip ${active ? '!bg-ink !text-white' : 'hover:bg-paper-card'}`}
                  >{t.setRow.flagOpts[f]}</button>
                )
              })}
            </div>
          </div>

          {/* Structured instruction to the athlete's future self. Free-text
              notes like "continue at 59" were rewritten every week because
              nothing carried them into the next session. */}
          <div className="space-y-1.5">
            <div className="label">{t.setRow.nextTimeLabel}</div>
            <div className="flex gap-1.5 flex-wrap">
              {NEXT_ACTIONS.map(a => {
                const active = nextAction === a
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setNextAction(active ? '' : a); if (active) setNextWeight('') }}
                    className={`chip ${active ? '!bg-ink !text-white' : 'hover:bg-paper-card'}`}
                  >{t.setRow.nextTimeOpts[a]}</button>
                )
              })}
            </div>
            {(nextAction === 'increase' || nextAction === 'decrease') && (
              <input
                className="input mt-1.5"
                inputMode="decimal"
                placeholder={t.setRow.nextTimeWeightPlaceholder}
                value={nextWeight}
                onChange={e => setNextWeight(e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={!canSave || saving}
        className="btn-accent w-full py-4 rounded-full text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t.setRow.saving}
          </>
        ) : (
          <>
            {t.setRow.saveBtn}
            {toFailure && <span className="opacity-90"> {t.setRow.saveBtnFailureSuffix}</span>}
          </>
        )}
      </button>

      {saveError && (
        <div className="text-xs text-danger text-center" role="alert">{saveError}</div>
      )}

      {lastSet && (
        <div className="text-xs text-muted text-center">
          {t.setRow.lastSetLabel} <span className="num text-ink-soft">{lastSet.weight} kg × {lastSet.reps}</span>
        </div>
      )}
    </div>
  )
}
