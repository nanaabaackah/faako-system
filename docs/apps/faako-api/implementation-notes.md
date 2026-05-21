# Faako API Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Faako API without changing application behavior.

## Known technical notes

- The app is backend-only and uses Netlify Functions.
- Current functions are `health` and `signup`.
- `src/runtimeConfig.js` and `src/db.js` centralize runtime config and database behavior.
- Local commands load `.env.dev`.
- Local development refuses the production database unless `ALLOW_PRODUCTION_DATABASE_IN_DEV=true`.
- Faako Website may mirror these functions during its prebuild step.
- `signup` accepts structured onboarding intake payloads and stores a compatibility summary in `SignupRequest.additionalNotes` without requiring a schema migration.
- `signup` generates a lightweight PDF summary server-side and sends client/admin copies through Resend when configured.
- `signup` rejects credential-like keys and pasted secret-looking values. Do not add public fields for API keys, passwords, tokens, private email credentials, or bank login details.
- `docs/platform/codebase-cleanup-audit.md` flags Faako API cleanup as documentation-first because signup/runtime behavior and website mirroring are deployment-sensitive.

## Open questions

- Should Faako API remain a dedicated Netlify site, or primarily act as the source for website-mirrored functions?
- What signup records, notifications, or CRM integrations are planned next?
- What production alerting is required for signup failures?
- Should the onboarding intake summary remain in `SignupRequest.additionalNotes`, or should a dedicated intake table be introduced later?

## Future cleanup

- Document function contracts as endpoints grow.
- Add explicit runbooks for migration deploys and signup incidents.
- Keep website sync expectations current when function names or behavior change.
- Add a private onboarding review/checklist workflow before automating setup tasks.
- Use the platform cleanup audit before changing signup runtime config, database targeting, or mirrored function behavior. Start with endpoint contracts and deployment docs.

## Risks to monitor

- Production database accidentally targeted from local development.
- Debug errors exposed outside local environments.
- Signup validation or storage regressions blocking onboarding.
- Faako Website using stale mirrored function code.
- Cleanup that changes runtime config or database guards could affect production signup safety.
