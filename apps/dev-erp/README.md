# Dev ERP

Workspace package: `@faako/dev-erp`

Dev ERP is the full-stack internal operations ERP in this repo. It combines a Vite admin frontend with an Express and Prisma backend for organizations, dashboards, rent management, accounting, invoicing, appointments, reporting, user access, alerts, and integrations.

## What Lives Here

- `src/`: React frontend, route shell, auth state, API client, pages, and utilities
- `backend/`: Express API, feature route slices, auth and capability middleware, jobs, email templates, and integration helpers
- `prisma/`: Prisma schema and migrations
- `netlify.toml`: frontend deploy config and API proxying
- `.env.example`: source of truth for local and hosted environment variables

## Run It Locally

Install from the repo root first:

```bash
pnpm install
```

Start the full local app:

```bash
pnpm --filter @faako/dev-erp run dev:with-backend
```

Equivalent root shortcut:

```bash
pnpm run dev:dev-erp
```

Run only one side:

```bash
pnpm --filter @faako/dev-erp run dev
pnpm --filter @faako/dev-erp run server:dev
```

Typical local ports:

- frontend: `5173`
- backend: `8080`

## Current System Notes

- the frontend now follows the shared shell contract used across the repo, including shared sidebar widths, the edge collapse toggle, and mobile-safe topbar spacing
- shared form compat styling from `@faako/ui` covers `select`, `date`, `time`, and related controls so Safari and WebKit stay visually aligned
- the backend is organized into focused vertical slices while `backend/server.js` owns runtime composition

## Database

Use `apps/dev-erp/.env.example` to create an untracked local env file such as `apps/dev-erp/.env.development`.

Common database commands:

```bash
pnpm --filter @faako/dev-erp run db:generate
pnpm --filter @faako/dev-erp run db:status:dev
pnpm --filter @faako/dev-erp run db:deploy:dev
pnpm --filter @faako/dev-erp run db:migrate:dev -- --name <migration-name>
pnpm --filter @faako/dev-erp run db:studio
```

Important safeguards:

- `APP_ENV` selects the environment-specific database flow
- `ENFORCE_DATABASE_ISOLATION=true` helps block local work from writing to production data
- `VITE_*` values are browser-visible and must not contain secrets
- `OAUTH_TOKEN_ENCRYPTION_KEY` is required when Google Calendar integration is enabled

## Auth And API

- the frontend boots from `/api/auth/session`
- session state is cookie-based rather than browser-readable token storage
- backend access is enforced by capability middleware and organization scoping, not only by frontend route visibility
- the shared API client in `src/api/client.ts` handles credentials, CSRF headers, JSON parsing, and normalized API errors

## Verify Changes

```bash
pnpm --filter @faako/dev-erp run test
pnpm --filter @faako/dev-erp exec tsc --noEmit
pnpm --filter @faako/dev-erp run build
```

## Deployment

The frontend can build through Netlify with:

```bash
pnpm --filter @faako/dev-erp run build
```

The publish folder is `apps/dev-erp/dist`, and selective deploy checks use:

```bash
node ./scripts/netlify-ignore.mjs @faako/dev-erp
```

The backend deploys separately through Railway using the repo root `nixpacks.toml`. For a standalone backend start:

```bash
pnpm --filter @faako/dev-erp run start
```
