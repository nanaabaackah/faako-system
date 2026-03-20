# Faako Website

Marketing site and signup funnel for Faako.

Scope:
- landing pages
- pricing and plans
- signup and onboarding entry points

API wiring:
- by default the signup flow can use this site's mirrored Netlify functions via `/api/signup`
- if `VITE_API_BASE_URL` is set, the signup flow can call a separately deployed `faako-api`
- the prebuild script syncs `apps/faako-api/netlify/functions` into this app's local `netlify/functions`

Temporary domain: faako.nanaabaackah.com

## Local Dev

- Preferred local frontend command: `pnpm --filter @faako/faako-website run dev:frontend`
- The local website runs on `http://localhost:5175`
- Local website settings are read from `apps/faako-website/.env.dev`
- The local signup flow points at `http://localhost:8889/.netlify/functions`
- The dedicated local backend owner is `apps/faako-api`

To start the local Faako stack together from the repo root:

```bash
pnpm run dev:faako
```
