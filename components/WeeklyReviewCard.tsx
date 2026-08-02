'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Check, AlertTriangle, CircleAlert, Sparkles } from 'lucide-react'
import { useDataStore } from '@/store/data'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import { mergeWithDefaults } from '@/lib/settings/effective'
import { buildWeeklyReview, applyProposal, type ReviewProposal } from '@/lib/coach/weeklyReview'
import type { Plan, PlanRow } from '@/lib/models'
import type { Lang } from '@/lib/i18n'

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }

/**
 * The weekly coach: how the past week went against the plan, and the changes
 * worth making before the next one.
 *
 * Computed on demand from data already in the store — no scheduled job, no
 * storage of its own. Every proposal is an edit the athlete approves; nothing
 * is applied on their behalf.
 */
export default function WeeklyReviewCard() {
  const t = useT()
  const lang = useLang()
  const { sessions, sets, exercises, plan, storedSettings, loadPlan } = useDataStore()
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [applied, setApplied] = useState<string[]>([])

  const review = useMemo(() => {
    if (sessions.status !== 'success' || sets.status !== 'success' ||
        exercises.status !== 'success' || plan.status !== 'success') return null
    const eff = mergeWithDefaults(storedSettings)
    const opts = {
      trainingMode: eff.trainingMode,
      thresholdsByMode: eff.thresholdsByMode,
      maxFailurePct: eff.maxFailurePct,
      targetRpeWhenReducing: eff.targetRpeWhenReducing,
    }
    const args = [sessions.data || [], sets.data || [], exercises.data || [], plan.data || [], opts] as const
    // Prefer the week in progress; on a Monday with nothing logged yet, the
    // week that just closed is the one worth reading.
    const now = new Date()
    const current = buildWeeklyReview(...args, now)
    if (current) return current
    const lastWeek = new Date(now)
    lastWeek.setDate(now.getDate() - 7)
    return buildWeeklyReview(...args, lastWeek)
  }, [sessions, sets, exercises, plan, storedSettings])

  if (!review) return null

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' })

  const pending = review.proposals.filter(p => !applied.includes(p.id))
  const worst = review.findings.some(f => f.severity === 'critical')
    ? 'critical'
    : review.findings.some(f => f.severity === 'warning') ? 'warning' : 'good'

  function describe(p: ReviewProposal): string {
    if (p.kind === 'adjust-sets') {
      return t.coach.proposals.adjustSets
        .replace('{exercise}', p.exerciseName).replace('{day}', p.day)
        .replace('{from}', String(p.from)).replace('{to}', String(p.to))
    }
    if (p.kind === 'move-exercise') {
      return t.coach.proposals.moveExercise
        .replace('{exercise}', p.exerciseName)
        .replace('{from}', p.fromDay).replace('{to}', p.toDay)
    }
    return t.coach.proposals.adjustRpe
      .replace('{from}', String(p.from)).replace('{to}', String(p.to))
      .replace('{n}', String(p.affected))
  }

  /** Write the accepted change onto the active plan. */
  async function accept(p: ReviewProposal) {
    if (applying) return
    setApplying(p.id)
    try {
      const res = await fetch('/api/data/plans', { cache: 'no-store' })
      if (!res.ok) throw new Error(`plans ${res.status}`)
      const plans: Plan[] = await res.json()
      const active = plans.find(x => x.isActive) || plans[0]
      if (!active) throw new Error('no active plan')

      const rows: PlanRow[] = applyProposal(active.rows || [], p)
      // The API does a full-row PutItem, so the whole plan travels, not a patch.
      const save = await fetch(`/api/data/plans/${active.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...active, rows }),
      })
      if (!save.ok) throw new Error(`save ${save.status}`)

      setApplied(prev => [...prev, p.id])
      await loadPlan(true)
      toast.success(t.coach.applied)
    } catch (e) {
      console.error('Failed to apply proposal:', e)
      toast.error(t.coach.applyFailed)
    } finally {
      setApplying(null)
    }
  }

  const Icon = worst === 'critical' ? CircleAlert : worst === 'warning' ? AlertTriangle : Sparkles
  const tone = worst === 'critical'
    ? 'text-accent-600 bg-accent-50'
    : worst === 'warning' ? 'text-warning bg-warning/10' : 'text-success bg-success/10'

  return (
    <section className="card p-4 space-y-3">
      <button
        className="w-full flex items-start justify-between gap-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={`shrink-0 rounded-full p-1.5 ${tone}`}><Icon size={14} strokeWidth={2.2} /></span>
          <div className="min-w-0">
            <div className="label !text-[9px]">{t.coach.title}</div>
            <div className="text-[13px] font-medium">
              {fmt(review.weekStart)} – {fmt(review.weekEnd)}
            </div>
            <div className="text-[11px] text-muted mt-0.5 num">
              {review.sessionsDone}/{review.sessionsPlanned} {t.coach.sessions}
              {' · '}{review.totalSets} {t.coach.sets}
              {review.failurePct !== null && <> · {review.failurePct}% {t.coach.toFailure}</>}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-muted mt-1">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {!open && pending.length > 0 && (
        <div className="text-[11px] text-muted">
          {t.coach.pendingHint.replace('{n}', String(pending.length))}
        </div>
      )}

      {open && (
        <div className="space-y-4 pt-1">
          {review.findings.length > 0 && (
            <ul className="space-y-1.5">
              {review.findings.map(f => (
                <li key={f.id} className="flex items-start gap-2 text-[12px] leading-snug">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    f.severity === 'critical' ? 'bg-accent-500'
                      : f.severity === 'warning' ? 'bg-warning' : 'bg-success'
                  }`} />
                  <span className="text-ink-soft">
                    {Object.entries(f.values).reduce(
                      (msg, [k, v]) => msg.replace(`{${k}}`, String(v)),
                      (t.coach.findings as Record<string, string>)[f.messageKey] || f.messageKey
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {review.proposals.length > 0 && (
            <div className="space-y-2">
              <div className="label">{t.coach.proposalsTitle}</div>
              {review.proposals.map(p => {
                const done = applied.includes(p.id)
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper-sunken px-3 py-2.5">
                    <span className="text-[12px] text-ink-soft leading-snug min-w-0">{describe(p)}</span>
                    <button
                      onClick={() => accept(p)}
                      disabled={done || applying !== null}
                      className={`shrink-0 chip !text-[11px] ${done ? '!bg-success/15 !text-success' : '!bg-ink !text-white'} disabled:opacity-60`}
                    >
                      {done
                        ? <><Check size={11} strokeWidth={2.6} className="inline mr-1" />{t.coach.appliedShort}</>
                        : applying === p.id ? t.coach.applying : t.coach.apply}
                    </button>
                  </div>
                )
              })}
              <p className="text-[10px] text-muted">{t.coach.proposalsFootnote}</p>
            </div>
          )}

          {review.findings.length === 0 && review.proposals.length === 0 && (
            <p className="text-[12px] text-muted">{t.coach.allGood}</p>
          )}
        </div>
      )}
    </section>
  )
}
