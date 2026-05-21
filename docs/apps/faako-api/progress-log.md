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
