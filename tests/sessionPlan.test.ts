import { describe, expect, it } from 'vitest'
import { buildSessionPlanBlock, type PlannedExerciseState } from '@/lib/workout/prompts/sessionPlan'
import { exercise } from './helpers'

const exercises = [
  { ...exercise('bench', { Petto: 100 }), name: 'Bench' },
  { ...exercise('row', { Dorsali: 100 }), name: 'Row' },
  { ...exercise('pulldown', { Dorsali: 100 }), name: 'Pulldown' },
  { ...exercise('curl', { Bicipiti: 100 }), name: 'Curl' },
]

function slot(position: number, id: string, name: string, setsDone: number, done: boolean): PlannedExerciseState {
  return { exerciseId: id, exerciseName: name, position, targetSets: 3, targetReps: '8', setsDone, done }
}

const base = {
  planDay: 'A',
  exercises,
  coverage: [],
  performed: [
    { exerciseId: 'bench', exerciseName: 'Bench', setsDone: 3 },
    { exerciseId: 'pulldown', exerciseName: 'Pulldown', setsDone: 3 },
  ],
  // Slot 2 is named after the planned Row but was filled by Pulldown.
  planned: [slot(1, 'bench', 'Bench', 3, true), slot(2, 'row', 'Row', 3, true), slot(3, 'curl', 'Curl', 0, false)],
  substitutions: { row: 'pulldown' },
  currentExerciseId: 'pulldown',
  currentPosition: { position: 2, total: 2 },
}

describe('buildSessionPlanBlock with a swapped exercise', () => {
  it('reports the planned exercise as swapped, not as still to do (EN)', () => {
    const text = buildSessionPlanBlock({ ...base, lang: 'en' })
    expect(text).toContain('2. Row 3x8 — swapped for Pulldown: just finished')
    expect(text).toContain('2) Pulldown (planned 2nd, in place of Row)')
    expect(text).toContain('STILL TO DO FROM THE PLAN (1):')
    expect(text).not.toMatch(/STILL TO DO[^]*- Row/)
    expect(text).not.toContain('off plan')
  })

  it('does the same in Italian', () => {
    const text = buildSessionPlanBlock({ ...base, lang: 'it' })
    expect(text).toContain('2. Row 3x8 — sostituito con Pulldown: appena concluso')
    expect(text).toContain('2) Pulldown (previsto 2°, al posto di Row)')
    expect(text).not.toContain('fuori piano')
  })

  it('names an untouched swapped slot by the exercise that will fill it', () => {
    const text = buildSessionPlanBlock({
      ...base,
      lang: 'en',
      performed: [{ exerciseId: 'bench', exerciseName: 'Bench', setsDone: 3 }],
      planned: [slot(1, 'bench', 'Bench', 3, true), slot(2, 'row', 'Row', 0, false), slot(3, 'curl', 'Curl', 0, false)],
      currentExerciseId: 'bench',
      currentPosition: { position: 1, total: 1 },
    })
    expect(text).toContain('2. Row 3x8 — swapped for Pulldown: TO DO')
    expect(text).toContain('- Pulldown (in place of Row) 3x8')
  })

  it('reads a plain plan exactly as before when nothing was swapped', () => {
    const text = buildSessionPlanBlock({
      ...base, lang: 'en', substitutions: undefined,
      performed: [{ exerciseId: 'bench', exerciseName: 'Bench', setsDone: 3 }],
      planned: [slot(1, 'bench', 'Bench', 3, true), slot(2, 'row', 'Row', 0, false)],
      currentExerciseId: 'bench',
      currentPosition: { position: 1, total: 1 },
    })
    expect(text).toContain('2. Row 3x8 — TO DO')
    expect(text).toContain('- Row 3x8')
  })
})
