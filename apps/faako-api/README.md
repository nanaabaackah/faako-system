# Faako API

Workspace package: `@faako/faako-api`

Faako API is the Express backend for the current Faako signup flow. It owns the signup and health endpoints, Prisma schema, email/PDF intake flow, and env-driven runtime config.

## What Lives Here

- `src/server.js`: Express API entrypoint
- `prisma/`: Prisma schema and migrations
- `src/`: runtime config and database helpers
- `.env.example`: environment variable reference

Current endpoints:

- `GET /health` and `GET /api/health`
- `POST /signup` and `POST /api/signup` - accepts client onboarding and client setup form submissions, persists the existing signup compatibility records, generates a PDF summary, and sends client/admin email copies when Resend is configured
- `POST /api/demo-access` - server-owned Faako ERP demo access flow; generates a short-lived code, stores only its HMAC hash, emails the code through Resend, rate-limits request/verify attempts, and never returns the code to the browser

## Run It Locally

```bash
pnpm --filter @faako/faako-api run dev:backend
```

Typical local backend URL:

- `http://localhost:8889`

Run the full Faako local stack from the repo root:

```bash
pnpm run dev:faako
```

## Common Commands

```bash
pnpm --filter @faako/faako-api run dev:backend
pnpm --filter @faako/faako-api run prisma:generate
pnpm --filter @faako/faako-api run prisma:migrate
pnpm --filter @faako/faako-api run prisma:migrate:deploy
pnpm --filter @faako/faako-api run prisma:migrate:status
pnpm --filter @faako/faako-api run predeploy:local
```

Use `predeploy:local` before shipping changes that touch signup persistence or Prisma migrations. It loads `.env.dev`, applies pending migrations to the local/development Faako API database, then checks migration status.

## Configuration

Use `apps/faako-api/.env.example` to create `apps/faako-api/.env.dev`.

Important behavior:

- local commands load `.env.dev`
- local development refuses the production database unless `ALLOW_PRODUCTION_DATABASE_IN_DEV=true`
- use `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL` for local work
- keep `EXPOSE_DEBUG_ERRORS=false` outside local debugging
- `VITE_*` values do not belong here because this package is backend-only
- configure `RESEND_API_KEY` plus `FAAKO_ONBOARDING_FROM_EMAIL` and `FAAKO_ONBOARDING_ADMIN_EMAIL` for onboarding PDF/email copies
- configure `FAAKO_ERP_DEMO_ACCESS_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optional `RESEND_FROM_NAME` for Faako ERP demo access emails
- never add public intake fields for Paystack/Resend/WhatsApp/SMS API keys, passwords, tokens, private email credentials, or bank login details

## Relationship To Faako Website

- `apps/faako-website` can call this API through `VITE_API_BASE_URL`
- local website development proxies `/api/*` to this API through Vite

## Deployment

Deploy this as a Node/Express service on Railway. Set the Railway service env to `RAILWAY_WORKSPACE=@faako/faako-api`. Run Prisma migrations before starting a hosted backend:

```bash
pnpm --filter @faako/faako-api run prisma:migrate:deploy
```

Workspace start command:

```bash
pnpm --filter @faako/faako-api run server
```
