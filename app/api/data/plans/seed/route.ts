import { NextResponse } from 'next/server'
import { readTable, appendRow } from '@/lib/data/dataStore'
import { invalidate } from '@/lib/data/dataCache'
import { STARTER_PLAN_FULL_BODY_2D } from '@/lib/seedData/plan'
import { SEED_EXERCISES } from '@/lib/seedData/exercises'
import { getLang } from '@/lib/i18n/getLang'
import type { Exercise, Plan, PlanRow } from '@/lib/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/data/plans/seed
// Inserts the 2-day full-body starter plan, resolving exerciseIds against the
// already-seeded `exercises` table. Refuses when:
//   - `plans` already has rows (don't overwrite a user's work)
//   - `exercises` is empty (seed exercises first)
//   - any starter-plan exercise can't be matched (locale mismatch / partial seed)
export async function POST() {
  try {
    const existingPlans = await readTable<Plan>('plans')
    if (existingPlans.length > 0) {
      return NextResponse.json(
        { error: 'plans_table_not_empty', count: existingPlans.length },
        { status: 409 },
      )
    }

    const exercises = await readTable<Exercise>('exercises')
    if (exercises.length === 0) {
      return NextResponse.json(
        { error: 'exercises_table_empty' },
        { status: 409 },
      )
    }

    const lang = await getLang()
    const expectedNameForKey = new Map<string, string>(
      SEED_EXERCISES.map(e => [e.name_it, lang === 'en' ? e.name_en : e.name_it]),
    )
    const exerciseIdByName = new Map<string, string>(
      exercises.map(e => [e.name, e.id]),
    )

    const rows: PlanRow[] = []
    const missing: string[] = []
    for (const r of STARTER_PLAN_FULL_BODY_2D.rows) {
      const expectedName = expectedNameForKey.get(r.exerciseName_it) ?? r.exerciseName_it
      const exerciseId = exerciseIdByName.get(expectedName)
      if (!exerciseId) {
        missing.push(expectedName)
        continue
      }
      const dayLabel = STARTER_PLAN_FULL_BODY_2D.dayLabels[lang][r.day]
      rows.push({
        day: dayLabel,
        exerciseId,
        targetSets: r.targetSets,
        targetReps: r.targetReps,
        ...(r.targetRpe !== undefined ? { targetRpe: r.targetRpe } : {}),
        order: r.order,
      })
    }

    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'exercises_missing', missing },
        { status: 409 },
      )
    }

    const plan: Omit<Plan, 'id'> = {
      name: lang === 'en' ? STARTER_PLAN_FULL_BODY_2D.name_en : STARTER_PLAN_FULL_BODY_2D.name_it,
      description: lang === 'en' ? STARTER_PLAN_FULL_BODY_2D.description_en : STARTER_PLAN_FULL_BODY_2D.description_it,
      createdAt: new Date().toISOString(),
      isActive: true,
      rows,
    }
    await appendRow('plans', plan)

    invalidate('plans')
    return NextResponse.json({ ok: true, inserted: rows.length, lang })
  } catch (e: any) {
    console.error('POST /api/data/plans/seed error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
