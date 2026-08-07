/**
 * Read-only DynamoDB access for the MCP server.
 *
 * This does NOT reuse `lib/data/dynamoAdapter.ts`: that module is marked
 * `server-only` and would throw outside the Next.js runtime. It does reuse
 * `normalizeRows`, which is the part that actually matters — pre-2026-04 rows
 * store weight/reps/rpe as DynamoDB Strings and later ones as Numbers, and
 * every aggregate below would silently mis-sort without that coercion.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { normalizeRows } from '../../lib/data/normalize'
import { mergeWithDefaults } from '../../lib/settings/effective'
import type { Exercise, Plan, Session, SetEntry } from '../../lib/models'
import type { EffectiveSettings, Settings } from '../../lib/settings/types'
import { DATASET_TTL_MS, REGION, TABLES } from './config'
import { resolveCredentials } from './credentials'
import { proxyRequestHandler } from './proxy'

// Without this the SDK falls back to the EC2 metadata endpoint when credentials
// fail to resolve, which on a laptop means minutes of silence and then a bare
// `TimeoutError` that says nothing about the actual problem.
process.env.AWS_EC2_METADATA_DISABLED = 'true'

const endpointHost = `dynamodb.${REGION}.amazonaws.com`

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: REGION,
  credentials: resolveCredentials,
  requestHandler: proxyRequestHandler(endpointHost),
}))

/**
 * A single Scan returns at most 1 MB. Without following LastEvaluatedKey the
 * history silently truncates once a table outgrows one page — and every
 * aggregate downstream starts reporting a decline the athlete never lived.
 */
async function scanAll<T>(table: string, logical: string): Promise<T[]> {
  const out: T[] = []
  let exclusiveStartKey: Record<string, any> | undefined
  do {
    const res = await client.send(new ScanCommand({
      TableName: table,
      ExclusiveStartKey: exclusiveStartKey,
    }))
    if (res.Items?.length) out.push(...(res.Items as T[]))
    exclusiveStartKey = res.LastEvaluatedKey
  } while (exclusiveStartKey)
  return normalizeRows<T>(logical, out)
}

export type Dataset = {
  exercises: Exercise[]
  sessions: Session[]
  sets: SetEntry[]
  plans: Plan[]
  settings: EffectiveSettings
}

let cached: { at: number; data: Dataset } | null = null

export async function loadDataset(force = false): Promise<Dataset> {
  if (!force && cached && Date.now() - cached.at < DATASET_TTL_MS) return cached.data

  const [exercises, sessions, sets, plans, settingsRows] = await Promise.all([
    scanAll<Exercise>(TABLES.exercises, 'exercises'),
    scanAll<Session>(TABLES.sessions, 'sessions'),
    scanAll<SetEntry>(TABLES.sets, 'sets'),
    scanAll<Plan>(TABLES.plans, 'plans'),
    scanAll<Settings & { id?: string }>(TABLES.settings, 'settings'),
  ])

  // Runtime overrides live on the singleton `settings/global` row; everything
  // else falls back to the defaults in lib/settings/defaults.ts.
  const stored = settingsRows.find(r => r.id === 'global') || null
  const data: Dataset = {
    exercises,
    sessions,
    sets,
    plans,
    settings: mergeWithDefaults(stored),
  }
  cached = { at: Date.now(), data }
  return data
}
