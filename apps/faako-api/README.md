# Faako API

Workspace package: `@faako/faako-api`

Faako's Netlify Functions API. This app is the backend for the Faako signup flow and can either run as its own site or act as the source of truth for the mirrored signup functions copied into `apps/faako-website`.

## What Lives Here

- Netlify Functions in `netlify/functions`
- Prisma schema and migrations in `prisma/`
- runtime config and DB helpers in `src/`

Current functions:

- `health`
- `signup`

## Local Dev

Primary command:

```bash
pnpm --filter @faako/faako-api run dev:backend
```

Local backend URL:

- `http://localhost:8889`

Useful commands:

```bash
pnpm --filter @faako/faako-api run dev:backend
pnpm --filter @faako/faako-api run netlify
pnpm --filter @faako/faako-api run prisma:migrate
pnpm --filter @faako/faako-api run prisma:migrate:deploy
pnpm --filter @faako/faako-api run prisma:migrate:status
```

You can also start the full Faako local stack from the repo root:

```bash
pnpm run dev:faako
```

## Environment

Use `apps/faako-api/.env.example` as the source of truth for required env names.

Important behavior:

- local commands load from `apps/faako-api/.env.dev`
- local development refuses to use the production database unless `ALLOW_PRODUCTION_DATABASE_IN_DEV=true` is set
- use `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL` for local work
- non-production signup emails should route to the placeholder QA inbox defined in `apps/faako-api/.env.example` unless `EMAIL_FORCE_TO` overrides that target
- `EXPOSE_DEBUG_ERRORS` should stay `false` outside deliberate local debugging
- `RATE_LIMIT_SECRET` should be set in hosted environments so persistent throttle keys are hashed with a stable secret

## Deployment

This app has its own Netlify config in `apps/faako-api/netlify.toml`.

Build behavior:

- Netlify runs `pnpm --filter @faako/faako-api prisma:migrate:deploy` before publish
- selective deploys use the app-local ignore command from `scripts/netlify-ignore.mjs`
- the publish folder is `apps/faako-api/netlify/static`

If another deployed site owns the signup function directly, that environment still needs the same Prisma migrations applied to its database.

## Relationship To Faako Website

- `apps/faako-website` can call this API directly through `VITE_API_BASE_URL`
- if `VITE_API_BASE_URL` is not set, the website can serve mirrored copies of these functions through `/api/*`
- the monorepo deploy graph treats `@faako/faako-website` as dependent on this app because of that mirrored build step
