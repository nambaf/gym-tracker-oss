import { NextResponse } from 'next/server'
import { deleteSession, getRow, updateRow } from '@/lib/data/dataStore'
import { invalidate } from '@/lib/data/dataCache'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const updates = await req.json()

    const existing = await getRow<any>('sessions', id)
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const merged = { ...existing, ...updates, id }
    await updateRow('sessions', id, merged)

    return NextResponse.json({ ok: true, updated: id })
  } catch (e: any) {
    console.error('PATCH /api/data/sessions/[id] error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    await deleteSession(id)

    invalidate('sessions')
    invalidate('sets')

    return NextResponse.json({ ok: true, deleted: id })
  } catch (e: any) {
    console.error('DELETE /api/data/sessions/[id] error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
