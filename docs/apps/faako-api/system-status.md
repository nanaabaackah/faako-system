# Faako API System Status

## App purpose

Faako API is the Netlify Functions backend for the current Faako signup flow. It owns signup and health functions, Prisma schema, database helpers, and env-driven runtime configuration.

## Current status

Focused backend service for signup and health checks. It may run as its own Netlify site or serve as the source of mirrored functions inside Faako Website.

## Stable modules/features

- `health` Netlify Function.
- `signup` Netlify Function.
- Runtime config and database helper structure.
- Prisma schema and migration workflow.
- API-only Netlify deployment configuration.
- Signup intake PDF summary and server-side Resend email copy foundation.

## In-progress modules/features

- Signup reliability, validation, and error handling.
- Runtime configuration hardening.
- Compatibility with Faako Website mirrored function deployment.
- Internal onboarding review/checklist workflow planning.

## Experimental modules/features

- Any additional functions beyond `health` and `signup` until documented and deployed intentionally.
- New signup destinations, notifications, or integrations until validated.

## High-risk areas

- Signup data validation, storage, and duplicate handling.
- Prisma migrations and production database targeting.
- Server-side secrets, debug errors, and runtime env loading.
- Compatibility with Faako Website function sync.

## Production sensitivity

High for signup flow and data. Backend failures can block onboarding, while configuration mistakes can expose errors or target the wrong database.

## Before-every-deploy questions

- Does this change affect `signup`, `health`, runtime config, Prisma, or website function sync?
- Is the target database correct for the environment?
- Are production database safeguards and debug settings correct?
- Are secrets server-only and absent from browser-visible configuration?
- Does the signup payload avoid collecting API keys, passwords, tokens, and banking credentials?
- Has Faako Website compatibility been checked if mirrored functions changed?
- Is there a rollback or forward-fix plan for migrations?
