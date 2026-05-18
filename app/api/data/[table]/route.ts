import { NextResponse } from 'next/server'
import { appendRow, readTable } from '@/lib/data/dataStore'
import { getCache, setCache, invalidate } from '@/lib/data/dataCache'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

const ALLOWED_TABLES = new Set([
  'exercises',
  'sessions',
  'sets',
  'plans',
  'settings',
])

type Ctx = { params: Promise<{ table: string }> }

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { table } = await params
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'unknown table' }, { status: 404 })
    }

    const url = new URL(req.url)
    const force = url.searchParams.get('refresh') === '1'

    if (!force) {
      const cached = getCache(table)
      if (cached) return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } })
    }

    const rows = await readTable(table)
    setCache(table, rows)
    return NextResponse.json(rows, { headers: { 'x-cache': force ? 'bypass' : 'miss' } })
  } catch (e: any) {
    console.error('GET /api/data error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { table } = await params
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'unknown table' }, { status: 404 })
    }
    const payload = await req.json()
    if (table === 'sessions' || table === 'sets') payload.id = payload.id || crypto.randomUUID()
    await appendRow(table, payload)
    invalidate(table)
    return NextResponse.json({ ok: true, id: payload.id })
  } catch (e: any) {
    console.error('POST /api/data error:', e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
