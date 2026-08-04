# gym-tracker MCP server

A **read-only** MCP server that exposes the training data to an MCP client
(Claude Desktop, Claude Code), so you can ask questions about your training in
chat and — once you connect a second server for nutrition — reason across both.

## What it is not

It is **not a daemon**. There is no port, nothing to start at boot, nothing
left running. The MCP client spawns it as a child process on demand and kills
it when you close the client.

It is also **not a write path**. No module here imports a DynamoDB write
command. Keep it that way: a chat that can rewrite training history is a chat
that can quietly corrupt it.

## Setup

```bash
cd mcp && npm install
```

Configuration is read from the repo's own `.env.local` / `.env`, so the table
names can never drift from what the deployed app uses. AWS credentials come
from the standard chain — set `AWS_PROFILE` in the client config below.

Verify it works before wiring any client:

```bash
AWS_PROFILE=gymtracker-dev npm run smoke
```

That exercises every tool against the real tables and prints a summary. A bad
profile or a missing table name is much easier to read here than through an MCP
client's connection error.

## Claude Code

Already wired via `.mcp.json` in the repo root — Claude Code picks it up when
started from this directory.

## Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`,
using **absolute paths** (Claude Desktop does not run from the repo):

```json
{
  "mcpServers": {
    "gym-tracker": {
      "command": "/absolute/path/to/gym-tracker-oss/mcp/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/gym-tracker-oss/mcp/src/server.ts"],
      "env": { "AWS_PROFILE": "gymtracker-dev" }
    }
  }
}
```

If the AWS profile is SSO-based, the session must be valid (`aws sso login
--profile <name>`) or every tool call fails with a credentials error.

## Tools

| Tool | Answers |
|---|---|
| `get_training_load` | Day-by-day load: sets, tonnage, duration, mean intensity, muscles hit, activities. **Keyed on `date` — this is the one to join against nutrition data.** |
| `get_weekly_review` | The same review the app's dashboard shows: adherence, coverage vs target, failure share, findings, proposals. |
| `get_exercise_progress` | Best set per session, estimated 1RM trend, personal bests, for one exercise. |
| `get_recent_sessions` | Recent sessions summarised per exercise, including logged comments. |
| `get_active_plan` | The active plan, by day, with target sets/reps/RPE. |
| `list_exercises` | Catalogue with muscle groups; use it to resolve a name. |

Every tool returns an **aggregate**, never raw rows. The `sets` table grows by
~50 rows a week; handing it over unaggregated would burn the model's context to
answer a single question.

## Two things the data cannot tell you

These are properties of the schema, not bugs, and the tools surface them
explicitly rather than papering over them:

1. **`rpe` is not a scale.** In practice it holds either `10` or nothing — it
   is a failure marker written next to the legacy `cedimento` note. Averaging
   it reports every day as maximal. The tools expose `intensity` (1–5, set by
   the athlete) and `failureSets` instead, and never surface `rpe`.

2. **Body weight is not stored anywhere.** So `tonnageKg` counts *added* load
   only, and a pull-up session contributes almost nothing. Days that include
   such work list them under `bodyweightExercises`, and
   `get_exercise_progress` returns `bodyweightExercise: true` with the
   load-based figures nulled out — an estimated 1RM of "1.3 kg" on weighted
   pull-ups is worse than no number at all. Treat tonnage as a relative trend,
   never as an absolute measure of work or energy expenditure.

The second one matters most when joining with nutrition data: tonnage is not a
calorie proxy.

## Going remote later

`src/tools.ts` holds pure functions over a loaded `Dataset` and knows nothing
about stdio. Exposing the same tools over Streamable HTTP from a Next.js route
means writing an adapter, not rewriting the tools. The hard part of that move
is authentication, not transport: an MCP client connecting from claude.ai does
not carry the Cognito cookie, so `/api/mcp` would have to be added to
`PUBLIC_PATHS` in `proxy.ts` and authenticate itself — with the token check
happening *before* any DynamoDB read.
