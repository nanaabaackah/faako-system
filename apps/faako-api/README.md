# Faako API

Workspace package: `@faako/faako-api`

Faako API is the Netlify Functions backend for the current Faako signup flow. It owns the `signup` and `health` functions, Prisma schema, and env-driven runtime config. It can run as its own Netlify site or as the source of mirrored functions inside `apps/faako-website`.

## What Lives Here

- `netlify/functions/`: serverless API functions
- `prisma/`: Prisma schema and migrations
- `src/`: runtime config and database helpers
- `netlify/static/`: intentionally minimal publish folder for the API-only site
- `.env.example`: environment variable reference

Current functions:

- `health`
- `signup` - accepts client onboarding intake submissions, persists the existing signup compatibility records, generates a PDF summary, and sends client/admin email copies when Resend is configured

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
pnpm --filter @faako/faako-api run netlify
pnpm --filter @faako/faako-api run prisma:generate
pnpm --filter @faako/faako-api run prisma:migrate
pnpm --filter @faako/faako-api run prisma:migrate:deploy
pnpm --filter @faako/faako-api run prisma:migrate:status
```

## Configuration

Use `apps/faako-api/.env.example` to create `apps/faako-api/.env.dev`.

Important behavior:

- local commands load `.env.dev`
- local development refuses the production database unless `ALLOW_PRODUCTION_DATABASE_IN_DEV=true`
- use `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL` for local work
- keep `EXPOSE_DEBUG_ERRORS=false` outside local debugging
- `VITE_*` values do not belong here because this package is backend-only
- configure `RESEND_API_KEY` plus `FAAKO_ONBOARDING_FROM_EMAIL` and `FAAKO_ONBOARDING_ADMIN_EMAIL` for onboarding PDF/email copies
- never add public intake fields for Paystack/Resend/WhatsApp/SMS API keys, passwords, tokens, private email credentials, or bank login details

## Relationship To Faako Website

- `apps/faako-website` can call this API through `VITE_API_BASE_URL`
- when `VITE_API_BASE_URL` is not set, the website can serve mirrored copies of these functions through `/api/*`
- `apps/faako-website` runs a prebuild sync from this app before its build

## Deployment

This app has its own Netlify config in `apps/faako-api/netlify.toml`.

Netlify runs Prisma deploy before publish:

```bash
pnpm --filter @faako/faako-api run prisma:migrate:deploy
```

The publish folder is `apps/faako-api/netlify/static`.
