# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-17

### Added

- Initial public release of Gym Tracker.
- Mobile-first PWA for tracking strength and hypertrophy workouts.
- Personalised workout plans with multi-day scheduling (3/4-day, full body, split, etc.).
- Session history with set/reps/RPE/weight tracking.
- AI coach with provider abstraction (`lib/ai/`):
  - AWS Bedrock (Claude)
  - Google Gemini
  - OpenAI (GPT)
  - Anthropic API (Claude)
  - `off` (coach disabled)
- Body muscle map, weekly volume / intensity charts, exercise history, manual deload banner, progress modal.
- Single-user self-hosted architecture on AWS:
  - Cognito User Pool with USER_PASSWORD_AUTH (one pre-created owner)
  - DynamoDB tables provisioned via AWS SAM (`template.yaml`)
  - Amplify Hosting build pipeline (`amplify.yml`)
- TypeScript end-to-end with Next.js 16 (App Router, Turbopack).
- Tailwind CSS for styling, Zustand for client state.
- Internationalisation: Italian and English UI dictionaries (`lib/i18n/dictionaries/`); AI coach replies in the user's language.

### Note

This is the first stable release. The project is designed for individuals who want to deploy their own instance on AWS — there is no shared/hosted version.
