import { NextResponse } from 'next/server'
import { getRow, appendRow } from '@/lib/data/dataStore'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

/**
 * Idempotent initializer for the `settings/global` row.
 *
 * Creates an empty `{ id: 'global' }` row if absent. Every setting
 * falls back to the corresponding `DEFAULT_*` in `lib/settings/defaults.ts`
 * until the user edits a field via `/profile`.
 *
 * NB: existing setters (`setDeloadActive` / `setTrainingMode` in the data
 * store) already create the row implicitly on first write. This endpoint
 * is the explicit, no-arg path used by the `/setup` wizard.
 */
export async function POST() {
  try {
    const existing = await getRow('settings', 'global')
    if (existing) {
      return NextResponse.json({ ok: true, alreadyInitialized: true })
    }
    await appendRow('settings', { id: 'global' })
    return NextResponse.json({ ok: true, initialized: true })
  } catch (e: any) {
    console.error('POST /api/data/settings/init error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
