/**
 * The tools themselves — pure functions over a loaded `Dataset`.
 *
 * Kept transport-agnostic on purpose: `server.ts` wires them to stdio today,
 * and a Next.js route can wire the same functions to Streamable HTTP later
 * without touching anything in this file.
 *
 * Design rule: every tool returns an AGGREGATE, never raw table rows. The
 * `sets` table grows by ~50 rows a week; handing it over unaggregated would
 * burn the model's context to answer "how is my bench going". The other rule
 * is that anything time-series is keyed on a `YYYY-MM-DD` `date` field, so a
 * second MCP server (nutrition) can be joined against it day by day.
 */
import { MUSCLE_CONTRIBUTION_THRESHOLD, MuscleGroup, normalizeMuscle, parsePrimaryMuscles } from '../../lib/bodyMapUtils'
import { buildWeeklyReview } from '../../lib/coach/weeklyReview'
import { localDayKey } from '../../lib/dateUtils'
import { epley1RM } from '../../lib/progress'
import { buildExerciseBests, MAX_REPS_FOR_E1RM } from '../../lib/records'
import { activityMinutes, isActivitySession } from '../../lib/sessions'
import { intensityOf, isFailureSet } from '../../lib/setNotes'
import type { Exercise, Plan, Session, SetEntry } from '../../lib/models'
import type { Dataset } from './ddb'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Local calendar day of a stored ISO timestamp. Matches what the app displays. */
function dayOf(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : localDayKey(d)
}

function setsBySession(sets: SetEntry[]): Map<string, SetEntry[]> {
  const out = new Map<string, SetEntry[]>()
  for (const s of sets) {
    const list = out.get(s.sessionId)
    if (list) list.push(s)
    else out.set(s.sessionId, [s])
  }
  return out
}

/** Sets per muscle group, counting a set once for every muscle above threshold. */
function muscleTally(sets: SetEntry[], exercises: Exercise[]): Record<string, number> {
  const byId = new Map(exercises.map(e => [e.id, e]))
  const out: Record<string, number> = {}
  for (const s of sets) {
    const ex = byId.get(s.exerciseId)
    if (!ex) continue
    for (const { muscle, weight } of parsePrimaryMuscles(ex.primaryMuscles)) {
      if (weight < MUSCLE_CONTRIBUTION_THRESHOLD) continue
      const group = normalizeMuscle(muscle)
      if (!group) continue
      out[group] = (out[group] || 0) + 1
    }
  }
  return out
}

/**
 * Sum of weight × reps.
 *
 * Body weight is nowhere in this schema, so a pull-up set contributes only the
 * added load. Tonnage therefore understates any bodyweight work — see
 * `bodyweightExercises` on the returned rows before treating it as work done.
 */
function tonnage(sets: SetEntry[]): number {
  return Math.round(sets.reduce((acc, s) => acc + Number(s.weight) * Number(s.reps), 0))
}

/**
 * Exercises where load is not the variable being trained.
 *
 * Same rule as `lib/workout/prompts/context.ts`, deliberately: the max load is
 * not a good test, because weighted pull-ups carry a real load on some sets and
 * a placeholder 1 kg on the rest. If most sets are unloaded, quoting an
 * estimated 1RM of "1.3 kg" is worse than quoting nothing.
 */
function bodyweightExerciseIds(sets: SetEntry[]): Set<string> {
  const counts = new Map<string, { unloaded: number; total: number }>()
  for (const s of sets) {
    const w = Number(s.weight)
    if (!Number.isFinite(w)) continue
    const c = counts.get(s.exerciseId) ?? { unloaded: 0, total: 0 }
    c.total += 1
    if (w <= 1) c.unloaded += 1
    counts.set(s.exerciseId, c)
  }
  const out = new Set<string>()
  for (const [id, c] of counts) {
    if (c.total > 0 && c.unloaded / c.total > 0.5) out.add(id)
  }
  return out
}

function avg(values: number[]): number | null {
  const usable = values.filter(v => Number.isFinite(v))
  if (usable.length === 0) return null
  return Math.round((usable.reduce((a, b) => a + b, 0) / usable.length) * 10) / 10
}

function withinRange(day: string, from?: string, to?: string): boolean {
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

function resolveExercise(exercises: Exercise[], query: string): Exercise | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return (
    exercises.find(e => e.id.toLowerCase() === q) ||
    exercises.find(e => e.name.toLowerCase() === q) ||
    exercises.find(e => e.name.toLowerCase().includes(q)) ||
    null
  )
}

// ── get_training_load ────────────────────────────────────────────────────────

export type TrainingLoadDay = {
  date: string
  trained: boolean
  strengthSessions: number
  totalSets: number
  tonnageKg: number
  durationMin: number | null
  /**
   * Mean perceived effort, 1–5. NOT derived from `rpe`: that field only ever
   * holds 10 or nothing — it is a failure marker written next to the legacy
   * "cedimento" note, not a graded scale. Averaging it would report every
   * single day as maximal. `intensity` is the scale the athlete actually sets.
   */
  avgIntensity: number | null
  failureSets: number
  musclesBySets: Record<string, number>
  exercises: string[]
  /**
   * Exercises trained that day whose load is mostly bodyweight. Their real
   * work is missing from `tonnageKg` — body weight is not stored anywhere in
   * this app. Do not read tonnage as total work on a day that lists any.
   */
  bodyweightExercises: string[]
  activities: Array<{
    type: string
    distanceKm: number | null
    durationMin: number | null
    effort: number | null
  }>
}

/**
 * One row per calendar day on which *something* happened. This is the tool
 * meant to be joined against nutrition data: tonnage, duration and activity
 * together are the usable proxy for the day's energy demand.
 */
export function getTrainingLoad(data: Dataset, opts: { from?: string; to?: string }): TrainingLoadDay[] {
  const { from, to } = opts
  const bySession = setsBySession(data.sets)
  const nameOf = new Map(data.exercises.map(e => [e.id, e.name]))
  const days = new Map<string, TrainingLoadDay>()
  // Averaging per session and then averaging again would weight a 3-set
  // session like a 20-set one, so every rating of the day is pooled here first.
  const intensityByDay = new Map<string, number[]>()

  const blank = (date: string): TrainingLoadDay => ({
    date,
    trained: false,
    strengthSessions: 0,
    totalSets: 0,
    tonnageKg: 0,
    durationMin: null,
    avgIntensity: null,
    failureSets: 0,
    musclesBySets: {},
    exercises: [],
    bodyweightExercises: [],
    activities: [],
  })

  const bodyweightIds = bodyweightExerciseIds(data.sets)

  for (const session of data.sessions) {
    const day = dayOf(session.date)
    if (!day || !withinRange(day, from, to)) continue
    const row = days.get(day) || blank(day)
    days.set(day, row)

    const minutes = activityMinutes(session)

    if (isActivitySession(session)) {
      row.activities.push({
        type: session.activity || 'other',
        distanceKm: session.distanceKm ?? null,
        durationMin: minutes,
        effort: session.effort ?? null,
      })
      continue
    }

    // Strength session: the sets carry the real content.
    const sets = bySession.get(session.id) || []
    row.trained = true
    row.strengthSessions += 1
    row.totalSets += sets.length
    row.tonnageKg += tonnage(sets)
    row.failureSets += sets.filter(isFailureSet).length
    if (minutes !== null) row.durationMin = (row.durationMin || 0) + minutes

    for (const [muscle, count] of Object.entries(muscleTally(sets, data.exercises))) {
      row.musclesBySets[muscle] = (row.musclesBySets[muscle] || 0) + count
    }
    for (const s of sets) {
      const name = nameOf.get(s.exerciseId)
      if (!name) continue
      if (!row.exercises.includes(name)) row.exercises.push(name)
      if (bodyweightIds.has(s.exerciseId) && !row.bodyweightExercises.includes(name)) {
        row.bodyweightExercises.push(name)
      }
    }
    const pooled = intensityByDay.get(day) || []
    pooled.push(...sets.map(intensityOf).filter((n): n is NonNullable<typeof n> => n !== undefined))
    intensityByDay.set(day, pooled)
  }

  for (const [day, ratings] of intensityByDay) {
    const row = days.get(day)
    if (row) row.avgIntensity = avg(ratings)
  }

  return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ── get_weekly_review ────────────────────────────────────────────────────────

/**
 * The same review the app shows on its dashboard, so the coach in chat and the
 * coach in the app never disagree. `weeksAgo: 0` is the current week.
 */
export function getWeeklyReview(data: Dataset, opts: { weeksAgo?: number }) {
  const weeksAgo = Math.max(0, Math.floor(opts.weeksAgo ?? 0))
  const reference = new Date()
  reference.setDate(reference.getDate() - weeksAgo * 7)

  const activePlan = data.plans.find(p => p.isActive)
  const review = buildWeeklyReview(
    data.sessions,
    data.sets,
    data.exercises,
    activePlan?.rows || [],
    {
      trainingMode: data.settings.trainingMode,
      thresholdsByMode: data.settings.thresholdsByMode,
      maxFailurePct: data.settings.maxFailurePct,
      targetRpeWhenReducing: data.settings.targetRpeWhenReducing,
    },
    reference
  )
  if (!review) return { available: false, reason: 'No active plan or no data for that week.' }

  return {
    available: true,
    // Reduced to plain day keys so a week lines up with `get_training_load`
    // rows and with whatever a nutrition source returns.
    weekStart: dayOf(review.weekStart),
    weekEnd: dayOf(review.weekEnd),
    adherence: { done: review.sessionsDone, planned: review.sessionsPlanned },
    totalSets: review.totalSets,
    volumeKg: review.volume,
    failurePct: review.failurePct,
    coverage: review.coverage.map(c => ({ muscle: c.muscle, sets: c.sets, weeklyTarget: c.target })),
    untouchedMuscles: review.coverage.filter(c => c.sets === 0 && c.target !== null).map(c => c.muscle),
    perPlanDay: review.perPlanDay,
    offPlanExercises: review.offPlanExercises,
    // Reported, never counted: activities explain a heavy week without
    // inflating adherence or muscle coverage.
    activities: review.activities.map(a => ({
      date: dayOf(a.date),
      type: a.activity || 'other',
      distanceKm: a.distanceKm ?? null,
      durationMin: activityMinutes(a),
      effort: a.effort ?? null,
    })),
    findings: review.findings.map(f => ({
      lever: f.lever,
      severity: f.severity,
      // The app renders these through the i18n dictionary; the key plus its
      // values is enough for a model to state the finding in any language.
      messageKey: f.messageKey,
      values: f.values,
    })),
    proposals: review.proposals,
  }
}

// ── get_exercise_progress ────────────────────────────────────────────────────

export function getExerciseProgress(data: Dataset, opts: { exercise: string; limit?: number }) {
  const exercise = resolveExercise(data.exercises, opts.exercise)
  if (!exercise) {
    return {
      found: false,
      hint: 'No exercise matched. Call list_exercises to see the available names.',
    }
  }

  const limit = Math.max(1, Math.min(opts.limit ?? 12, 60))
  const mine = data.sets.filter(s => s.exerciseId === exercise.id)
  if (mine.length === 0) return { found: true, exercise: exercise.name, sessions: [], note: 'Never logged.' }

  // Best set per calendar day, ranked by estimated 1RM. One point per session
  // is what makes a trend readable; every set would just be noise.
  const byDay = new Map<string, SetEntry[]>()
  for (const s of mine) {
    const day = dayOf(s.ts)
    if (!day) continue
    const list = byDay.get(day)
    if (list) list.push(s)
    else byDay.set(day, [s])
  }

  const isBodyweight = bodyweightExerciseIds(mine).has(exercise.id)

  const history = Array.from(byDay.entries())
    .map(([date, sets]) => {
      // On a bodyweight exercise the hardest set is the one with the most
      // reps; ranking by a 1RM built from the added load alone would crown a
      // 1 kg × 3 set over a 0 kg × 15 one.
      const scored = sets
        .map(s => ({ s, e1rm: Number(s.reps) <= MAX_REPS_FOR_E1RM ? epley1RM(Number(s.weight), Number(s.reps)) : 0 }))
        .sort((a, b) =>
          isBodyweight
            ? Number(b.s.reps) - Number(a.s.reps) || Number(b.s.weight) - Number(a.s.weight)
            : b.e1rm - a.e1rm || Number(b.s.weight) - Number(a.s.weight)
        )
      const top = scored[0]
      return {
        date,
        sets: sets.length,
        // `rpe` is deliberately not surfaced — see the note on `avgIntensity`.
        topSet: {
          weightKg: Number(top.s.weight),
          reps: Number(top.s.reps),
          intensity: intensityOf(top.s) ?? null,
          toFailure: isFailureSet(top.s),
        },
        estimated1RM: isBodyweight ? null : Math.round(top.e1rm * 10) / 10,
        tonnageKg: tonnage(sets),
        failureSets: sets.filter(isFailureSet).length,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const best = buildExerciseBests(mine).get(exercise.id)

  return {
    found: true,
    exercise: exercise.name,
    exerciseId: exercise.id,
    totalSetsLogged: mine.length,
    // Load-based numbers are suppressed rather than reported wrong: the stored
    // weight is the ADDED load only, so a 1RM estimate on pull-ups would read
    // as a couple of kilos. Progress here is reps and total volume, not load.
    bodyweightExercise: isBodyweight,
    personalBests: isBodyweight
      ? null
      : best
      ? {
          byEstimated1RM: { e1rm: Math.round(best.byE1rm.e1rm * 10) / 10, weightKg: best.byE1rm.weight, reps: best.byE1rm.reps, date: dayOf(best.byE1rm.ts) },
          byLoad: { weightKg: best.byWeight.weight, reps: best.byWeight.reps, date: dayOf(best.byWeight.ts) },
        }
      : null,
    history: history.slice(-limit),
  }
}

// ── get_recent_sessions ──────────────────────────────────────────────────────

export function getRecentSessions(data: Dataset, opts: { limit?: number; includeActivities?: boolean }) {
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 50))
  const includeActivities = opts.includeActivities ?? true
  const bySession = setsBySession(data.sets)
  const nameOf = new Map(data.exercises.map(e => [e.id, e.name]))

  const rows = data.sessions
    .filter(s => includeActivities || !isActivitySession(s))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit)
    .map((session: Session) => {
      const date = dayOf(session.date)
      if (isActivitySession(session)) {
        return {
          date,
          kind: 'activity' as const,
          activity: session.activity || 'other',
          distanceKm: session.distanceKm ?? null,
          durationMin: activityMinutes(session),
          effort: session.effort ?? null,
          note: session.note || null,
        }
      }
      const sets = bySession.get(session.id) || []
      const byExercise = new Map<string, SetEntry[]>()
      for (const s of sets) {
        const list = byExercise.get(s.exerciseId)
        if (list) list.push(s)
        else byExercise.set(s.exerciseId, [s])
      }
      return {
        date,
        kind: 'strength' as const,
        durationMin: activityMinutes(session),
        totalSets: sets.length,
        tonnageKg: tonnage(sets),
        note: session.note || null,
        exercises: Array.from(byExercise.entries()).map(([exerciseId, list]) => ({
          name: nameOf.get(exerciseId) || exerciseId,
          sets: list.length,
          topWeightKg: Math.max(...list.map(s => Number(s.weight))),
          repsPerSet: list.map(s => Number(s.reps)),
          failureSets: list.filter(isFailureSet).length,
          comments: list.map(s => s.comment).filter((c): c is string => !!c),
        })),
      }
    })

  return rows
}

// ── get_active_plan ──────────────────────────────────────────────────────────

export function getActivePlan(data: Dataset) {
  const plan: Plan | undefined = data.plans.find(p => p.isActive)
  if (!plan) return { active: false, hint: 'No plan is currently active.' }
  const nameOf = new Map(data.exercises.map(e => [e.id, e.name]))

  const byDay = new Map<string, typeof plan.rows>()
  for (const row of plan.rows) {
    const list = byDay.get(row.day)
    if (list) list.push(row)
    else byDay.set(row.day, [row])
  }

  return {
    active: true,
    name: plan.name,
    description: plan.description || null,
    createdAt: dayOf(plan.createdAt),
    trainingMode: data.settings.trainingMode,
    days: Array.from(byDay.entries()).map(([day, rows]) => ({
      day,
      exercises: rows
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(r => ({
          name: nameOf.get(r.exerciseId) || r.exerciseId,
          targetSets: r.targetSets,
          targetReps: r.targetReps,
          targetRpe: r.targetRpe ?? null,
          note: r.note || null,
        })),
    })),
  }
}

// ── list_exercises ───────────────────────────────────────────────────────────

export function listExercises(data: Dataset, opts: { query?: string; onlyLogged?: boolean }) {
  const q = (opts.query || '').trim().toLowerCase()
  const logged = new Set(data.sets.map(s => s.exerciseId))

  return data.exercises
    .filter(e => (opts.onlyLogged ? logged.has(e.id) : true))
    .filter(e => (q ? e.name.toLowerCase().includes(q) || e.id.toLowerCase() === q : true))
    .map(e => ({
      id: e.id,
      name: e.name,
      primaryMuscles: parsePrimaryMuscles(e.primaryMuscles)
        .filter(m => m.weight >= MUSCLE_CONTRIBUTION_THRESHOLD)
        .map(m => normalizeMuscle(m.muscle))
        .filter((m): m is MuscleGroup => !!m),
      everLogged: logged.has(e.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
