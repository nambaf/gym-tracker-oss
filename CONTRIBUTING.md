# Contributing

Thanks for wanting to contribute! Quick guidelines to keep things moving.

## Local Setup

See the [README](README.md#quick-start) for the initial AWS deploy (SAM + Amplify). For local development against a deployed stack:

```bash
npm install
cp .env.example .env.local  # point at your dev Cognito + DynamoDB tables
npm run dev
```

## Branch Model

- `main` — protected, PRs only
- `feat/<name>` — new features
- `fix/<name>` — bug fixes
- `docs/<name>` — documentation only
- `refactor/<name>` — refactors without behavioural changes

## Commit Messages

Conventional Commits recommended but not required. Examples:

```
feat(ai): add Anthropic provider
fix(plan): order rows by day correctly
docs(readme): clarify Cognito password setup
```

## Before Opening a PR

There is no CI in this repo — Amplify builds on merge to `main`, so the only pre-merge safety net is what you run locally. Both of these must pass:

```bash
npx tsc --noEmit   # type-check (also runs as part of build)
npm run build      # must pass — includes full TS check
```

If you modified files marked with `// CUSTOMIZE:`, call it out in the PR description — adopters tune those values after forking, so a heads-up reduces breakage downstream.

## What We Don't Accept

- Multi-user / tenancy: the app is explicitly single-user. Need a different model? Fork it.
- Personal data in commits (workout backups, screenshots with real emails, etc.)
- Heavy dependencies without justification (keep the bundle lightweight)
- Reintroducing the removed `AUTH_SECRET` / `AUTH_PASSWORD_HASH` / `DATASTORE` env vars — see `CLAUDE.md` for the list of things we do not bring back

## What We Appreciate

- Bug fixes
- New AI providers (add `lib/ai/<name>.ts` and register it in `lib/ai/index.ts`)
- UI/UX improvements consistent with the existing style
- Localisation: the project ships with `it` and `en`; new dictionaries under `lib/i18n/dictionaries/` are welcome
- Clearer documentation (kept inline in `template.yaml`, `amplify.yml`, `.env.example`, and this repo's `README.md` / `CLAUDE.md`)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
