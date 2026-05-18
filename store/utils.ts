import type { LoadState } from '@/lib/fetchJson'
import { fetchJSON } from '@/lib/fetchJson'

export type StoreLoader<T> = {
  loadData: (force?: boolean) => Promise<void>
  data: LoadState<T[]>
}

export function createLoader<T>(
  endpoint: string,
  getCurrentData: () => LoadState<T[]>,
  updateData: (data: LoadState<T[]>) => void
): (force?: boolean) => Promise<void> {
  return async (force = false) => {
    const currentData = getCurrentData()
    if (!force && (currentData.status === 'loading' || currentData.status === 'success')) {
      return
    }

    try {
      await fetchJSON<T[]>(endpoint, {
        onUpdate: updateData
      })
    } catch (error: any) {
      updateData({
        status: 'error',
        error: error.message || 'Errore di caricamento'
      })
    }
  }
}

export function createBatchLoader(loaders: Array<(force?: boolean) => Promise<void>>) {
  return async (force = false) => {
    await Promise.all(loaders.map(loader => loader(force)))
  }
}

export const createInitialState = <T>(): LoadState<T[]> => ({ status: 'idle' })