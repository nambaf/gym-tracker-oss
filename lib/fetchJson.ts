export type LoadState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error'
  data?: T
  error?: string
  startedAt?: number
  endedAt?: number
  durationMs?: number
  /** True when the response carried `x-cache: hit`. */
  fromCache?: boolean
  /** Raw `x-cache` header value: 'hit' | 'miss' | 'bypass' | undefined. */
  cacheHeader?: string
  /** 0–100 loading progress, when Content-Length is available. */
  progress?: number
}

/**
 * Fetch a JSON resource and report loading state via `onUpdate`.
 *
 * Reads the response body as a stream so `progress` advances when
 * Content-Length is set. Falls back to `res.json()` otherwise.
 */
export async function fetchJSON<T = unknown>(
  url: string,
  opts?: { timeoutMs?: number; onUpdate?: (state: LoadState<T>) => void }
): Promise<LoadState<T>> {
  const { timeoutMs = 20000, onUpdate } = opts || {}
  const ctrl = new AbortController()
  const startedAt = performance.now()
  let state: LoadState<T> = { status: 'loading', startedAt, progress: 0 }
  onUpdate?.(state)
  const t = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    let json: T
    const len = Number(res.headers.get('content-length'))
    if (res.body && len) {
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          const progress = Math.round((received / len) * 100)
          state = { ...state, progress }
          onUpdate?.(state)
        }
      }
      const merged = new Uint8Array(received)
      let pos = 0
      for (const c of chunks) { merged.set(c, pos); pos += c.length }
      json = JSON.parse(new TextDecoder().decode(merged)) as T
    } else {
      json = (await res.json()) as T
      state = { ...state, progress: 100 }
      onUpdate?.(state)
    }

    const cacheHeader = res.headers.get('x-cache') || undefined
    const now = performance.now()
    state = {
      ...state,
      status: 'success',
      data: json,
      endedAt: now,
      durationMs: now - startedAt,
      fromCache: cacheHeader === 'hit',
      cacheHeader,
      progress: 100,
    }
    onUpdate?.(state)
    return state
  } catch (e: any) {
    clearTimeout(t)
    if (e?.name === 'AbortError') return { status: 'idle' }

    const now = performance.now()
    state = {
      ...state,
      status: 'error',
      error: e?.message || 'Unknown error',
      endedAt: now,
      durationMs: now - startedAt,
      progress: 100,
    }
    onUpdate?.(state)
    return state
  }
}
