# Faako API Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Faako API without changing application behavior.

## Known technical notes

- The app is backend-only and uses Express.
- Current endpoints are `health`, `signup`, and `demo-access`.
- `src/runtimeConfig.js` and `src/db.js` centralize runtime config and database behavior.
- Local commands load `.env.dev`.
- Local development refuses the production database unless `ALLOW_PRODUCTION_DATABASE_IN_DEV=true`.
- Faako Website calls these endpoints through `VITE_API_BASE_URL` or the local Vite proxy.
- `signup` accepts structured onboarding intake payloads and stores a compatibility summary in `SignupRequest.additionalNotes` without requiring a schema migration.
- `signup` generates a lightweight PDF summary server-side and sends client/admin copies through Resend when configured.
- `signup` rejects credential-like keys and pasted secret-looking values. Do not add public fields for API keys, passwords, tokens, private email credentials, or bank login details.
- `/api/demo-access` owns the Faako ERP walkthrough code flow. Codes are generated server-side, stored as HMAC hashes, emailed through Resend, rate-limited per email/IP/challenge, and never returned to browser code. Production fails closed unless `FAAKO_ERP_DEMO_ACCESS_SECRET` is configured with at least 32 characters.
- `docs/platform/codebase-cleanup-audit.md` flags Faako API cleanup as documentation-first because signup/runtime behavior and website mirroring are deployment-sensitive.

## Open questions

- What hosted API target should own production signup traffic long term?
- What signup records, notifications, or CRM integrations are planned next?
- What production alerting is required for signup failures?
- Should the onboarding intake summary remain in `SignupRequest.additionalNotes`, or should a dedicated intake table be introduced later?

## Future cleanup

- Document endpoint contracts as the API grows.
- Add explicit runbooks for migration deploys and signup incidents.
- Keep website API expectations current when endpoint behavior changes.
- Add a private onboarding review/checklist workflow before automating setup tasks.
- Use the platform cleanup audit before changing signup runtime config, database targeting, or API behavior. Start with endpoint contracts and deployment docs.

## Risks to monitor

- Production database accidentally targeted from local development.
- Debug errors exposed outside local environments.
- Signup validation or storage regressions blocking onboarding.
- Faako Website calling stale or mismatched API behavior.
- Cleanup that changes runtime config or database guards could affect production signup safety.
