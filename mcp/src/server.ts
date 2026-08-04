/**
 * Read-only MCP server over the gym tracker's DynamoDB tables.
 *
 * Transport is stdio: the MCP client spawns this as a child process and kills
 * it on disconnect. There is no daemon, no listening port, nothing to keep
 * running. Credentials come from the AWS profile named in the client config.
 *
 * READ-ONLY BY CONSTRUCTION: nothing here imports a DynamoDB write command.
 * Keep it that way — a chat that can rewrite training history is a chat that
 * can quietly corrupt it.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { loadDataset } from './ddb'
import {
  getActivePlan,
  getExerciseProgress,
  getRecentSessions,
  getTrainingLoad,
  getWeeklyReview,
  listExercises,
} from './tools'

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const server = new McpServer({
  name: 'gym-tracker',
  version: '0.1.0',
})

/** Every tool answers with JSON text: models parse it far more reliably than prose tables. */
function json(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] }
}

server.registerTool(
  'get_training_load',
  {
    title: 'Training load per day',
    description:
      'Day-by-day training load: sets, tonnage (kg lifted), duration, mean perceived intensity (1-5), ' +
      'sets per muscle group, and any non-gym activity (run, ride, swim). One row per calendar day on ' +
      'which something was logged, keyed on a YYYY-MM-DD date. This is the tool to use when correlating ' +
      'training with nutrition, body weight or sleep data from another source: join on `date`. ' +
      'CAVEAT: body weight is not stored by this app, so `tonnageKg` counts added load only and ' +
      'understates any day listing `bodyweightExercises`. Treat it as a relative trend, never as an ' +
      'absolute measure of work or energy expenditure.',
    inputSchema: {
      from: DATE.optional().describe('Inclusive start date. Defaults to the earliest logged day.'),
      to: DATE.optional().describe('Inclusive end date. Defaults to today.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ from, to }) => json(getTrainingLoad(await loadDataset(), { from, to }))
)

server.registerTool(
  'get_weekly_review',
  {
    title: 'Weekly training review',
    description:
      'The same weekly review the app shows on its dashboard: plan adherence, total sets and volume, ' +
      'share of sets taken to failure, sets per muscle group against the weekly target, untouched muscles, ' +
      'off-plan exercises, logged activities, and the coach findings/proposals. ' +
      'Findings come back as dictionary keys plus values — state them in the user\'s language.',
    inputSchema: {
      weeksAgo: z.number().int().min(0).max(52).optional()
        .describe('0 = current week (default), 1 = last week, and so on.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ weeksAgo }) => json(getWeeklyReview(await loadDataset(), { weeksAgo }))
)

server.registerTool(
  'get_exercise_progress',
  {
    title: 'Progress on one exercise',
    description:
      'History of a single exercise: best set per session with estimated 1RM (Epley), tonnage, ' +
      'sets taken to failure, plus all-time personal bests by estimated 1RM and by absolute load. ' +
      'Accepts an exercise name (partial match is fine) or its id. ' +
      'When `bodyweightExercise` is true the load-based figures come back null on purpose — the stored ' +
      'weight is the ADDED load only, so progress there is reps and volume, not kilos.',
    inputSchema: {
      exercise: z.string().min(1).describe('Exercise name or id, e.g. "panca piana" or "E037".'),
      limit: z.number().int().min(1).max(60).optional()
        .describe('How many of the most recent sessions to return. Default 12.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ exercise, limit }) => json(getExerciseProgress(await loadDataset(), { exercise, limit }))
)

server.registerTool(
  'get_recent_sessions',
  {
    title: 'Recent sessions',
    description:
      'The most recent sessions, newest first, each summarised per exercise (sets, top weight, reps per set, ' +
      'failure sets, any comment the athlete left). Non-gym activities are included by default and are marked ' +
      'with kind="activity" — they never count as training.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().describe('Default 10.'),
      includeActivities: z.boolean().optional().describe('Default true.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ limit, includeActivities }) =>
    json(getRecentSessions(await loadDataset(), { limit, includeActivities }))
)

server.registerTool(
  'get_active_plan',
  {
    title: 'Active training plan',
    description:
      'The currently active plan: one prototype week, broken down by day, with target sets, rep ranges ' +
      'and target RPE per exercise. Returns active=false when no plan is active.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => json(getActivePlan(await loadDataset()))
)

server.registerTool(
  'list_exercises',
  {
    title: 'List exercises',
    description:
      'The exercise catalogue with the muscle groups each one trains, and whether it has ever been logged. ' +
      'Use it to resolve a name before calling get_exercise_progress.',
    inputSchema: {
      query: z.string().optional().describe('Case-insensitive substring filter on the name.'),
      onlyLogged: z.boolean().optional().describe('Only exercises with at least one logged set. Default false.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query, onlyLogged }) => json(listExercises(await loadDataset(), { query, onlyLogged }))
)

const transport = new StdioServerTransport()
await server.connect(transport)
