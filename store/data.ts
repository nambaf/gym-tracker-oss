import { create } from 'zustand'
import type { LoadState } from '@/lib/fetchJson'
import type { Session, SetEntry, Exercise, Plan, PlanRow } from '@/lib/models'
import type { TrainingMode } from '@/lib/hypertrophyThresholds'
import type { Settings } from '@/lib/settings/types'
import { mergeWithDefaults } from '@/lib/settings/effective'
import { apiFetch, ApiError } from '@/lib/api'
import {
  createLoader, createSequencedLoader, createBatchLoader, createInitialState,
  createSerialQueue, buildSettingsWrite, SettingsNotLoadedError,
  type SettingsLoadStatus,
} from './utils'

export { SettingsNotLoadedError }
export type { SettingsLoadStatus }

interface DataStore {
  sessions: LoadState<Session[]>
  sets: LoadState<SetEntry[]>
  exercises: LoadState<Exercise[]>
  plan: LoadState<PlanRow[]>
  /** Raw `settings/global` row (sans defaults). Source-of-truth for writes. */
  storedSettings: Partial<Settings>
  /**
   * Whether `storedSettings` reflects the DB row. Anything other than
   * `success` means the row is unknown: forms must not offer to save, and
   * `setSettings` refuses to write.
   */
  settingsStatus: SettingsLoadStatus
  deloadActive: boolean
  trainingMode: TrainingMode
  loadSessions: (force?: boolean) => Promise<void>
  loadSets: (force?: boolean) => Promise<void>
  loadExercises: (force?: boolean) => Promise<void>
  loadPlan: (force?: boolean) => Promise<void>
  loadSettings: (force?: boolean) => Promise<void>
  loadAll: (force?: boolean) => Promise<void>
  invalidate: (tables?: string[]) => void
  /**
   * Merges `patch` into the row and writes it. Rejects — leaving the in-memory
   * settings as they were — when the row could not be read
   * (`SettingsNotLoadedError`) or the write failed.
   */
  setSettings: (patch: Partial<Settings>) => Promise<void>
  /** Resolve to `false` when nothing was saved (state is rolled back). Never reject. */
  setDeloadActive: (active: boolean) => Promise<boolean>
  setTrainingMode: (mode: TrainingMode) => Promise<boolean>
  addSessionOptimistic: (session: Session) => void
  removeSessionOptimistic: (sessionId: string) => void
  addSetOptimistic: (set: SetEntry) => void
  removeSetOptimistic: (setId: string) => void
  updateSessionOptimistic: (sessionId: string, updates: Partial<Session>) => void
}

async function fetchActivePlanRows(): Promise<PlanRow[]> {
  const res = await fetch('/api/data/plans', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load plans: ${res.status}`)
  const plans = await res.json() as Plan[]
  if (!Array.isArray(plans) || plans.length === 0) return []
  const active = plans.find(p => p.isActive) || plans[0]
  return Array.isArray(active.rows) ? active.rows : []
}

/** Defensive parse of the raw DDB row into a typed `Partial<Settings>`. */
function parseStoredSettings(data: any): Partial<Settings> {
  if (!data || typeof data !== 'object') return {}
  const out: Partial<Settings> = { id: 'global' }
  if (typeof data.athleteProfile === 'string') out.athleteProfile = data.athleteProfile
  if (typeof data.athleteNotes === 'string') out.athleteNotes = data.athleteNotes
  if (['intensity', 'volume', 'mixed'].includes(data.trainingMode)) {
    out.trainingMode = data.trainingMode as TrainingMode
  }
  if (data.deloadActive === true || data.deloadActive === 'true') out.deloadActive = true
  else if (data.deloadActive === false || data.deloadActive === 'false') out.deloadActive = false
  if (data.autoStartRestTimer === true || data.autoStartRestTimer === 'true') out.autoStartRestTimer = true
  else if (data.autoStartRestTimer === false || data.autoStartRestTimer === 'false') out.autoStartRestTimer = false
  if (typeof data.maxSetsPerSessionPerMuscle === 'number') out.maxSetsPerSessionPerMuscle = data.maxSetsPerSessionPerMuscle
  if (typeof data.restCompoundSec === 'number') out.restCompoundSec = data.restCompoundSec
  if (typeof data.restStandardSec === 'number') out.restStandardSec = data.restStandardSec
  if (typeof data.restIsolationSec === 'number') out.restIsolationSec = data.restIsolationSec
  if (typeof data.defaultTargetSets === 'number') out.defaultTargetSets = data.defaultTargetSets
  if (typeof data.defaultTargetReps === 'string') out.defaultTargetReps = data.defaultTargetReps
  if (typeof data.progressionStepKg === 'number') out.progressionStepKg = data.progressionStepKg
  if (typeof data.deloadLoadFactor === 'number') out.deloadLoadFactor = data.deloadLoadFactor
  if (typeof data.maxFailurePct === 'number') out.maxFailurePct = data.maxFailurePct
  if (typeof data.targetRpeWhenReducing === 'number') out.targetRpeWhenReducing = data.targetRpeWhenReducing
  if (typeof data.progressWindowWeeks === 'number') out.progressWindowWeeks = data.progressWindowWeeks
  if (typeof data.progressTrendThresholdPct === 'number') out.progressTrendThresholdPct = data.progressTrendThresholdPct
  if (typeof data.maxHistoryMonths === 'number') out.maxHistoryMonths = data.maxHistoryMonths
  if (Array.isArray(data.compoundMuscles)) out.compoundMuscles = data.compoundMuscles
  if (Array.isArray(data.isolationMuscles)) out.isolationMuscles = data.isolationMuscles
  if (data.thresholdsByMode && typeof data.thresholdsByMode === 'object') out.thresholdsByMode = data.thresholdsByMode
  if (data.recommendedSets && typeof data.recommendedSets === 'object') out.recommendedSets = data.recommendedSets
  return out
}

const SETTINGS_URL = '/api/data/settings/global'
const SETTINGS_TIMEOUT_MS = 20000

/** `apiFetch` on the settings row with a timeout, so a stalled request cannot block the queue. */
async function settingsRequest(init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), SETTINGS_TIMEOUT_MS)
  try {
    return await apiFetch(SETTINGS_URL, { ...init, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Reads the raw row. A row that does not exist yet is a legitimate empty
 * state, not a failure: the API answers 200 with `null` (and a 404 is treated
 * the same way). Anything else throws.
 */
async function readSettingsRow(): Promise<Record<string, unknown>> {
  try {
    const res = await settingsRequest()
    const data = await res.json()
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return {}
    throw e
  }
}

// Loads and writes of `settings/global` run one at a time, in call order. A
// write therefore always merges into a row that is fully read, and a response
// to an older request can never land on top of a newer one.
const settingsQueue = createSerialQueue()
let pendingSettingsLoad: Promise<void> | null = null
/** The row as last read or written, including attributes this client does not model. */
let rawSettingsRow: Record<string, unknown> = {}

export const useDataStore = create<DataStore>()((set, get) => {
  /** Never rejects: the outcome is `settingsStatus`. */
  async function runSettingsLoad(): Promise<void> {
    if (get().settingsStatus !== 'success') set({ settingsStatus: 'loading' })
    try {
      const row = await readSettingsRow()
      rawSettingsRow = row
      const stored = parseStoredSettings(row)
      const effective = mergeWithDefaults(stored)
      set({
        storedSettings: stored,
        settingsStatus: 'success',
        deloadActive: effective.deloadActive,
        trainingMode: effective.trainingMode,
      })
    } catch (e) {
      console.error('Failed to load settings:', e)
      // A failed refresh keeps the row already held; only a row that was
      // never read becomes an error.
      if (get().settingsStatus !== 'success') set({ settingsStatus: 'error' })
    }
  }

  return {
  sessions: createInitialState<Session>(),
  sets: createInitialState<SetEntry>(),
  exercises: createInitialState<Exercise>(),
  plan: createInitialState<PlanRow>(),
  storedSettings: {},
  settingsStatus: 'idle' as SettingsLoadStatus,
  deloadActive: false,
  trainingMode: 'mixed' as TrainingMode,

  loadSessions: createLoader<Session>(
    '/api/data/sessions',
    () => get().sessions,
    (data) => set({ sessions: data })
  ),

  loadSets: createLoader<SetEntry>(
    '/api/data/sets',
    () => get().sets,
    (data) => set({ sets: data })
  ),

  loadExercises: createLoader<Exercise>(
    '/api/data/exercises',
    () => get().exercises,
    (data) => set({ exercises: data })
  ),

  loadPlan: createSequencedLoader<PlanRow>(
    async (onUpdate) => {
      onUpdate({ status: 'loading', startedAt: performance.now(), progress: 0 })
      try {
        const rows = await fetchActivePlanRows()
        onUpdate({ status: 'success', data: rows, progress: 100 })
      } catch (e: any) {
        onUpdate({ status: 'error', error: e?.message || 'Failed to load plan' })
      }
    },
    () => get().plan,
    (data) => set({ plan: data })
  ),

  loadSettings(force = false) {
    if (pendingSettingsLoad && !force) return pendingSettingsLoad
    if (get().settingsStatus !== 'success') set({ settingsStatus: 'loading' })
    const request: Promise<void> = settingsQueue(runSettingsLoad).finally(() => {
      if (pendingSettingsLoad === request) pendingSettingsLoad = null
    })
    pendingSettingsLoad = request
    return request
  },

  loadAll: createBatchLoader([
    () => get().loadSessions(),
    () => get().loadSets(),
    () => get().loadExercises(),
    () => get().loadPlan(),
    () => get().loadSettings(),
  ]),

  invalidate(tables = ['sessions', 'sets', 'exercises', 'plan']) {
    const updates: Partial<DataStore> = {}
    if (tables.includes('sessions')) updates.sessions = createInitialState<Session>()
    if (tables.includes('sets')) updates.sets = createInitialState<SetEntry>()
    if (tables.includes('exercises')) updates.exercises = createInitialState<Exercise>()
    if (tables.includes('plan') || tables.includes('plans')) updates.plan = createInitialState<PlanRow>()
    set(updates)
  },

  setSettings(patch: Partial<Settings>) {
    // Queued behind any load in flight. The API does a full-row PutItem, so
    // the patch is merged into the row as read; if the row could not be read
    // there is nothing safe to merge into and the write is refused.
    return settingsQueue(async () => {
      if (get().settingsStatus !== 'success') await runSettingsLoad()
      const state = get()
      const write = buildSettingsWrite(state.settingsStatus, rawSettingsRow, state.storedSettings, patch)
      if (!write) throw new SettingsNotLoadedError()

      const previous = {
        storedSettings: state.storedSettings,
        deloadActive: state.deloadActive,
        trainingMode: state.trainingMode,
      }
      const effective = mergeWithDefaults(write.stored)
      set({
        storedSettings: write.stored,
        deloadActive: effective.deloadActive,
        trainingMode: effective.trainingMode,
      })
      try {
        await settingsRequest({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(write.row),
        })
        rawSettingsRow = write.row
      } catch (e) {
        set(previous)
        throw e
      }
    })
  },

  setDeloadActive(active: boolean) {
    return get().setSettings({ deloadActive: active }).then(
      () => true,
      e => { console.error('setDeloadActive failed:', e); return false }
    )
  },

  setTrainingMode(mode: TrainingMode) {
    return get().setSettings({ trainingMode: mode }).then(
      () => true,
      e => { console.error('setTrainingMode failed:', e); return false }
    )
  },

  addSessionOptimistic(session: Session) {
    const current = get().sessions
    if (current.status === 'success' && current.data) {
      set({ sessions: { ...current, data: [...current.data, session] } })
    }
  },

  removeSessionOptimistic(sessionId: string) {
    const current = get().sessions
    if (current.status === 'success' && current.data) {
      set({ sessions: { ...current, data: current.data.filter(s => s.id !== sessionId) } })
    }
  },

  addSetOptimistic(newSet: SetEntry) {
    const current = get().sets
    if (current.status === 'success' && current.data) {
      set({ sets: { ...current, data: [...current.data, newSet] } })
    }
  },

  removeSetOptimistic(setId: string) {
    const current = get().sets
    if (current.status === 'success' && current.data) {
      set({ sets: { ...current, data: current.data.filter(s => s.id !== setId) } })
    }
  },

  updateSessionOptimistic(sessionId: string, updates: Partial<Session>) {
    const current = get().sessions
    if (current.status === 'success' && current.data) {
      set({
        sessions: {
          ...current,
          data: current.data.map(s => s.id === sessionId ? { ...s, ...updates } : s)
        }
      })
    }
  },
  }
})
