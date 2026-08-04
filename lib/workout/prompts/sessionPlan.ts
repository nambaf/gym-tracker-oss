/**
 * What the plan said today, what actually happened, and what is left.
 *
 * The coach used to see a flat list of the exercises done so far and nothing
 * about the plan they came from. That is enough to comment on a single
 * exercise and not enough to comment on a *session*: an exercise moved to the
 * end because the rack was busy is done on tired legs, and comparing its load
 * with a week where it opened the session is comparing two different things.
 * Same for what is still to come — the last plan row of the day is the one
 * that gets dropped, and whether dropping it costs anything depends on how
 * much of that muscle group the week already has.
 *
 * Everything here is computed from data the app already holds (plan rows, set
 * timestamps, weekly coverage). The model is being told what is true, not
 * asked to infer it.
 */
import type { Exercise } from '../../models'
import type { Lang } from '../../i18n'
import { MUSCLE_CONTRIBUTION_THRESHOLD, normalizeMuscle, parsePrimaryMuscles } from '../../bodyMapUtils'

/** A plan row for today, with how far the athlete got on it. */
export type PlannedExerciseState = {
  exerciseId: string
  exerciseName: string
  /** 1-based position in the plan's own order for this day. */
  position: number
  targetSets: number
  targetReps: string
  targetRpe?: number
  /** Free-text note on the plan row — where "do this one no matter what" lives. */
  note?: string
  setsDone: number
  /** Closed by the athlete, or the planned set count reached. */
  done: boolean
}

/** An exercise actually trained today, in the order it was performed. */
export type PerformedExercise = {
  exerciseId: string
  exerciseName: string
  setsDone: number
}

/** Where an exercise sat inside a session. */
export type SessionPosition = { position: number; total: number }

export type SessionPlanInput = {
  lang: Lang
  /** Plan day being trained, as stored on the rows (a weekday name). */
  planDay?: string
  currentExerciseId: string
  /** Today's plan rows, in planned order. */
  planned: PlannedExerciseState[]
  /** What was actually trained today, in performed order (off-plan included). */
  performed: PerformedExercise[]
  /** Position of the exercise that just ended, in today's real order. */
  currentPosition?: SessionPosition | null
  /** Its position in the last session it was trained in. */
  previousPosition?: SessionPosition | null
  exercises: Exercise[]
  /** Sets per muscle group so far this week, against the hypertrophy target. */
  coverage: Array<{ muscle: string; sets: number; target: number | null }>
}

const L = {
  it: {
    planToday: 'PIANO DI OGGI',
    plannedOrder: 'ordine previsto',
    noPlan: 'Nessun piano per oggi: la seduta e\' tutta fuori programma.',
    justFinished: 'appena concluso',
    done: 'fatto',
    started: 'iniziato',
    todo: 'DA FARE',
    sets: 'serie',
    planNote: 'nota piano',
    realOrder: 'ORDINE REALE DI OGGI',
    plannedNth: 'previsto',
    offPlan: 'fuori piano',
    deviations: 'SCOSTAMENTI DALL\'ORDINE',
    movedLater: (name: string, from: number, to: number) =>
      `${name} era previsto ${from}° del giorno ed e\' stato fatto ${to}° della seduta: arriva con piu\' fatica addosso.`,
    movedEarlier: (name: string, from: number, to: number) =>
      `${name} era previsto ${from}° del giorno ed e\' stato anticipato ${to}°: arriva piu\' fresco del solito.`,
    skippedSoFar: (names: string) =>
      `Previsti prima di questo e non ancora fatti: ${names}. Se sono stati saltati per attrezzi occupati, vanno recuperati in coda.`,
    prevPosition: (prev: number, now: number) =>
      `La volta scorsa questo esercizio era il ${prev}° della seduta, oggi il ${now}°: i carichi non sono confrontabili alla pari.`,
    remaining: 'ANCORA DA FARE DAL PIANO',
    remainingNone: 'Il piano di oggi e\' completo: non resta nulla.',
    weekLoad: 'CARICO SETTIMANALE SUI DISTRETTI CHE RESTANO (serie fatte/soglia, oggi incluso)',
    currentMuscles: 'DISTRETTI DELL\'ESERCIZIO APPENA CONCLUSO',
    over: 'gia\' oltre soglia',
    at: 'a soglia',
    under: 'sotto soglia',
    noTarget: 'nessuna soglia',
  },
  en: {
    planToday: 'TODAY\'S PLAN',
    plannedOrder: 'planned order',
    noPlan: 'No plan for today: the whole session is off programme.',
    justFinished: 'just finished',
    done: 'done',
    started: 'started',
    todo: 'TO DO',
    sets: 'sets',
    planNote: 'plan note',
    realOrder: 'ACTUAL ORDER TODAY',
    plannedNth: 'planned',
    offPlan: 'off plan',
    deviations: 'ORDER DEVIATIONS',
    movedLater: (name: string, from: number, to: number) =>
      `${name} was planned ${from}${ord(from)} for the day and was done ${to}${ord(to)} in the session: it lands on more fatigue.`,
    movedEarlier: (name: string, from: number, to: number) =>
      `${name} was planned ${from}${ord(from)} for the day and was brought forward to ${to}${ord(to)}: it lands fresher than usual.`,
    skippedSoFar: (names: string) =>
      `Planned before this one and still not done: ${names}. If they were skipped because the kit was busy, they need picking up at the end.`,
    prevPosition: (prev: number, now: number) =>
      `Last time this exercise was the ${prev}${ord(prev)} of the session, today the ${now}${ord(now)}: the loads are not directly comparable.`,
    remaining: 'STILL TO DO FROM THE PLAN',
    remainingNone: 'Today\'s plan is complete: nothing left.',
    weekLoad: 'THIS WEEK\'S LOAD ON THE MUSCLE GROUPS STILL TO COME (sets done/threshold, today included)',
    currentMuscles: 'MUSCLE GROUPS OF THE EXERCISE JUST FINISHED',
    over: 'already over threshold',
    at: 'at threshold',
    under: 'under threshold',
    noTarget: 'no threshold',
  },
} as const

/** English ordinal suffix, so "3rd" does not read as "3th". */
function ord(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th'
}

/** Ordinal in the prompt's own language: `3°` in Italian, `3rd` in English. */
function nth(n: number, lang: Lang): string {
  return lang === 'en' ? `${n}${ord(n)}` : `${n}°`
}

/** Muscle groups an exercise trains above the contribution threshold. */
function musclesOf(exerciseId: string, exercises: Exercise[]): string[] {
  const ex = exercises.find(e => e.id === exerciseId)
  if (!ex) return []
  const out: string[] = []
  for (const { muscle, weight } of parsePrimaryMuscles(ex.primaryMuscles)) {
    if (weight < MUSCLE_CONTRIBUTION_THRESHOLD) continue
    const g = normalizeMuscle(muscle)
    if (g && !out.includes(g)) out.push(g)
  }
  return out
}

function target(spec: { targetSets: number; targetReps: string; targetRpe?: number }): string {
  return `${spec.targetSets}x${spec.targetReps}${spec.targetRpe ? ` @RPE${spec.targetRpe}` : ''}`
}

/**
 * The block appended to the debrief prompt. Returns an empty string when there
 * is nothing to say — no plan and a single exercise done is not worth a header.
 */
export function buildSessionPlanBlock(i: SessionPlanInput): string {
  const d = L[i.lang]
  const out: string[] = []

  // ── The plan for the day, in its own order, annotated with reality ────────
  if (i.planned.length === 0) {
    out.push(d.noPlan)
  } else {
    out.push(`${d.planToday}${i.planDay ? ` (${i.planDay})` : ''} — ${d.plannedOrder}:`)
    for (const p of i.planned) {
      const status = p.exerciseId === i.currentExerciseId
        ? d.justFinished
        : p.done
          ? `${d.done} (${p.setsDone} ${d.sets})`
          : p.setsDone > 0
            ? `${d.started}, ${p.setsDone} ${d.sets}`
            : d.todo
      const note = p.note ? ` [${d.planNote}: "${p.note}"]` : ''
      out.push(`  ${p.position}. ${p.exerciseName} ${target(p)} — ${status}${note}`)
    }
  }

  // ── What actually happened, in the order it happened ──────────────────────
  const plannedPos = new Map(i.planned.map(p => [p.exerciseId, p.position]))
  if (i.performed.length > 0) {
    const line = i.performed.map((p, idx) => {
      const pp = plannedPos.get(p.exerciseId)
      const tag = pp ? `${d.plannedNth} ${nth(pp, i.lang)}` : d.offPlan
      return `${idx + 1}) ${p.exerciseName} (${tag})`
    }).join(' · ')
    out.push('', `${d.realOrder}: ${line}`)
  }

  // ── Order deviations, stated as facts the coach can reason about ──────────
  const deviations: string[] = []
  const currentPlanned = plannedPos.get(i.currentExerciseId)
  const actual = i.currentPosition?.position
  if (currentPlanned && actual && currentPlanned !== actual) {
    const name = i.planned.find(p => p.exerciseId === i.currentExerciseId)?.exerciseName
      || i.performed.find(p => p.exerciseId === i.currentExerciseId)?.exerciseName
      || ''
    deviations.push(actual > currentPlanned
      ? d.movedLater(name, currentPlanned, actual)
      : d.movedEarlier(name, currentPlanned, actual))
  }
  // Plan rows that come before this one and are still untouched: the usual
  // shape of "the machine was busy, I'll come back to it".
  if (currentPlanned) {
    const skipped = i.planned
      .filter(p => p.position < currentPlanned && !p.done && p.setsDone === 0)
      .map(p => `${p.exerciseName} (${d.plannedNth} ${nth(p.position, i.lang)})`)
    if (skipped.length > 0) deviations.push(d.skippedSoFar(skipped.join(', ')))
  }
  if (i.previousPosition && i.currentPosition &&
      i.previousPosition.position !== i.currentPosition.position) {
    deviations.push(d.prevPosition(i.previousPosition.position, i.currentPosition.position))
  }
  if (deviations.length > 0) out.push('', `${d.deviations}:`, ...deviations.map(s => `- ${s}`))

  // ── What is left, and whether the week still needs it ─────────────────────
  const remaining = i.planned.filter(p => !p.done && p.exerciseId !== i.currentExerciseId)
  if (remaining.length > 0) {
    out.push('', `${d.remaining} (${remaining.length}):`)
    for (const p of remaining) {
      const note = p.note ? ` [${d.planNote}: "${p.note}"]` : ''
      const partial = p.setsDone > 0 ? ` — ${p.setsDone}/${p.targetSets} ${d.sets}` : ''
      out.push(`  - ${p.exerciseName} ${target(p)}${partial}${note}`)
    }
  } else if (i.planned.length > 0) {
    out.push('', d.remainingNone)
  }

  const covOf = (muscle: string) => i.coverage.find(c => c.muscle === muscle)
  const statusWord = (sets: number, tgt: number | null) => {
    if (tgt === null) return d.noTarget
    if (sets > tgt) return d.over
    if (sets >= tgt) return d.at
    return d.under
  }
  const coverageLines = (ids: string[]) => {
    const muscles: string[] = []
    for (const id of ids) for (const m of musclesOf(id, i.exercises)) if (!muscles.includes(m)) muscles.push(m)
    return muscles.map(m => {
      const c = covOf(m)
      const sets = c?.sets ?? 0
      const tgt = c?.target ?? null
      return `  - ${m}: ${sets}${tgt !== null ? `/${tgt}` : ''} ${d.sets} (${statusWord(sets, tgt)})`
    })
  }

  // Where the week stands on what is still to come. This is what turns "you
  // are tired, drop the last exercise" from a guess into a decision: a muscle
  // already over threshold can be cut, one at zero cannot.
  const remainingCoverage = coverageLines(remaining.map(p => p.exerciseId))
  if (remainingCoverage.length > 0) out.push('', `${d.weekLoad}:`, ...remainingCoverage)

  const currentCoverage = coverageLines([i.currentExerciseId])
  if (currentCoverage.length > 0) out.push('', `${d.currentMuscles}:`, ...currentCoverage)

  return out.join('\n')
}
