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
