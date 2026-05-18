import { NextResponse } from 'next/server'
import { readTable, appendRow } from '@/lib/data/dataStore'
import { invalidate } from '@/lib/data/dataCache'
import { SEED_EXERCISES } from '@/lib/seedData/exercises'
import { getLang } from '@/lib/i18n/getLang'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/data/exercises/seed
// Inserts the default exercise list into DynamoDB, picking names in the
// active locale (resolved server-side from cookie / Accept-Language / env).
// Refuses to run when the table is already populated — adopters customise
// their own list via the UI after first launch.
export async function POST() {
  try {
    const existing = await readTable('exercises')
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'exercises_table_not_empty', count: existing.length },
        { status: 409 },
      )
    }

    const lang = await getLang()

    let inserted = 0
    for (const ex of SEED_EXERCISES) {
      const name = lang === 'en' ? ex.name_en : ex.name_it
      await appendRow('exercises', { name, primaryMuscles: ex.primaryMuscles })
      inserted++
    }

    invalidate('exercises')
    return NextResponse.json({ ok: true, inserted, lang })
  } catch (e: any) {
    console.error('POST /api/data/exercises/seed error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
