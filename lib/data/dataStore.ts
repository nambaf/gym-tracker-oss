import 'server-only'
import dynamoAdapter from './dynamoAdapter'

/**
 * Data store interface. The only implementation is `dynamoAdapter`,
 * which talks directly to DynamoDB via the Amplify IAM role.
 *
 * Helpers are re-exported as free functions so route handlers can
 * `import { readTable } from '@/lib/data/dataStore'`.
 */

export interface DataStore {
  readTable<T = any>(table: string): Promise<T[]>
  appendRow(table: string, row: Record<string, any>): Promise<void>
  updateRow(table: string, id: string, row: Record<string, any>): Promise<void>
  deleteRow(table: string, id: string): Promise<void>
  deleteSetsForSession(sessionId: string): Promise<void>
  getRow<T = any>(table: string, id: string): Promise<T | null>
}

const adapter: DataStore = dynamoAdapter

export const readTable = adapter.readTable.bind(adapter)
export const appendRow = adapter.appendRow.bind(adapter)
export const updateRow = adapter.updateRow.bind(adapter)
export const deleteRow = adapter.deleteRow.bind(adapter)
export const getRow = adapter.getRow.bind(adapter)
export const deleteSetsForSession = adapter.deleteSetsForSession.bind(adapter)

export async function deleteSession(sessionId: string) {
  // Sets are looked up via the `sessionId-index` GSI (touches only the
  // session's own rows). Sessions has `id` as HASH so a direct delete is one
  // request — no scan, no in-memory filter.
  await deleteSetsForSession(sessionId)
  await deleteRow('sessions', sessionId)
}

export default adapter
