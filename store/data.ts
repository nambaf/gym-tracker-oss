import { create } from 'zustand'
import type { LoadState } from '@/lib/fetchJson'
import type { Session, SetEntry, Exercise, Plan, PlanRow } from '@/lib/models'
import type { TrainingMode } from '@/lib/hypertrophyThresholds'
import type { Settings } from '@/lib/settings/types'
import { mergeWithDefaults } from '@/lib/settings/effective'
import { createLoader, createBatchLoader, createInitialState } from './utils'

interface DataStore {
  sessions: LoadState<Session[]>
  sets: LoadState<SetEntry[]>
  exercises: LoadState<Exercise[]>
  plan: LoadState<PlanRow[]>
  /** Raw `settings/global` row (sans defaults). Source-of-truth for writes. */
  storedSettings: Partial<Settings>
  deloadActive: boolean
  trainingMode: TrainingMode
  loadSessions: (force?: boolean) => Promise<void>
  loadSets: (force?: boolean) => Promise<void>
  loadExercises: (force?: boolean) => Promise<void>
  loadPlan: (force?: boolean) => Promise<void>
  loadSettings: (force?: boolean) => Promise<void>
  loadAll: (force?: boolean) => Promise<void>
  invalidate: (tables?: string[]) => void
  setSettings: (patch: Partial<Settings>) => Promise<void>
  setDeloadActive: (active: boolean) => void
  setTrainingMode: (mode: TrainingMode) => void
  addSessionOptimistic: (session: Session) => void
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
  if (typeof data.maxSetsPerSessionPerMuscle === 'number') out.maxSetsPerSessionPerMuscle = data.maxSetsPerSessionPerMuscle
  if (typeof data.restCompoundSec === 'number') out.restCompoundSec = data.restCompoundSec
  if (typeof data.restStandardSec === 'number') out.restStandardSec = data.restStandardSec
  if (typeof data.restIsolationSec === 'number') out.restIsolationSec = data.restIsolationSec
  if (Array.isArray(data.compoundMuscles)) out.compoundMuscles = data.compoundMuscles
  if (Array.isArray(data.isolationMuscles)) out.isolationMuscles = data.isolationMuscles
  if (data.thresholdsByMode && typeof data.thresholdsByMode === 'object') out.thresholdsByMode = data.thresholdsByMode
  if (data.recommendedSets && typeof data.recommendedSets === 'object') out.recommendedSets = data.recommendedSets
  return out
}

export const useDataStore = create<DataStore>()((set, get) => ({
  sessions: createInitialState<Session>(),
  sets: createInitialState<SetEntry>(),
  exercises: createInitialState<Exercise>(),
  plan: createInitialState<PlanRow>(),
  storedSettings: {},
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

  loadPlan: async (force = false) => {
    const current = get().plan
    if (!force && (current.status === 'loading' || current.status === 'success')) return
    set({ plan: { status: 'loading', startedAt: performance.now(), progress: 0 } })
    try {
      const rows = await fetchActivePlanRows()
      set({ plan: { status: 'success', data: rows, progress: 100 } })
    } catch (e: any) {
      set({ plan: { status: 'error', error: e?.message || 'Failed to load plan' } })
    }
  },

  loadSettings: async () => {
    try {
      const res = await fetch('/api/data/settings/global')
      if (!res.ok) return
      const data = await res.json()
      const stored = parseStoredSettings(data)
      const effective = mergeWithDefaults(stored)
      set({
        storedSettings: stored,
        deloadActive: effective.deloadActive,
        trainingMode: effective.trainingMode,
      })
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
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

  async setSettings(patch: Partial<Settings>) {
    // Merge with the current stored row before writing — the API does a
    // full-row PutItem, so sending only `patch` would wipe other fields.
    const current = get().storedSettings
    const merged: Partial<Settings> = { ...current, ...patch, id: 'global' }
    const effective = mergeWithDefaults(merged)
    set({
      storedSettings: merged,
      deloadActive: effective.deloadActive,
      trainingMode: effective.trainingMode,
    })
    const res = await fetch('/api/data/settings/global', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    })
    if (!res.ok) throw new Error(`Failed to save settings: HTTP ${res.status}`)
  },

  setDeloadActive(active: boolean) {
    get().setSettings({ deloadActive: active }).catch(e => console.error('setDeloadActive failed:', e))
  },

  setTrainingMode(mode: TrainingMode) {
    get().setSettings({ trainingMode: mode }).catch(e => console.error('setTrainingMode failed:', e))
  },

  addSessionOptimistic(session: Session) {
    const current = get().sessions
    if (current.status === 'success' && current.data) {
      set({ sessions: { ...current, data: [...current.data, session] } })
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
}))
