# Faako Website Progress Log

## Purpose

Track meaningful changes to Faako Website, the public marketing site and signup funnel for Faako.

## Current app status

Public-facing website and onboarding entry point. Changes should protect brand trust, signup reliability, routing, mirrored function behavior, and browser-safe configuration.

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

### Shared app update notice shell adoption

Date: 2026-06-15
Feature/change name: Shared app update notice shell adoption
What changed: Mounted `AppUpdateNotice` from `@faako/ui` in the Faako Website app shell so visitors are prompted to refresh when a newer deployed frontend bundle is available.
Why it changed: The onboarding wizard can contain in-progress form data, so routine deploys should not force a reload while someone is completing the intake.
Files changed: apps/faako-website/src/App.jsx, apps/faako-website/README.md, packages/ui/src/components/AppUpdateNotice.tsx, packages/ui/src/ui.css, docs/apps/faako-website/progress-log.md, docs/platform/platform-progress-log.md.
Data impact: None.
Security impact: Frontend shell-only change. No signup payload, server function, email, PDF generation, or secret handling behavior changed.
Testing done: `git diff --check` passed at repo level. Shared update-notice validation is covered by the platform entry; full cross-app builds were not run in this pass.
Rollback notes: Remove the `AppUpdateNotice` import/render and revert shared UI/docs changes.
Next step: Smoke-test the signup wizard during a deployed frontend update.

### Client onboarding intake wizard with PDF and email copy

Date: 2026-05-21
Feature/change name: Client onboarding intake wizard with PDF and email copy
What changed: Replaced the simple signup form with a guided multi-step client onboarding intake wizard covering company details, primary contact, operations, modules, payment preferences, communication preferences, domain/email details, admin users, security/compliance, and review/submit. Added draft persistence, honeypot handling, mobile-friendly progress navigation, friendly validation, review summaries, and explicit no-secrets guidance.
Why it changed: Faako needs richer setup intake before manual implementation work while avoiding insecure collection of API keys, passwords, tokens, or banking credentials.
Files changed: apps/faako-website/src/pages/Signup.jsx, apps/faako-website/src/styles/pages/Auth.css, apps/faako-website/.env.example, apps/faako-website/netlify/functions/signup.js, docs/apps/faako-website/progress-log.md, docs/apps/faako-website/system-status.md, docs/apps/faako-website/implementation-notes.md, apps/faako-website/README.md
Data impact: Uses the existing signup endpoint and database compatibility flow. No website database schema change.
Security impact: Positive. The UI repeatedly tells clients not to enter secrets, and the backend rejects credential-like fields/values.
Testing done: Website build passed. Signup function syntax check passed for the mirrored website function. PDF helper smoke check passed through the shared function source. Website lint could not run because `eslint` is not installed in this checkout.
Rollback notes: Restore the previous `Signup.jsx`, remove the wizard-specific CSS and env documentation, and resync the mirrored function from a reverted Faako API function.
Next step: Add an internal admin review/checklist surface for submitted onboarding intakes.

### Documentation foundation added

Date: 2026-05-10
Feature/change name: Documentation foundation added
What changed: Added the standard app documentation set for progress tracking, system status, deploy readiness, and implementation notes.
Why it changed: Establish a consistent documentation baseline for Faako Website as part of the Faako monorepo platform.
Files changed: docs/apps/faako-website/progress-log.md, docs/apps/faako-website/system-status.md, docs/apps/faako-website/pre-deploy-checklist.md, docs/apps/faako-website/implementation-notes.md
Data impact: None. Documentation-only change.
Security impact: None. No auth, permission, secret, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added Faako Website documentation files if this documentation foundation needs to be reverted.
Next step: Keep this log updated for marketing, signup, routing, function sync, and deployment changes.
