import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LoadState } from '@/lib/fetchJson'
import type { Session, SetEntry, Exercise, Plan, PlanRow } from '@/lib/models'
import type { TrainingMode } from '@/lib/hypertrophyThresholds'
import { createLoader, createBatchLoader, createInitialState } from './utils'

interface DataStore {
  sessions: LoadState<Session[]>
  sets: LoadState<SetEntry[]>
  exercises: LoadState<Exercise[]>
  plan: LoadState<PlanRow[]>
  deloadActive: boolean
  trainingMode: TrainingMode
  loadSessions: (force?: boolean) => Promise<void>
  loadSets: (force?: boolean) => Promise<void>
  loadExercises: (force?: boolean) => Promise<void>
  loadPlan: (force?: boolean) => Promise<void>
  loadSettings: (force?: boolean) => Promise<void>
  loadAll: (force?: boolean) => Promise<void>
  invalidate: (tables?: string[]) => void
  setDeloadActive: (active: boolean) => void
  setTrainingMode: (mode: TrainingMode) => void
  addSessionOptimistic: (session: Session) => void
  addSetOptimistic: (set: SetEntry) => void
  removeSetOptimistic: (setId: string) => void
  updateSessionOptimistic: (sessionId: string, updates: Partial<Session>) => void
}

async function saveSettingsToApi(settings: any) {
  try {
    await fetch('/api/data/settings/global', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, id: 'global' })
    })
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

async function fetchActivePlanRows(): Promise<PlanRow[]> {
  const res = await fetch('/api/data/plans', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load plans: ${res.status}`)
  const plans = await res.json() as Plan[]
  if (!Array.isArray(plans) || plans.length === 0) return []
  const active = plans.find(p => p.isActive) || plans[0]
  return Array.isArray(active.rows) ? active.rows : []
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      sessions: createInitialState<Session>(),
      sets: createInitialState<SetEntry>(),
      exercises: createInitialState<Exercise>(),
      plan: createInitialState<PlanRow>(),
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
          if (res.ok) {
            const data = await res.json()
            if (data && typeof data === 'object') {
              set({
                deloadActive: data.deloadActive === true || data.deloadActive === 'true',
                trainingMode: (['intensity', 'volume', 'mixed'].includes(data.trainingMode) ? data.trainingMode : 'mixed') as TrainingMode,
              })
            }
          }
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

      async setDeloadActive(active: boolean) {
        set({ deloadActive: active })
        await saveSettingsToApi({
          deloadActive: active,
          trainingMode: get().trainingMode,
        })
      },

      async setTrainingMode(mode: TrainingMode) {
        set({ trainingMode: mode })
        await saveSettingsToApi({
          deloadActive: get().deloadActive,
          trainingMode: mode,
        })
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
    }),
    {
      name: 'workout-settings',
      partialize: (state) => ({
        deloadActive: state.deloadActive,
        trainingMode: state.trainingMode,
      }),
    }
  )
)
