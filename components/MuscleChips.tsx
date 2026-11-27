"use client"
import type { MuscleContribution } from '@/lib/models'
import { MUSCLE_CONTRIBUTION_THRESHOLD } from '@/lib/bodyMapUtils'
import { muscleProfile } from '@/lib/workout/alternatives'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  primaryMuscles: MuscleContribution[] | undefined
  size?: 'sm' | 'md'
}

/**
 * Which muscles an exercise trains. Groups at or above the contribution
 * threshold are the ones every volume figure counts, so they get a chip; the
 * rest are listed in muted text because they are worked but never counted.
 */
export default function MuscleChips({ primaryMuscles, size = 'md' }: Props) {
  const t = useT()
  const groups = [...muscleProfile({ id: '', primaryMuscles })].sort((a, b) => b[1] - a[1])
  if (groups.length === 0) return null

  const counted = groups.filter(([, share]) => share >= MUSCLE_CONTRIBUTION_THRESHOLD)
  const minor = groups.filter(([, share]) => share < MUSCLE_CONTRIBUTION_THRESHOLD)
  const main = groups[0][0]
  const chip = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'
  const pct = (share: number) => `${Math.round(share * 100)}%`

  return (
    <span className="flex flex-wrap items-center gap-1">
      {counted.map(([group, share]) => (
        <span
          key={group}
          className={`inline-flex items-center gap-1 rounded-md font-medium border ${chip} ${
            group === main ? 'bg-ink text-white border-ink' : 'border-ink/20 text-ink-soft'
          }`}
        >
          {t.muscles[group] || group} <span className="num opacity-70">{pct(share)}</span>
        </span>
      ))}
      {minor.length > 0 && (
        <span className={`text-muted ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>
          {minor.map(([group, share]) => `${t.muscles[group] || group} ${pct(share)}`).join(' · ')}
        </span>
      )}
    </span>
  )
}
