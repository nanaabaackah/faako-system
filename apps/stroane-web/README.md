# Stroane Web

Workspace package: `@faako/stroane-web`

Stroane Web is a full-stack commerce app. It pairs a React 19 + TypeScript frontend with an Express backend and a Prisma-managed PostgreSQL database for product browsing and purchasing flows.

## What Lives Here

- `src/`: React frontend, pages, components, API client, and types
- `backend/`: Express API server, route handlers, and middleware
- `prisma/`: Prisma schema and migrations
- `vite.config.ts`: Vite dev server and build config
- `.env.example`: environment variable reference

## Run It Locally

Install from the repo root first:

```bash
pnpm install
```

Start both frontend and backend together:

```bash
pnpm --filter @faako/stroane-web run dev:with-backend
```

Or run each side separately:

```bash
pnpm --filter @faako/stroane-web run dev:frontend
pnpm --filter @faako/stroane-web run server:dev
```

Typical local ports:

- frontend: `5175`
- backend: `3000`

## Database

```bash
pnpm --filter @faako/stroane-web run db:migrate:dev
pnpm --filter @faako/stroane-web run db:studio
pnpm --filter @faako/stroane-web run db:status:dev
pnpm --filter @faako/stroane-web run db:status:prod
```

## Configuration

Use `apps/stroane-web/.env.example` to create an untracked local env file.

Only browser-safe values should use the `VITE_*` prefix.

## Build And Deploy

```bash
pnpm --filter @faako/stroane-web run build
pnpm --filter @faako/stroane-web run db:deploy:prod
pnpm --filter @faako/stroane-web run server:prod
```

## Netlify Deployment

Use Netlify for the deployed frontend and keep Hostinger as the domain/DNS host.

Recommended Netlify settings:

- Base directory: repo root
- Build command: `pnpm --filter @faako/stroane-web build`
- Publish directory: `apps/stroane-web/dist`
- Config file: `apps/stroane-web/netlify.toml`
- Environment variable: set `VITE_BACKEND_BASE_URL` only if the API is hosted outside the Netlify site

If Hostinger manages DNS, point the Stroane domain to Netlify with Netlify's DNS records for the site. After the domain is attached in Netlify, add the deployed origin to backend `CORS_ORIGINS` when the backend runs separately.

If the backend runs behind a trusted reverse proxy, set `TRUST_PROXY_HOPS` to the number of trusted proxy hops, usually `1`, so Express resolves client IPs safely for rate limiting without trusting arbitrary forwarded headers.
