# Reebs Portal

Workspace package: `@faako/reebs-portal`

Reebs Portal is the admin portal and Netlify Functions backend for the Reebs product. It owns the operational frontend, Prisma-backed backend functions, admin accounting workflows, bookings, content, and internal product modules used by the Reebs stack.

## What Lives Here

- `src/`: React admin portal frontend
- `netlify/functions/`: backend functions
- `prisma/`: Prisma schema, migrations, and generated client output
- `docs/`: deeper frontend and backend notes
- `netlify.toml`: local and hosted Netlify configuration
- `.env.example`: runtime configuration reference

## Run It Locally

Frontend only:

```bash
pnpm --filter @faako/reebs-portal run dev:frontend
```

Backend/functions only:

```bash
pnpm --filter @faako/reebs-portal run dev:backend
```

Full local Reebs stack from the repo root:

```bash
pnpm run dev:reebs
```

Default local ports:

- portal frontend: `5174`
- functions/backend: `8888`

## Common Commands

```bash
pnpm --filter @faako/reebs-portal run build
pnpm --filter @faako/reebs-portal run netlify
pnpm --filter @faako/reebs-portal run db:generate
pnpm --filter @faako/reebs-portal run db:migrate:dev
pnpm --filter @faako/reebs-portal run db:deploy:dev
pnpm --filter @faako/reebs-portal run db:status:dev
pnpm --filter @faako/reebs-portal run test:e2e
```

## Relationship To Reebs Website

- `apps/reebs-website` is the public customer-facing site
- `apps/reebs-portal` owns the backend and admin experience
- local full-stack Reebs work normally runs both together through `pnpm run dev:reebs`

## Deployment

This app has its own Netlify config in `apps/reebs-portal/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/reebs-portal build
```

Functions are served from `apps/reebs-portal/netlify/functions`, and selective deploys use:

```bash
node ./scripts/netlify-ignore.mjs @faako/reebs-portal
```

## More Detail

- `apps/reebs-portal/docs/FRONTEND.md`
- `apps/reebs-portal/docs/BACKEND.md`
