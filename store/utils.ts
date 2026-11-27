import type { LoadState } from '@/lib/fetchJson'
import { fetchJSON } from '@/lib/fetchJson'
import type { Settings } from '@/lib/settings/types'

export type StoreLoader<T> = {
  loadData: (force?: boolean) => Promise<void>
  data: LoadState<T[]>
}

/**
 * Neutral code stored in `LoadState.error` when a loader fails without a
 * message of its own. No screen renders `LoadState.error` — they branch on
 * `status` and show their own dictionary string — so this is a code for logs,
 * not user-facing text.
 */
export const LOAD_FAILED = 'load_failed'

/**
 * Wraps a fetch routine in the store's loader contract.
 *
 * - Not forced: a slice that is loading or loaded is left alone (a call made
 *   while a request is in flight gets that request's promise).
 * - Forced: a new request starts even if one is in flight, and from then on
 *   only the LATEST request may write to the slice. Without that, the last
 *   response to arrive wins, and a slow older response overwrites a newer one.
 */
export function createSequencedLoader<T>(
  run: (onUpdate: (state: LoadState<T[]>) => void) => Promise<unknown>,
  getCurrentData: () => LoadState<T[]>,
  updateData: (data: LoadState<T[]>) => void
): (force?: boolean) => Promise<void> {
  let latest = 0
  let inFlight: Promise<void> | null = null

  return (force = false) => {
    if (!force) {
      const status = getCurrentData().status
      if (status === 'success') return Promise.resolve()
      if (status === 'loading') return inFlight ?? Promise.resolve()
    }

    const seq = ++latest
    const guarded = (state: LoadState<T[]>) => {
      if (seq === latest) updateData(state)
    }

    const request: Promise<void> = (async () => {
      try {
        await run(guarded)
      } catch (error: any) {
        guarded({ status: 'error', error: error?.message || LOAD_FAILED })
      }
    })().finally(() => {
      if (inFlight === request) inFlight = null
    })
    inFlight = request
    return request
  }
}

export function createLoader<T>(
  endpoint: string,
  getCurrentData: () => LoadState<T[]>,
  updateData: (data: LoadState<T[]>) => void
): (force?: boolean) => Promise<void> {
  return createSequencedLoader<T>(
    onUpdate => fetchJSON<T[]>(endpoint, { onUpdate }),
    getCurrentData,
    updateData
  )
}

export function createBatchLoader(loaders: Array<(force?: boolean) => Promise<void>>) {
  return async (force = false) => {
    await Promise.all(loaders.map(loader => loader(force)))
  }
}

export const createInitialState = <T>(): LoadState<T[]> => ({ status: 'idle' })

/** Runs async operations one at a time, in the order they were enqueued. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = tail.then(op)
    tail = run.then(() => undefined, () => undefined)
    return run
  }
}

// ─── settings/global write guard ─────────────────────────────────────────────

export type SettingsLoadStatus = 'idle' | 'loading' | 'success' | 'error'

/** Thrown by `setSettings` when the row could not be read, so nothing was written. */
export class SettingsNotLoadedError extends Error {
  constructor() {
    super('settings/global was not loaded; refusing to overwrite it')
    this.name = 'SettingsNotLoadedError'
  }
}

function dropUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as T
}

/**
 * Decides what a settings write may send.
 *
 * `PUT settings/global` is a DynamoDB `PutItem`: the body replaces the whole
 * row. So a write is only allowed once the row has been read (`success`), and
 * the body is the row as read, overlaid with the patch. Returns `null` when
 * the row is unknown — the caller must not write.
 *
 * `raw` is the row exactly as the server returned it; it carries any attribute
 * this client does not model, which would otherwise be dropped by the write.
 * A patch value of `undefined` removes the override (reset to default).
 */
export function buildSettingsWrite(
  status: SettingsLoadStatus,
  raw: Record<string, unknown>,
  stored: Partial<Settings>,
  patch: Partial<Settings>
): { stored: Partial<Settings>; row: Record<string, unknown> } | null {
  if (status !== 'success') return null
  const nextStored = dropUndefined({ ...stored, ...patch, id: 'global' as const })
  const row = dropUndefined({ ...raw, ...stored, ...patch, id: 'global' })
  return { stored: nextStored, row }
}
