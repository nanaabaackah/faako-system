# Faako Website

Workspace package: `@faako/faako-website`

Faako's marketing site and signup funnel.

## Scope

- landing pages
- pricing and plan selection
- signup and onboarding entry points

## Local Dev

Primary command:

```bash
pnpm --filter @faako/faako-website run dev:frontend
```

Local frontend URL:

- `http://localhost:5175`

Useful commands:

```bash
pnpm --filter @faako/faako-website run dev:frontend
pnpm --filter @faako/faako-website run build
pnpm --filter @faako/faako-website run netlify
```

You can also start the Faako website, API, and ERP together from the repo root:

```bash
pnpm run dev:faako
```

## API Wiring

- by default the signup flow can use this site's mirrored Netlify functions through `/api/signup`
- if `VITE_API_BASE_URL` is set, the signup flow can call a separately deployed `@faako/faako-api`
- the prebuild step copies `apps/faako-api/netlify/functions` into this app's `netlify/functions`
- the monorepo deploy graph treats this app as dependent on `@faako/faako-api` because of that sync step

## Environment

Use `apps/faako-website/.env.example` as the source of truth.

Important rules:

- `VITE_*` values are bundled into the browser and must stay non-secret
- local website settings can live in `apps/faako-website/.env.dev`
- if this site owns the signup function directly, the server-side env values from the example file must also be configured here
- if `VITE_API_BASE_URL` points at a dedicated `faako-api` deployment, keep the backend secrets on that API site instead

## Deployment

This app has its own Netlify site and `apps/faako-website/netlify.toml`.

Build behavior:

- Netlify builds with `pnpm --filter @faako/faako-website build`
- selective deploys are controlled by `node ./scripts/netlify-ignore.mjs @faako/faako-website`
- the publish folder is `apps/faako-website/dist`
- configure the deployed site domain outside this README and keep environment-specific values in `apps/faako-website/.env.example`
