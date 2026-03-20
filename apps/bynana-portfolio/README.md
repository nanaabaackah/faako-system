# ByNana Portfolio

Workspace package: `@faako/bynana-portfolio`

Personal portfolio site for Nana Aba Ackah.

This app owns the public frontend plus two serverless integrations: the contact form handler and the trust-stats proxy.

## What Lives Here

- React and Vite frontend in `src/`
- route screens for home, about, projects, blog, resume, and contact
- Netlify Functions in `netlify/functions`
- deploy-time security headers and redirects in `netlify.toml`

Current functions:

- `contact-submit`
- `trust-stats-proxy`

## Local Dev

Primary command:

```bash
pnpm --filter @faako/bynana-portfolio run dev
```

Useful commands:

```bash
pnpm --filter @faako/bynana-portfolio run build
pnpm --filter @faako/bynana-portfolio run preview
pnpm --filter @faako/bynana-portfolio run lint
```

The frontend uses the normal Vite dev port.

## Serverless Environment

The frontend itself is static. The sensitive configuration lives only on the Netlify function side.

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

Important rule:

- none of those values belong in browser-visible `VITE_*` config

## Deployment

This app has its own Netlify site and config in `apps/bynana-portfolio/netlify.toml`.

Build behavior:

- Netlify builds with `pnpm --filter @faako/bynana-portfolio build`
- selective deploys are controlled by `node ./scripts/netlify-ignore.mjs @faako/bynana-portfolio`
- the publish folder is `apps/bynana-portfolio/dist`
- function requests are routed through `/api/contact` and `/api/public/trust-stats`

The checked-in Netlify config also sets stricter headers, CORS handling through the functions, and hides upstream trust-stats credentials from the browser.
