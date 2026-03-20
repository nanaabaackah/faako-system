# Reebs Portal

Workspace package: `@faako/reebs-portal`

Admin portal and Netlify backend for the Reebs product.

This app owns the admin-facing frontend, serverless functions, and Prisma-backed backend behavior used by the Reebs stack.

## What Lives Here

- admin portal frontend
- Netlify Functions backend in `netlify/functions`
- Prisma schema and migrations
- Reebs-specific ERP config and modules

## Local Dev

Frontend:

```bash
pnpm --filter @faako/reebs-portal run dev:frontend
```

Backend:

```bash
pnpm --filter @faako/reebs-portal run dev:backend
```

Useful commands:

```bash
pnpm --filter @faako/reebs-portal run netlify
pnpm --filter @faako/reebs-portal run db:migrate:dev
pnpm --filter @faako/reebs-portal run db:deploy:dev
pnpm --filter @faako/reebs-portal run test:e2e
```

Default local ports:

- frontend: `5174`
- functions/backend: `8888`

## Relationship To Reebs Website

- `apps/reebs-website` is the public site
- `apps/reebs-portal` owns the backend and admin frontend
- for full local Reebs development, the easiest root command is:

```bash
pnpm run dev:reebs
```

## Deployment

This app has its own Netlify config in `apps/reebs-portal/netlify.toml`.

Build behavior:

- Netlify builds with `pnpm --filter @faako/reebs-portal build`
- selective deploys are controlled by `node ./scripts/netlify-ignore.mjs @faako/reebs-portal`
- functions are served from `apps/reebs-portal/netlify/functions`

## More Detail

Deeper Reebs portal docs live here:

- `apps/reebs-portal/docs/FRONTEND.md`
- `apps/reebs-portal/docs/BACKEND.md`
