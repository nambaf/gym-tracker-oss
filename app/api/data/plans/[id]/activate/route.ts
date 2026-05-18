import { NextResponse } from 'next/server'
import { readTable, appendRow } from '@/lib/data/dataStore'
import { invalidate } from '@/lib/data/dataCache'
import type { Plan } from '@/lib/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/data/plans/:id/activate
// Set isActive=true on the requested plan and false on all the others.
// Two sequential writes — acceptable for single-user, no transactions needed.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const plans = await readTable<Plan>('plans')
    const target = plans.find(p => p.id === id)
    if (!target) {
      return NextResponse.json({ error: 'plan_not_found' }, { status: 404 })
    }

    for (const p of plans) {
      const shouldBeActive = p.id === id
      if (Boolean(p.isActive) === shouldBeActive) continue
      await appendRow('plans', { ...p, isActive: shouldBeActive })
    }

    invalidate('plans')
    return NextResponse.json({ ok: true, activeId: id })
  } catch (e: any) {
    console.error('POST /api/data/plans/[id]/activate error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
