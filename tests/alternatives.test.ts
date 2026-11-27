import { describe, expect, it } from 'vitest'
import {
  countedMuscles, rankAlternatives, sameVolumeAsPlan, volumeImpact, weekCoverage,
} from '@/lib/workout/alternatives'
import { exerciseWeekUsage } from '@/lib/workout/weekUsage'
import { MuscleGroup } from '@/lib/bodyMapUtils'
import { at, exercise, session, sets } from './helpers'

const panca = exercise('panca', { Petto: 70, Tricipiti: 30 })
const chestPress = exercise('chest-press', { Petto: 75, Tricipiti: 25 })
const dips = exercise('dips', { Petto: 50, Tricipiti: 40, Spalle: 10 })
const lat = exercise('lat', { Dorsali: 70, Bicipiti: 30 })
const all = [panca, chestPress, dips, lat]

describe('rankAlternatives', () => {
  it('orders by muscle split and drops exercises sharing nothing', () => {
    expect(rankAlternatives(panca, all).map(a => a.exercise.id)).toEqual(['chest-press', 'dips'])
  })
  it('honours the exclusion set', () => {
    expect(rankAlternatives(panca, all, new Set(['chest-press'])).map(a => a.exercise.id)).toEqual(['dips'])
  })
})

describe('countedMuscles', () => {
  it('credits a full set to every muscle at or above 40%', () => {
    expect([...countedMuscles(dips).keys()]).toEqual([MuscleGroup.Petto, MuscleGroup.Tricipiti])
    expect([...countedMuscles(panca).keys()]).toEqual([MuscleGroup.Petto])
  })
})

describe('weekCoverage + volumeImpact', () => {
  const mon = at(2026, 11, 23), lastWeek = at(2026, 11, 18), now = at(2026, 11, 26)
  const sessions = [session('w', mon), session('old', lastWeek), session('run', mon, { kind: 'activity' })]
  const logged = [...sets('w', 'panca', 4, mon), ...sets('old', 'panca', 9, lastWeek), ...sets('run', 'lat', 2, mon)]
  const thresholds = { [MuscleGroup.Petto]: { hypertrophy: 12 }, [MuscleGroup.Tricipiti]: { hypertrophy: 8 } }
  const coverage = weekCoverage({ sessions, sets: logged, exercises: all, thresholds, now })

  it('counts only this week\'s strength sets and lists untouched targets', () => {
    expect(coverage).toEqual(expect.arrayContaining([
      { muscle: MuscleGroup.Petto, sets: 4, target: 12 },
      { muscle: MuscleGroup.Tricipiti, sets: 0, target: 8 },
    ]))
    expect(coverage.find(c => c.muscle === MuscleGroup.Dorsali)).toBeUndefined()
  })

  it('an equivalent swap changes nothing against the plan', () => {
    const impact = volumeImpact({ coverage, candidate: chestPress, planned: panca, sets: 3 })
    expect(impact).toEqual([{ muscle: MuscleGroup.Petto, before: 4, after: 7, target: 12, vsPlan: 0 }])
    expect(sameVolumeAsPlan(impact)).toBe(true)
  })

  it('shows what a different swap adds and takes away', () => {
    const impact = volumeImpact({ coverage, candidate: dips, planned: panca, sets: 3 })
    expect(impact.find(i => i.muscle === MuscleGroup.Tricipiti)).toMatchObject({ before: 0, after: 3, vsPlan: 3 })
    const away = volumeImpact({ coverage, candidate: lat, planned: panca, sets: 3 })
    expect(away.find(i => i.muscle === MuscleGroup.Petto)).toMatchObject({ before: 4, after: 4, vsPlan: -3 })
    expect(sameVolumeAsPlan(away)).toBe(false)
  })

  it('reports usage earlier this week, excluding today\'s session', () => {
    const today = session('today', now)
    const usage = exerciseWeekUsage({
      sessions: [...sessions, today], sets: [...logged, ...sets('today', 'dips', 2, now)], now, excludeSessionId: 'today',
    })
    expect(usage.get('panca')).toMatchObject({ sets: 4, lastDayKey: '2026-11-23' })
    expect(usage.has('dips')).toBe(false)
    expect(usage.has('lat')).toBe(false)
  })
})
