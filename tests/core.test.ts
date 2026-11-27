import { describe, expect, it } from 'vitest'
import { daysBetweenLocal, localDayKey, parseLocalDate, weekBounds } from '@/lib/dateUtils'
import { sortDays } from '@/lib/dayUtils'
import { activitySessions, strengthSessions } from '@/lib/sessions'
import { normalizeRow } from '@/lib/data/normalize'
import { at } from './helpers'

describe('dateUtils', () => {
  it('keys a late-evening instant to its local day', () => {
    expect(localDayKey(at(2026, 11, 26, 23))).toBe('2026-11-26')
    expect(localDayKey(at(2026, 11, 26, 0))).toBe('2026-11-26')
  })
  it('bounds the week Monday to Sunday, Sunday included', () => {
    const { monday, sunday } = weekBounds(at(2026, 11, 29, 23))
    expect(localDayKey(monday)).toBe('2026-11-23')
    expect(localDayKey(sunday)).toBe('2026-11-29')
    expect(localDayKey(weekBounds(at(2026, 11, 23, 0)).monday)).toBe('2026-11-23')
  })
  it('counts calendar days, not 24-hour spans', () => {
    expect(daysBetweenLocal(at(2026, 11, 25, 20), at(2026, 11, 26, 8))).toBe(1)
  })
  it('parses a date input as local midnight', () => {
    expect(localDayKey(parseLocalDate('2026-11-26')!)).toBe('2026-11-26')
    expect(parseLocalDate('26/11/2026')).toBeNull()
  })
})

describe('sortDays', () => {
  it('orders weekdays, then numbered days, then the rest', () => {
    expect(sortDays(['B', 'Day 2', 'Venerdì', 'A', 'Day 1', 'Monday']))
      .toEqual(['Monday', 'Venerdì', 'Day 1', 'Day 2', 'A', 'B'])
  })
})

describe('sessions', () => {
  it('splits strength from activity, treating legacy rows as strength', () => {
    const rows = [{ kind: 'activity' as const }, { kind: 'strength' as const }, {}]
    expect(strengthSessions(rows)).toHaveLength(2)
    expect(activitySessions(rows)).toHaveLength(1)
  })
})

describe('normalizeRow', () => {
  it('coerces legacy string numbers on sets', () => {
    expect(normalizeRow('sets', { weight: '52,5', reps: '8', rpe: true }))
      .toMatchObject({ weight: 52.5, reps: 8, rpe: 10, toFailure: true })
  })
  it('keeps the plan-day fields on strength sessions, validated', () => {
    const out = normalizeRow<any>('sessions', {
      planDay: 'A', substitutions: { x: 'y', same: 'same', bad: 3 }, closedExercises: ['x', 'x', 4],
    })
    expect(out).toMatchObject({ kind: 'strength', planDay: 'A', substitutions: { x: 'y' }, closedExercises: ['x'] })
  })
  it('drops them on activity rows and when empty', () => {
    const activity = normalizeRow<any>('sessions', { kind: 'activity', planDay: 'A', substitutions: { x: 'y' } })
    expect(activity.planDay).toBeUndefined()
    expect(activity.substitutions).toBeUndefined()
    const empty = normalizeRow<any>('sessions', { substitutions: {}, closedExercises: [] })
    expect('substitutions' in empty || 'closedExercises' in empty).toBe(false)
  })
  it('cleans dayOrder on plans', () => {
    expect(normalizeRow<any>('plans', { rows: [], dayOrder: ['A', 'A', '', 3, 'B'] }).dayOrder).toEqual(['A', 'B'])
  })
})
