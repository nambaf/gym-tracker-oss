import { describe, expect, it } from 'vitest'
import { volumeImpact, type MuscleCoverage } from '@/lib/workout/alternatives'
import { buildWorkoutList } from '@/lib/workout/workoutList'
import { effectiveSubstitutions, formatGainImpact, formatSwapImpact } from '@/lib/workout/impactLabel'
import { MuscleGroup } from '@/lib/bodyMapUtils'
import { exercise, row, sets } from './helpers'

const labels = { dorsali: 'Dorsali', bicipiti: 'Bicipiti', petto: 'Petto' }
const coverage: MuscleCoverage[] = [
  { muscle: MuscleGroup.Dorsali, sets: 5, target: 12 },
  { muscle: MuscleGroup.Bicipiti, sets: 4, target: 8 },
  { muscle: MuscleGroup.Petto, sets: 8, target: null },
]
const row1 = exercise('row', { Dorsali: 100 })
const curl = exercise('curl', { Bicipiti: 100 })
const pulldown = exercise('pulldown', { Dorsali: 100 })
const bench = exercise('bench', { Petto: 100 })

describe('formatSwapImpact', () => {
  it('names what the swap takes away and what it adds, with where the week lands', () => {
    const impact = volumeImpact({ coverage, candidate: curl, planned: row1, sets: 3 })
    const text = formatSwapImpact(impact, labels)
    expect(text.split(' · ').sort()).toEqual(['Bicipiti +3 (7/8)', 'Dorsali −3 (5/12)'])
  })

  it('is empty when the swap leaves the week unchanged', () => {
    const impact = volumeImpact({ coverage, candidate: pulldown, planned: row1, sets: 3 })
    expect(formatSwapImpact(impact, labels)).toBe('')
  })
})

describe('formatGainImpact', () => {
  it('reports the plain gain against the target', () => {
    const impact = volumeImpact({ coverage, candidate: curl, sets: 3 })
    expect(formatGainImpact(impact, labels)).toBe('+3 Bicipiti (7/8)')
  })

  it('drops the target when the muscle has none', () => {
    const impact = volumeImpact({ coverage, candidate: bench, sets: 3 })
    expect(formatGainImpact(impact, labels)).toBe('+3 Petto (11)')
  })
})

describe('effectiveSubstitutions', () => {
  const base = {
    day: 'A',
    planRows: [row('A', 'row', 3, 0), row('A', 'bench', 3, 1)],
    exercises: [row1, curl, bench],
    fallbackTargetSets: 3,
    fallbackTargetReps: '8',
  }

  it('keeps a swap that fills its slot', () => {
    const items = buildWorkoutList({ ...base, sets: sets('s', 'curl', 2), substitutions: { row: 'curl' } })
    expect(effectiveSubstitutions(items)).toEqual({ row: 'curl' })
  })

  it('drops a stored swap once the planned exercise was trained after all', () => {
    const items = buildWorkoutList({ ...base, sets: sets('s', 'row', 1), substitutions: { row: 'curl' } })
    expect(effectiveSubstitutions(items)).toEqual({})
  })
})
