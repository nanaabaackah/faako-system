# Faako Website

Workspace package: `@faako/faako-website`

Faako Website is the public marketing site and signup funnel for Faako. It presents product information, pricing, and onboarding entry points, then hands signup work to the Faako API or to mirrored local functions depending on the environment.

## What Lives Here

- `src/`: React + Vite public website
- `netlify/functions/`: mirrored functions copied from `apps/faako-api`
- `scripts/sync-netlify-functions.mjs`: prebuild sync for mirrored functions
- `netlify.toml`: deploy, headers, and function routing
- `.env.example`: public and server-side env reference for this site

## Run It Locally

```bash
pnpm --filter @faako/faako-website run dev:frontend
```

Typical local frontend URL:

- `http://localhost:5175`

Run the website, API, and ERP together from the repo root:

```bash
pnpm run dev:faako
```

## Current System Notes

- the prebuild step keeps the site's local `/api/*` functions in sync with `apps/faako-api`
- if `VITE_API_BASE_URL` is set, the signup flow calls a dedicated API deployment
- if `VITE_API_BASE_URL` is not set, the site can serve the mirrored functions itself
- the signup page is a client onboarding intake wizard and should not collect API keys, passwords, tokens, private email credentials, or bank login details
- onboarding PDF generation and email sending happen server-side in the `signup` function, not in the browser

## Common Commands

```bash
pnpm --filter @faako/faako-website run build
pnpm --filter @faako/faako-website run preview
pnpm --filter @faako/faako-website run netlify
pnpm --filter @faako/faako-website run lint
```

## Configuration

Use `apps/faako-website/.env.example` as the source of truth.

Rules:

- `VITE_*` values are bundled into the browser and must stay non-secret
- local website values can live in `apps/faako-website/.env.dev`
- if this site owns the signup function directly, configure the server-side env values here
- if this site points to a dedicated Faako API, keep backend secrets on that API site
- onboarding email aliases are optional: `FAAKO_ONBOARDING_FROM_NAME`, `FAAKO_ONBOARDING_FROM_EMAIL`, and `FAAKO_ONBOARDING_ADMIN_EMAIL`

## Deployment

This app has its own Netlify config in `apps/faako-website/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/faako-website run build
```

The publish folder is `apps/faako-website/dist`, and selective deploy checks use:

```bash
node ./scripts/netlify-ignore.mjs @faako/faako-website
```
