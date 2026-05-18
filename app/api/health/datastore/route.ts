import { NextResponse } from 'next/server'
import { readTable } from '@/lib/data/dataStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DynamoDB backend health check.
 * Performs a minimal scan on the `exercises` table to verify connectivity + IAM.
 */

const DYNAMO_TABLE_VARS = [
  'DYNAMO_TABLE_EXERCISES',
  'DYNAMO_TABLE_SESSIONS',
  'DYNAMO_TABLE_SETS',
  'DYNAMO_TABLE_PLANS',
  'DYNAMO_TABLE_SETTINGS',
]

function checkConfig(): string[] {
  return DYNAMO_TABLE_VARS.filter(v => !process.env[v])
}

export async function GET() {
  const startTime = Date.now()
  const missingVars = checkConfig()

  if (missingVars.length > 0) {
    return NextResponse.json(
      {
        summary: { status: 'error', responseTime: `${Date.now() - startTime}ms` },
        error: 'Missing environment variables',
        missingVars,
      },
      { status: 500 },
    )
  }

  try {
    const exercises = await readTable('exercises')
    return NextResponse.json({
      summary: { status: 'ok', responseTime: `${Date.now() - startTime}ms` },
      connection: { ok: true, recordCount: exercises.length, testTable: 'exercises' },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        APP_AWS_REGION: process.env.APP_AWS_REGION || null,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        summary: { status: 'error', responseTime: `${Date.now() - startTime}ms` },
        connection: { ok: false, error: error?.message || String(error) },
      },
      { status: 500 },
    )
  }
}
