import { describe, expect, it } from 'vitest'
import { buildWorkoutList } from '@/lib/workout/workoutList'
import { sessionProgress, isItemFinished } from '@/lib/workout/progress'
import { row, sets } from './helpers'

const exercises = ['a', 'b', 'c', 'x'].map(id => ({ id, name: id.toUpperCase() }))
const planRows = [row('D1', 'a', 3, 0), row('D1', 'b', 3, 1), row('D2', 'c', 4, 0)]
const base = { day: 'D1', planRows, exercises, fallbackTargetSets: 3, fallbackTargetReps: '8' }

describe('buildWorkoutList + sessionProgress', () => {
  it('a substitute fills the planned slot instead of adding to the total', () => {
    const today = [...sets('s', 'a', 3), ...sets('s', 'c', 3)]
    const list = buildWorkoutList({ ...base, sets: today, substitutions: { b: 'c' } })
    expect(list.map(i => [i.id, i.fromPlan, i.replaces])).toEqual([['a', true, undefined], ['c', true, 'b']])
    // Target comes from the planned row (3), not from c's own row on D2 (4).
    expect(list[1].targetSets).toBe(3)
    expect(sessionProgress(list)).toMatchObject({
      planSetsDone: 6, planSetsTarget: 6, planExercisesDone: 2, planExercisesTotal: 2, extraSets: 0,
    })
  })

  it('an extra never counts toward the plan', () => {
    const today = [...sets('s', 'a', 3), ...sets('s', 'x', 3)]
    const list = buildWorkoutList({ ...base, sets: today })
    expect(list.map(i => i.id)).toEqual(['a', 'b', 'x'])
    expect(sessionProgress(list)).toMatchObject({
      planSetsDone: 3, planSetsTarget: 6, planExercisesDone: 1, planExercisesTotal: 2, extraSets: 3, extraExercises: 1,
    })
  })

  it('caps each slot at its target', () => {
    const list = buildWorkoutList({ ...base, sets: sets('s', 'a', 5) })
    expect(sessionProgress(list)).toMatchObject({ planSetsDone: 3, planSetsTarget: 6 })
  })

  it('ignores a substitution once the planned exercise has sets', () => {
    const today = [...sets('s', 'b', 1), ...sets('s', 'c', 2)]
    const list = buildWorkoutList({ ...base, sets: today, substitutions: { b: 'c' } })
    expect(list.map(i => [i.id, i.fromPlan])).toEqual([['a', true], ['b', true], ['c', false]])
  })

  it('ignores a substitution pointing at another exercise planned today', () => {
    const list = buildWorkoutList({ ...base, sets: [], substitutions: { b: 'a' } })
    expect(list.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('keeps a picked extra with no sets yet, once', () => {
    const list = buildWorkoutList({ ...base, sets: sets('s', 'x', 1), pendingExtras: ['x', 'c'] })
    expect(list.map(i => i.id)).toEqual(['a', 'b', 'x', 'c'])
  })

  it('counts an exercise closed by hand as done without inflating its sets', () => {
    const list = buildWorkoutList({ ...base, sets: sets('s', 'a', 2) })
    const closed = new Set(['a'])
    expect(isItemFinished(list[0], closed)).toBe(true)
    expect(sessionProgress(list, closed)).toMatchObject({ planSetsDone: 2, planExercisesDone: 1 })
  })
})
