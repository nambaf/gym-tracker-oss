# Gym Tracker

> Mobile-first gym workout tracker, self-hosted on AWS. Integrated AI coach. Italian/English UI.

**🌐 Live overview & screenshots → [nambaf.github.io/gym-tracker-oss](https://nambaf.github.io/gym-tracker-oss/)**

[![Website](https://img.shields.io/badge/Website-live-d6492a)](https://nambaf.github.io/gym-tracker-oss/) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![AWS Cognito](https://img.shields.io/badge/Auth-Cognito-orange) ![AWS DynamoDB](https://img.shields.io/badge/DB-DynamoDB-blue) ![Amplify Hosting](https://img.shields.io/badge/Deploy-Amplify-yellow) ![License MIT](https://img.shields.io/badge/License-MIT-green)

## What Is It

An app for tracking strength and hypertrophy workouts with personalized plans, session history, and AI coaching for volume and progression advice. **Single-user self-hosted**: fork it, deploy to your own AWS account, and use your private instance.

- Mobile-first PWA
- Set/reps/RPE/weight history per exercise
- Multi-plan workout scheduler (3/4-day, full body, split, etc.)
- AI coach with provider abstraction: **AWS Bedrock**, **Gemini**, **OpenAI**, **Anthropic**, or **off**
- Body muscle map, weekly volume / intensity charts, exercise history, manual deload banner, progress modal
- Auth via **AWS Cognito** (USER_PASSWORD_AUTH, single owner user)
- Data on **DynamoDB** (direct IAM, no API Gateway)
- **i18n** — UI and AI coach replies in Italian or English

## Quick Start

### Prerequisites

Install once on your machine:

- An AWS account, and an IAM user/role that can create CloudFormation stacks, DynamoDB tables, and Cognito User Pools.
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), authenticated via `aws configure`. If you already have AWS SSO / IAM Identity Center configured, refresh and export the profile for this shell instead:
  ```bash
  aws sso login --profile <your-profile>
  export AWS_PROFILE=<your-profile>
  ```
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
- Node.js — the version pinned in `.nvmrc`.

You do **not** need to create or fill in any `.env` file before deploying. SAM takes its parameters from the command line; the `.env` file is only used later for local development.

### 1. Clone the repo

```bash
git clone https://github.com/<your-user>/gym-tracker-oss.git
cd gym-tracker-oss
npm install
```

### 2. Deploy the AWS infrastructure

This creates 5 DynamoDB tables, a Cognito User Pool, and a single pre-created owner user. Pick your own `OwnerEmail` — it's the email you'll use to sign in.

```bash
sam deploy --guided \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AppName=gym-tracker \
    Environment=dev \
    OwnerEmail=you@example.com
```

`CAPABILITY_NAMED_IAM` is required because the template creates IAM resources with explicit names — a managed policy (`<AppName>-runtime-<Environment>`) and the Amplify compute role (`<AppName>-amplify-compute-<Environment>`) that the SSR runtime assumes (see step 4b).

`--guided` runs an interactive flow. Recommended answers:

| Prompt | Answer |
|---|---|
| **Stack Name** | something descriptive, e.g. `gym-tracker-dev` (don't keep the default `sam-app`). |
| **AWS Region** | the region where infra lives, e.g. `eu-south-1`. Bedrock runs in its own region (`BEDROCK_REGION`), so you're not locked in here. |
| **Parameter `AppName` / `Environment` / `OwnerEmail`** | already filled from `--parameter-overrides`, just press Enter. |
| **Confirm changes before deploy** | `y` — review the changeset on the first deploy. |
| **Allow SAM CLI IAM role creation** | `Y` — the template creates IAM policies. |
| **Disable rollback** | `N` — keep rollback enabled. |
| **`OwnerUser` may not have authorization defined, Is this okay?** | `y` — false positive, SAM raises this on any non-Lambda resource. |
| **Save arguments to configuration file** | `Y` — creates `samconfig.toml` so future deploys are just `sam deploy`. |
| **SAM configuration file** | Enter (default `samconfig.toml`). |
| **SAM configuration environment** | Enter (default `default`). |

The deploy takes a few minutes — Cognito is the slowest resource. When it finishes, the **`EnvironmentVariables`** output block contains the values you'll need next — copy them somewhere handy.

> ⚠️ **`AppName` is the single most error-prone parameter.** Type it once, exactly the same, **everywhere**: in `--parameter-overrides`, in the `--guided` prompt confirmation, and later in Amplify env vars (`APP_NAME`, step 4b). A typo of one character (`gym-tracker-os` vs `gym-tracker-oss`) makes the stack and the app silently disagree — the deploy succeeds, but at runtime the app looks up tables that don't exist and you get HTTP 500 on `/api/data/*` with no obvious cause. Recommended: stick with the default `gym-tracker`. If you change it, change it everywhere.

### 3. Set the Cognito owner's temporary password

Cognito creates the owner user empty. Set a temporary password (you'll be forced to change it on first login):

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId from step 2 output> \
  --username you@example.com \
  --password 'TempPwd1!'
```

From here, pick **one** of the two paths below.

### 4a. Run locally (`npm run dev`)

Useful for trying the app, or for development work, against the live AWS stack from your laptop.

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

- `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` — from step 2 output.
- `DYNAMO_TABLE_*` — follow the pattern `<AppName>-<table>-<Environment>`, e.g. `gym-tracker-exercises-dev`.
- `AI_PROVIDER=off` to start (or wire up a provider — see [AI Providers](#ai-providers)).

Then:

```bash
npm run dev
```

Open <http://localhost:3000>, sign in with the email + temp password, set a new one. On a fresh DB the dashboard shows a **"Fresh install"** banner that links to `/setup` — see [First run](#first-run) below.

### 4b. Deploy to Amplify (production)

1. In the AWS Amplify console: "Host a web app" → connect your forked GitHub repo, pick the branch.
2. Under **App settings → Environment variables**, add the variables below.

   **Required — always set these:**

   | Variable | Value | Where it comes from |
   |---|---|---|
   | `APP_AWS_REGION` | e.g. `eu-south-1` | the region your SAM stack runs in |
   | `APP_NAME` | e.g. `gym-tracker` | **must match exactly** the `AppName` from `sam deploy` |
   | `ENVIRONMENT` | e.g. `dev` | **must match exactly** the `Environment` from `sam deploy` |
   | `COGNITO_USER_POOL_ID` | long ID | SAM `EnvironmentVariables` output |
   | `COGNITO_CLIENT_ID` | long ID | SAM `EnvironmentVariables` output |
   | `AI_PROVIDER` | one of `bedrock` / `gemini` / `openai` / `anthropic` / `off` | pick one |

   **Optional:**

   | Variable | Value | Default if unset |
   |---|---|---|
   | `DEFAULT_LANG` | `it` or `en` | `it` |

   **Conditional — only if `AI_PROVIDER` is not `off`:**

   | If `AI_PROVIDER` is | Set |
   |---|---|
   | `bedrock` | `BEDROCK_REGION` (e.g. `us-east-1`), `BEDROCK_MODEL_ID` (e.g. `anthropic.claude-haiku-4-5`) |
   | `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` (e.g. `gemini-2.5-flash`) |
   | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` (e.g. `gpt-4o-mini`) |
   | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (e.g. `claude-haiku-4-5`) |

   **Do NOT set in Amplify** (they would just clutter the panel — nothing reads them at runtime):

   - `DYNAMO_TABLE_*` — derived at build time by `amplify.yml` from `APP_NAME + ENVIRONMENT`.
   - `DYNAMODB_ACCESS_KEY` / `DYNAMODB_SECRET_KEY` / `DYNAMODB_SESSION_TOKEN` — production uses the Amplify compute role, not static keys.
   - `NODE_ENV` — Amplify sets this to `production` automatically.

3. Trigger the build (Amplify auto-detects `amplify.yml`).
4. **Bind the SSR compute role to the Amplify app** (one-off — see below).
5. When the build is green and the role is bound, open the Amplify URL, sign in with email + temp password, set the new one. On the empty stack the dashboard shows a **"Fresh install"** banner that links to `/setup` — see [First run](#first-run) below.

#### Binding the SSR compute role

The SAM stack already creates an IAM role named `<AppName>-amplify-compute-<Environment>` (e.g. `gym-tracker-amplify-compute-dev`) with DynamoDB access pre-attached. You just need to tell Amplify to use it for the SSR runtime — one CLI call:

```bash
aws amplify update-app \
  --app-id <APP_ID> \
  --compute-role-arn <AmplifyComputeRoleArn from sam deploy outputs> \
  --region <your region>
```

`<APP_ID>` is the 12-ish-char string in the Amplify console URL (e.g. `d136lpmaniqigy`), also visible under **App settings → General**.

> ⚠️ **Do NOT pick the ARN from the Amplify console.** The console shows a `AmplifySSRLoggingRole-<uuid>` under App settings → IAM roles → *Service role*. That is a different role used by Amplify itself for logging — it has **no** DynamoDB permissions. Binding it as compute role makes login succeed but `/api/data/*` return 500. The only correct ARN is the `AmplifyComputeRoleArn` printed in your `sam deploy` outputs.

After the call, **redeploy the app from the Amplify console** ("Redeploy this version") — the compute role is only picked up on the next deploy.

Sanity check (run *after* the redeploy finishes):

```bash
aws amplify get-app --app-id <APP_ID> --query "app.computeRoleArn" --output text --region <your region>
```

This must echo the same ARN you just bound (ending in `<AppName>-amplify-compute-<Environment>`). If it echoes anything starting with `AmplifySSRLoggingRole-`, the bind was on the wrong role — re-run the `update-app` command with the SAM output ARN.

When you add a new DynamoDB table later, the managed policy auto-updates at the next `sam deploy` and the role inherits it — no re-bind required.

> ⚠️ **Env var changes require a manual rebuild.** Amplify does **not** redeploy automatically when you edit variables in the console. The `.env.production` file is regenerated only at build time — so after any env var change, click "Redeploy this version" (or push a commit) to pick up the new values. Symptoms of a stale build: login returns HTTP 500 (`auth_not_configured`) even though the variables look correct in the console.

> ⚠️ **Symptom: login works but `/api/data/*` returns 500 with `CredentialsProviderError`.** The compute role is not bound to the app, so the SSR runtime has no AWS credentials. Re-run the `aws amplify update-app --compute-role-arn …` command above and redeploy. Cognito itself does **not** need IAM permissions — `InitiateAuth` is a public API and JWT verification uses the public JWKS endpoint.

---

The authoritative deploy reference is the inline comments inside `template.yaml`, `amplify.yml`, and `.env.example`. There is no separate `docs/` tree.

Subsequent infra changes: edit `template.yaml`, then re-run `sam deploy` (no flags needed once `samconfig.toml` exists). For a single-user self-hosted app, running SAM from your laptop is simpler than wiring up OIDC + GitHub Actions for the handful of infra changes you'll ever make.

## First run

After the first login your DynamoDB tables are empty. The home dashboard detects this and shows a **Fresh install** banner pointing to `/setup`.

`/setup` is a two-card, opt-in wizard:

1. **Default exercises** — inserts ~27 base exercises covering every muscle group, picking names in the language active at click time (resolved from the `gt_lang` cookie / `Accept-Language` / `DEFAULT_LANG`). Source: `lib/seedData/exercises.ts`.
2. **Starter plan** (optional) — inserts a 2-day full-body A/B plan referencing the exercises seeded in step 1. Source: `lib/seedData/plan.ts`. The plan is marked `isActive: true`.

Both steps are skippable and idempotent: the seed endpoints (`POST /api/data/exercises/seed`, `POST /api/data/plans/seed`) refuse to overwrite a table that already has rows. You can build everything by hand from the **Plan** page instead — `/setup` is just a shortcut.

> ℹ️ **Localized at insert time, not at runtime.** Exercise names and day labels are persisted in the locale active when you click the seed buttons. Switching the UI language afterwards does **not** retranslate the existing rows — rename them by hand from the Plan page if you want.

## What you can do in the app

- **Track a session** — `Workout` tab: log set/reps/weight/RPE, see the rest timer, and per-exercise history side-by-side.
- **Build plans** — `Plan` tab: assign exercises to days, set target sets/reps/RPE, switch between multiple plans, mark one as active.
- **History** — `History` tab: browse past sessions, drill into a specific workout, edit/delete entries.
- **Body map + charts** — home page: weekly muscle-group coverage, volume and intensity trends, 2-week activity heatmap.
- **Exercise detail** — tap an exercise from the plan to see every set ever logged for it.
- **Deload week** — toggle in the Plan page settings; applies RPE −2 to all current targets.
- **Training mode** — `intensity` / `volume` / `mixed`; biases the AI coach's suggestions.
- **AI coach** (only when `AI_PROVIDER` is set): per-session debrief and weekly review based on actual volume vs plan.
- **Switch language** — top-right switcher; cookie-based, no reload needed for UI strings.

## AI Providers

`AI_PROVIDER` selects the backend at runtime. All providers share the same prompt/abstraction (`lib/ai/`), so swapping is one env var.

| Provider | Cost | Env vars |
|---|---|---|
| `bedrock` | AWS pay-per-token | `BEDROCK_REGION`, `BEDROCK_MODEL_ID` (default `anthropic.claude-haiku-4-5`) |
| `gemini` | Free tier available | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `openai` | Pay-per-token | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `anthropic` | Pay-per-token | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| `off` | Free | _(coach disabled)_ |

### Bedrock setup

Bedrock auths via the SSR runtime's IAM role — no API key in env. Three caveats:

1. **Region** — Set `BEDROCK_REGION` to `us-east-1`, `eu-central-1`, or `us-west-2` or other region where the model is located, check the AWS page. The Bedrock region may differ from `APP_AWS_REGION` (where DynamoDB + Cognito live).
2. **IAM permission** — the SAM template (`AppRuntimePolicy`) already includes `bedrock:InvokeModel` on `arn:aws:bedrock:*::foundation-model/*`. If you forked before this was added, edit your `template.yaml` and run `sam deploy` to apply. Adopters using a non-Bedrock provider can drop the statement without impact.
3. **Model access** — AWS requires manual model-access activation. Open Bedrock console in your `BEDROCK_REGION` → **Model access** → request access to the model in `BEDROCK_MODEL_ID`. Usually instantaneous for Anthropic models, but not automatable via CloudFormation.

After enabling the model + setting `AI_PROVIDER=bedrock` in Amplify env vars, redeploy with `aws amplify start-job --app-id <id> --branch-name main --job-type RELEASE`.

## Localization

UI strings live in `lib/i18n/dictionaries/{it,en}.ts`. The active language is resolved server-side from:

1. `gt_lang` cookie (set by the in-app language switcher)
2. `Accept-Language` browser header
3. `DEFAULT_LANG` env var (default `it`)

AI coach prompts are passed a `lang` parameter and respond in the user's language.

## Contributing

Pull requests welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

If you find a vulnerability that affects every deployment of this code (not
just your own AWS account), please follow [SECURITY.md](SECURITY.md) instead
of opening a public issue.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

**Single-user self-hosted app**. No warranties, no support, no SLA. Not a medical device — AI advice does not replace a personal trainer or doctor. Your data stays in your AWS account.
