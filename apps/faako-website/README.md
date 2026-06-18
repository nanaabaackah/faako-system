# Faako Website

Workspace package: `@faako/faako-website`

Faako Website is the public marketing site and signup funnel for Faako. It presents product information, pricing, and onboarding entry points, then hands signup work to the Faako API.

## What Lives Here

- `src/`: React + Vite public website
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

- the signup flow calls `VITE_API_BASE_URL` when configured; production should use `https://api.faako.nanaabaackah.com`, while local dev can use the `/api` Vite proxy
- local development proxies `/api/*` to the Faako API server through Vite
- the signup page is a client onboarding intake wizard, and `/client-setup` is a lighter client setup wizard with product-specific follow-up questions
- public intake forms should not collect API keys, passwords, tokens, private email credentials, or bank login details
- onboarding PDF generation and email sending happen server-side in the Faako API, not in the browser
- signup and client setup forms send a per-submission idempotency key to Faako API so double clicks or browser retries do not create duplicate records or duplicate emails
- the shared `AppUpdateNotice` is mounted in the app shell, enabled in production, and testable locally with `VITE_ENABLE_APP_UPDATE_NOTICE=true`; it prompts for refresh without interrupting an in-progress onboarding form

## Common Commands

```bash
pnpm --filter @faako/faako-website run build
pnpm --filter @faako/faako-website run preview
pnpm --filter @faako/faako-website run lint
```

## Configuration

Use `apps/faako-website/.env.example` as the source of truth.

Rules:

- `VITE_*` values are bundled into the browser and must stay non-secret
- local website values can live in `apps/faako-website/.env.dev`
- keep backend secrets on the dedicated Faako API service
- onboarding email aliases are optional: `FAAKO_ONBOARDING_FROM_NAME`, `FAAKO_ONBOARDING_FROM_EMAIL`, and `FAAKO_ONBOARDING_ADMIN_EMAIL`

## Deployment

Static hosts build with:

```bash
pnpm --filter @faako/faako-website run build
```

The publish folder is `apps/faako-website/dist`.
