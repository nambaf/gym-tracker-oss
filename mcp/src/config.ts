/**
 * Configuration for the local MCP server.
 *
 * The server is a child process spawned by an MCP client (Claude Desktop,
 * Claude Code), not a long-running daemon: it reads its config once at start
 * and dies when the client disconnects.
 *
 * Credentials come from the standard AWS chain via `AWS_PROFILE` — the same
 * SSO profile used for CLI work. Nothing is stored in this repo.
 */
import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
/** Repo root — `mcp/src` → `mcp` → repo. */
export const REPO_ROOT = resolve(here, '..', '..')

// The app's own env files are the source of truth for table names, so the MCP
// server never drifts from what the deployed app reads. `.env.local` wins
// because that is where a local override belongs.
for (const file of ['.env.local', '.env']) {
  const path = resolve(REPO_ROOT, file)
  if (existsSync(path)) loadDotenv({ path, override: false, quiet: true })
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] || fallback
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in the repo's .env.local, or pass it in the MCP client's ` +
      `server config under "env".`
    )
  }
  return value
}

export const REGION = process.env.APP_AWS_REGION || 'eu-south-1'

/** Falls back to the naming convention amplify.yml uses: <APP_NAME>-<table>-<ENVIRONMENT>. */
function tableFor(logical: string, envSuffix: string): string {
  const appName = process.env.APP_NAME
  const environment = process.env.ENVIRONMENT
  const derived = appName && environment ? `${appName}-${logical}-${environment}` : undefined
  return required(`DYNAMO_TABLE_${envSuffix}`, derived)
}

export const TABLES = {
  exercises: tableFor('exercises', 'EXERCISES'),
  sessions: tableFor('sessions', 'SESSIONS'),
  sets: tableFor('sets', 'SETS'),
  plans: tableFor('plans', 'PLANS'),
  settings: tableFor('settings', 'SETTINGS'),
} as const

/**
 * How long a loaded dataset stays fresh within one process. A client session
 * fires several tool calls in a row while answering a single question; without
 * this, each one re-scans every table.
 */
export const DATASET_TTL_MS = Number(process.env.MCP_DATASET_TTL_MS || 60_000)
