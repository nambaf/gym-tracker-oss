'use client'
import { useEffect, useRef, useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { coachExerciseDebrief, type ExerciseDebriefContext } from '@/lib/workout/aiActions'
import { useT } from '@/lib/i18n/I18nProvider'
import { useAIEnabled } from '@/lib/appConfig'

type Props = {
  /**
   * Changes to a new value the moment an exercise is completed. The value
   * doubles as the identity of that completion, so the same exercise never
   * triggers twice in one session even if extra sets are added afterwards.
   */
  trigger: string | null
  /**
   * Name of the exercise the debrief is about. Closing an exercise moves the
   * athlete to the next one, so without it the card reads as a comment on
   * whatever happens to be on screen.
   */
  exerciseName?: string
  buildContext: () => ExerciseDebriefContext | null
}

/**
 * The coach's unprompted word when an exercise is done.
 *
 * Fire-and-forget: the request runs in the background and the card appears when
 * the answer lands, so nothing about finishing an exercise waits on the model.
 * If it fails, it fails silently — an absent comment is a non-event, an error
 * banner in the middle of a workout is not.
 */
export default function ExerciseDebrief({ trigger, exerciseName, buildContext }: Props) {
  const t = useT()
  const aiEnabled = useAIEnabled()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const doneRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!aiEnabled || !trigger || doneRef.current.has(trigger)) return
    doneRef.current.add(trigger)
    const ctx = buildContext()
    if (!ctx) return

    let cancelled = false
    setLoading(true)
    setDismissed(false)
    setText('')
    coachExerciseDebrief(ctx)
      .then(res => { if (!cancelled) setText(res.trim()) })
      .catch(err => { console.warn('Coach debrief unavailable:', err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // `buildContext` is rebuilt every render; the trigger is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, aiEnabled])

  if (!aiEnabled || dismissed) return null
  if (!loading && !text) return null

  return (
    <div className="rounded-2xl bg-ink text-white px-4 py-3 flex items-start gap-2.5">
      <MessageSquare size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <div className="label !text-[9px] !text-white/50">
          {t.coach.debriefLabel}{exerciseName ? ` · ${exerciseName}` : ''}
        </div>
        {loading ? (
          <div className="flex items-center gap-1.5 mt-1" aria-live="polite">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse [animation-delay:300ms]" />
          </div>
        ) : (
          <p className="text-[13px] leading-snug mt-0.5 whitespace-pre-line">{text}</p>
        )}
      </div>
      {!loading && (
        <button
          onClick={() => setDismissed(true)}
          aria-label={t.common.close}
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}
