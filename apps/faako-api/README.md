# Faako API

Netlify Functions API for Faako.

Current functions:
- `health`
- `signup`

Runtime pieces:
- functions live in `netlify/functions`
- Prisma schema lives in `prisma/`
- local helpers live in `src/`

This app can be deployed as its own Netlify site or used as the source of truth
for the mirrored website functions that get copied into `apps/faako-website`
during that app's prebuild step.

## Local Dev

- Safe local backend command: `pnpm --filter @faako/faako-api run dev:backend`
- The backend listens on `http://localhost:8889`
- Local backend settings are read from `apps/faako-api/.env.dev`
- Local development refuses to use the production database unless
  `ALLOW_PRODUCTION_DATABASE_IN_DEV=true` is set explicitly
- Use `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL` for local work
- Non-production signup emails are forwarded to `faako@nanaabaackah.com` by default
  unless `EMAIL_FORCE_TO` overrides that target

You can start the whole Faako stack from the repo root with:

```bash
pnpm run dev:faako
```
