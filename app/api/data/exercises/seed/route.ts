import { NextResponse } from 'next/server'
import { readTable, appendRow } from '@/lib/data/dataStore'
import { invalidate } from '@/lib/data/dataCache'
import { SEED_EXERCISES } from '@/lib/seedData/exercises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/data/exercises/seed
// Inserts the default exercise list into DynamoDB.
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

    let inserted = 0
    for (const ex of SEED_EXERCISES) {
      await appendRow('exercises', { ...ex })
      inserted++
    }

    invalidate('exercises')
    return NextResponse.json({ ok: true, inserted })
  } catch (e: any) {
    console.error('POST /api/data/exercises/seed error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
