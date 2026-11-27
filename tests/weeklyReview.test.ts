import { describe, expect, it } from 'vitest'
import { buildWeeklyReview, clientWeek, type WeeklyReviewOptions } from '@/lib/coach/weeklyReview'
import { deriveNextWorkout, setsPerDay } from '@/lib/workout/nextWorkout'
import { at, exercise, row, session, sets } from './helpers'

const opts: WeeklyReviewOptions = {
  trainingMode: 'mixed',
  thresholdsByMode: { intensity: {}, volume: {}, mixed: {} } as WeeklyReviewOptions['thresholdsByMode'],
  maxFailurePct: 100,
  targetRpeWhenReducing: 8,
}

const exercises = [
  exercise('squat', { quadricipiti: 100 }),
  exercise('bench', { petto: 100 }),
  exercise('row', { dorsali: 100 }),
  exercise('curl', { bicipiti: 100 }),
  exercise('legpress', { quadricipiti: 100 }),
  exercise('plank', { core: 100 }),
]

// Squat is planned on both days: the old review ticked it off on both from a
// single session.
const plan = [
  row('A', 'squat'), row('A', 'bench'),
  row('B', 'squat'), row('B', 'row'), row('B', 'curl'),
]

// Wednesday 25 Nov 2026; the week runs Mon 23 – Sun 29.
const now = at(2026, 11, 25, 18)
const mon = at(2026, 11, 23, 18)
const tue = at(2026, 11, 24, 18)

describe('buildWeeklyReview — per-session attribution', () => {
  it('credits a session to the one plan day it ran', () => {
    const review = buildWeeklyReview(
      [session('s1', mon)],
      [...sets('s1', 'squat', 3, mon), ...sets('s1', 'bench', 3, mon)],
      exercises, plan, opts, now,
    )!
    expect(review.perPlanDay).toEqual([
      { day: 'A', plannedExercises: 2, doneExercises: 2 },
      { day: 'B', plannedExercises: 3, doneExercises: 0 },
    ])
  })

  it('lets the stored plan day win over the exercise overlap', () => {
    // Squat alone points at A (first best overlap); the athlete said B.
    const review = buildWeeklyReview(
      [session('s1', mon, { planDay: 'B' })],
      sets('s1', 'squat', 3, mon),
      exercises, plan, opts, now,
    )!
    expect(review.perPlanDay.find(d => d.day === 'A')!.doneExercises).toBe(0)
    expect(review.perPlanDay.find(d => d.day === 'B')!.doneExercises).toBe(1)
  })

  it('lists days in the plan order it is given', () => {
    const review = buildWeeklyReview(
      [session('s1', mon)], sets('s1', 'bench', 3, mon),
      exercises, plan, { ...opts, dayOrder: ['B', 'A'] }, now,
    )!
    expect(review.perPlanDay.map(d => d.day)).toEqual(['B', 'A'])
    expect(review.sessionsPlanned).toBe(2)
  })

  it('does not count an ordered day that has no exercises yet', () => {
    const review = buildWeeklyReview(
      [session('s1', mon)], sets('s1', 'bench', 3, mon),
      exercises, plan, { ...opts, dayOrder: ['A', 'C', 'B'] }, now,
    )!
    expect(review.perPlanDay.map(d => d.day)).toEqual(['A', 'B'])
  })
})

describe('buildWeeklyReview — substitutions', () => {
  const sessions = [session('s1', mon, { planDay: 'A', substitutions: { squat: 'legpress' } })]
  const logged = [
    ...sets('s1', 'legpress', 3, mon), ...sets('s1', 'bench', 3, mon), ...sets('s1', 'plank', 2, mon),
  ]

  it('counts the substitute as its planned exercise, on that session\'s day', () => {
    const review = buildWeeklyReview(sessions, logged, exercises, plan, opts, now)!
    expect(review.perPlanDay.find(d => d.day === 'A')).toEqual({ day: 'A', plannedExercises: 2, doneExercises: 2 })
    expect(review.perPlanDay.find(d => d.day === 'B')!.doneExercises).toBe(0)
  })

  it('keeps the substitute out of the off-plan list, but not a real extra', () => {
    const review = buildWeeklyReview(sessions, logged, exercises, plan, opts, now)!
    expect(review.offPlanExercises).toEqual(['plank'])
  })

  it('still flags the same exercise when another session adds it on top', () => {
    const review = buildWeeklyReview(
      [...sessions, session('s2', tue, { planDay: 'B' })],
      [...logged, ...sets('s2', 'row', 3, tue), ...sets('s2', 'legpress', 3, tue)],
      exercises, plan, opts, now,
    )!
    expect(review.offPlanExercises).toEqual(['legpress', 'plank'])
  })
})

describe('buildWeeklyReview — sessions counted on local days', () => {
  it('counts one training day for a session that runs past midnight', () => {
    const late = at(2026, 11, 24, 23)
    const sessions = [session('s1', late)]
    const logged = [
      ...sets('s1', 'squat', 2, late),
      ...sets('s1', 'bench', 2, at(2026, 11, 25, 0)),
    ]
    expect(buildWeeklyReview(sessions, logged, exercises, plan, opts, now)!.sessionsDone).toBe(1)
  })

  it('tells apart two local days that share a UTC date, or the reverse', () => {
    // 00:30 and 23:30 of the same local day straddle a UTC date boundary in
    // any zone that is not UTC; 23:30 and 00:30 the next day never share a
    // local day anywhere.
    const early = new Date(2026, 10, 24, 0, 30)
    const night = new Date(2026, 10, 24, 23, 30)
    const next = new Date(2026, 10, 25, 0, 30)
    const sessions = [session('s1', early), session('s2', night), session('s3', next)]
    const logged = [
      ...sets('s1', 'squat', 1, early), ...sets('s2', 'bench', 1, night), ...sets('s3', 'row', 1, next),
    ]
    expect(buildWeeklyReview(sessions, logged, exercises, plan, opts, now)!.sessionsDone).toBe(2)
  })

  it('ignores a session with no sets and one from last week', () => {
    const lastSunday = at(2026, 11, 22, 23)
    const sessions = [session('s1', mon), session('empty', tue), session('old', lastSunday)]
    const logged = [...sets('s1', 'squat', 3, mon), ...sets('old', 'bench', 3, lastSunday)]
    const review = buildWeeklyReview(sessions, logged, exercises, plan, opts, now)!
    expect(review.sessionsDone).toBe(1)
    expect(review.totalSets).toBe(3)
  })
})

describe('buildWeeklyReview — explicit week', () => {
  // What a UTC server must do for a browser in Auckland: the athlete's Monday
  // morning is still Sunday on the server's clock.
  const week = {
    start: '2026-11-22T11:00:00.000Z', // Mon 23 Nov 00:00 in Auckland (UTC+13)
    end: '2026-11-29T10:59:59.999Z',
    timeZone: 'Pacific/Auckland',
  }
  const mondayMorning = new Date('2026-11-22T19:00:00.000Z') // Mon 08:00 Auckland
  const mondayEvening = new Date('2026-11-23T06:00:00.000Z') // Mon 19:00 Auckland
  const sessions = [
    { id: 's1', date: mondayMorning.toISOString(), kind: 'strength' as const },
    { id: 's2', date: mondayEvening.toISOString(), kind: 'strength' as const },
  ]
  const logged = [...sets('s1', 'squat', 3, mondayMorning), ...sets('s2', 'bench', 3, mondayEvening)]

  it('reviews the week it is given, whatever the reference date says', () => {
    const farAway = at(2020, 1, 1)
    const review = buildWeeklyReview(sessions, logged, exercises, plan, { ...opts, week }, farAway)!
    expect(review.totalSets).toBe(6)
    expect(review.weekStart).toBe(week.start)
    expect(review.weekEnd).toBe(week.end)
  })

  it('counts days in the athlete\'s zone, not the machine\'s', () => {
    const review = buildWeeklyReview(sessions, logged, exercises, plan, { ...opts, week })!
    expect(review.sessionsDone).toBe(1)
  })

  it('falls back to the reference week when the range is unusable', () => {
    const review = buildWeeklyReview(
      [session('s1', mon)], sets('s1', 'squat', 3, mon), exercises, plan,
      { ...opts, week: { start: 'nope', end: 'nope' } }, now,
    )!
    expect(review.totalSets).toBe(3)
  })

  it('clientWeek describes the local week around the instant', () => {
    const w = clientWeek(now)
    expect(new Date(w.start)).toEqual(at(2026, 11, 23, 0))
    expect(new Date(w.end).getTime()).toBe(at(2026, 11, 30, 0).getTime() - 1)
    expect(w.now).toBe(now.toISOString())
  })
})

describe('deriveNextWorkout', () => {
  const days = ['A', 'B']

  it('proposes the first plan day not done this week', () => {
    const next = deriveNextWorkout({
      days, planRows: plan, now,
      sessions: [session('s1', mon, { planDay: 'A' })],
      sets: sets('s1', 'bench', 3, mon),
    })!
    expect(next).toMatchObject({ day: 'B', state: 'next', exerciseCount: 3 })
  })

  it('reports today\'s day as done once it has a set', () => {
    const next = deriveNextWorkout({
      days, planRows: plan, now,
      sessions: [session('s1', now, { planDay: 'A' })],
      sets: sets('s1', 'bench', 1, now),
    })!
    expect(next).toMatchObject({ day: 'A', state: 'doneToday' })
  })

  it('does not call today done for a session logged late yesterday', () => {
    const lateYesterday = at(2026, 11, 24, 23)
    const next = deriveNextWorkout({
      days, planRows: plan, now: at(2026, 11, 25, 1),
      sessions: [session('s1', lateYesterday, { planDay: 'A' })],
      sets: sets('s1', 'bench', 3, lateYesterday),
    })!
    expect(next).toMatchObject({ day: 'B', state: 'next' })
  })

  it('restarts the sequence when the whole week is done', () => {
    const next = deriveNextWorkout({
      days, planRows: plan, now,
      sessions: [session('s1', mon, { planDay: 'A' }), session('s2', tue, { planDay: 'B' })],
      sets: [...sets('s1', 'bench', 3, mon), ...sets('s2', 'row', 3, tue)],
    })!
    expect(next).toMatchObject({ day: 'A', state: 'weekDone' })
  })

  it('ignores an activity logged today', () => {
    const next = deriveNextWorkout({
      days, planRows: plan, now,
      sessions: [session('run', now, { kind: 'activity', activity: 'run' })],
      sets: [],
    })!
    expect(next).toMatchObject({ day: 'A', state: 'next' })
  })

  it('has nothing to propose without a plan', () => {
    expect(deriveNextWorkout({ days: [], planRows: [], sessions: [], sets: [], now })).toBeNull()
  })
})

describe('setsPerDay', () => {
  it('puts a late-evening session on its own local day', () => {
    const late = new Date(2026, 10, 24, 23, 30)
    const early = new Date(2026, 10, 25, 0, 30)
    const out = setsPerDay(
      [session('s1', late), session('s2', early)],
      [...sets('s1', 'squat', 4, late), ...sets('s2', 'bench', 2, early)],
      3, now,
    )
    expect(out.map(d => d.sets)).toEqual([0, 4, 2])
    expect(out.map(d => d.date.getDate())).toEqual([23, 24, 25])
  })
})
