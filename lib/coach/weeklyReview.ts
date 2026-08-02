/**
 * Weekly review: what the past week looked like against the plan, and what to
 * change for the next one.
 *
 * Deterministic on purpose. `AI_PROVIDER=off` is a legitimate configuration, so
 * no core feature may depend on a model being reachable — an AI provider can
 * only rephrase what this computes, never supply it.
 *
 * Pure function of sessions + sets + exercises + plan, which is why the review
 * needs no storage of its own: it is recomputed from data that already exists.
 */
import type { Exercise, PlanRow, Session, SetEntry } from '../models'
import type { MuscleGroup } from '../bodyMapUtils'
import { MUSCLE_CONTRIBUTION_THRESHOLD, normalizeMuscle, parsePrimaryMuscles } from '../bodyMapUtils'
import { isFailureSet } from '../setNotes'
import { weekBounds } from '../dateUtils'
import type { ThresholdsMatrix, TrainingMode } from '../settings/types'

export type ReviewSeverity = 'critical' | 'warning' | 'good'

/** Something worth telling the athlete, whether or not it maps to a plan edit. */
export type ReviewFinding = {
  id: string
  lever: 'coverage' | 'adherence' | 'failure'
  severity: ReviewSeverity
  /** Dictionary key under `coach.findings`. */
  messageKey: string
  /** Values interpolated into the message. */
  values: Record<string, string | number>
}

/** A concrete edit the athlete can accept with one tap. */
export type ReviewProposal =
  | { id: string; kind: 'adjust-sets'; rowId: string; exerciseName: string; day: string; from: number; to: number }
  | { id: string; kind: 'adjust-rpe'; rowIds: string[]; from: number; to: number; affected: number }
  | { id: string; kind: 'move-exercise'; rowId: string; exerciseName: string; fromDay: string; toDay: string }

export type WeeklyReview = {
  weekStart: string
  weekEnd: string
  sessionsDone: number
  sessionsPlanned: number
  totalSets: number
  volume: number
  failurePct: number | null
  /** Sets per muscle group over the week, weighted the same way the charts do. */
  coverage: Array<{ muscle: MuscleGroup; sets: number; target: number | null }>
  perPlanDay: Array<{ day: string; plannedExercises: number; doneExercises: number }>
  offPlanExercises: string[]
  findings: ReviewFinding[]
  proposals: ReviewProposal[]
}

export type WeeklyReviewOptions = {
  trainingMode: TrainingMode
  thresholdsByMode: ThresholdsMatrix
  /** Above this share of sets taken to failure, recovery becomes the limiter. */
  maxFailurePct: number
  /** Rep-target RPE proposed when the failure share is too high. */
  targetRpeWhenReducing: number
}

function inRange(iso: string | undefined, start: Date, end: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return !Number.isNaN(d.getTime()) && d >= start && d <= end
}

/** Sets per muscle group, counting a set once for every muscle above threshold. */
function coverageOf(sets: SetEntry[], exercises: Exercise[]): Map<MuscleGroup, number> {
  const byId = new Map(exercises.map(e => [e.id, e]))
  const out = new Map<MuscleGroup, number>()
  for (const s of sets) {
    const ex = byId.get(s.exerciseId)
    if (!ex) continue
    for (const { muscle, weight } of parsePrimaryMuscles(ex.primaryMuscles)) {
      if (weight < MUSCLE_CONTRIBUTION_THRESHOLD) continue
      const group = normalizeMuscle(muscle)
      if (!group) continue
      out.set(group, (out.get(group) || 0) + 1)
    }
  }
  return out
}

/** Which plan days contain at least one exercise hitting this muscle. */
function daysCovering(muscle: MuscleGroup, planRows: PlanRow[], exercises: Exercise[]): string[] {
  const byId = new Map(exercises.map(e => [e.id, e]))
  const days = new Set<string>()
  for (const r of planRows) {
    const ex = byId.get(r.exerciseId)
    if (!ex) continue
    const hit = parsePrimaryMuscles(ex.primaryMuscles)
      .some(m => m.weight >= MUSCLE_CONTRIBUTION_THRESHOLD && normalizeMuscle(m.muscle) === muscle)
    if (hit && r.day) days.add(String(r.day))
  }
  return Array.from(days)
}

export function buildWeeklyReview(
  sessions: Session[],
  sets: SetEntry[],
  exercises: Exercise[],
  planRows: PlanRow[],
  opts: WeeklyReviewOptions,
  reference: Date = new Date()
): WeeklyReview | null {
  const { monday, sunday } = weekBounds(reference)

  const weekSessions = sessions.filter(s => inRange(s.date, monday, sunday))
  const sessionIds = new Set(weekSessions.map(s => s.id))
  const weekSets = sets.filter(s => sessionIds.has(s.sessionId))
  if (weekSets.length === 0) return null

  const byId = new Map(exercises.map(e => [e.id, e]))
  const trainedDays = new Set(weekSets.map(s => new Date(s.ts).toDateString()))
  const doneExerciseIds = new Set(weekSets.map(s => s.exerciseId))

  const planDays = Array.from(new Set(planRows.map(r => String(r.day)).filter(Boolean)))
  const perPlanDay = planDays.map(day => {
    const planned = planRows.filter(r => String(r.day) === day)
    return {
      day,
      plannedExercises: planned.length,
      doneExercises: planned.filter(r => doneExerciseIds.has(r.exerciseId)).length,
    }
  })

  /**
   * A plan day counts as trained only if a meaningful part of it happened.
   * One exercise out of nine is a day you skipped after a warm-up, and
   * treating it as trained hid the fact that the day never really runs.
   */
  const isTrainedDay = (d: { doneExercises: number; plannedExercises: number }) =>
    d.doneExercises >= 2 || (d.plannedExercises > 0 && d.doneExercises / d.plannedExercises >= 0.5)

  const trainedPlanDays = perPlanDay
    .filter(isTrainedDay)
    .sort((a, b) => b.doneExercises - a.doneExercises)
    .map(d => d.day)

  const plannedIds = new Set(planRows.map(r => r.exerciseId))
  const offPlanExercises = Array.from(doneExerciseIds)
    .filter(id => !plannedIds.has(id))
    .map(id => byId.get(id)?.name || id)
    .sort()

  const thresholds = opts.thresholdsByMode[opts.trainingMode] || {}
  const cov = coverageOf(weekSets, exercises)
  const planned = coverageOf(
    // A plan row contributes `targetSets` sets, so expand it into that many.
    planRows.flatMap(r => Array.from({ length: Number(r.targetSets) || 0 }, () => ({
      id: '', sessionId: '', exerciseId: r.exerciseId, weight: 0, reps: 1, ts: '',
    } as SetEntry))),
    exercises
  )
  const muscles = Array.from(new Set([...cov.keys(), ...planned.keys(), ...Object.keys(thresholds) as MuscleGroup[]]))
  const coverage = muscles
    .map(muscle => ({
      muscle,
      sets: cov.get(muscle) || 0,
      target: (thresholds as any)[muscle]?.hypertrophy ?? null,
    }))
    .sort((a, b) => b.sets - a.sets)

  const failureSets = weekSets.filter(isFailureSet).length
  const failurePct = weekSets.length ? Math.round((failureSets / weekSets.length) * 100) : null
  const volume = weekSets.reduce((sum, s) => sum + Number(s.weight) * Number(s.reps), 0)

  const findings: ReviewFinding[] = []
  const proposals: ReviewProposal[] = []

  // ── Lever 1: muscle coverage ──────────────────────────────────────────────
  // Muscles the plan covers but the week did not touch at all are the loudest
  // signal: the work exists on paper and never happens.
  // Ordered by how much work the plan says is missing: a leg group with a
  // target of 18 matters more than forearms with a target of 6, and sorting by
  // set count leaves every zero tied.
  const untouched = coverage
    .filter(c => c.sets === 0 && planned.get(c.muscle))
    .sort((a, b) => (b.target ?? 0) - (a.target ?? 0))
  if (untouched.length > 0) {
    findings.push({
      id: 'coverage-zero',
      lever: 'coverage',
      severity: 'critical',
      messageKey: 'coverageZero',
      values: { muscles: untouched.map(c => c.muscle).join(', '), count: untouched.length },
    })
    // If the muscle only lives on a day the athlete keeps skipping, moving one
    // exercise onto the day they actually train is worth more than any nagging.
    if (trainedPlanDays.length > 0) {
      for (const c of untouched.slice(0, 2)) {
        const candidateDays = daysCovering(c.muscle, planRows, exercises)
        const orphanDay = candidateDays.find(d => !trainedPlanDays.includes(d))
        if (!orphanDay) continue
        const row = planRows.find(r =>
          String(r.day) === orphanDay &&
          parsePrimaryMuscles(byId.get(r.exerciseId)?.primaryMuscles)
            .some(m => m.weight >= MUSCLE_CONTRIBUTION_THRESHOLD && normalizeMuscle(m.muscle) === c.muscle)
        )
        if (!row?.id) continue
        proposals.push({
          id: `move-${row.id}`,
          kind: 'move-exercise',
          rowId: String(row.id),
          exerciseName: byId.get(row.exerciseId)?.name || row.exerciseId,
          fromDay: orphanDay,
          toDay: trainedPlanDays[0],
        })
      }
    }
  }

  // Muscles trained but short of the hypertrophy threshold: add sets where the
  // plan already covers them, on a day actually being trained.
  const short = coverage.filter(c => c.target !== null && c.sets > 0 && c.sets < (c.target as number))
  const trainedDayNames = trainedPlanDays
  for (const c of short.slice(0, 3)) {
    const deficit = (c.target as number) - c.sets
    findings.push({
      id: `coverage-short-${c.muscle}`,
      lever: 'coverage',
      severity: 'warning',
      messageKey: 'coverageShort',
      values: { muscle: c.muscle, sets: c.sets, target: c.target as number, deficit },
    })
    const row = planRows
      .filter(r =>
        trainedDayNames.includes(String(r.day)) &&
        doneExerciseIds.has(r.exerciseId) &&
        parsePrimaryMuscles(byId.get(r.exerciseId)?.primaryMuscles)
          .some(m => m.weight >= MUSCLE_CONTRIBUTION_THRESHOLD && normalizeMuscle(m.muscle) === c.muscle)
      )
      .sort((a, b) => trainedDayNames.indexOf(String(a.day)) - trainedDayNames.indexOf(String(b.day)))[0]
    if (!row?.id) continue
    const from = Number(row.targetSets) || 0
    proposals.push({
      id: `sets-${row.id}`,
      kind: 'adjust-sets',
      rowId: String(row.id),
      exerciseName: byId.get(row.exerciseId)?.name || row.exerciseId,
      day: String(row.day),
      from,
      to: from + Math.min(deficit, 2),
    })
  }

  // ── Lever 2: frequency and adherence ──────────────────────────────────────
  const sessionsDone = trainedDays.size
  const sessionsPlanned = planDays.length
  if (sessionsPlanned > 0 && sessionsDone < sessionsPlanned) {
    findings.push({
      id: 'adherence-frequency',
      lever: 'adherence',
      severity: sessionsDone === 0 ? 'critical' : sessionsDone < sessionsPlanned / 2 ? 'critical' : 'warning',
      messageKey: 'adherenceFrequency',
      values: { done: sessionsDone, planned: sessionsPlanned },
    })
  }
  const skipped = perPlanDay.filter(d => !isTrainedDay(d))
  if (skipped.length > 0 && sessionsDone > 0) {
    findings.push({
      id: 'adherence-skipped-days',
      lever: 'adherence',
      severity: 'warning',
      messageKey: 'adherenceSkippedDays',
      values: { days: skipped.map(d => d.day).join(', ') },
    })
  }
  if (offPlanExercises.length > 0) {
    findings.push({
      id: 'adherence-off-plan',
      lever: 'adherence',
      severity: 'good',
      messageKey: 'adherenceOffPlan',
      values: { exercises: offPlanExercises.join(', '), count: offPlanExercises.length },
    })
  }

  // ── Lever 3: failure management ───────────────────────────────────────────
  if (failurePct !== null && failurePct > opts.maxFailurePct) {
    findings.push({
      id: 'failure-too-high',
      lever: 'failure',
      severity: failurePct >= 80 ? 'critical' : 'warning',
      messageKey: 'failureTooHigh',
      values: { pct: failurePct, max: opts.maxFailurePct },
    })
    // Lower the prescribed RPE wherever the plan asks for more than we want.
    const rows = planRows.filter(r => Number(r.targetRpe) > opts.targetRpeWhenReducing)
    if (rows.length > 0) {
      const from = Math.max(...rows.map(r => Number(r.targetRpe)))
      proposals.push({
        id: 'rpe-down',
        kind: 'adjust-rpe',
        rowIds: rows.map(r => String(r.id)).filter(Boolean),
        from,
        to: opts.targetRpeWhenReducing,
        affected: rows.length,
      })
    }
  }

  // One exercise often covers several muscles, so the same row can be proposed
  // more than once. Keep the first occurrence: proposals are generated in
  // priority order, so that is the most important reason for the change.
  const seenRows = new Set<string>()
  const dedupedProposals = proposals.filter(p => {
    const key = p.kind === 'adjust-rpe' ? p.id : `${p.kind}:${p.rowId}`
    if (seenRows.has(key)) return false
    seenRows.add(key)
    return true
  })

  return {
    weekStart: monday.toISOString(),
    weekEnd: sunday.toISOString(),
    sessionsDone,
    sessionsPlanned,
    totalSets: weekSets.length,
    volume: Math.round(volume),
    failurePct,
    coverage,
    perPlanDay,
    offPlanExercises,
    findings,
    proposals: dedupedProposals,
  }
}

/** Apply an accepted proposal to a set of plan rows, returning the new rows. */
export function applyProposal(rows: PlanRow[], proposal: ReviewProposal): PlanRow[] {
  switch (proposal.kind) {
    case 'adjust-sets':
      return rows.map(r => (String(r.id) === proposal.rowId ? { ...r, targetSets: proposal.to } : r))
    case 'move-exercise':
      return rows.map(r => (String(r.id) === proposal.rowId ? { ...r, day: proposal.toDay } : r))
    case 'adjust-rpe':
      return rows.map(r => (proposal.rowIds.includes(String(r.id)) ? { ...r, targetRpe: proposal.to } : r))
    default:
      return rows
  }
}
