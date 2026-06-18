# Faako API Progress Log

## Purpose

Track meaningful changes to Faako API, the Netlify Functions backend for the current Faako signup flow.

## Current app status

Backend API for signup and health checks. Changes should protect signup data, database integrity, function behavior, environment safety, and compatibility with Faako Website.

## Reusable change entry template

Date:
Feature/change name:
What changed:
Why it changed:
Files changed:
Data impact:
Security impact:
Testing done:
Rollback notes:
Next step:

## Entries

### Signup management metadata for Dev ERP

Date: 2026-06-18
Feature/change name: Signup management metadata for Dev ERP
What changed: Added a safe, additive Prisma migration for `SignupRequest` management fields: internal notes, assigned owner, activity timeline, email delivery metadata, PDF summary metadata, management update tracking, and new internal status values. Updated the signup handler to preserve the existing submission/email/PDF flow while recording delivery and PDF metadata when those columns exist.
Why it changed: Dev ERP needs to manage Faako Website onboarding and client setup submissions internally without disrupting the public form path.
Files changed: apps/faako-api/prisma/schema.prisma, apps/faako-api/prisma/migrations/20260618000000_add_signup_management_fields/migration.sql, apps/faako-api/src/signup.cjs, apps/faako-api/README.md, docs/apps/faako-api/*.
Data impact: Forward-only additive migration. Existing signup rows remain valid. Public signup still works against older databases because metadata writes check for column availability first.
Security impact: Internal notes, owner assignments, and management status metadata are not exposed through public Faako Website flows. Existing credential-like intake rejection remains in place.
Testing done: `node --check apps/faako-api/src/signup.cjs` passed. `node --check apps/faako-api/src/server.js` passed. `pnpm --filter @faako/faako-api exec prisma validate` passed. `node --test apps/faako-api/src/demoAccess.test.mjs` passed with 3 tests. `pnpm --filter @faako/faako-api run lint` could not run because the workspace does not install/configure `eslint`.
Rollback notes: Revert signup metadata writes and Dev ERP management usage. If the migration has deployed, retain the additive fields or remove them only through a separately reviewed forward migration.
Next step: Apply the migration to the intended Faako API database before enabling Dev ERP management updates in production.

### Faako API local predeploy migration script

Date: 2026-06-16
Feature/change name: Faako API local predeploy migration script
What changed: Added `predeploy:local` to `@faako/faako-api` and root shortcuts `predeploy:faako-api`/`predeploy:faako`. Updated Prisma scripts to load `.env.dev`, and aligned `prisma.config.ts` with the API runtime database precedence so local migration commands target `DATABASE_URL_DEVELOPMENT`/`DATABASE_URL_LOCAL` in development instead of silently using `DATABASE_URL`.
Why it changed: Signup submissions failed when the API runtime pointed at a development database that had not received the `SignupRequest` migrations, while the previous Prisma command path could target a different database.
Files changed: package.json, apps/faako-api/package.json, apps/faako-api/prisma.config.ts, apps/faako-api/README.md, docs/apps/faako-api/pre-deploy-checklist.md, docs/apps/faako-api/progress-log.md.
Data impact: Applied existing Faako API migrations to the configured development database. No destructive migration was introduced.
Security impact: Positive. Development migration commands now follow the same production-safety guard as the API runtime and avoid accidental production targeting unless explicitly allowed.
Testing done: `pnpm --filter @faako/faako-api run prisma:migrate:deploy` applied all pending migrations to the configured dev database. `pnpm --filter @faako/faako-api run predeploy:local` completed with "No pending migrations to apply" and "Database schema is up to date!".
Rollback notes: Revert script/config/docs changes if another migration workflow replaces this one. Do not roll back the already-applied development migrations unless intentionally resetting that dev database.
Next step: Use `pnpm run predeploy:faako-api` before future Faako API deploys that touch signup persistence or Prisma migrations.

### ERP demo access API hardening

Date: 2026-06-16
Feature/change name: ERP demo access API hardening
What changed: Added the server-owned `POST /api/demo-access` flow for Faako ERP demo access. The API now generates six-digit codes server-side, stores only an HMAC hash per challenge, emails codes through Resend, verifies with timing-safe comparison, rate-limits request and verification attempts, and fails closed in production if the demo signing secret is missing.
Why it changed: The ERP demo must not generate or display access codes in the browser. Access-code delivery and verification belongs to the backend.
Files changed: apps/faako-api/src/demoAccess.js, apps/faako-api/src/server.js, apps/faako-api/src/demoAccess.test.mjs, apps/faako-api/appSystem.js, apps/faako-api/README.md, docs/apps/faako-api/progress-log.md, docs/apps/faako-api/implementation-notes.md.
Data impact: No database migration or persisted data change. Demo challenges are in-memory and expire.
Security impact: Positive. Browser-visible demo codes were removed from the architecture; code hashes, rate limits, server-side Resend delivery, and production secret enforcement were added.
Testing done: `node --test apps/faako-api/src/demoAccess.test.mjs apps/stroane-web/backend/auth.test.js` passed. `pnpm run security:gate` passed. `pnpm run security:scan` passed. `node --check apps/faako-api/src/demoAccess.js` passed.
Rollback notes: Revert the demo access route/handler/tests and return Faako ERP to a disabled API-only state. Do not restore browser-generated preview codes.
Next step: Configure `FAAKO_ERP_DEMO_ACCESS_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the deployed ERP origin before public demo sharing.

### Client onboarding intake wizard with PDF and email copy

Date: 2026-05-21
Feature/change name: Client onboarding intake wizard with PDF and email copy
What changed: Extended the `signup` Netlify Function to accept structured onboarding intake payloads, reject credential-like secrets, preserve the existing SignupRequest/Organization/User/Membership persistence path, generate a sanitized PDF summary attachment, and send email copies to the client/contact email and Faako admin email through the existing Resend server-side flow.
Why it changed: The public Faako signup path now needs to collect business setup details and send reliable intake copies without collecting private integration credentials or creating a new backend workflow.
Files changed: apps/faako-api/netlify/functions/signup.js, apps/faako-api/.env.example, docs/apps/faako-api/progress-log.md, docs/apps/faako-api/system-status.md, docs/apps/faako-api/implementation-notes.md, apps/faako-api/README.md
Data impact: No schema migration. Structured intake is collapsed into `SignupRequest.additionalNotes` for compatibility, while existing organization/user/member records remain pending setup records.
Security impact: Positive. Backend rejects credential-like keys/values, keeps Resend sending server-side, uses existing rate limiting/CORS/database guards, and avoids logging raw email provider failures.
Testing done: API signup function syntax check passed. PDF helper smoke check passed. API lint could not run because `eslint` is not installed in this checkout. Prisma validate is blocked by the existing Prisma config/package-type mismatch.
Rollback notes: Revert the `signup` function and env/docs updates. Existing SignupRequest rows remain readable because no schema changed.
Next step: Add an internal setup checklist/admin review surface for Paystack, Resend, WhatsApp Business, SMS, domain/DNS, hosting, module enablement, admin user creation, and security review planning.

### Documentation foundation added

Date: 2026-05-10
Feature/change name: Documentation foundation added
What changed: Added the standard app documentation set for progress tracking, system status, deploy readiness, and implementation notes.
Why it changed: Establish a consistent documentation baseline for Faako API as part of the Faako monorepo platform.
Files changed: docs/apps/faako-api/progress-log.md, docs/apps/faako-api/system-status.md, docs/apps/faako-api/pre-deploy-checklist.md, docs/apps/faako-api/implementation-notes.md
Data impact: None. Documentation-only change.
Security impact: None. No auth, permission, secret, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added Faako API documentation files if this documentation foundation needs to be reverted.
Next step: Keep this log updated for function changes, signup behavior, migrations, env changes, and website compatibility.
