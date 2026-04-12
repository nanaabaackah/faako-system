# Faako API

Workspace package: `@faako/faako-api`

Faako API is the Netlify Functions backend for the Faako signup flow. It validates signup requests, talks to the Faako database through Prisma, and can run as a standalone API site or as the source for mirrored functions in `apps/faako-website`.

## What Lives Here

- `netlify/functions/`: serverless API functions
- `prisma/`: Prisma schema and migrations
- `src/`: runtime config and database helpers
- `netlify/static/`: placeholder publish folder for the API-only Netlify site
- `.env.example`: required environment variable reference

Current functions:

- `health`
- `signup`

## Run It Locally

```bash
pnpm --filter @faako/faako-api run dev:backend
```

Local backend URL:

- `http://localhost:8889`

Useful commands:

```bash
pnpm --filter @faako/faako-api run netlify
pnpm --filter @faako/faako-api run prisma:generate
pnpm --filter @faako/faako-api run prisma:migrate
pnpm --filter @faako/faako-api run prisma:migrate:deploy
pnpm --filter @faako/faako-api run prisma:migrate:status
```

Run the full Faako local stack from the repo root:

```bash
pnpm run dev:faako
```

## Configuration

Use `apps/faako-api/.env.example` to create `apps/faako-api/.env.dev`.

Important behavior:

- local commands load `.env.dev`
- local development refuses the production database unless `ALLOW_PRODUCTION_DATABASE_IN_DEV=true`
- use `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL` for local work
- non-production signup emails should route to a QA inbox unless `EMAIL_FORCE_TO` overrides it
- keep `EXPOSE_DEBUG_ERRORS=false` outside local debugging
- set `RATE_LIMIT_SECRET` in hosted environments for stable hashed throttle keys

## Relationship To Faako Website

- `apps/faako-website` can call this API through `VITE_API_BASE_URL`
- when `VITE_API_BASE_URL` is not set, the website can serve mirrored copies of these functions through `/api/*`
- `apps/faako-website` runs a prebuild sync from this app before its build

## Deployment

This app has its own Netlify config in `apps/faako-api/netlify.toml`.

Netlify runs Prisma deploy before publish:

```bash
pnpm --filter @faako/faako-api prisma:migrate:deploy
```

The publish folder is `apps/faako-api/netlify/static`.
