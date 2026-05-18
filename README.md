# Gym Tracker

> Mobile-first gym workout tracker, self-hosted on AWS. Integrated AI coach. Italian/English UI.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![AWS Cognito](https://img.shields.io/badge/Auth-Cognito-orange) ![AWS DynamoDB](https://img.shields.io/badge/DB-DynamoDB-blue) ![Amplify Hosting](https://img.shields.io/badge/Deploy-Amplify-yellow) ![License MIT](https://img.shields.io/badge/License-MIT-green)

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

```bash
# 1. Fork + clone
git clone https://github.com/<your-user>/gym-tracker-oss.git
cd gym-tracker-oss
cp .env.example .env.local  # see .env.example for every variable

# 2. Deploy the AWS infrastructure (DynamoDB + Cognito)
sam deploy --guided \
  --parameter-overrides \
    AppName=gym-tracker \
    Environment=dev \
    OwnerEmail=yourmail@example.com

# 3. Set the owner's temporary password (forced change on first login)
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId from SAM outputs> \
  --username yourmail@example.com \
  --password 'TempPwd1!'

# 4. Connect the Amplify console to your fork, then copy the variables
#    from the SAM stack's `EnvironmentVariables` output into the Amplify
#    "Environment variables" panel. Add AI_PROVIDER + provider keys if needed.

# 5. Open the Amplify URL → sign in with email + temp password → set the new one
```

The authoritative deploy reference is the inline comments inside `template.yaml`, `amplify.yml`, and `.env.example`. They are kept in sync with the code; there is no separate `docs/` tree.

### Automated SAM deploys (optional)

The first deploy is easiest with `sam deploy --guided` from your laptop. For
subsequent deploys you can use the included GitHub Action at
`.github/workflows/deploy-sam.yml` — it's gated behind `workflow_dispatch`, so
it only runs when you launch it from the Actions tab. The job intentionally
does **not** touch Amplify environment variables; after a stack change it just
prints the `EnvironmentVariables` output for you to paste into the Amplify
console.

One-off setup:

1. Create an IAM role in your AWS account with permissions to deploy this stack
   (CloudFormation, DynamoDB, Cognito). Its trust policy must allow
   `sts:AssumeRoleWithWebIdentity` from this GitHub repo via OIDC
   (`token.actions.githubusercontent.com`).
2. Add the following **repository secrets** in GitHub:
   - `AWS_DEPLOY_ROLE_ARN`
   - `AWS_DEPLOY_REGION` (e.g. `eu-south-1`)
   - `SAM_STACK_NAME`
   - `SAM_OWNER_EMAIL`
3. Optional: set repository **variables** `SAM_APP_NAME` and the workflow input
   `environment` if you want anything other than the defaults.

## AI Providers

`AI_PROVIDER` selects the backend at runtime. All providers share the same prompt/abstraction (`lib/ai/`), so swapping is one env var.

| Provider | Cost | Env vars |
|---|---|---|
| `bedrock` | AWS pay-per-token | `BEDROCK_REGION`, `BEDROCK_MODEL_ID` (default `anthropic.claude-haiku-4-5`) |
| `gemini` | Free tier available | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `openai` | Pay-per-token | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `anthropic` | Pay-per-token | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| `off` | Free | _(coach disabled)_ |

Bedrock note: Claude is not available in `eu-south-1`. Use `us-east-1`, `eu-central-1`, or `us-west-2` for `BEDROCK_REGION`.

## Localization

UI strings live in `lib/i18n/dictionaries/{it,en}.ts`. The active language is resolved server-side from:

1. `gt_lang` cookie (set by the in-app language switcher)
2. `Accept-Language` browser header
3. `DEFAULT_LANG` env var (default `it`)

AI coach prompts are passed a `lang` parameter and respond in the user's language.

## Customization

The app defaults are opinionated for an intermediate lifter targeting hypertrophy. The athlete profile fed to the AI coach lives in `lib/workout/prompts/profile.ts` — edit `ATHLETE_PROFILE` to match your sex, weight, training age, and goals so coach replies are tailored to you.

All other adopter-tunable values are marked in the code with `// CUSTOMIZE:` comments — `grep -rn 'CUSTOMIZE:'` to enumerate them. Common ones:

- AI prompts and athlete profile → `lib/workout/prompts/`
- Volume thresholds by level → `lib/hypertrophyThresholds.ts`
- Weekly recommended sets → `lib/planAnalysis.ts`
- Rest-time presets → `lib/restTimerPresets.ts`
- UI strings → `lib/i18n/dictionaries/`

## Architecture

```
Browser ──> Amplify Hosting (Next.js 16)
              ├─> Cognito User Pool (auth, 1 owner email)
              ├─> DynamoDB (5 tables, direct IAM)
              └─> AI Provider (config-driven: bedrock | gemini | openai | anthropic | off)
```

See `CLAUDE.md` for a contributor-oriented map of the codebase.

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
