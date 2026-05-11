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

## Open questions

- Should Faako API remain a dedicated Netlify site, or primarily act as the source for website-mirrored functions?
- What signup records, notifications, or CRM integrations are planned next?
- What production alerting is required for signup failures?

## Future cleanup

- Document function contracts as endpoints grow.
- Add explicit runbooks for migration deploys and signup incidents.
- Keep website sync expectations current when function names or behavior change.

## Risks to monitor

- Production database accidentally targeted from local development.
- Debug errors exposed outside local environments.
- Signup validation or storage regressions blocking onboarding.
- Faako Website using stale mirrored function code.
