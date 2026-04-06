# Dev ERP

Workspace package: `@faako/dev-erp`

Standalone KPI dashboard plus Express and Prisma backend for a dedicated dashboard deployment.

This app was moved into the monorepo without flattening its business logic. It still owns its frontend, backend, auth, reporting, rent, and productivity flows locally.

## What Lives Here

- Vite frontend in `src/`
- Express backend in `backend/`
- Prisma schema and migrations
- environment-specific runtime loading through `APP_ENV`

## Local Dev

Full stack:

```bash
pnpm --filter @faako/dev-erp run dev:with-backend
```

Or from the repo root:

```bash
pnpm run dev:dev-erp
```

Frontend only:

```bash
pnpm --filter @faako/dev-erp run dev
```

Backend only:

```bash
pnpm --filter @faako/dev-erp run server:dev
```

Backend with development migrations applied first:

```bash
pnpm --filter @faako/dev-erp run server:dev:with-migrate
```

Useful commands:

```bash
pnpm --filter @faako/dev-erp run dev:with-backend
pnpm --filter @faako/dev-erp run build
pnpm --filter @faako/dev-erp run test
pnpm --filter @faako/dev-erp run db:status:dev
pnpm --filter @faako/dev-erp run db:deploy:dev
pnpm --filter @faako/dev-erp run db:migrate:dev -- --name <migration-name>
```

The frontend runs on `http://localhost:5173`. Local API requests can go through `VITE_API_PROXY_TARGET` when you want `/api/*` routed to a local or remote backend.

## Environment

Use `apps/dev-erp/.env.example` as the source of truth.

Important behavior:

- copy that file to an untracked local env file such as `apps/dev-erp/.env.development`
- `VITE_*` values are browser-visible and must stay non-secret
- backend env values control database access, email, auth, Google integrations, and alerts
- `APP_ENV` selects the environment-specific database flow
- `ENFORCE_DATABASE_ISOLATION=true` helps block local work from writing into the production database by mistake
- `OAUTH_TOKEN_ENCRYPTION_KEY` is required when Google Calendar integration is enabled

## Deployment

This app keeps its own Netlify frontend config in `apps/dev-erp/netlify.toml`.

Build behavior:

- Netlify builds with `pnpm --filter @faako/dev-erp build`
- selective deploys are controlled by `node ./scripts/netlify-ignore.mjs @faako/dev-erp`
- the publish folder is `apps/dev-erp/dist`
- production `/api/*` traffic is redirected to the upstream backend configured in `netlify.toml`

For backend deploys outside Netlify, use the app-local server scripts so Prisma migrations run before startup when needed:

```bash
pnpm --filter @faako/dev-erp run start
```
