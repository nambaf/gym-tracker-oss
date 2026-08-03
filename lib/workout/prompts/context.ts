/**
 * The athlete context handed to every AI prompt.
 *
 * The coach used to receive counts and nothing else: how many sessions, how
 * many sets, a per-muscle tally computed with its own ad-hoc normalisation, and
 * a `session.note` that is empty on almost every row. It never saw a single
 * word the athlete wrote, nor whether they were getting stronger.
 *
 * Everything assembled here is already computed deterministically elsewhere —
 * the model is being told what the app knows, not asked to work it out. That
 * keeps the AI strictly additive: with `AI_PROVIDER=off` the same facts are
 * still on screen, just without the prose.
 */
import type { Exercise, PlanRow, SetEntry, Session } from '../../models'
import type { Lang } from '../../i18n'
import { commentOf, intensityOf, isFailureSet, INTENSITY_KEYS } from '../../setNotes'
import { getExerciseProgress } from '../../deload'
import { buildWeeklyReview, type WeeklyReview } from '../../coach/weeklyReview'
import { activityMinutes, activitySessions } from '../../sessions'
import { weekBounds } from '../../dateUtils'
import type { ThresholdsMatrix, TrainingMode } from '../../settings/types'

/** Cap on how much athlete prose reaches the prompt, newest first. */
const MAX_NOTES = 12
/** Cap on per-exercise trend lines. */
const MAX_TRENDS = 8

const L = {
  it: {
    week: 'SETTIMANA CORRENTE',
    sessions: 'sedute', sets: 'serie', toFailure: 'a cedimento',
    coverage: 'Serie per gruppo muscolare (soglia ipertrofia fra parentesi)',
    untouched: 'Non allenati per niente',
    issues: 'RILIEVI DELL\'ANALISI SETTIMANALE',
    trends: 'ANDAMENTO PER ESERCIZIO (ultime settimane, e1RM)',
    improving: 'in crescita', stable: 'fermo', declining: 'in calo',
    notes: 'PAROLE DELL\'ATLETA (dalle sue note, dalla piu\' recente)',
    intents: 'COSA SI ERA RIPROMESSO',
    activities: 'ALTRE ATTIVITA\' DELLA SETTIMANA (non contano come sedute, ma pesano sul recupero)',
    activityLabels: {
      run: 'corsa', bike: 'bici', swim: 'nuoto', walk: 'camminata',
      sport: 'sport', other: 'altro',
    },
    effort: 'sforzo',
    flags: 'segnalazioni',
    none: 'nessuno',
    flagLabels: { pain: 'dolore', technique: 'tecnica sporca', interrupted: 'serie interrotta', fatigued: 'gia\' stanco' },
    intentLabels: { hold: 'stesso peso', increase: 'aumentare', decrease: 'diminuire', retry: 'riprovare uguale' },
    intensityLabels: { veryEasy: 'molto facile', easy: 'facile', medium: 'media', hard: 'difficile', veryHard: 'molto difficile' },
    bodyweight: 'a corpo libero',
  },
  en: {
    week: 'CURRENT WEEK',
    sessions: 'sessions', sets: 'sets', toFailure: 'to failure',
    coverage: 'Sets per muscle group (hypertrophy threshold in brackets)',
    untouched: 'Not trained at all',
    issues: 'WEEKLY REVIEW FINDINGS',
    trends: 'PER-EXERCISE TREND (recent weeks, e1RM)',
    improving: 'improving', stable: 'flat', declining: 'declining',
    notes: 'THE ATHLETE\'S OWN WORDS (from their notes, most recent first)',
    intents: 'WHAT THEY TOLD THEMSELVES TO DO',
    activities: 'OTHER ACTIVITY THIS WEEK (does not count as a session, but costs recovery)',
    activityLabels: {
      run: 'run', bike: 'ride', swim: 'swim', walk: 'walk',
      sport: 'sport', other: 'other',
    },
    effort: 'effort',
    flags: 'flags',
    none: 'none',
    flagLabels: { pain: 'pain', technique: 'sloppy form', interrupted: 'cut short', fatigued: 'already tired' },
    intentLabels: { hold: 'same weight', increase: 'increase', decrease: 'decrease', retry: 'retry same' },
    intensityLabels: { veryEasy: 'very easy', easy: 'easy', medium: 'medium', hard: 'hard', veryHard: 'very hard' },
    bodyweight: 'bodyweight',
  },
} as const

function reviewFindingText(f: WeeklyReview['findings'][number], lang: Lang): string {
  const v = f.values
  if (lang === 'en') {
    switch (f.messageKey) {
      case 'coverageZero': return `Not trained at all this week: ${v.muscles}.`
      case 'coverageShort': return `${v.muscle}: ${v.sets} sets against a threshold of ${v.target}.`
      case 'adherenceFrequency': return `${v.done} of ${v.planned} planned sessions done.`
      case 'adherenceSkippedDays': return `Plan days not really trained: ${v.days}.`
      case 'adherenceOffPlan': return `Exercises done outside the plan: ${v.exercises}.`
      case 'failureTooHigh': return `${v.pct}% of sets taken to failure (their own ceiling is ${v.max}%).`
      default: return ''
    }
  }
  switch (f.messageKey) {
    case 'coverageZero': return `Non allenati per niente questa settimana: ${v.muscles}.`
    case 'coverageShort': return `${v.muscle}: ${v.sets} serie contro una soglia di ${v.target}.`
    case 'adherenceFrequency': return `${v.done} sedute su ${v.planned} previste.`
    case 'adherenceSkippedDays': return `Giorni di piano non realmente allenati: ${v.days}.`
    case 'adherenceOffPlan': return `Esercizi svolti fuori piano: ${v.exercises}.`
    case 'failureTooHigh': return `${v.pct}% delle serie portate a cedimento (la sua soglia e' ${v.max}%).`
    default: return ''
  }
}

export type AthleteContextInput = {
  lang: Lang
  sessions: Session[]
  sets: SetEntry[]
  exercises: Exercise[]
  planRows: PlanRow[]
  trainingMode: TrainingMode
  thresholdsByMode: ThresholdsMatrix
  maxFailurePct: number
  targetRpeWhenReducing: number
  progressWindowWeeks: number
  progressTrendThresholdPct: number
}

/**
 * A compact, high-signal block describing where the athlete stands.
 * Deliberately terse: a prompt padded with noise buries the parts that matter.
 */
export function buildAthleteContext(input: AthleteContextInput): string {
  const { lang, sessions, sets, exercises, planRows } = input
  const d = L[lang]
  const nameOf = new Map(exercises.map(e => [e.id, e.name]))
  const out: string[] = []

  const review = buildWeeklyReview(sessions, sets, exercises, planRows, {
    trainingMode: input.trainingMode,
    thresholdsByMode: input.thresholdsByMode,
    maxFailurePct: input.maxFailurePct,
    targetRpeWhenReducing: input.targetRpeWhenReducing,
  })

  if (review) {
    out.push(`${d.week}: ${review.sessionsDone}/${review.sessionsPlanned} ${d.sessions}, ` +
      `${review.totalSets} ${d.sets}` +
      (review.failurePct !== null ? `, ${review.failurePct}% ${d.toFailure}` : ''))

    const trained = review.coverage.filter(c => c.sets > 0)
    if (trained.length > 0) {
      out.push(`${d.coverage}: ` +
        trained.map(c => `${c.muscle} ${c.sets}${c.target !== null ? `/${c.target}` : ''}`).join(', '))
    }
    const zero = review.coverage.filter(c => c.sets === 0 && c.target !== null)
    if (zero.length > 0) out.push(`${d.untouched}: ${zero.map(c => c.muscle).join(', ')}`)

    const issues = review.findings.map(f => reviewFindingText(f, lang)).filter(Boolean)
    if (issues.length > 0) out.push('', d.issues, ...issues.map(s => `- ${s}`))
  }

  // Read straight from `sessions`, not from `review`: a week of nothing but
  // running produces no review at all, and that is exactly the week where the
  // coach most needs to know why the athlete never made it to the gym.
  const { monday, sunday } = weekBounds(new Date())
  const weekActivities = activitySessions(sessions).filter(s => {
    const t = new Date(s.date).getTime()
    return Number.isFinite(t) && t >= monday.getTime() && t <= sunday.getTime()
  })
  if (weekActivities.length > 0) {
    out.push('', d.activities)
    for (const a of weekActivities) {
      const day = new Date(a.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', { weekday: 'long' })
      const bits: string[] = [d.activityLabels[a.activity || 'other']]
      const mins = activityMinutes(a)
      if (mins) bits.push(`${mins} min`)
      if (a.distanceKm) bits.push(`${a.distanceKm} km`)
      if (a.effort) bits.push(`${d.effort} ${a.effort}/5`)
      if (a.note) bits.push(`"${a.note}"`)
      out.push(`- ${day}: ${bits.join(', ')}`)
    }
  }

  // Per-exercise direction, for the exercises the plan actually contains.
  const trendLines: string[] = []
  // Whether an exercise is effectively bodyweight, so we don't quote an
  // estimated 1RM of "1.3 kg" as if it meant something. The max load is not a
  // good test: weighted pull-ups carry a real load on some sets and a
  // placeholder 1 kg on the rest, which makes their e1RM meaningless anyway.
  // If most sets are unloaded, the load is not the variable being trained.
  const loadCounts = new Map<string, { unloaded: number; total: number }>()
  for (const s of sets) {
    const w = Number(s.weight)
    if (!Number.isFinite(w)) continue
    const c = loadCounts.get(s.exerciseId) ?? { unloaded: 0, total: 0 }
    c.total += 1
    if (w <= 1) c.unloaded += 1
    loadCounts.set(s.exerciseId, c)
  }
  const isBodyweight = (id: string) => {
    const c = loadCounts.get(id)
    return !!c && c.total > 0 && c.unloaded / c.total > 0.5
  }
  for (const id of Array.from(new Set(planRows.map(r => r.exerciseId)))) {
    const p = getExerciseProgress(id, sets, input.progressWindowWeeks, input.progressTrendThresholdPct)
    if (!p) continue
    const word = p.status === 'improving' ? d.improving : p.status === 'declining' ? d.declining : d.stable
    const name = nameOf.get(id) || id
    if (isBodyweight(id)) {
      trendLines.push(`- ${name}: ${d.bodyweight}, ${p.sessionCount} ${d.sessions}`)
      continue
    }
    trendLines.push(`- ${name}: ${word} (${p.trend > 0 ? '+' : ''}${p.trend}%, e1RM ${p.lastE1RM} kg, ${p.sessionCount} ${d.sessions})`)
  }
  if (trendLines.length > 0) {
    out.push('', d.trends, ...trendLines.slice(0, MAX_TRENDS))
  }

  // The part that was missing entirely: what the athlete actually wrote.
  const seenNote = new Set<string>()
  const recent = [...sets]
    .filter(s => commentOf(s) || (s.flags && s.flags.length))
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    // The same remark often lands on several sets of one exercise. Keeping every
    // copy spends prompt budget repeating one thought.
    .filter(s => {
      const key = `${s.exerciseId}|${commentOf(s)}`
      if (seenNote.has(key)) return false
      seenNote.add(key)
      return true
    })
    .slice(0, MAX_NOTES)
  if (recent.length > 0) {
    out.push('', d.notes)
    for (const s of recent) {
      const when = String(s.ts).slice(0, 10)
      const ex = nameOf.get(s.exerciseId) || s.exerciseId
      const bits: string[] = []
      const c = commentOf(s)
      if (c) bits.push(`"${c}"`)
      const lvl = intensityOf(s)
      if (lvl) {
        const key = INTENSITY_KEYS.find(i => i.level === lvl)?.key
        // Localised words, not the internal dictionary keys: "veryHard" in an
        // Italian prompt reads as a leaked identifier, not as information.
        if (key) {
          const label = (d.intensityLabels as any)[key]
          bits.push(lang === 'en' ? `felt ${label}` : `percepita ${label}`)
        }
      }
      if (s.flags?.length) {
        bits.push(`${d.flags}: ${s.flags.map(f => (d.flagLabels as any)[f] || f).join(', ')}`)
      }
      if (isFailureSet(s)) bits.push(d.toFailure)
      out.push(`- ${when} ${ex} ${s.weight}x${s.reps} — ${bits.join(' · ')}`)
    }
  }

  // Standing instructions the athlete left for themselves.
  const intents = new Map<string, { ts: string; text: string }>()
  for (const s of sets) {
    if (!s.nextIntent?.action) continue
    const ex = nameOf.get(s.exerciseId) || s.exerciseId
    const prev = intents.get(ex)
    if (prev && prev.ts > String(s.ts)) continue
    const label = (d.intentLabels as any)[s.nextIntent.action] || s.nextIntent.action
    intents.set(ex, {
      ts: String(s.ts),
      text: `- ${ex}: ${label}${s.nextIntent.weight ? ` (${s.nextIntent.weight} kg)` : ''}`,
    })
  }
  if (intents.size > 0) {
    out.push('', d.intents, ...Array.from(intents.values()).slice(0, MAX_TRENDS).map(i => i.text))
  }

  return out.join('\n')
}
