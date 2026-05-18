import 'server-only'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import type { DataStore } from './dataStore'

/**
 * Logical table name → suffix of the `DYNAMO_TABLE_*` env var.
 * Tables are created by the SAM stack and the real names are injected
 * by the Amplify build from stack outputs.
 *
 * CUSTOMIZE: to add a table, add the key here and the matching resource
 * in `template.yaml`.
 */
const TABLE_MAPPING: Record<string, string> = {
  exercises: 'EXERCISES',
  sessions: 'SESSIONS',
  sets: 'SETS',
  plans: 'PLANS',
  settings: 'SETTINGS',
}

function tableName(logicalName: string): string {
  const suffix = TABLE_MAPPING[logicalName]
  if (!suffix) throw new Error(`Unknown table: ${logicalName}`)
  const envName = `DYNAMO_TABLE_${suffix}`
  const value = process.env[envName]
  if (!value) throw new Error(`Missing environment variable: ${envName}`)
  return value
}

function keyOf(row: any) {
  return row.id ? { id: row.id } : { date: row.date }
}

const region =
  process.env.APP_AWS_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'eu-south-1'

// Default: standard credential provider chain (IAM role on Amplify).
// CUSTOMIZE: for explicit credentials (local testing) set DYNAMODB_ACCESS_KEY/SECRET_KEY.
const clientConfig: any = { region }
if (process.env.DYNAMODB_ACCESS_KEY && process.env.DYNAMODB_SECRET_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.DYNAMODB_ACCESS_KEY,
    secretAccessKey: process.env.DYNAMODB_SECRET_KEY,
    sessionToken: process.env.DYNAMODB_SESSION_TOKEN,
  }
}
const client = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig))

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

async function readTable<T = any>(table: string): Promise<T[]> {
  const { getCache, setCache } = await import('./dataCache')

  const cached = getCache(table)
  if (cached) return cached as T[]

  const name = tableName(table)
  try {
    const res = await client.send(new ScanCommand({ TableName: name, ConsistentRead: true }))
    const result = (res.Items ?? []) as T[]
    setCache(table, result as any[])
    return result
  } catch (error) {
    console.error(`DynamoDB scan failed: ${name}`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      status: (error as any)?.$metadata?.httpStatusCode,
      requestId: (error as any)?.$metadata?.requestId,
    })
    throw error
  }
}

async function getRow<T = any>(table: string, id: string): Promise<T | null> {
  const res = await client.send(new GetCommand({ TableName: tableName(table), Key: { id } }))
  return (res.Item ?? null) as T | null
}

async function appendRow(table: string, row: Record<string, any>) {
  if (!row.id) row.id = generateId()
  await client.send(new PutCommand({ TableName: tableName(table), Item: row }))
  const { invalidate } = await import('./dataCache')
  invalidate(table)
}

async function updateRow(table: string, id: string, row: Record<string, any>) {
  await client.send(new PutCommand({ TableName: tableName(table), Item: { ...row, id } }))
  const { invalidate } = await import('./dataCache')
  invalidate(table)
}

async function deleteRow(table: string, id: string) {
  const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb')
  await client.send(new DeleteCommand({ TableName: tableName(table), Key: keyOf({ id }) }))
  const { invalidate } = await import('./dataCache')
  invalidate(table)
}

async function deleteRowsWhere(table: string, condition: (row: any) => boolean) {
  const name = tableName(table)
  const res = await client.send(new ScanCommand({ TableName: name }))
  const toDelete = (res.Items ?? []).filter(condition)

  for (let i = 0; i < toDelete.length; i += 25) {
    const batch = toDelete.slice(i, i + 25).map(item => ({ DeleteRequest: { Key: keyOf(item) } }))
    if (batch.length) await client.send(new BatchWriteCommand({ RequestItems: { [name]: batch } }))
  }

  if (toDelete.length > 0) {
    const { invalidate } = await import('./dataCache')
    invalidate(table)
  }
}

const dynamoAdapter: DataStore = {
  readTable,
  appendRow,
  updateRow,
  deleteRow,
  deleteRowsWhere,
  getRow,
}

export default dynamoAdapter
