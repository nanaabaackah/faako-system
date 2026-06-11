# Faako Website Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Faako Website without changing application behavior.

## Known technical notes

- The app is a React and Vite public website.
- `VITE_API_BASE_URL` points signup to a dedicated API deployment when set.
- Local development can proxy `/api/*` to `apps/faako-api`.
- `VITE_*` values are browser-visible and must not contain secrets.
- `Signup.jsx` is now a guided onboarding intake wizard. It sends a structured `intake` payload plus legacy compatibility fields to `/api/signup`.
- The wizard intentionally does not collect API keys, tokens, passwords, private email credentials, or bank login details. Keep any future credential exchange outside the public form.
- `docs/platform/codebase-cleanup-audit.md` flags Faako Website cleanup opportunities around long marketing CSS, repeated button/card/section-header patterns, page-section extraction candidates, and signup/API deployment coupling.

## Open questions

- Which hosted API target should own production signup traffic long term?
- What signup conversion events and failure alerts should be tracked?
- Should onboarding intake submissions later appear in a private admin checklist view?
- Which public pricing and product claims require review before release?

## Future cleanup

- Keep website API behavior documented when Faako API changes.
- Add a release checklist for marketing copy, pricing, and signup analytics.
- Keep production ownership of server-side env vars on the API service.
- Add a private intake review/checklist screen before automating setup tasks.
- Use the platform cleanup audit before consolidating public-site primitives or splitting Signup/Home/Pricing/Module Config. Preserve signup endpoint behavior and API deployment assumptions.

## Risks to monitor

- Signup failures caused by API URL drift.
- Public copy or pricing becoming stale.
- Secrets accidentally placed in browser-visible env vars.
- Website and API deploys getting out of sync.
- Visual cleanup can accidentally change public pricing, signup, and conversion surfaces; pair style extraction with content and responsive checks.
