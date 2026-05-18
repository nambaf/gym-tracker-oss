import { NextResponse } from 'next/server'
import { getRow, appendRow, deleteRow } from '@/lib/data/dataStore'
import { invalidate } from '@/lib/data/dataCache'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

const ALLOWED_TABLES = new Set(['settings', 'sessions', 'sets', 'plans'])

type Ctx = { params: Promise<{ table: string; id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const unauthorized = await requireAuth()
    if (unauthorized) return unauthorized
    try {
        const { table, id } = await params
        if (!ALLOWED_TABLES.has(table)) {
            return NextResponse.json({ error: 'unknown table' }, { status: 404 })
        }
        const item = await getRow(table, id)
        return NextResponse.json(item ?? null)
    } catch (e: any) {
        console.error('GET /api/data/[table]/[id] error:', e)
        return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: Ctx) {
    const unauthorized = await requireAuth()
    if (unauthorized) return unauthorized
    try {
        const { table, id } = await params
        if (!ALLOWED_TABLES.has(table)) {
            return NextResponse.json({ error: 'unknown table' }, { status: 404 })
        }

        const payload = await req.json()
        payload.id = id

        // appendRow is PutItem in DynamoDB → overwrite-by-id
        await appendRow(table, payload)
        invalidate(table)

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        console.error('PUT /api/data/[table]/[id] error:', e)
        return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const unauthorized = await requireAuth()
    if (unauthorized) return unauthorized
    try {
        const { table, id } = await params
        if (!ALLOWED_TABLES.has(table)) {
            return NextResponse.json({ error: 'unknown table' }, { status: 404 })
        }
        await deleteRow(table, id)
        invalidate(table)
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        console.error('DELETE /api/data/[table]/[id] error:', e)
        return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
    }
}
