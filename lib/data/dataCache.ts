// Process-local cache for data tables.
// Survives between requests while the lambda is warm.
type Row = Record<string, any>
type Entry = { ts: number; data: Row[] }

const CACHE = new Map<string, Entry>()
const DEFAULT_TTL = Number(process.env.DATA_CACHE_TTL_S ?? 600) * 1000

export function getCache(table: string, ttlMs = DEFAULT_TTL): Row[] | null {
  const e = CACHE.get(table)
  if (!e) return null
  if (Date.now() - e.ts > ttlMs) { CACHE.delete(table); return null }
  return e.data
}

export function setCache(table: string, data: Row[]) {
  CACHE.set(table, { ts: Date.now(), data })
}

export function invalidate(table?: string) {
  if (table) CACHE.delete(table); else CACHE.clear()
}
