import { NextResponse } from 'next/server'
import { deleteRow, updateRow } from '@/lib/data/dataStore'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Ctx) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Set ID required' }, { status: 400 })
    }

    const updatedSet = await req.json()
    const itemToWrite = { ...updatedSet, id }

    await updateRow('sets', id, itemToWrite)

    return NextResponse.json({ ok: true, updated: id })
  } catch (e: any) {
    console.error('PUT /api/data/sets/[id] error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Set ID required' }, { status: 400 })
    }

    await deleteRow('sets', id)

    return NextResponse.json({ ok: true, deleted: id })
  } catch (e: any) {
    console.error('DELETE /api/data/sets/[id] error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
