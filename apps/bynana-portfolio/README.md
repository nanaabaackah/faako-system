# ByNana Portfolio

Workspace package: `@faako/bynana-portfolio`

ByNana Portfolio is Nana Aba Ackah's public portfolio site. It presents projects, writing, resume material, and contact entry points, and it owns the serverless integrations needed by that public site.

## What Lives Here

- `src/`: React + Vite frontend
- `netlify/functions/contact-submit`: contact form submission handler
- `netlify/functions/trust-stats-proxy`: proxy for public trust-stat metrics
- `public/fonts/`: current custom font assets used by the site
- `netlify.toml`: redirects, headers, function routing, and deploy settings
- `.env.example`: local reference for function-side configuration

## Run It Locally

```bash
pnpm --filter @faako/bynana-portfolio run dev
```

The frontend uses the normal Vite dev port unless another process already owns it.

## Common Commands

```bash
pnpm --filter @faako/bynana-portfolio run build
pnpm --filter @faako/bynana-portfolio run preview
pnpm --filter @faako/bynana-portfolio run lint
```

## Configuration

The static frontend should only receive browser-safe `VITE_*` values. Sensitive settings belong on the Netlify function side.

Trust stats proxy settings:

- `TRUST_STATS_UPSTREAM_URL`
- `TRUST_STATS_UPSTREAM_TOKEN`
- `TRUST_STATS_ALLOWED_ORIGINS`
- `TRUST_STATS_UPSTREAM_TIMEOUT_MS`
- `TRUST_STATS_CACHE_CONTROL`

Contact function settings:

- `RESEND_API_KEY`
- `CONTACT_NOTIFICATION_TO`
- `CONTACT_NOTIFICATION_FROM`
- `CONTACT_NOTIFICATION_SUBJECT_PREFIX`
- `CONTACT_ALLOWED_ORIGINS`
- `CONTACT_RATE_LIMIT_WINDOW_MS`
- `CONTACT_RATE_LIMIT_MAX_REQUESTS`
- `CONTACT_FORM_SUBMISSION_URL`
- `CONTACT_FORM_SITE_ORIGIN`

## Deployment

This app has its own Netlify site and config in `apps/bynana-portfolio/netlify.toml`.

Netlify builds with:

```bash
pnpm --filter @faako/bynana-portfolio run build
```

The publish folder is `apps/bynana-portfolio/dist`, and selective deploy checks use:

```bash
node ./scripts/netlify-ignore.mjs @faako/bynana-portfolio
```
