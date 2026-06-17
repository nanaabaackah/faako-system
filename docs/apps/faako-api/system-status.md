# Faako API System Status

## App purpose

Faako API is the Express backend for the current Faako signup flow and Faako ERP demo access flow. It owns signup, demo-access, and health endpoints, Prisma schema, database helpers, and env-driven runtime configuration.

## Current status

Focused backend service for signup, demo access, and health checks. Faako Website calls this API through `VITE_API_BASE_URL` or the local Vite `/api` proxy; Faako ERP calls `/api/demo-access` for email-code demo access.

## Stable modules/features

- `GET /health` and `GET /api/health`.
- `POST /signup` and `POST /api/signup`.
- `POST /api/demo-access` for backend-generated, emailed, short-lived Faako ERP demo access codes.
- Runtime config and database helper structure.
- Prisma schema and migration workflow.
- Node/Express deployment configuration.
- Signup intake PDF summary and server-side Resend email copy foundation.

## In-progress modules/features

- Signup reliability, validation, and error handling.
- Runtime configuration hardening.
- Compatibility with Faako Website signup calls.
- Internal onboarding review/checklist workflow planning.

## Experimental modules/features

- Any additional endpoints beyond health, signup, and demo access until documented and deployed intentionally.
- New signup destinations, notifications, or integrations until validated.

## High-risk areas

- Signup data validation, storage, and duplicate handling.
- Prisma migrations and production database targeting.
- Server-side secrets, debug errors, and runtime env loading.
- Demo access code delivery, rate limiting, and production signing-secret configuration.
- Compatibility with Faako Website function sync.

## Production sensitivity

High for signup flow and data. Backend failures can block onboarding, while configuration mistakes can expose errors or target the wrong database.

## Before-every-deploy questions

- Does this change affect `signup`, `demo-access`, `health`, runtime config, Prisma, or website/ERP API calls?
- Is the target database correct for the environment?
- Are production database safeguards and debug settings correct?
- Are secrets server-only and absent from browser-visible configuration?
- Does the signup payload avoid collecting API keys, passwords, tokens, and banking credentials?
- Has Faako Website compatibility been checked if API behavior changed?
- Is there a rollback or forward-fix plan for migrations?
