import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadState } from '@/lib/fetchJson'
import { buildSettingsWrite, createSequencedLoader, createSerialQueue } from '@/store/utils'

/** A promise resolved from outside, to control the order responses arrive in. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createSequencedLoader', () => {
  function setup() {
    let state: LoadState<string[]> = { status: 'idle' }
    const pending: Array<ReturnType<typeof deferred<string[]>>> = []
    const load = createSequencedLoader<string>(
      async onUpdate => {
        onUpdate({ status: 'loading' })
        const d = deferred<string[]>()
        pending.push(d)
        onUpdate({ status: 'success', data: await d.promise })
      },
      () => state,
      s => { state = s }
    )
    return { load, pending, get: () => state }
  }

  it('lets the latest request win when an older response arrives last', async () => {
    const { load, pending, get } = setup()
    const first = load(true)
    const second = load(true)
    pending[1].resolve(['new'])
    await second
    pending[0].resolve(['old'])
    await first
    expect(get()).toMatchObject({ status: 'success', data: ['new'] })
  })

  it('ignores a late failure of a superseded request', async () => {
    const { load, pending, get } = setup()
    const first = load(true)
    const second = load(true)
    pending[1].resolve(['new'])
    await second
    pending[0].reject(new Error('boom'))
    await first
    expect(get()).toMatchObject({ status: 'success', data: ['new'] })
  })

  it('does not start a second request when not forced', async () => {
    const { load, pending, get } = setup()
    const first = load()
    const second = load()
    expect(pending).toHaveLength(1)
    pending[0].resolve(['a'])
    await Promise.all([first, second])
    expect(get().data).toEqual(['a'])
    await load()
    expect(pending).toHaveLength(1)
  })

  it('reports a thrown error as an error state', async () => {
    let state: LoadState<string[]> = { status: 'idle' }
    const load = createSequencedLoader<string>(
      async () => { throw new Error('nope') },
      () => state,
      s => { state = s }
    )
    await load()
    expect(state).toEqual({ status: 'error', error: 'nope' })
  })
})

describe('createSerialQueue', () => {
  it('runs operations in order and survives a rejection', async () => {
    const enqueue = createSerialQueue()
    const order: string[] = []
    const gate = deferred<void>()
    const a = enqueue(async () => { await gate.promise; order.push('a'); throw new Error('a failed') })
    const b = enqueue(async () => { order.push('b'); return 'b' })
    gate.resolve()
    await expect(a).rejects.toThrow('a failed')
    await expect(b).resolves.toBe('b')
    expect(order).toEqual(['a', 'b'])
  })
})

describe('buildSettingsWrite', () => {
  const stored = { id: 'global' as const, athleteProfile: 'lifter', trainingMode: 'volume' as const }

  it('refuses to build a write unless the row was read', () => {
    for (const status of ['idle', 'loading', 'error'] as const) {
      expect(buildSettingsWrite(status, {}, {}, { trainingMode: 'intensity' })).toBeNull()
    }
  })

  it('overlays the patch on the whole row', () => {
    const write = buildSettingsWrite('success', { ...stored }, stored, { trainingMode: 'intensity' })
    expect(write?.row).toEqual({ id: 'global', athleteProfile: 'lifter', trainingMode: 'intensity' })
    expect(write?.stored).toEqual({ id: 'global', athleteProfile: 'lifter', trainingMode: 'intensity' })
  })

  it('keeps row attributes the client does not model', () => {
    const write = buildSettingsWrite('success', { ...stored, futureField: 7 }, stored, { deloadActive: true })
    expect(write?.row).toMatchObject({ futureField: 7, deloadActive: true, athleteProfile: 'lifter' })
    expect(write?.stored).not.toHaveProperty('futureField')
  })

  it('removes an override reset to undefined', () => {
    const write = buildSettingsWrite('success', { ...stored }, stored, { athleteProfile: undefined })
    expect(write?.row).toEqual({ id: 'global', trainingMode: 'volume' })
    expect(write?.stored).toEqual({ id: 'global', trainingMode: 'volume' })
  })

  it('writes a first row when none exists yet', () => {
    const write = buildSettingsWrite('success', {}, { id: 'global' }, { deloadActive: true })
    expect(write?.row).toEqual({ id: 'global', deloadActive: true })
  })
})

describe('useDataStore settings', () => {
  const ROW = {
    id: 'global',
    athleteProfile: 'lifter',
    athleteNotes: 'bad shoulder',
    trainingMode: 'volume',
    thresholdsByMode: { mixed: {} },
  }

  type Call = { method: string; body?: any }
  let calls: Call[]
  let respond: (call: Call) => Response | Promise<Response>

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

  async function freshStore() {
    vi.resetModules()
    return (await import('@/store/data')).useDataStore
  }

  beforeEach(() => {
    calls = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method || 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      }
      calls.push(call)
      return respond(call)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const puts = () => calls.filter(c => c.method === 'PUT')

  it('a toggle fired before the load resolves writes the whole row, not just the patch', async () => {
    const gate = deferred<Response>()
    respond = call => (call.method === 'GET' ? gate.promise : json({ ok: true }))
    const store = await freshStore()

    const loading = store.getState().loadSettings()
    expect(store.getState().settingsStatus).toBe('loading')
    const toggled = store.getState().setTrainingMode('intensity')
    expect(puts()).toHaveLength(0)

    gate.resolve(json(ROW))
    await loading
    expect(await toggled).toBe(true)

    expect(puts()).toHaveLength(1)
    expect(puts()[0].body).toEqual({ ...ROW, trainingMode: 'intensity' })
    expect(store.getState().trainingMode).toBe('intensity')
  })

  it('loads the row itself when a write comes first', async () => {
    respond = call => (call.method === 'GET' ? json(ROW) : json({ ok: true }))
    const store = await freshStore()
    await store.getState().setSettings({ deloadActive: true })
    expect(calls.map(c => c.method)).toEqual(['GET', 'PUT'])
    expect(puts()[0].body).toEqual({ ...ROW, deloadActive: true })
  })

  it('refuses to write, and leaves state alone, when the row could not be read', async () => {
    respond = call => (call.method === 'GET' ? json({ error: 'ddb down' }, 500) : json({ ok: true }))
    const store = await freshStore()
    await store.getState().loadSettings()
    expect(store.getState().settingsStatus).toBe('error')

    const { SettingsNotLoadedError } = await import('@/store/data')
    await expect(store.getState().setSettings({ trainingMode: 'intensity' }))
      .rejects.toBeInstanceOf(SettingsNotLoadedError)
    expect(await store.getState().setDeloadActive(true)).toBe(false)

    expect(puts()).toHaveLength(0)
    expect(store.getState().trainingMode).toBe('mixed')
    expect(store.getState().deloadActive).toBe(false)
    expect(store.getState().storedSettings).toEqual({})
  })

  it('recovers once the row can be read again', async () => {
    let healthy = false
    respond = call => {
      if (call.method === 'PUT') return json({ ok: true })
      return healthy ? json(ROW) : json({ error: 'ddb down' }, 500)
    }
    const store = await freshStore()
    await store.getState().loadSettings()
    healthy = true
    await store.getState().setSettings({ deloadActive: true })
    expect(store.getState().settingsStatus).toBe('success')
    expect(puts()[0].body).toEqual({ ...ROW, deloadActive: true })
  })

  it('treats a missing row as an empty one that can be written', async () => {
    respond = call => (call.method === 'GET' ? json(null) : json({ ok: true }))
    const store = await freshStore()
    await store.getState().loadSettings()
    expect(store.getState().settingsStatus).toBe('success')
    await store.getState().setSettings({ trainingMode: 'volume' })
    expect(puts()[0].body).toEqual({ id: 'global', trainingMode: 'volume' })
  })

  it('rolls back and rejects when the PUT fails', async () => {
    respond = call => (call.method === 'GET' ? json(ROW) : json({ error: 'nope' }, 500))
    const store = await freshStore()
    await store.getState().loadSettings()
    const before = store.getState().storedSettings

    await expect(store.getState().setSettings({ trainingMode: 'intensity', deloadActive: true })).rejects.toThrow()
    expect(store.getState().storedSettings).toBe(before)
    expect(store.getState().trainingMode).toBe('volume')
    expect(store.getState().deloadActive).toBe(false)
    expect(store.getState().settingsStatus).toBe('success')

    // The next write must build on the row as it is in the DB, not on the failed patch.
    respond = call => (call.method === 'GET' ? json(ROW) : json({ ok: true }))
    await store.getState().setSettings({ athleteNotes: 'healed' })
    expect(puts().at(-1)!.body).toEqual({ ...ROW, athleteNotes: 'healed' })
  })

  it('applies two quick writes in order, the second on top of the first', async () => {
    respond = call => (call.method === 'GET' ? json(ROW) : json({ ok: true }))
    const store = await freshStore()
    await store.getState().loadSettings()
    await Promise.all([
      store.getState().setTrainingMode('intensity'),
      store.getState().setDeloadActive(true),
    ])
    expect(puts().map(p => p.body)).toEqual([
      { ...ROW, trainingMode: 'intensity' },
      { ...ROW, trainingMode: 'intensity', deloadActive: true },
    ])
  })
})
