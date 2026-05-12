# Faako Website Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Faako Website without changing application behavior.

## Known technical notes

- The app is a React and Vite public website.
- `scripts/sync-netlify-functions.mjs` syncs mirrored functions from `apps/faako-api` before build.
- `VITE_API_BASE_URL` points signup to a dedicated API deployment when set.
- If `VITE_API_BASE_URL` is not set, mirrored functions can serve `/api/*` from the website deployment.
- `VITE_*` values are browser-visible and must not contain secrets.
- `docs/platform/codebase-cleanup-audit.md` flags Faako Website cleanup opportunities around long marketing CSS, repeated button/card/section-header patterns, page-section extraction candidates, and signup/API deployment coupling.

## Open questions

- Which deployment mode is preferred long term: dedicated Faako API or website-owned mirrored functions?
- What signup conversion events and failure alerts should be tracked?
- Which public pricing and product claims require review before release?

## Future cleanup

- Keep function sync behavior documented when Faako API changes.
- Add a release checklist for marketing copy, pricing, and signup analytics.
- Clarify production ownership of server-side env vars when deployment topology changes.
- Use the platform cleanup audit before consolidating public-site primitives or splitting Signup/Home/Pricing/Module Config. Preserve signup endpoint behavior and mirrored function deployment assumptions.

## Risks to monitor

- Signup failures caused by API URL or mirrored function drift.
- Public copy or pricing becoming stale.
- Secrets accidentally placed in browser-visible env vars.
- Website and API deploys getting out of sync.
- Visual cleanup can accidentally change public pricing, signup, and conversion surfaces; pair style extraction with content and responsive checks.
