# Faako Website

Workspace package: `@faako/faako-website`

Faako Website is the public marketing site and signup funnel for Faako. It presents product information, pricing, plan selection, and onboarding entry points, then hands signup work to the Faako API.

## What Lives Here

- `src/`: React and Vite public website
- `netlify/functions/`: mirrored signup functions copied from `apps/faako-api`
- `scripts/sync-netlify-functions.mjs`: prebuild sync for the mirrored functions
- `netlify.toml`: deploy, headers, and function routing
- `.env.example`: public and server-side env reference for this site

## Run It Locally

```bash
pnpm --filter @faako/faako-website run dev:frontend
```

Local frontend URL:

- `http://localhost:5175`

Useful commands:

```bash
pnpm --filter @faako/faako-website run build
pnpm --filter @faako/faako-website run preview
pnpm --filter @faako/faako-website run netlify
pnpm --filter @faako/faako-website run lint
```

Run the website, API, and ERP together from the repo root:

```bash
pnpm run dev:faako
```

## API Wiring

- if `VITE_API_BASE_URL` is set, the signup flow calls a dedicated `@faako/faako-api` deployment
- if `VITE_API_BASE_URL` is not set, the site can serve mirrored functions through `/api/signup`
- the prebuild step copies `apps/faako-api/netlify/functions` into this app
- backend secrets belong on the site that owns the serverless function at runtime

## Configuration

Use `apps/faako-website/.env.example` as the source of truth.

Rules:

- `VITE_*` values are bundled into the browser and must stay non-secret
- local website values can live in `apps/faako-website/.env.dev`
- if this site owns the signup function directly, configure the server-side env values here
- if this site points to a dedicated Faako API, keep backend secrets on that API site

## Deployment

This app has its own Netlify config in `apps/faako-website/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/faako-website build
```

The publish folder is `apps/faako-website/dist`, and selective deploys use:

```bash
node ./scripts/netlify-ignore.mjs @faako/faako-website
```
