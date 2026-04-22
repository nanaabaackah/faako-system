# Dev ERP

Workspace package: `@faako/dev-erp`

Dev ERP is the internal operations portal for the portfolio. It combines a Vite admin frontend with an Express and Prisma backend for organization metrics, rent management, accounting, invoicing, appointments, reports, user access, alerts, and Google Calendar integration.

## What Lives Here

- `src/`: React frontend, route shell, auth store, API client, pages, and utilities
- `backend/`: Express API, feature route slices, auth and capability middleware, background jobs, email templates, and integration helpers
- `prisma/`: Prisma schema and migrations for the Dev ERP database
- `netlify.toml`: frontend deploy config and production API proxying
- `.env.example`: source of truth for local and hosted environment variables

Backend routing is being split into vertical slices. `backend/server.js` now owns runtime setup and composition, while focused modules own auth, users, dashboard, jobs, productivity, capability checks, organization scoping, HTTP app wiring, and security helpers.

## Run It Locally

Install from the repo root first:

```bash
pnpm install
```

Start the full local app:

```bash
pnpm --filter @faako/dev-erp run dev:with-backend
```

Equivalent root command:

```bash
pnpm run dev:dev-erp
```

Run only one side:

```bash
pnpm --filter @faako/dev-erp run dev
pnpm --filter @faako/dev-erp run server:dev
```

The frontend uses `http://localhost:5173`. Local API calls can go through the Vite proxy when `VITE_API_PROXY_TARGET` is set.

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

- `APP_ENV` selects the environment-specific database flow.
- `ENFORCE_DATABASE_ISOLATION=true` helps block local work from writing to the production database.
- `VITE_*` values are browser-visible and must not contain secrets.
- `OAUTH_TOKEN_ENCRYPTION_KEY` is required when Google Calendar integration is enabled.

## Auth And API

The frontend boots by calling `/api/auth/session`. The response becomes the central auth store state, including the authenticated user and module access. Session tokens are set through server-managed cookies, not returned as browser-readable JSON payloads.

Route visibility is still a frontend convenience. Backend access is enforced by capability middleware and organization scoping helpers:

- `backend/auth/capabilities.js` maps API route groups to required modules and denies non-admin roles without a matching capability.
- `backend/organizations/scope.js` resolves organization read/write scope and blocks cross-organization access for local admins.
- `backend/security/envExposure.test.js` keeps the browser-visible `VITE_*` env surface intentionally allowlisted.

Use the shared API client in `src/api/client.ts` for new frontend calls. It standardizes JSON parsing, credentials, CSRF headers, session-expiry handling, and normalized API errors.

## Auth Security

### Endpoints

| Route | Description |
| --- | --- |
| `POST /api/auth/login` | Issues a 15-min JWT access token cookie and a 7-day rotating refresh token cookie |
| `GET /api/auth/session` | Validates the session and returns the current user |
| `POST /api/auth/refresh` | Rotates the refresh token and issues a new access token (no re-login needed) |
| `POST /api/auth/logout` | Revokes the refresh token in the database and clears all auth cookies |
| `POST /api/auth/forgot-password` | Sends a password reset email |
| `POST /api/auth/setup-account/verify` | Validates an invitation token before the user sets a password |
| `POST /api/auth/setup-account/complete` | Accepts a password, hashes it, and activates the account |

The `/api/v1/*` URL prefix is supported as an alias — the server rewrites it to `/api/*` before routing so both URL shapes work transparently.

### Tokens and Cookies

- Access tokens are short-lived JWTs (15 minutes) embedded in an HttpOnly cookie.
- Refresh tokens are 40-byte random values whose SHA-256 hash is stored in the `RefreshToken` table. The raw token lives only in the HttpOnly `dev_kpi_refresh` cookie scoped to `/api/auth/refresh`.
- Each access token embeds `tokenVersion`, which is matched against the user row on every authenticated request. Logging out increments `tokenVersion`, immediately invalidating all outstanding access tokens for that user.
- CSRF protection uses a double-submit cookie pattern. The CSRF token is rotated with every new access token.

### Account Lockout

After 5 consecutive failed password attempts the account is locked for 15 minutes. The lock state is stored in `loginAttempts` and `lockedUntil` on the `User` row. Successful login resets both fields.

### Input Validation

All auth endpoints run Zod schema validation before handlers execute. Invalid payloads return a `400` with a structured `errors` array.

### Logging

All auth and server errors use `@faako/logger` (Pino) with structured JSON output. No raw `console.error` calls remain in the backend.

## Verify Changes

```bash
pnpm --filter @faako/dev-erp run test
pnpm --filter @faako/dev-erp exec tsc --noEmit
pnpm --filter @faako/dev-erp run build
```

## Deployment

Netlify builds the frontend with:

```bash
pnpm --filter @faako/dev-erp build
```

The publish folder is `apps/dev-erp/dist`, and selective deploys use:

```bash
node ./scripts/netlify-ignore.mjs @faako/dev-erp
```

For a standalone backend deploy, use the server scripts so Prisma generation and migrations run before startup when needed:

```bash
pnpm --filter @faako/dev-erp run start
```
