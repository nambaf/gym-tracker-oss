import { describe, expect, it } from 'vitest'
import { pickPlanDay, resolveSessionPlanDay, usualExtrasForDay, weekDayStatus, exercisesByDay } from '@/lib/workout/planDay'
import { planDays } from '@/lib/plan/days'
import { at, row, session, sets } from './helpers'

// Week of Monday 23 Nov 2026. Plan days are named after weekdays on purpose:
// the name must not influence which day is proposed.
const days = ['Lunedì', 'Mercoledì', 'Venerdì']
const planRows = [
  row('Lunedì', 'squat'), row('Lunedì', 'panca'),
  row('Mercoledì', 'stacco'), row('Mercoledì', 'lat'),
  row('Venerdì', 'military'), row('Venerdì', 'curl'),
]

describe('pickPlanDay', () => {
  it('proposes the first day of the plan on a fresh week, whatever the weekday', () => {
    expect(pickPlanDay({ days, planRows, sessions: [], sets: [], now: at(2026, 11, 25) })).toBe('Lunedì')
  })

  it('proposes the first day not done this week when the schedule drifted', () => {
    // Monday's workout done on Tuesday; on Thursday the next one is Wednesday's.
    const tue = at(2026, 11, 24)
    const sessions = [session('s1', tue)]
    const all = [...sets('s1', 'squat', 3, tue), ...sets('s1', 'panca', 3, tue)]
    expect(pickPlanDay({ days, planRows, sessions, sets: all, now: at(2026, 11, 26) })).toBe('Mercoledì')
    // Even on the Friday, the calendar name does not jump the queue.
    expect(pickPlanDay({ days, planRows, sessions, sets: all, now: at(2026, 11, 27) })).toBe('Mercoledì')
  })

  it('ignores last week when deciding what is still open', () => {
    const lastFri = at(2026, 11, 20)
    const sessions = [session('s0', lastFri)]
    const all = sets('s0', 'military', 3, lastFri)
    expect(pickPlanDay({ days, planRows, sessions, sets: all, now: at(2026, 11, 23) })).toBe('Lunedì')
  })

  it('keeps the day stored on today\'s session even if the sets point elsewhere', () => {
    // Thursday, doing Wednesday's day, with substitutes borrowed from Friday.
    const now = at(2026, 11, 26, 19)
    const sessions = [session('s2', now, { planDay: 'Mercoledì' })]
    const all = [...sets('s2', 'military', 3, now), ...sets('s2', 'curl', 3, now), ...sets('s2', 'stacco', 1, now)]
    expect(pickPlanDay({ days, planRows, sessions, sets: all, now })).toBe('Mercoledì')
  })

  it('infers today\'s day from the sets for a session with no stored day', () => {
    const now = at(2026, 11, 26, 19)
    const sessions = [session('s2', now)]
    expect(pickPlanDay({ days, planRows, sessions, sets: sets('s2', 'curl', 2, now), now })).toBe('Venerdì')
  })

  it('wraps to the day after the last one trained once the week is complete', () => {
    const mon = at(2026, 11, 23), tue = at(2026, 11, 24), wed = at(2026, 11, 25)
    const sessions = [session('a', mon), session('b', tue), session('c', wed)]
    const all = [...sets('a', 'squat', 3, mon), ...sets('b', 'stacco', 3, tue), ...sets('c', 'curl', 3, wed)]
    expect(pickPlanDay({ days, planRows, sessions, sets: all, now: at(2026, 11, 27) })).toBe('Lunedì')
  })

  it('never proposes a day that has no exercises yet', () => {
    expect(pickPlanDay({ days: ['Vuoto', ...days], planRows, sessions: [], sets: [], now: at(2026, 11, 25) })).toBe('Lunedì')
  })

  it('does not count activity rows or sessions without sets', () => {
    const mon = at(2026, 11, 23)
    const sessions = [session('run', mon, { kind: 'activity', activity: 'run' }), session('empty', mon)]
    expect(pickPlanDay({ days, planRows, sessions, sets: [], now: at(2026, 11, 24) })).toBe('Lunedì')
  })
})

describe('resolveSessionPlanDay', () => {
  const byDay = exercisesByDay(planRows)
  it('falls back to inference when the stored day left the plan', () => {
    expect(resolveSessionPlanDay({ planDay: 'Rinominato' }, new Set(['lat']), days, byDay)).toBe('Mercoledì')
  })
  it('returns null when nothing matches', () => {
    expect(resolveSessionPlanDay({}, new Set(['dips']), days, byDay)).toBeNull()
  })
})

describe('weekDayStatus', () => {
  it('marks each day with the date it was done this week', () => {
    const tue = at(2026, 11, 24)
    const status = weekDayStatus({
      days, planRows, sessions: [session('s1', tue)], sets: sets('s1', 'squat', 3, tue), now: at(2026, 11, 26),
    })
    expect(status).toEqual([
      { day: 'Lunedì', doneOn: '2026-11-24' },
      { day: 'Mercoledì', doneOn: null },
      { day: 'Venerdì', doneOn: null },
    ])
  })
})

describe('usualExtrasForDay', () => {
  it('lists extras but not substitutes', () => {
    const d1 = at(2026, 11, 9), d2 = at(2026, 11, 16)
    const sessions = [
      session('a', d1, { planDay: 'Lunedì' }),
      session('b', d2, { planDay: 'Lunedì', substitutions: { panca: 'dips' } }),
    ]
    const all = [
      ...sets('a', 'squat', 3, d1), ...sets('a', 'polpacci', 2, d1),
      ...sets('b', 'squat', 3, d2), ...sets('b', 'dips', 3, d2), ...sets('b', 'polpacci', 2, d2),
    ]
    expect(usualExtrasForDay({ day: 'Lunedì', days, planRows, sessions, sets: all, now: at(2026, 11, 23) }))
      .toEqual(['polpacci'])
  })
})

describe('planDays', () => {
  it('reads a legacy plan in sortDays order', () => {
    expect(planDays({ rows: [row('Venerdì', 'x'), row('Lunedì', 'y')] })).toEqual(['Lunedì', 'Venerdì'])
  })
  it('honours dayOrder, keeps empty days and appends unknown ones', () => {
    expect(planDays({ rows: [row('B', 'x'), row('A', 'y'), row('Z', 'z')], dayOrder: ['B', 'Vuoto', 'A'] }))
      .toEqual(['B', 'Vuoto', 'A', 'Z'])
  })
  it('handles a missing plan', () => {
    expect(planDays(null)).toEqual([])
  })
})
