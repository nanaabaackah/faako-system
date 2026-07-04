# Platform Progress Log

## Purpose

Track monorepo-wide changes that affect multiple apps, shared packages, deployment conventions, documentation standards, or platform operations.

## Current platform status

Faako is a growing multi-app monorepo with public websites, client commerce, operational portals, backend APIs, shared UI conventions, and app-specific deployment paths.

## Reusable change entry template

Date:
Change name:
Apps/packages affected:
What changed:
Why it changed:
Files changed:
Data impact:
Security impact:
Testing done:
Rollback notes:
Next step:

## Entries

### Stroane staging and rate-limit audit

Date: 2026-07-03
Change name: Stroane staging and rate-limit audit
Apps/packages affected: Stroane Web, platform security docs
What changed: Audited rate limiting across the monorepo and tuned Stroane's API limiter layering. Stroane now supports method-scoped API limiter buckets, separates global read/write traffic from narrow auth routes, keeps dedicated admin/customer/session/checkout/payment/webhook buckets, and mounts the admin limiter once before the admin router stack. Staging docs now describe the Stroane storefront, portal, API, Cloudflare, Railway, and database split. A responsive audit-table CSS selector typo surfaced by the build was also fixed.
Why it changed: Stroane portal/customer usage could hit broad in-memory rate limits after normal repeated actions, even though route-specific admin limits had already been raised. Admin requests could also consume more than one admin-limit hit while passing unmatched routers. Staging needed a clear runbook before promotion.
Files changed: Stroane backend security/server/tests and Stroane/platform docs.
Data impact: No schema or data changes.
Security impact: Positive. Sensitive auth/payment/write endpoints remain limited separately while normal authenticated app reads are less likely to exhaust narrow abuse-protection buckets. Persistent/provider-level rate limiting is still not standardized across the monorepo.
Testing done: Stroane backend tests, syntax checks, Prisma validate, TypeScript, lint, build, whitespace check, staging curl smoke, and headless Chrome staging smoke passed. Build retained only the existing Vite env warning.
Rollback notes: Revert the Stroane limiter wiring and docs. No database rollback is required.
Next step: Deploy the tuned Stroane API to staging and repeat the action flow that previously produced 429s.

### REEBS CRM contact intake and project metadata refresh

Date: 2026-06-25
Change name: REEBS CRM contact intake and project metadata refresh
Apps/packages affected: REEBS Website, REEBS Portal, Dev ERP docs, ByNana Portfolio, @faako/config
What changed: Connected REEBS public contact submissions to CRM persistence: contact requests now upsert/link customers, create request rows, create follow-up activity, return a request reference, and still send email notifications. Added authenticated contact-request list/status-update support. REEBS CRM customer detail now shows planning requests and follow-up activity with inline status updates. Updated ByNana portfolio/project registry metadata for current REEBS and Dev ERP system state, including CRM-backed contact intake, registry-driven modules, proposal workflow, Faako onboarding review, and the future module-settings direction.
Why it changed: Contact submissions need an operational source of truth inside CRM, and public/internal project metadata should match the current monorepo capabilities.
Files changed: REEBS contact/backend/customer/CRM files, REEBS READMEs/docs, ByNana project content/pages, shared project registry, Dev ERP implementation/progress docs.
Data impact: Additive REEBS runtime table creation for `contactRequest` and `customerActivity`; contact submissions can create/update CRM customer records as prospects. Dev ERP and ByNana updates are metadata/content only.
Security impact: Positive. Contact intake remains server-validated, cross-site browser requests are rejected, rate limiting was added, and CRM persistence avoids relying on email-only handling.
Testing done: REEBS backend syntax checks passed. Targeted REEBS contact/CRM ESLint checks passed. ByNana content lint passed. `pnpm run project-registry:check` passed.
Rollback notes: Revert the REEBS CRM/contact changes and metadata/docs updates. Handle any created CRM contact request data with a separate reviewed data-retention decision.
Next step: Add a dedicated CRM request inbox/filter view, then design backend-owned module enablement and editable template/settings APIs with audit logging.

### Dev ERP Faako onboarding management

Date: 2026-06-18
Change name: Dev ERP Faako onboarding management
Apps/packages affected: Dev ERP, Faako API
What changed: Added a protected Dev ERP module for managing Faako Website onboarding and client setup submissions. Dev ERP reads Faako API `SignupRequest` rows through `FAAKO_DATABASE_URL`, shows submissions in a filterable ERP table, opens full wizard responses in a lightbox, and supports internal status, notes, owner, email/PDF metadata, and activity timeline review. Faako API received an additive signup-management migration and now records delivery/PDF metadata when those columns exist.
Why it changed: Faako needed an internal operational review surface for public onboarding/client setup submissions while preserving the existing public submission, PDF, and email flow.
Files changed: Dev ERP module/backend/routes/navigation/tests/docs, Faako API signup/schema/migration/docs, package/lock metadata.
Data impact: No Dev ERP database migration. Faako API migration is additive to `SignupRequest` and keeps existing rows compatible.
Security impact: Internal management routes are authenticated/admin-protected by Dev ERP capability checks. Public Faako Website flows do not expose internal notes or management fields.
Testing done: Dev ERP tests passed with 124 tests, Dev ERP lint/typecheck/build passed, Dev ERP Playwright onboarding workflow passed with 1 test, Faako API Prisma validate passed, Faako API syntax checks passed, and Faako API demo access tests passed. Faako API lint remains unavailable because that workspace has no eslint install/config.
Rollback notes: Revert Dev ERP module wiring and Faako API metadata writes. Treat any deployed Faako API schema removal as a separate forward migration.
Next step: Deploy the Faako API migration, configure Dev ERP `FAAKO_DATABASE_URL`, and smoke-test the live management workflow.

### Dev startup runs local predeploy migrations

Date: 2026-06-17
Change name: Dev startup runs local predeploy migrations
Apps/packages affected: Faako API, Dev ERP, REEBS Portal, REEBS Website combined dev, Stroane Web, root dev shortcuts, platform docs
What changed: Tied Prisma-backed local dev startup to each app's local predeploy migration flow. Faako API `dev`, Dev ERP `dev`/`dev:with-backend`, REEBS Portal `dev`/`dev:with-backend`, REEBS Website `dev:with-backend`, and Stroane Web `dev`/`dev:with-backend` now run local Prisma predeploy before long-running dev servers start. Root `dev:faako`, `dev:dev-erp`, `dev:reebs`, and `dev:stroane` now run or flow through those guarded commands before launching their stacks.
Why it changed: Local development should not start against stale Prisma clients or pending development migrations, especially after schema changes.
Files changed: package.json, apps/faako-api/package.json, apps/dev-erp/package.json, apps/reebs-portal/package.json, apps/reebs-website/package.json, apps/stroane-web/package.json, scripts/dev-faako.mjs, scripts/dev-dev-erp.mjs, README.md, app READMEs, Stroane env/predeploy docs.
Data impact: Running the affected dev commands can now apply pending migrations to the configured local/development databases before startup. Production migration commands are unchanged.
Security impact: Positive operationally. Local app servers are less likely to run against stale schemas that can produce broken auth, customer, order, or signup flows.
Testing done: Package JSON parse checks passed for root and affected app package files. `node --check` passed for `scripts/dev-faako.mjs` and `scripts/dev-dev-erp.mjs`. `git diff --check` passed.
Rollback notes: Revert the dev script prefixes and launcher command changes if local dev should no longer apply pending migrations automatically. Keep standalone `predeploy:local` scripts for manual checks.
Next step: Run each affected dev shortcut with approved database/network access and confirm the migration preflight completes before servers stay running.

### Cross-app local predeploy and dev email routing

Date: 2026-06-16
Change name: Cross-app local predeploy and dev email routing
Apps/packages affected: Dev ERP, Faako API, Faako Website env template, REEBS Portal, REEBS Website local env, Stroane Web, platform scripts/docs
What changed: Added `predeploy:local` scripts to the Prisma-backed apps and root shortcuts for Dev ERP, Faako API, REEBS Portal, Stroane Web, plus `pnpm run predeploy:local` for all local app migrations. Local/non-production email delivery now forces test sends to `dev@nanaabaackah.com` by default across Dev ERP, Faako signup/demo access, REEBS notifications, and Stroane order/inventory email senders.
Why it changed: Local migration checks should be consistent across app databases, and local test emails must not reach customer/input addresses.
Files changed: Root and app package scripts, app email sender helpers, local/example env defaults, focused email tests, and app pre-deploy checklists.
Data impact: No schema or data changes in this patch. The new all-app command applies pending local/development migrations only when explicitly run.
Security impact: Positive. Non-production email sends are less likely to leak to customer addresses, and redirected messages are visibly marked as local tests.
Testing done: Package JSON parse checks passed. Syntax checks passed for the touched Faako, REEBS, and Stroane email modules. Focused Node tests passed with 20 tests. `git diff --check` passed.
Rollback notes: Revert the script additions and email routing helpers/env defaults if needed. No data rollback is required unless the new predeploy migration command has been run separately.
Next step: Run `pnpm run predeploy:local` only when ready to apply pending migrations to every configured local/development app database.

### Cross-app security hardening pass

Date: 2026-06-16
Change name: Cross-app security hardening pass
Apps/packages affected: Faako ERP, Faako API, Stroane Web, REEBS Portal, platform security tooling/docs
What changed: Removed browser-visible Faako ERP demo codes and moved demo access to the Faako API email-code route. Moved Stroane admin auth to HttpOnly cookies with legacy bearer fallback, removed storefront browser-side customer password-hash storage, and updated portal clients to use credentialed cookie requests. Replaced REEBS customer wildcard CORS responses with allowlisted security headers and hardened the water MoMo webhook to require header-based shared-secret delivery. Expanded `security:gate` to detect sensitive `VITE_*` source usage and browser-visible demo access-code patterns.
Why it changed: Access codes, staff auth tokens, customer password hashes, customer data CORS, and webhook secrets are high-risk surfaces that should not be exposed in browser-readable paths or arbitrary-origin responses.
Files changed: Faako API/ERP demo access files, Stroane auth/backend/portal customer-profile files, REEBS customer/webhook functions, `scripts/security-gate.mjs`, app READMEs, app security/progress/implementation docs, and this platform log.
Data impact: No schema migrations or database writes. Browser storage shape changed for Faako demo sessions and Stroane portal/customer placeholder sessions; old token fields are normalized away by the frontend.
Security impact: Positive. Codes are backend-generated/emailed, admin credentials moved to HttpOnly cookies, customer password storage was removed from the storefront, customer API CORS now uses allowlists, webhook secrets no longer travel in URLs/bodies, and the security gate now catches more browser-exposure regressions. Postgres RLS was documented as a staged per-app rollout rather than enabled unsafely across the monorepo.
Testing done: `node --test apps/faako-api/src/demoAccess.test.mjs apps/stroane-web/backend/auth.test.js` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm run security:gate` passed. `pnpm run security:scan` passed. Syntax checks passed for the touched Faako API, Stroane auth, and REEBS function files.
Rollback notes: Revert app-specific changes if an integration needs an emergency hotfix, but do not restore browser-visible demo codes, customer password storage, wildcard customer CORS, or URL/body webhook secrets as permanent behavior.
Next step: Add explicit CSRF tokens before widening Stroane admin cookie scope, then design staged least-privilege/RLS policies per Postgres app with request-level tenant context and tests.

### Cross-app non-interruptive update notice and docs skill

Date: 2026-06-15
Change name: Cross-app non-interruptive update notice and docs skill
Apps/packages affected: `@faako/ui`, By Nana Portfolio, Dev ERP, Faako ERP, Faako Website, REEBS Portal, REEBS Website, Stroane Web, System Starter, UI Workbench, platform documentation
What changed: Added shared `AppUpdateNotice` support in `@faako/ui` and mounted it across the browser app shells. The notice checks the current HTML for changed hashed assets, prompts users to refresh when a newer deployed bundle exists, supports opt-in local testing through `VITE_ENABLE_APP_UPDATE_NOTICE=true`, and never auto-reloads the page. Added a repo-local `skills/update-project-docs` skill plus documentation updates so future code changes carry their README, app-doc, package-doc, and platform-doc trail with them.
Why it changed: Git deploys can replace app bundles while users are editing forms, managing inventory, checking out, or working in live portals. The shared prompt lets users finish their current work before refreshing, and the docs skill reduces drift after future changes.
Files changed: packages/ui/src/components/AppUpdateNotice.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, browser app `App` files, app README files, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, skills/update-project-docs/*.
Data impact: None. No schema, migration, seed, operational record, cart, order, payment, inventory, customer, report, offline queue, or auth data changed.
Security impact: Low-risk frontend shell addition. The notice performs same-origin HTML checks by default, sends no customer/admin/form/cart/payment/auth data, and reloads only when the user clicks the refresh action.
Testing done: `git diff --check` passed. `apps/stroane-web/src/data/stroaneCatalogue.json` parsed successfully. Direct backend tests for Stroane priced checkout and Paystack helper behavior passed with 7 tests. A fallback skill metadata/frontmatter check passed; the official skill validator could not run because this Python environment is missing PyYAML. Stroane TypeScript, lint, and narrow component TypeScript checks were attempted but did not complete in this shell and were interrupted.
Rollback notes: Remove `AppUpdateNotice` imports/usages from app shells, remove the shared component export/styles, and revert the docs/skill additions. No data rollback is required.
Next step: Smoke-test one public website and one authenticated portal after deployment, leaving a form or cart open while a newer bundle is available, to confirm the prompt does not interrupt in-progress work.

### Automatic app registry onboarding

Date: 2026-06-03
Change name: Automatic app registry onboarding
Apps/packages affected: App creation script, `@faako/config`, byNana portfolio metadata
What changed: Updated `pnpm create:app` so newly cloned apps are automatically added to shared monorepo monitoring metadata, private draft portfolio project metadata, and `docs/apps/<new-app>/README.md`. Monitoring category/pages/env overrides are inferred from the source app and target name, while project metadata stays private until explicitly reviewed for publication.
Why it changed: New app creation previously required manual registry and portfolio metadata edits, which made Dev ERP monitoring and future byNana portfolio project tracking easy to miss.
Files changed: scripts/create-app-from-reference.mjs, docs/app-platform.md, apps/bynana-portfolio/README.md, packages/config/README.md, docs/platform/platform-progress-log.md.
Data impact: None. Future create-app runs edit source-controlled metadata only; no database, migration, hosted service, payment, customer, report, or audit data changes.
Security impact: New portfolio entries are private drafts by default. The clone flow still skips env/key material and does not publish case studies automatically.
Testing done: `node --check scripts/create-app-from-reference.mjs` passed. Focused registry/status tests passed. `pnpm run monitoring:check` passed. `pnpm run project-registry:check` completed with existing legacy-app metadata warnings only. Dev ERP tests passed with 104 tests. Dev ERP lint and build passed. Affected-file `git diff --check` passed.
Rollback notes: Revert the create-app auto-registration helpers and documentation updates; app cloning would return to manual registry follow-up.
Next step: When creating a real app, review the generated monitoring route list and private project metadata before deployment or public portfolio publication.

### Surface-aware app monitoring registry

Date: 2026-06-03
Change name: Surface-aware app monitoring registry
Apps/packages affected: `@faako/config`, Dev ERP
What changed: Expanded shared app monitoring metadata for Stroane, Faako, and REEBS frontend/portal routes, added Stroane portal and backend API surfaces, and documented that Dev ERP keeps API/internal-only surfaces out of website page health while promoting APIs into System Status.
Why it changed: The monitoring view needed complete hosted frontend/portal coverage without showing backend APIs, System Starter, or UI Workbench as website pages.
Files changed: packages/config/src/monorepoApps/appRegistry.js, packages/config/src/monorepoApps/appRegistry.test.js, packages/config/README.md, Dev ERP monitoring/status files, Dev ERP docs.
Data impact: None in shared config. Dev ERP separately seeds the missing Stroane organization when its backend starts.
Security impact: None. Monitoring metadata only; no auth, permission, cookie, CORS, or API write behavior changed.
Testing done: Focused registry/status tests, `pnpm run monitoring:check`, Dev ERP tests/lint/build, backend syntax check, and affected-file `git diff --check` passed.
Rollback notes: Restore the previous registry route list and Dev ERP monitoring separation.
Next step: Reuse the same category split when adding future hosted portals or backend APIs to the registry.

### Shared branded month and time fields

Date: 2026-06-02
Change name: Shared branded month and time fields
Apps/packages affected: `@faako/ui`, Dev ERP
What changed: Extended the shared Faako field set with branded `MonthField` and `TimeField` controls alongside the existing dropdown and calendar-date controls. Migrated Dev ERP's remaining native select, date, month, and time widgets across its operational modules to the shared field language while keeping app-owned state and workflow handlers.
Why it changed: The shared field system needed reusable month and time variants before Dev ERP could remove its remaining browser-native form widgets consistently.
Files changed: packages/ui/src/components/Fields.tsx, packages/ui/src/ui.css, packages/ui/README.md, Dev ERP page and style files, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md.
Data impact: None.
Security impact: None. Presentation-only shared UI adoption.
Testing done: The Dev ERP raw-control sweep returned no page-owned `<select>` or `date`/`month`/`time` inputs under `apps/dev-erp/src`. Dev ERP lint passed, Dev ERP tests passed with 104 tests, Dev ERP and UI Workbench production builds passed, the Stroane Web TypeScript check passed, and the affected-file `git diff --check` passed.
Rollback notes: Restore the prior Dev ERP native fields, remove the shared month/time controls and styles, and revert these documentation entries.
Next step: Reuse the shared variants in other apps when their date, month, or time controls are next reviewed.

### Shared themed skeleton loading adoption

Date: 2026-06-02
Change name: Shared themed skeleton loading adoption
Apps/packages affected: `@faako/ui`, By Nana Portfolio, Dev ERP, Faako ERP, Faako Website, REEBS Portal, REEBS Website, Stroane Web, System Starter, UI Workbench
What changed: Reused the shared `AnimatedLoadingState` skeleton across frontend apps. Added fixed overlay support for route transitions, kept shimmer colors app-owned through shared theme tokens, replaced duplicated REEBS loader implementations, converted Dev ERP module fetch states to compact skeletons, and added lazy route boundaries to Dev ERP, Faako Website, and Faako ERP. By Nana now uses the shared full-page overlay during its existing route transition. System Starter and UI Workbench expose the compact skeleton as the canonical scaffold/reference example. Stroane already used the shared skeleton and inherits the overlay-capable shared primitive without an app-local change.
Why it changed: Loading states had drifted into app-local spinners, plain text, and bespoke animations. The monorepo now has one consistent three-row skeleton language while preserving each app's own accent color.
Files changed: packages/ui/src/components/Feedback.tsx, packages/ui/src/ui.css, packages/ui/README.md, apps/bynana-portfolio/src/components/Loader.jsx, apps/bynana-portfolio/src/styles/global.css, apps/dev-erp/src/App.jsx, Dev ERP loading-state page/component files, apps/faako-erp/src/App.jsx, apps/faako-website/src/App.jsx, REEBS SiteLoader files, apps/system-starter/src/App.jsx, apps/ui-workbench/src/App.jsx, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md.
Data impact: None. No schema, migration, seed, operational record, customer, order, payment, report, or audit data changed.
Security impact: None. Presentation and frontend bundle-splitting only. Existing route guards, auth checks, permissions, cookies, CSRF behavior, and API ownership remain unchanged.
Testing done: All nine frontend production builds passed: By Nana Portfolio, Dev ERP, Faako ERP, Faako Website, REEBS Portal, REEBS Website, Stroane Web, System Starter, and UI Workbench. Dev ERP tests passed with 102 tests. Dev ERP, By Nana Portfolio, and Stroane Web lint passed. Faako Website and Faako ERP lint scripts remain blocked because their workspace dependency graphs do not install `eslint`. REEBS Website sitemap generation used its existing fallback because network fetch was unavailable; the generated sitemap diff was restored. `git diff --check` passed.
Rollback notes: Revert the shared overlay option, route lazy boundaries, shared loader wrappers, Dev ERP compact loader adoption, starter/workbench examples, and this documentation entry. No data rollback is required.
Next step: Smoke-test route transitions on narrow and desktop viewports after deployment, especially Dev ERP auth boot, REEBS lazy routes, and By Nana overlay transitions.

### Stroane portal subdomain separation

Date: 2026-05-31
Change name: Stroane portal subdomain separation
Apps/packages affected: Stroane Web, platform documentation
What changed: Split the Stroane frontend into lazy storefront and portal surfaces from the same workspace. `stroanesolutions.com` remains public-facing, while `portal.stroanesolutions.com` owns `/login` and protected `/admin/*` operations. Railway CORS includes the portal origin. Portal bearer auth remains origin-scoped and no parent-domain cookie was introduced.
Why it changed: Align Stroane with the Faako/REEBS pattern of keeping client storefronts separate from operational portals without destabilizing existing inventory, supplier, catalogue fallback, or protected API workflows.
Data impact: None.
Security impact: Positive hostname separation and explicit CORS expansion for the private portal origin.
Testing done: See Stroane progress log and final verification summary.
Rollback notes: Revert the Stroane surface router, portal URL handoff, CORS origin addition, and documentation.
Next step: Provision the Cloudflare Pages portal project and hosted portal DNS, then run login/logout and protected-route acceptance checks.

### Faako client-app boundary audit and Dev ERP operational stabilization

Date: 2026-05-31
Change name: Faako client-app boundary audit and Dev ERP operational stabilization
Apps/packages affected: Stroane Web, Dev ERP, `@faako/notifications`, `@faako/finance`, platform documentation
What changed: Documented public-site, client-portal, internal-ERP, and shared-package ownership boundaries. Stroane owner-alert text sanitization now reuses `@faako/notifications` while Stroane catalogue, inventory, supplier, alert orchestration, and bearer auth stay app-owned. Dev ERP hosted cookie sessions now support separate frontend/API origins without weakening CSRF, and invoices add an additive paid-amount field with shared pure balance/status arithmetic plus operator, public-view, PDF, and email presentation.
Why it changed: The platform needs deliberate reuse boundaries, and Dev ERP had two urgent production-sensitive gaps: cross-site hosted-session cookies and missing partial-invoice payment visibility.
Files changed: docs/platform/architecture.md, docs/platform/faako-client-app-boundaries.md, docs/platform/platform-progress-log.md, Stroane notification helper/package files, Dev ERP auth/session/invoice/schema/migration/UI/docs files.
Data impact: Stroane has no data change. Dev ERP has one additive invoice migration: existing paid invoices are backfilled to their total, and other existing invoices default to zero payment received.
Security impact: Positive. Shared notification sanitation removes local drift. Dev ERP cookies remain secure cross-site cookies, CSRF cookie/header validation remains enforced, refresh rechecks organization scope, and no browser-readable access token was introduced.
Testing done: See app-specific progress logs. Dev ERP backend tests passed with 98 tests; Stroane backend tests passed with 30 tests; Stroane Playwright passed with 9 tests; shared finance and notification package tests passed with 4 and 5 tests respectively; affected builds, lint checks, Prisma validation, `pnpm run security:gate`, `pnpm run monitoring:check`, and `git diff --check` passed.
Rollback notes: Revert helper adoption and docs for Stroane. For Dev ERP, revert runtime/UI changes; preserve entered paid amounts before any separately reviewed forward migration removing the column.
Next step: Deploy Dev ERP migration and Railway cookie env values, then run hosted login and partial-invoice acceptance tests before broader shared extraction.

### Stroane catalogue normalization and Faako onboarding submit fix

Date: 2026-05-22
Change name: Stroane catalogue normalization and Faako onboarding submit fix
Apps/packages affected: Stroane Web, Faako Website, Faako API
What changed: Normalized the Stroane catalogue seed into category groups, leaf categories, standalone thermometer products, and apron variant-parent products with normalized media, structured specifications, variant images, and inventory/manual-review placeholders. Added supplied product images under organized Stroane public asset folders and updated storefront/backend catalogue mapping to consume the normalized shape. Also fixed the Faako onboarding wizard submit path by sending a simple form-encoded payload to avoid local cross-port CORS preflight failures, parsing structured intake fields server-side, preserving credential-like payload rejection, and keeping local draft auto-save visible to users.
Why it changed: Stroane needs a scalable catalogue structure before any future inventory/ERP work, and Faako onboarding submissions were failing locally/production-like with a preflight 500 before the function could process the intake.
Files changed: apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/public/imgs/products/thermometers/*, apps/stroane-web/public/imgs/products/aprons/*, apps/stroane-web/README.md, docs/apps/stroane-web/catalogue-architecture.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, apps/faako-api/netlify/functions/signup.js, docs/platform/client-onboarding-wizard.md, docs/platform/platform-progress-log.md
Data impact: Static catalogue seed and public image asset updates only for Stroane. No Stroane schema change, no orders/payments/inquiries/customer data changes, and no inventory automation. Faako onboarding keeps the existing persistence path and does not change schema.
Security impact: No secrets exposed. Stroane unknown price/stock products remain non-purchasable. Faako onboarding still rejects credential-like fields and sends email/PDF only from server-side functions.
Testing done: Catalogue JSON parse check passed. Stroane backend catalogue and seed script syntax checks passed. Stroane TypeScript check passed. Faako Website build passed. Faako signup function syntax checks passed. Faako local CORS/secret-rejection smoke check passed. Final build/check details are recorded in the chat summary.
Rollback notes: Revert the Stroane catalogue seed/assets/helper/UI/backend/docs changes and the Faako signup frontend/function/draft-note changes. No database rollback is required unless the updated Stroane seed has been applied to production.
Next step: Confirm Stroane product prices, stock counts, and variant availability; then add an internal Faako onboarding review/checklist surface before integration automation.

### Client onboarding intake wizard with PDF and email copy

Date: 2026-05-21
Change name: Client onboarding intake wizard with PDF and email copy
Apps/packages affected: Faako Website, Faako API
What changed: Converted the Faako signup surface into a guided client onboarding intake wizard and extended the shared `signup` function path to accept structured onboarding payloads, reject credential-like secrets, generate a sanitized PDF summary, and send client/admin email copies through server-side Resend email.
Why it changed: Faako onboarding needs richer business setup details before manual implementation work, while keeping integration credentials out of public forms and avoiding live setup automation.
Files changed: apps/faako-website/src/pages/Signup.jsx, apps/faako-website/src/styles/pages/Auth.css, apps/faako-website/.env.example, apps/faako-website/netlify/functions/signup.js, apps/faako-api/netlify/functions/signup.js, apps/faako-api/.env.example, apps/faako-website/README.md, apps/faako-api/README.md, docs/platform/client-onboarding-wizard.md, docs/platform/platform-progress-log.md, docs/apps/faako-website/progress-log.md, docs/apps/faako-website/system-status.md, docs/apps/faako-website/implementation-notes.md, docs/apps/faako-api/progress-log.md, docs/apps/faako-api/system-status.md, docs/apps/faako-api/implementation-notes.md
Data impact: No database schema change. The existing signup persistence path remains in use and stores the structured intake as a compatibility summary in `SignupRequest.additionalNotes`.
Security impact: Positive. No frontend email sending, no integration automation, no secret collection, server-side Resend only, credential-like payload rejection, existing rate limiting/CORS/database guards preserved.
Testing done: Source and mirrored signup function syntax checks passed. PDF helper smoke check passed. Faako Website production build passed. Faako Website/API lint scripts could not run because `eslint` is not installed in this checkout. API Prisma validate is blocked by the existing Prisma config/package-type mismatch.
Rollback notes: Revert the website wizard, backend signup function, env examples, mirrored function sync, and documentation. No database rollback is required.
Next step: Add an internal onboarding setup checklist/admin review surface before automating Paystack, Resend, WhatsApp Business, SMS, domain/DNS, hosting, module enablement, admin user creation, or security review tasks.

### Stroane commerce stabilization and Safari UI QA

Date: 2026-05-21
Change name: Stroane commerce stabilization and Safari UI QA
Apps/packages affected: Stroane Web, `@faako/ui`, platform security docs
What changed: Ran a focused Stroane commerce QA pass and applied low-risk stabilization fixes. Shared/Stroane CSS now normalizes Safari/iOS native styling for buttons, inputs, selects, textareas, search fields, date fields, dropdowns, shared field controls, and action controls while preserving token-based styling and focus behavior. Mobile viewport handling was tightened with `100dvh` fallbacks on checkout, auth, admin orders, error, services, shared app screen, dropdown, and maintenance-page surfaces. The Paystack browser-return verification endpoint now normalizes currency codes before comparison, matching webhook behavior. Backend auth/catalogue/order/payment route logs now use sanitized message/status output instead of raw error objects.
Why it changed: Stroane is now a payment/order-capable commerce app, so checkout, payment status messaging, stock gating, mobile forms, and browser-control consistency needed a QA and stabilization pass before additional commerce features.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/src/styles/globals.css, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/src/styles/pages/AdminOrders.css, apps/stroane-web/src/styles/pages/Auth.css, apps/stroane-web/src/styles/pages/ErrorPage.css, apps/stroane-web/src/styles/pages/Services.css, packages/ui/src/ui.css, packages/ui/README.md, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/security-status.md
Data impact: None. No migrations, database writes, stock counts, order totals, inventory deduction, fulfillment automation, CRM, Dev ERP, REEBS, WhatsApp, or SMS workflows changed.
Security impact: Positive hardening only. Webhook confirmation remains the trusted paid-state path. Browser callback verification stays customer messaging/status check only. Sanitized route logging reduces accidental provider/error detail exposure. Shared UI changes are presentation-only.
Testing done: `/usr/local/bin/node --check apps/stroane-web/backend/src/orders.js` passed. `/usr/local/bin/node --check apps/stroane-web/backend/src/routes/auth.js` passed. `/usr/local/bin/node --check apps/stroane-web/backend/server.js` passed. `/usr/local/bin/node --test apps/stroane-web/backend/paystack.test.js apps/stroane-web/backend/security.test.js` passed. Stroane TypeScript check, lint, Prisma validate, production build, `security:gate`, `security:scan`, and `git diff --check` passed.
Rollback notes: Revert the CSS normalization/viewport changes, Paystack callback currency normalization, sanitized log updates, and documentation. No database rollback is required.
Next step: Add payment event/notification logs, then perform deployed iPhone Safari checkout smoke testing against the Netlify/Railway environment.

### Stroane staff sign-in routing fix

Date: 2026-05-21
Change name: Stroane staff sign-in routing fix
Apps/packages affected: Stroane Web
What changed: Updated Stroane `/signin` so it can accept customer email sign-in or private staff usernames. When no local customer account exists, the page now attempts backend `SiteUser` login and routes valid `ADMIN`/`VIEWER` staff users to `/admin/orders`.
Why it changed: The newly seeded backend staff accounts were valid for the admin order workflow, but the visible sign-in page only checked local customer accounts and showed "No account found for that email."
Files changed: apps/stroane-web/src/pages/SignIn.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: None. Runtime login uses database-backed `SiteUser` rows; the CSV remains seed/import-only.
Security impact: No admin permissions were loosened. Staff users still receive backend bearer tokens from `/api/auth/login`, and admin order APIs still enforce `ADMIN`/`VIEWER` roles.
Testing done: `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run lint` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run build` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:gate` passed. `git diff --check` for affected files passed.
Rollback notes: Revert the sign-in fallback and docs if staff should use only the unlinked `/admin/orders` login.
Next step: Verify the seeded admin/viewer accounts exist in the deployed Railway Postgres database.

### Stroane lightweight admin order management

Date: 2026-05-21
Change name: Stroane lightweight admin order management
Apps/packages affected: Stroane Web
What changed: Added a protected lightweight admin order-management foundation for Stroane. Backend admin order routes support authenticated list/detail access, search/filtering, masked Paystack references, and admin-only fulfillment/status/note updates. The frontend adds an unlinked `/admin/orders` page with private backend login, status filters, order detail, delivery/internal notes, and quick fulfillment actions. Added additive order fields for fulfillment status, delivery method, expected delivery date, admin delivery notes, internal notes, and status update metadata.
Why it changed: Stroane needs a small operational view after payment confirmation, but still needs to avoid full ERP, CRM, inventory automation, or payment mutation.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/adminAuth.js, apps/stroane-web/backend/src/adminOrders.js, apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260521000000_add_admin_order_fulfillment_fields/migration.sql, apps/stroane-web/src/App.tsx, apps/stroane-web/src/api/adminOrders.ts, apps/stroane-web/src/pages/AdminOrders.tsx, apps/stroane-web/src/styles/pages/AdminOrders.css, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/platform/security-status.md
Data impact: Additive order fulfillment/admin-note fields only. No payment verification, Paystack webhook, stock, inventory, CRM, Dev ERP, REEBS, WhatsApp, SMS, or unrelated workflow changes.
Security impact: Admin order routes require backend `SiteUser` bearer authentication; viewers are read-only and admins can update fulfillment/status fields. Payment status remains webhook/provider-owned and cannot be manually changed. Admin responses mask Paystack references and do not expose raw payment metadata or secrets.
Testing done: Backend syntax checks, Paystack/security node tests, Stroane Prisma validate, TypeScript check, lint, build, security gate, security scan, and diff hygiene passed.
Rollback notes: Revert the admin routes, admin frontend files, additive schema/migration fields, and docs. Export entered fulfillment notes/statuses first if the migration has been deployed and used.
Next step: Dedicated payment event/notification log, then lightweight stock admin.

### Stroane Paystack webhook verification and reliable order finalization

Date: 2026-05-21
Change name: Stroane Paystack webhook verification and reliable order finalization
Apps/packages affected: Stroane Web
What changed: Strengthened Stroane Paystack webhook processing so a signed webhook now performs server-side Paystack transaction verification before any final paid-state transition. The route validates the stored order, Paystack-verified reference, verified amount, verified currency, and current order state before marking an order paid. Already-finalized paid orders return successfully without re-running order transitions, and customer confirmation email remains tied to trusted paid finalization. Customer callback copy now avoids presenting browser return as final payment truth.
Why it changed: Stroane checkout needs production-safer payment trust semantics before broader commerce expansion. Browser redirects are customer UX only; final order confirmation needs server-to-server verification.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/paystack.test.js, apps/stroane-web/src/pages/CheckoutReturn.tsx, apps/stroane-web/.env.example, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: No schema changes. Existing payment metadata fields now capture transaction-verified webhook metadata. No inventory, fulfillment, CRM, Dev ERP, REEBS, WhatsApp, SMS, or unrelated app workflows changed.
Security impact: Paystack secrets remain backend-only. Paid order finalization now requires signature verification plus Paystack transaction verification with reference, amount, and currency checks. Duplicate webhooks do not re-run paid transitions, and email failure does not fail order finalization.
Testing done: Backend syntax checks and Paystack/security node tests passed. Stroane TypeScript check, lint, Prisma validate, build, security gate, and security scan passed. Project registry check passed with warning-only missing metadata notes for apps outside this scope. `git diff --check` passed.
Rollback notes: Revert the Stroane webhook transaction-verification route changes, Paystack test, checkout return copy, env/docs updates, and this entry. No migration rollback required.
Next step: Lightweight admin order management and a dedicated payment event/notification log before fulfillment automation.

### Stroane security and production readiness pass

Date: 2026-05-20
Change name: Stroane security and production readiness pass
Apps/packages affected: Stroane Web, `@faako/security`, platform security docs
What changed: Reused the shared `@faako/security` API header baseline in Stroane backend security middleware, added route-specific in-memory rate limits for auth/inquiry/checkout/Paystack routes, added a pre-Paystack payment-readiness validation that rechecks current catalogue price, currency, stock status, purchasability, and quantity, minimized Paystack provider metadata, removed obsolete browser-visible preview-auth env examples, and created Stroane/platform security status notes.
Why it changed: Stroane now has customer data, order data, payment references, Paystack webhook confirmation, and notification foundations, so security consistency and payment-readiness controls needed to be tightened before further commerce expansion.
Files changed: apps/stroane-web/backend/security.js, apps/stroane-web/backend/security.test.js, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/paystack.js, apps/stroane-web/.env.example, apps/stroane-web/package.json, pnpm-lock.yaml, apps/stroane-web/src/pages/Privacy.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/security-status.md, docs/platform/platform-progress-log.md
Data impact: None. No schema changes, migrations, inventory deductions, order total changes, fulfillment automation, CRM workflow, Dev ERP workflow, or REEBS workflow changed.
Security impact: Positive hardening only. Shared headers reduce drift, route-specific limits reduce basic abuse risk, server-side readiness validation prevents stale stock/pricing from proceeding to payment initialization, Paystack metadata avoids raw internal IDs/customer phone, and security docs now call out Railway/provider-level rate controls, Railway Postgres least-privilege access, backend admin auth, and payment event/notification log gaps.
Testing done: `pnpm --filter @faako/stroane-web exec node --test backend/security.test.js` passed. Backend `node --check` passed for `server.js`, `security.js`, `orders.js`, `paystack.js`, and `orderNotifications.js`. `pnpm --filter @faako/stroane-web exec prisma validate` passed after rerunning with access to Prisma's local engine cache. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run security:scan` passed. `pnpm run security:gate` initially failed on obsolete `VITE_AUTH_PASSWORD`; after cleanup it passed. `pnpm run monitoring:check` passed. `pnpm run project-registry:check` passed with warning-only metadata coverage notes.
Rollback notes: Revert the Stroane security middleware/dependency/lockfile changes, route limit wiring, payment-readiness validation, metadata minimization, env example cleanup, docs, and privacy wording update. No data rollback required.
Next step: Railway/provider-level rate limiting, payment event/notification logs, Railway Postgres least-privilege access, and backend-enforced admin auth planning before broader commerce/admin workflows.

Decision update: On 2026-05-21, public Stroane sign-in/sign-up was retained as a frontend-only customer convenience, not a backend auth boundary. Stroane selected Railway/provider controls as the production rate-limit layer and Railway Postgres as the production database direction. Private backend `SiteUser` access should remain limited to one seeded admin and one seeded viewer account until a real admin/account model is approved.

### Stroane storefront stock availability foundation

Date: 2026-05-20
Change name: Stroane storefront stock availability foundation
Apps/packages affected: Stroane Web
What changed: Added storefront stock availability fields and conservative purchase gating for Stroane catalogue products. Catalogue products now support `stockQuantity`, `stockStatus`, `lowStockThreshold`, `allowBackorder`, and `isPurchasable`; PDF-imported seed products default to unavailable/non-purchasable until real counts are confirmed. Product cards/details show customer-facing availability, inquiry appears only as fallback, cart controls disable unavailable additions, checkout blocks unavailable/unconfirmed-stock items, and backend order preparation validates stock/purchasability server-side before payment initialization.
Why it changed: Stroane is moving from catalogue/inquiry into lightweight commerce, so storefront purchasing must not treat unknown stock as sellable or rely on browser-only cart state.
Files changed: apps/stroane-web/src/data/products.ts, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/types/index.ts, apps/stroane-web/src/components/QuantityControls.tsx, apps/stroane-web/src/styles/components/QuantityControls.css, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000004_add_catalogue_stock_availability_fields/migration.sql, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Additive catalogue stock metadata fields only until deployed. No stock deduction, inventory ledger, fulfillment automation, payment total changes, CRM workflow, Dev ERP workflow, or REEBS workflow changed.
Security impact: Server remains the source of truth for checkout validation. Frontend availability is advisory; the backend rejects non-purchasable, unavailable, price-request, or insufficient-stock items before order/payment work.
Testing done: `node --check apps/stroane-web/backend/src/catalogue.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `node --check apps/stroane-web/prisma/seed-catalogue.mjs` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `git diff --check` passed.
Rollback notes: Revert the additive catalogue stock fields/migration, seed mapping, storefront/cart/checkout availability updates, backend validation updates, and docs. Preserve any manually entered stock metadata before removing deployed fields.
Next step: Lightweight Stroane stock editor/admin foundation.

### Stroane Paystack webhook verification and order confirmation completion

Date: 2026-05-20
Change name: Stroane Paystack webhook verification and order confirmation completion
Apps/packages affected: Stroane Web, @faako/config portfolio project metadata
What changed: Added secure Paystack webhook handling for Stroane checkout: raw request-body capture, HMAC-SHA512 signature verification, event validation, reference-based order lookup, amount/currency validation, webhook metadata storage, and idempotent paid-status handling. This path has since been tightened to call Paystack transaction verification before final paid-state changes. The browser return verification endpoint remains a customer-facing status check and does not finalize paid status or send confirmation before webhook confirmation. Payment-confirmed email triggers from the signed webhook-confirmed paid path.
Why it changed: Stroane needs production-safer payment confirmation where Paystack server-to-server webhooks are the trusted source of paid status, not browser redirects.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/paystack.js, apps/stroane-web/backend/src/orderNotifications.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000003_add_paystack_webhook_metadata/migration.sql, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/CheckoutReturn.tsx, apps/stroane-web/.env.example, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive webhook metadata fields only until deployed. Signed webhooks can mark matching orders paid only after reference, amount, and currency validation. Browser callback verification stays display/status-only for successful payments until webhook confirmation. No inventory, fulfillment, CRM, Dev ERP, REEBS, WhatsApp, or SMS workflows changed.
Security impact: Paystack secrets remain backend-only. Invalid webhook signatures are rejected. Paid status is not trusted from the browser return path. Provider payloads are reduced to safe metadata, and logs avoid dumping sensitive data. Confirmation email sends only after webhook-confirmed paid state and still checks `customerNotificationSentAt` to reduce duplicate sends.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/paystack.js` passed. `node --check apps/stroane-web/backend/src/orderNotifications.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. Paystack webhook signature helper check passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes. `git diff --check` passed.
Rollback notes: Revert the webhook signature helpers/route, callback-status-only behavior, additive webhook metadata fields/migration, env/docs updates, and project-registry milestone update. If deployed, preserve any required webhook/payment metadata before removing fields.
Next step: Add a payment event/notification log for strict idempotency and replay review before fulfillment automation or staff alerts.

### Stroane order notification foundation

Date: 2026-05-20
Change name: Stroane order notification foundation
Apps/packages affected: Stroane Web, @faako/config portfolio project metadata
What changed: Added a Stroane backend order notification helper with customer-safe templates for order received, payment confirmed, order processing, order completed, payment pending, and payment failed states. Payment-confirmed email now belongs to the webhook-confirmed paid path after server-side Paystack transaction verification. Checkout captures a preferred contact method, and `CommerceOrder` has additive notification metadata fields for send status, type, timestamp, provider ID, and last error. WhatsApp/SMS order formatters were added as templates only.
Why it changed: Stroane customers need a lightweight confirmation path after verified payment, while keeping notification automation minimal, private, and payment-safe before webhook hardening and full order operations exist.
Files changed: apps/stroane-web/backend/src/orderNotifications.js, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000002_add_order_notification_foundation/migration.sql, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/.env.example, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive order notification metadata fields only until deployed. A paid order can record customer email notification status after successful payment verification. No order totals, Paystack amount validation, inventory, fulfillment, CRM, Dev ERP, REEBS, WhatsApp, or SMS workflows changed.
Security impact: Resend and payment secrets stay server-side. Notification content is customer-safe and excludes internal notes, audit metadata, raw database IDs, secrets, payment authorization payloads, and card/MoMo details. Duplicate sends are reduced with order-level `customerNotificationSentAt`; a dedicated notification log/audit trail remains future work for strict idempotency.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/orderNotifications.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. Order notification helper import check passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes. `git diff --check` passed.
Rollback notes: Revert the notification helper, verify-hook email attempt, checkout preferred-contact field, additive notification schema/migration fields, env/docs updates, and project-registry milestone update. If deployed, preserve any needed notification delivery metadata before removing fields.
Next step: Add Paystack webhook verification and a notification log/idempotency foundation before relying on automated fulfillment or multi-channel order updates.

### Stroane Paystack checkout MVP

Date: 2026-05-20
Change name: Stroane Paystack checkout MVP
Apps/packages affected: Stroane Web, @faako/config portfolio project metadata
What changed: Added backend Paystack initialization and verification for Stroane checkout. Checkout creates a pending order, calls `POST /api/orders/:orderId/paystack/initialize`, redirects customers to Paystack, and `/checkout/return` verifies the returned reference through `POST /api/paystack/verify`. The backend verifies server-side order totals before sending amount/currency to Paystack, maps payment statuses (`payment_pending`, `paid`, `failed`, `abandoned`), and stores safe Paystack reference/status/verification metadata on the order. Added additive payment metadata fields to `CommerceOrder`, customer-friendly callback states, documentation, and project metadata updates.
Why it changed: Enable the first Ghana-aligned payment path for Stroane using Paystack test mode first, while keeping prices/order validation server-owned and avoiding inventory, fulfillment, CRM, or ERP expansion.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/paystack.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000001_add_commerce_payment_metadata/migration.sql, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/pages/CheckoutReturn.tsx, apps/stroane-web/src/App.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive payment metadata fields only until deployed. Payment initialization updates existing order payment reference/status. Verification can mark a matching order paid only after Paystack confirms reference, amount, and currency. No inventory deduction, fulfillment automation, CRM workflow, Dev ERP workflow, REEBS workflow, or unrelated app data is changed.
Security impact: Paystack secret key remains backend-only. Frontend totals are not trusted. Backend checks amount/currency/reference before paid status, blocks live keys unless `PAYSTACK_ALLOW_LIVE=true` is explicitly set server-side, stores only safe provider metadata, and does not store card/MoMo sensitive details. Webhook verification remains the next hardening phase.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/paystack.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the Paystack helper/endpoints, checkout redirect/return route, additive payment metadata migration/schema changes, docs/env updates, and project-registry metadata update. If already deployed, preserve needed payment references before removing payment metadata fields.
Next step: Add Paystack webhook verification and customer/staff order confirmation emails after test-mode checkout is verified end to end.

### Stroane commerce and checkout foundation

Date: 2026-05-20
Change name: Stroane commerce and checkout foundation
Apps/packages affected: Stroane Web, @faako/config portfolio project metadata
What changed: Added a lightweight Stroane commerce foundation: persistent cart storage for product IDs/quantities, cart count in the public header/mobile nav, checkout detail/review flow, a backend `POST /api/orders` endpoint, and additive Prisma models/migration for `CommerceOrder`, `CommerceOrderItem`, and `CommerceOrderStatus`. Orders are created as `PAYMENT_PENDING` with server-calculated line totals from catalogue data, customer contact/delivery details, payment provider placeholders, and item snapshots. Checkout no longer calls Paystack directly; it prepares an order request only. Added future Paystack env placeholders and updated Stroane project metadata to the commerce milestone.
Why it changed: Stroane is evolving into a lightweight commerce platform and needs a safe browse -> cart -> checkout -> pending order foundation before payment collection, inventory automation, advanced CRM, or ERP workflows.
Files changed: apps/stroane-web/src/context/CartContext.tsx, apps/stroane-web/src/components/Header.tsx, apps/stroane-web/src/styles/components/Header.css, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000000_add_commerce_order_foundation/migration.sql, apps/stroane-web/.env.example, packages/config/src/projectRegistry/projectRegistry.js, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive schema only until deployed. When deployed, checkout can create minimal pending order records and order item records. No inventory deduction, warehouse logic, CRM automation, payment capture, Paystack transaction, Dev ERP workflow, REEBS workflow, or unrelated app data is changed.
Security impact: Server recalculates prices from catalogue data and does not trust frontend totals. Paystack secret/config values are documented as server-side only, and the current checkout does not generate payment links, verify webhooks, mark orders paid, or expose secrets. Backend validation and rate limiting remain required.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the cart/header/checkout/order API changes, order helper, additive migration/schema changes, env/docs updates, and project-registry metadata update. If already deployed, export/archive needed order records before dropping the added commerce tables and enum.
Next step: Test deployed pending-order creation against the intended Stroane database, then design server-side Paystack initialize/link generation and webhook verification.

### Stroane catalogue frontend and inquiry workflow completion refinement

Date: 2026-05-19
Change name: Stroane catalogue frontend and inquiry workflow completion
Apps/packages affected: Stroane Web, @faako/config portfolio project metadata
What changed: Completed the safe Stroane catalogue/inquiry path by making the backend catalogue API prefer persisted Prisma catalogue categories/products when those tables are available, while preserving JSON seed fallback for local development, unmigrated databases, or backend read failures. The product detail API now falls back to the local catalogue seed if persisted product lookup fails. `/shop` keeps category browsing/counts, search, sort, fallback notices, and mapped product imagery tied to the backend-aware catalogue data. Product Detail keeps mapped images, specs, use cases, pricing labels, related products, and product-specific inquiry forms for priced and quote-only products.
Why it changed: Move Stroane closer to production-ready backend-driven catalogue browsing without adding payments, ERP workflows, advanced CRM, inventory automation, AI, or unrelated app changes.
Files changed: apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/server.js, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/pages/ProductDetail.tsx, packages/config/src/projectRegistry/projectRegistry.js, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Read-only catalogue API behavior only. Inquiry persistence remains limited to the existing `/api/inquiries` endpoint and only writes minimal `CatalogueInquiry` records when the Stroane migration/backend are deployed. No payment, order, inventory, CRM, Dev ERP, REEBS, or proposal workflows changed.
Security impact: No secrets exposed. Backend validation remains required for inquiry submissions, internal database errors are not exposed to storefront users, and no admin lead-management or automated notification surface was introduced.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/catalogue.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the backend catalogue DB-first helpers/routes, the Shop/Product Detail catalogue/inquiry refinements, project metadata update, and docs. No database rollback is required unless separately deployed inquiry records need archival.
Next step: Deploy/test the Stroane backend/database pairing, verify live inquiry persistence from the Netlify frontend, and complete final product photography/manual review.

### Stroane product image extraction and mapping

Date: 2026-05-19
Change name: Stroane product image extraction and mapping
Apps/packages affected: Stroane Web
What changed: Extracted product-specific WebP assets from the uploaded Stroane thermometer catalogue, thermometer price list, and thermometers/posters/aprons brochure into `apps/stroane-web/public/imgs/products/`. Mapped images through the centralized Stroane catalogue seed with thumbnail, primary image, gallery image, and alt-text fields. Updated catalogue helpers and low-risk storefront image rendering to use mapped images with a placeholder fallback.
Why it changed: Replace generic storefront placeholders with source-catalogue product imagery while keeping Stroane lightweight, product-focused, and data-driven.
Files changed: apps/stroane-web/public/imgs/products/*.webp, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/pages/Home.tsx, apps/stroane-web/src/styles/pages/Home.css, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Static asset and catalogue metadata update only. No schema, persisted data, inquiry, payment, inventory, CRM, Dev ERP, or REEBS workflows changed.
Security impact: None. Images are public catalogue assets; no secrets or internal metadata were added.
Testing done: Reviewed generated crop contact sheet. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `node --check apps/stroane-web/backend/src/catalogue.js` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed.
Rollback notes: Revert the new assets, catalogue metadata, image rendering updates, homepage image CSS change, and docs. No database rollback required.
Next step: Confirm image crops with Stroane and replace catalogue-derived crops with final product photography where available.

### Stroane catalogue frontend and inquiry workflow completion

Date: 2026-05-19
Change name: Stroane catalogue frontend and inquiry workflow completion
Apps/packages affected: Stroane Web, @faako/config portfolio project metadata
What changed: Added a shared Stroane catalogue data hook that reads products/categories from the backend first and falls back to the local normalized JSON seed. Improved `/shop` with category overview cards, URL-aware category filtering, search/sort, result counts, fallback/loading notices, richer product cards, and responsive spacing. Updated `/products` to use the same backend-aware catalogue data path and image-led cards. Improved Product Detail with API-first detail loading, local fallback notices, long descriptions, availability notes, expanded specifications, use-case chips, and lazy-loaded related product images. Updated product and contact inquiry forms to submit through the existing validated `/api/inquiries` endpoint when available, keep direct email fallbacks, and include simple frontend honeypot fields. Updated Stroane project metadata for future byNana portfolio consumption.
Why it changed: Complete the first product-focused catalogue and inquiry conversion experience for Stroane while keeping the app lightweight and avoiding payments, ERP workflows, advanced CRM, AI, inventory automation, or unrelated app changes.
Files changed: apps/stroane-web/src/hooks/useCatalogueData.ts, apps/stroane-web/src/api/products.ts, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/styles/pages/ProductList.css, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/src/components/ProductInquiryForm.tsx, apps/stroane-web/src/pages/Contact.tsx, apps/stroane-web/src/styles/pages/Contact.css, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: No database schema changes. Catalogue browsing remains read-only. Submitted product/contact inquiries use the previously created `/api/inquiries` path and may persist `CatalogueInquiry` records only when the existing Stroane backend and migration are deployed.
Security impact: No secrets exposed and no automated notifications, payments, inventory automation, admin CRM, or internal APIs added. Inquiry forms use minimal payloads, visible fallback paths, and simple honeypot fields while backend validation/rate limiting remain the source of truth.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/catalogue.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `node --check scripts/check-project-registry.mjs` passed. `pnpm run project-registry:check` passed with warning-only app coverage notes. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `git diff --check` passed.
Rollback notes: Revert the catalogue hook, catalogue/detail/contact/inquiry UI changes, project registry metadata update, and documentation updates. No database rollback is required.
Next step: Deploy and test the Stroane backend/database pairing, verify live inquiry persistence from the Netlify frontend, and complete product image/manual-review cleanup.

### Stroane database and deployment foundation

Date: 2026-05-19
Change name: Stroane database, deployment, and portfolio registry foundation
Apps/packages affected: Stroane Web, @faako/config, byNana Portfolio metadata preparation
What changed: Added an additive Prisma/Postgres foundation for Stroane catalogue categories, catalogue products, catalogue inquiries, and public business profile content. Added a migration, an opt-in catalogue seed script, environment-specific database URL resolution for the backend, and minimal inquiry persistence through the existing validated `/api/inquiries` endpoint. Added a shared portfolio project registry in `@faako/config`, registered Stroane Web / Stroane Solutions with public-safe metadata and case-study publishing disabled, and added a warning-only project registry check. Updated Stroane deployment documentation for Hostinger DNS/email, Netlify frontend hosting, Railway backend hosting, Railway/Supabase Postgres database hosting, and future byNana portfolio metadata consumption.
Why it changed: Prepare Stroane for production-safe backend/data deployment and future operational scaling while keeping the app lightweight and product-focused, and prepare shared project metadata for future portfolio/case-study use without publishing anything.
Files changed: apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260519000000_add_catalogue_inquiry_foundation/migration.sql, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/package.json, apps/stroane-web/.env.example, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/README.md, apps/bynana-portfolio/README.md, package.json, packages/config/src/projectRegistry/projectRegistry.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, scripts/check-project-registry.mjs, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Additive schema only until deployed. Applying the migration creates new Stroane catalogue/inquiry tables. Running the seed upserts catalogue data from the centralized JSON seed. No payments, orders, inventory automation, CRM records, Dev ERP workflows, REEBS workflows, or unrelated app data are changed.
Security impact: Secrets remain server-side; database URLs are not browser-visible. Inquiry persistence stores minimized contact/product request data after validation and existing API rate limiting. Portfolio metadata is public-safe, excludes private backend/admin details, and keeps `caseStudyEnabled` false. No automated messaging, admin inquiry UI, payments, inventory automation, CRM workflows, public case-study publishing, or byNana UI changes were added.
Testing done: `pnpm --filter @faako/stroane-web exec prisma validate` passed. `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/prisma/seed-catalogue.mjs` passed. Catalogue inquiry helper import check passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run monitoring:check` passed. `pnpm run project-registry:check` passed with warning-only coverage notes. `git diff --check` passed.
Rollback notes: Revert the schema/migration/seed/backend/env/docs changes. If already migrated, export any needed inquiry records and drop the added catalogue/inquiry/business-profile tables plus `CatalogueInquiryStatus`.
Next step: Provision Railway backend and Railway/Supabase Postgres, configure production env vars, run migrations, seed the catalogue, test deployed inquiry persistence, and later plan byNana portfolio UI consumption from the shared registry.

### Stroane catalogue and backend foundation

Date: 2026-05-19
Change name: Stroane catalogue and backend foundation
Apps/packages affected: Stroane Web, Dev ERP monitoring metadata, @faako/config
What changed: Added a normalized Stroane catalogue seed/data structure from reviewed catalogue and pricing PDFs, added read-only category/product API foundations, added a validated product inquiry acknowledgement endpoint, wired frontend catalogue/product/detail/search surfaces to the centralized data helpers, added quote-only product handling and product-detail inquiry UI, and extended the shared monorepo app registry with optional Stroane API monitoring endpoints that activate only when a backend base URL is configured.
Why it changed: Establish a production-safe catalogue and inquiry foundation for Stroane before any future payments, CRM, admin, inventory, AI, or ERP expansion.
Files changed: apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/types/index.ts, apps/stroane-web/src/api/products.ts, apps/stroane-web/src/components/ProductInquiryForm.tsx, apps/stroane-web/src/pages/Home.tsx, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Search.tsx, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/pages/Contact.tsx, apps/stroane-web/src/pages/About.tsx, apps/stroane-web/src/styles/globals.css, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/tsconfig.app.json, apps/stroane-web/README.md, packages/config/src/monorepoApps/appRegistry.js, packages/config/README.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: No production data changes. Catalogue data is seed/config only, and inquiry submissions are acknowledged but not persisted.
Security impact: No secrets exposed and no automated messaging, payments, inventory automation, CRM, or ERP workflows added. Inquiry data is validated and minimized; backend validation remains required before future persistence or admin views.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. Catalogue helper import check returned 8 products and 4 categories, and confirmed optional `stroane-api` monitoring emits when a backend base URL is supplied. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run monitoring:check` passed. `git diff --check` passed.
Rollback notes: Revert the Stroane catalogue seed/helpers/API routes/inquiry form/UI wiring, optional monitoring registry metadata, and documentation updates. No schema or data rollback required.
Next step: Complete manual catalogue extraction/review, confirm product imagery and pricing, then decide the safest inquiry persistence or notification workflow.

### Client proposal approval and request changes MVP

Date: 2026-05-19
Change name: Client proposal approval and request changes MVP
Apps/packages affected: Dev ERP
What changed: Added secure-link client actions for Dev ERP proposals. Shared proposals can now be approved or receive requested-changes feedback from `/proposal/view/:token`; public endpoints validate the share token, update proposal status to `approved` or `changes_requested`, and store lightweight client response metadata in existing proposal content JSON. The internal proposal workflow panel displays the client response and feedback.
Why it changed: Complete the first client-response loop for shared proposals before invoice conversion, Paystack links, digital signatures, or AI workflows are introduced.
Files changed: apps/dev-erp/backend/server.js, apps/dev-erp/src/pages/Proposals/ProposalClientView.jsx, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/src/pages/Proposals/proposalWorkflow.js, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/system-status.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Additive proposal-content JSON update only. No schema, invoice/payment, receipt, rent, accounting, report, Paystack, or operational data behavior changed.
Security impact: Token validation, expiry checks, shared-status action gating, noindex/noarchive client view protections, and sanitized client payloads remain in place. Internal notes, editor controls, staff metadata, audit fields, invoices, payments, and Paystack data are not exposed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`.
Rollback notes: Revert the client response endpoints, client-view approval/request-changes UI, internal response display, and documentation updates. No database rollback required.
Next step: Proposal-to-invoice conversion planning with server-owned approval/audit records and version-locking review.

### Online proposal share link and client view MVP

Date: 2026-05-18
Change name: Online proposal share link and client view MVP
Apps/packages affected: Dev ERP
What changed: Enabled Dev ERP secure proposal client viewing for proposals with server-generated share tokens and `shared` or `approved` status. Added `/api/proposals/view/:token`, `/proposal/view/:token`, a sanitized client proposal view, noindex/noarchive protections, graceful invalid/expired/not-shared states, and a print/save-as-PDF Download PDF action.
Why it changed: Allow client-safe online proposal viewing before approval, invoice conversion, Paystack links, or broader public workflows are implemented.
Files changed: apps/dev-erp/backend/server.js, apps/dev-erp/src/App.jsx, apps/dev-erp/src/pages/Proposals/ProposalClientView.jsx, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/system-status.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: None. Existing Proposal share-token fields are used; no schema, payment, invoice, receipt, rent, accounting, report, or Paystack behavior changed.
Security impact: Token-only client access, shared/approved status gating, expiry checks, noindex/noarchive metadata/headers, and client-safe serialization that omits internal notes, staff/editor metadata, audit fields, workflow state, metadata, and token values.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`.
Rollback notes: Revert the public proposal endpoint, client route/view/styles, editor copy, and documentation updates. Existing saved proposals do not require data rollback.
Next step: Proposal approval/request-changes flow and client-view expiry/view-tracking planning.

### Proposal template expansion and blank proposal flow

Date: 2026-05-18
Change name: Proposal template expansion and blank proposal flow
Apps/packages affected: Dev ERP
What changed: Expanded the Dev ERP proposal template library and added a first-class Start from Scratch / Blank Proposal starter. New starters cover ERP system, business website, client portal, inventory/POS, operational workflow, business automation, onboarding/implementation, service, maintenance/support, and future travel itinerary proposals. The template gallery now searches tags, restores lightweight Preview and Use/Start actions, shows visible/total counts, and offers a reset action for empty search/filter results.
Why it changed: Improve proposal creation flexibility while keeping the current reusable block schema, private persistence, preview, approval foundation, and future PDF/payment/AI boundaries unchanged.
Files changed: apps/dev-erp/src/pages/Proposals/proposalTemplates.js, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/ProposalPreview.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md
Data impact: None. Template/default-content and UI-only change; no schema, data writes, proposal API, invoice/payment, rent/accounting/report, Paystack, public proposal, PDF, or AI behavior changed.
Security impact: Presentation and template defaults only. Authenticated proposal access, organization scoping, secure-link preparation boundaries, and disabled public/client workflows remain unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`.
Rollback notes: Revert the expanded template data, gallery JSX/CSS polish, and documentation updates. No data rollback required.
Next step: Manual proposal-to-invoice draft generation planning.

### Proposal UX polish pass

Date: 2026-05-18
Change name: Proposal UX polish pass
Apps/packages affected: Dev ERP
What changed: Refined the Dev ERP Proposal Generator after the first UI simplification by making template gallery cards thumbnail-first, removing long descriptions and heavy metadata from template cards, keeping actions lightweight on hover/focus and visible on mobile, and reducing dashboard-style framing in the live proposal preview.
Why it changed: Bring the proposal module closer to a calm template-browsing experience while preserving proposal persistence, approval, invoice/payment, Paystack, and public-sharing boundaries.
Files changed: apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md
Data impact: None. UI-only refinement with no schema, data writes, proposal API, invoice/payment, rent/accounting/report, Paystack, or public proposal changes.
Security impact: Presentation-only. Authenticated proposal access, organization scoping, secure-link preparation boundaries, and disabled public/client workflows remain unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; proposal UI hardcoded color scan.
Rollback notes: Revert the proposal JSX/CSS polish and documentation updates. No data rollback required.
Next step: Manual proposal-to-invoice draft generation.

### Proposal Generator UI simplification

Date: 2026-05-18
Change name: Proposal Generator UI simplification
Apps/packages affected: Dev ERP
What changed: Simplified the Dev ERP Proposal Generator UI into a template-browsing flow with a clean hero, search/action area, category filter chips, visual template gallery, compact recent proposal list, clearer Preview/Use template/Edit actions, and a two-column editor plus live document preview. Proposal template and recent proposal cards now use `bubble-card` where intended, while preview styling remains document-oriented and theme-token based.
Why it changed: Reduce visual clutter and align the proposal module with a modern template-gallery direction before implementing future proposal-to-invoice, PDF/export, approval, Paystack, or AI phases.
Files changed: apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/src/pages/Proposals/proposalTemplates.js, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md
Data impact: None. UI-only change; no schema, proposal persistence, approval, invoice/payment, rent/accounting/report, Paystack, or public proposal behavior changed.
Security impact: Presentation-only. Authenticated proposal access, organization scoping, secure-link preparation boundaries, and disabled public/client workflows remain unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; affected-file `git diff --check`; proposal UI hardcoded color scan.
Rollback notes: Revert the proposal JSX/CSS/template category metadata and documentation updates. No data rollback required.
Next step: Manual proposal-to-invoice draft generation.

### Proposal template management foundation

Date: 2026-05-18
Change name: Proposal template management foundation
Apps/packages affected: Dev ERP
What changed: Added a dedicated Dev ERP proposal template layer with reusable template entities for website, ERP, onboarding, and future travel proposals. Templates now define keys, names, descriptions, proposal type, default section order, enabled/disabled sections, style reference, and default content placeholders. The proposal editor loads new local drafts from that template layer and shows template/style/section metadata without changing proposal persistence, PDF export, invoice conversion, Paystack, AI, or public editing behavior.
Why it changed: Prepare proposal layouts to scale beyond a single hardcoded starter before implementing manual proposal-to-invoice draft generation or later PDF/payment/AI flows.
Files changed: apps/dev-erp/src/pages/Proposals/proposalSchema.js, apps/dev-erp/src/pages/Proposals/proposalTemplates.js, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md
Data impact: None. Template defaults are draft creation metadata only; no database schema, invoice/payment/rent/accounting/report data, public proposal content, or existing proposal API behavior changed.
Security impact: Private authenticated template selection foundation only. No public editor, PDF generation, AI generation, invoice conversion, Paystack links, approval actions, auth changes, or permission changes.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/dev-erp run test`; affected-file `git diff --check`.
Rollback notes: Revert the template helper extraction, restore proposal starter definitions to the schema file, and remove the template metadata UI/docs updates. No data rollback required.
Next step: Manual proposal-to-invoice draft generation.

### Proposal approval flow foundation

Date: 2026-05-18
Change name: Proposal approval flow foundation
Apps/packages affected: Dev ERP
What changed: Added proposal workflow-state foundation for Dev ERP, including `changes_requested`, internal review notes, internal comments, change-request notes, approval-readiness checks, workflow badges/descriptions, disabled future client action placeholders, and server-owned status history metadata within saved proposal content. Existing proposal APIs remain authenticated and organization-scoped.
Why it changed: Prepare proposals for future client review, revision requests, approvals, onboarding conversion, invoice conversion, Paystack payment workflows, and travel proposal reuse without exposing risky public workflows yet.
Files changed: apps/dev-erp/backend/server.js, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/src/pages/Proposals/proposalSchema.js, apps/dev-erp/src/pages/Proposals/proposalWorkflow.js, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md
Data impact: Additive proposal-content workflow metadata only. No schema changes, invoice/payment/rent/accounting/report changes, PDF generation, file storage, Paystack links, or public proposal access changes.
Security impact: Internal authenticated workflow-state foundation only. No public approval routes, digital signatures, payment links, invoice conversion, notifications, analytics, or AI generation were implemented.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; affected-file `git diff --check`.
Rollback notes: Revert the workflow helper/UI/server normalization/docs changes. Existing saved proposals can ignore the extra workflow content metadata.
Next step: Proposal-to-invoice conversion planning.

### Proposal PDF/export architecture foundation

Date: 2026-05-18
Change name: Proposal PDF/export architecture foundation
Apps/packages affected: Dev ERP
What changed: Added export-aware proposal preview architecture by moving preview rendering into `ProposalPreview.jsx`, adding `proposalExportConfig.js` for export targets, section roles, page modes, print-break metadata, and future renderer hooks, and strengthening print CSS for A4 output, app chrome removal, section break avoidance, cover/page behavior, and color preservation. The online preview remains the source of truth for future PDF export.
Why it changed: Prepare Dev ERP proposals for future presentation-style PDF export without generating production PDFs or changing proposal persistence/payment/invoice workflows.
Files changed: apps/dev-erp/src/pages/Proposals/ProposalPreview.jsx, apps/dev-erp/src/pages/Proposals/proposalExportConfig.js, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md
Data impact: None. No schema changes, proposal persistence contract changes, file storage, invoice/payment/rent/accounting/report changes, or Paystack behavior changes.
Security impact: Export planning only. No public proposal links, PDF download, approval, invoice conversion, Paystack links, or AI generation were implemented.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `git diff --check`.
Rollback notes: Revert the proposal preview/export helper extraction, print CSS additions, and documentation updates. No data rollback required.
Next step: Proposal approval flow foundation.

### Proposal persistence and secure share-link foundation

Date: 2026-05-18
Change name: Proposal persistence and secure share-link foundation
Apps/packages affected: Dev ERP
What changed: Added Dev ERP private proposal persistence using an additive `Proposal` table, authenticated admin-only proposal APIs, saved proposal management in `/proposals`, lightweight versioning, internal preview routing at `/proposals/:proposalId/preview`, proposal statuses, creator/last-editor metadata, and secure token preparation for a future client-view route. Public proposal content, PDF export, approval, invoice conversion, Paystack links, and AI generation remain disabled.
Why it changed: Prepare proposals for safe saving, management, and future secure online viewing before implementing PDF/export architecture or client/payment workflows.
Files changed: apps/dev-erp/prisma/schema.prisma, apps/dev-erp/prisma/migrations/20260518000000_add_proposal_foundation/migration.sql, apps/dev-erp/backend/server.js, apps/dev-erp/backend/auth/accessConfig.js, apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/src/pages/Proposals/proposalSchema.js, apps/dev-erp/src/App.jsx, apps/dev-erp/src/app/navigation.js, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/system-status.md, docs/platform/platform-progress-log.md
Data impact: Additive proposal storage only. Existing invoice, payment, receipt, rent, booking, accounting, report, Paystack, public invoice, and operational data flows are unchanged.
Security impact: Authenticated admin-only APIs, organization-scoped proposal access, server-generated unpredictable share tokens, expiry metadata, and sanitized proposal metadata. No public proposal content endpoint or client approval/payment access is active.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/dev-erp exec prisma validate`; `git diff --check`.
Rollback notes: Revert the schema/migration/API/frontend/docs updates. If applied to a database, export/archive any saved proposal drafts before dropping the `Proposal` table.
Next step: Proposal PDF/export architecture.

### Proposal template schema and preview foundation

Date: 2026-05-18
Change name: Proposal template schema and preview foundation
Apps/packages affected: Dev ERP
What changed: Added a Dev ERP `/proposals` frontend-only foundation with reusable proposal schema blocks, template starters, a proposal list page, editor shell, personal-note fields, section ordering controls, proposal type support for ERP/website/onboarding/future travel proposals, and a responsive/print-aware preview shell. The module is registered in Dev ERP navigation metadata as experimental.
Why it changed: Create reusable proposal structure and preview behavior before persistence, secure online viewing, PDF generation, approval flows, invoice conversion, Paystack links, travel reuse, or AI proposal generation.
Files changed: apps/dev-erp/src/pages/Proposals/Proposals.jsx, apps/dev-erp/src/pages/Proposals/Proposals.css, apps/dev-erp/src/pages/Proposals/proposalSchema.js, apps/dev-erp/src/App.jsx, apps/dev-erp/src/config/adminModules.js, apps/dev-erp/src/app/navigation.js, apps/dev-erp/src/utils/moduleAccess.js, apps/dev-erp/README.md, docs/apps/dev-erp/proposal-module-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/system-status.md, docs/platform/platform-progress-log.md
Data impact: None. The foundation is in-memory frontend state only and does not write proposal, invoice, payment, receipt, rent, accounting, report, or customer data.
Security impact: No public proposal links, persistence, approval flow, invoice conversion, Paystack payment links, AI generation, auth behavior, permission logic, or database schema changes.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `git diff --check`.
Rollback notes: Remove the route, proposal page/schema/styles, registry/navigation/module-access entry, and documentation updates. No data rollback required.
Next step: Proposal persistence and secure share-link planning.

### Dev ERP monitoring and Paystack foundation

Date: 2026-05-18
Change name: Dev ERP monitoring and Paystack foundation
Apps/packages affected: Dev ERP, @faako/config, platform scripts
What changed: Added `scripts/check-monorepo-app-registry.mjs` and the root `monitoring:check` script to scan `apps/`, compare app directories against shared monorepo app registry metadata, and warn/fail if app registry coverage drifts. Added Dev ERP Paystack planning/config foundation with a non-runtime config descriptor, server-side `.env.example` placeholders, and `docs/apps/dev-erp/paystack-foundation-plan.md`. Current Dev ERP invoice, rent payment, receipt, report, public invoice token, and manual payment behavior remains unchanged.
Why it changed: Keep Dev ERP monitoring current as apps are added and establish Paystack safety boundaries before Proposal Generator work.
Files changed: scripts/check-monorepo-app-registry.mjs, package.json, apps/dev-erp/backend/payments/paystack.config.js, apps/dev-erp/.env.example, apps/dev-erp/README.md, README.md, packages/config/README.md, docs/apps/dev-erp/paystack-foundation-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/system-status.md, docs/platform/platform-progress-log.md
Data impact: None. No schema changes, data writes, invoice/payment/rent persistence changes, receipt generation, report changes, or live Paystack transactions.
Security impact: Improves registry drift detection and documents Paystack secret-handling requirements. No secrets are printed or exposed. Paystack secret/webhook values remain server-side env only. Webhook verification, idempotency, audit logging, and provider reference persistence remain future work.
Testing done: `pnpm run monitoring:check` passed. Paystack config import/status check passed without returning secret values. `pnpm --filter @faako/dev-erp run lint` passed. `pnpm --filter @faako/dev-erp run build` passed. `git diff --check` passed.
Rollback notes: Remove the registry check script/root script entry, remove the Paystack config descriptor and `.env.example` placeholders, and revert documentation updates. No data rollback required.
Next step: Proposal Generator foundation.

### Production stabilization refinement pass

Date: 2026-05-18
Change name: Production stabilization refinement pass
Apps/packages affected: REEBS Portal, Dev ERP, Stroane Web, Faako Website, Faako API, @faako/ui, @faako/config
What changed: Refined the shared maintenance/read-only/degraded UI foundation so generic `MaintenanceBanner`, `ReadOnlyModeBanner`, `DegradedModeNotice`, `MaintenancePage`, and `MaintenanceGuard` render through neutral `ui-app-mode-*` classes instead of ERP-specific maintenance page/banner classes. The ERP-prefixed maintenance components remain available for ERP/admin screens. Re-verified Dev ERP monitoring registry coverage against all apps under `apps/`, including REEBS Portal, Dev ERP, Stroane Web, Faako Website, Faako API, REEBS Website, ByNana Portfolio, Faako ERP, System Starter, and UI Workbench. Re-ran focused Stroane, Dev ERP, REEBS Portal, and Faako Website checks after the shared UI refinement.
Why it changed: Close the stabilization gap where public/client websites needed branded maintenance/degraded/read-only states without inheriting ERP-only screen classes, while keeping the pass narrow and production-safe.
Files changed: packages/ui/src/components/ERPNotifications.tsx, packages/ui/src/ui.css, packages/ui/README.md, README.md, docs/platform/codex-handoff-verification.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: None. No database schema changes, migrations, data writes, API behavior changes, or business workflow changes.
Security impact: UI-only maintenance/read-only/degraded presentation refinement. Backend/API enforcement is still required before relying on maintenance or read-only mode for data protection.
Testing done: Dev ERP config registry import check passed and resolved all current apps plus monitored entries. `pnpm --filter @faako/dev-erp run lint` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm --filter @faako/dev-erp run build` passed. `pnpm --filter @faako/reebs-portal run build` passed. `pnpm --filter @faako/faako-website run build` passed. `git diff --check` passed. `pnpm --filter @faako/faako-website run lint` still fails because the package script calls `eslint .` but the package does not install/configure ESLint.
Rollback notes: Revert the `@faako/ui` generic app-mode wrapper/style changes and the documentation updates. No data rollback required.
Next step: Decide app-specific maintenance/read-only wiring policy and backend/API enforcement plan before using these modes during risky deployments.

### Production verification and stabilization sprint

Date: 2026-05-17
Change name: Production verification and stabilization sprint
Apps/packages affected: REEBS Portal, Dev ERP, Stroane Web, Faako Website, Faako API, Faako ERP, REEBS Website, ByNana Portfolio, System Starter, UI Workbench, @faako/config, @faako/ui
What changed: Verified shared UI, offline, audit/activity, monitoring, and recent Stroane/Faako Website work before further feature development. Added a config-driven monorepo app registry in `@faako/config` and wired Dev ERP monitoring to it. Added shared app-mode helpers for normal/degraded/read-only/maintenance states in `@faako/config`. Added presentation-only ERP and generic maintenance/read-only/degraded UI wrappers in `@faako/ui`, and standardized shared alert tones for pending, maintenance, and degraded. Repaired Stroane Web lint tooling and two unused-symbol type issues. Created `docs/platform/codex-handoff-verification.md` with pass/fail results, styling findings, risky areas, incomplete implementation notes, documentation gaps, and pending manual review items.
Why it changed: Stabilize recent Codex/Claude platform work, reduce fragile monitoring configuration, keep maintenance/read-only UI foundations available without backend behavior changes, and make verification status explicit before proposal-system implementation.
Files changed: packages/config/src/appModes/appModes.js, packages/config/src/monorepoApps/appRegistry.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, apps/dev-erp/backend/server.js, apps/dev-erp/README.md, packages/ui/src/components/ERPNotifications.tsx, packages/ui/src/ui.css, packages/ui/README.md, apps/stroane-web/eslint.config.js, apps/stroane-web/package.json, apps/stroane-web/backend/server.js, apps/stroane-web/src/pages/Services.tsx, apps/stroane-web/src/pages/Shop.tsx, pnpm-lock.yaml, README.md, docs/platform/codex-handoff-verification.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, apps/stroane-web/README.md
Data impact: None. No database schema changes, data migrations, data writes, payment/order/booking/inventory/rent workflow changes, or proposal workflow changes.
Security impact: Improves production visibility and documentation. Maintenance/read-only components and app-mode helpers are presentation/config foundations only and do not enforce backend restrictions. Dev ERP monitoring remains read-only. Stroane lint/tooling fixes do not change auth enforcement.
Testing done: `pnpm --filter @faako/offline-sync run test`; `pnpm --filter @faako/finance run test`; `pnpm --filter @faako/notifications run test`; `pnpm --filter @faako/audit run test`; Dev ERP config import check; `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp exec tsc --noEmit`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `pnpm --filter @faako/stroane-web run lint`; `pnpm --filter @faako/stroane-web run build`; `pnpm --filter @faako/reebs-portal run build`; `pnpm --filter @faako/faako-website run build`; `git diff --check`. `pnpm --filter @faako/faako-website run lint` failed because the package has no local ESLint dependency/config.
Rollback notes: Revert the config registry/app-mode wiring in `@faako/config` and Dev ERP `backend/server.js` to restore the previous local site list. Revert the maintenance/read-only UI wrappers and tones if not wanted. Revert the Stroane lint/tooling cleanup if a different lint strategy is chosen. No data rollback required.
Next step: Route-level visual QA for live ERP surfaces; backend/API maintenance guard planning; Faako Website lint tooling setup; Stroane auth/payment production-readiness review; proposal system implementation planning only after these checks are accepted.

### Theme and styling consistency fix

Date: 2026-05-13
Change name: Theme and styling consistency fix
Apps/packages affected: @faako/ui (ERPActivityFeed component + activity feed CSS), Dev ERP Settings
What changed: Audited recently-added shared ERP components (ERPActivityFeed, ERPNotifications, ERPForm, ERPActions, ERPModal) and recently-modified shared CSS (`packages/ui/src/ui.css`, `packages/theme/src/erp-shell.css`) for hardcoded colors, raw hex/rgba values, and inline-style duplication of theme concerns. Audit findings and fixes: (1) `.ui-erp-activity-detail` previously hardcoded `color: var(--sys-danger)` — it now defaults to `var(--sys-muted)` and becomes tone-aware via `.ui-erp-activity-item--error .ui-erp-activity-detail` (danger) and `.ui-erp-activity-item--warning .ui-erp-activity-detail` (warning) selectors, matching the existing `.ui-erp-activity-dot--*` and `.ui-erp-activity-badge--*` tone modifier pattern. (2) `ERPActivityFeed` now accepts optional `className` and `style` props so apps can apply app-specific theming, spacing, or layout overrides without forking the component — this is the documented `className overrides` escape hatch in the shared UI package. (3) Dev ERP Settings replaced two inline `style={{ marginTop: "1rem" }}` instances on `<SyncReviewPanel>` and `<ERPActivityFeed>` with a `<StackGroup>` wrapper from `@faako/ui`. The existing Dev ERP `.stack { display: grid; gap: 1rem }` rule and `.page { display: grid; gap: 1.2rem }` rule together provide the same vertical rhythm without inline styles. (4) The other recently-added shared components (ERPNotifications, ERPForm, ERPActions, ERPModal) and the P6.0 erp-shell.css mobile-responsive changes were audited and found clean — no hardcoded hex/rgba colors, no inline-style theme duplication. (5) Pre-existing inline JS styles in `@faako/offline-sync` `SyncReviewPanel.js` (panelStyle, headerStyle, chipStyle, buttonStyle, mutedStyle, errorStyle with raw `rgba(0,0,0,0.12)`/`rgba(155,28,49,0.25)` fallbacks) were left unchanged — they predate this work, currently render correctly under both production app themes, and changing them would alter live REEBS Portal and Dev ERP appearance. Documented as pending manual review for a future shared-CSS-class migration.
Why it changed: Remove hardcoded styling concerns from newly-added ERP components, ensure shared components are theme-aware and brand-neutral, and provide a proper className override escape hatch so app-specific branding can be applied without forking the shared component.
Files changed: packages/ui/src/components/ERPActivityFeed.tsx, packages/ui/src/ui.css, apps/dev-erp/src/pages/Settings/Settings.jsx, packages/ui/README.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md
Data impact: None.
Security impact: UI-only styling consistency. No auth, permissions, API behavior, payment/order/inventory/booking/rent workflow, offline sync processing, database schema, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint` — clean. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` — clean.
Rollback notes: Revert the four changed files. Inline `marginTop` styles can be restored in Settings.jsx if `<StackGroup>` spacing causes visual regression. The tone-aware detail color selectors can be reverted to the previous unconditional `var(--sys-danger)` if any consumer relies on red detail text for non-error items. No data rollback required.
Next step: Continue module enable/disable persistence planning; design auth-scoped `/api/org/settings` read endpoint; review and migrate SyncReviewPanel inline JS styles to shared CSS classes (pending separate manual review to avoid visual regression in both production apps).

### Organization settings and tenant foundation

Date: 2026-05-13
Change name: Organization settings and tenant foundation
Apps/packages affected: @faako/org-settings (new package), @faako/notifications (TODO updated), @faako/finance (TODO updated)
What changed: Created `packages/org-settings` as a new shared `@faako/org-settings` package. Provides: `OrganizationSettings` JSDoc type with 16 fields (businessName, logoUrl, faviconUrl, primaryColor, accentColor, contactEmail, contactPhone, whatsappNumber, addressLine1, addressLine2, city, country, currency, timezone, enabledModules, notificationPrefs); `normalizeOrganizationSettings(raw)` — validates, trims, and returns a safe shape from any raw input; `DEFAULT_ORGANIZATION_SETTINGS` with GHS currency and Africa/Accra timezone defaults; `getOrganizationDisplayName`, `getOrganizationCurrency`, `getOrganizationCurrencySymbol`, `getOrganizationTimezone`, `getOrganizationBranding`, `getOrganizationContactInfo` display helpers; `isSafeOrgSettingsKey`, `stripSensitiveOrgSettings` security helpers that block API keys, secrets, tokens, passwords, webhook secrets, and payment provider credentials; `SUPPORTED_CURRENCIES` (9 currencies), `CURRENCY_CODES`, `SUPPORTED_TIMEZONES` (11 regions), `TIMEZONE_VALUES`, `ORG_SETTINGS_FIELDS` field registry. Currency validated against allowed codes; timezone validated against allowed IANA values; both fall back to safe defaults. Updated TODO comments in @faako/notifications and @faako/finance to reference the new package for future branding and currency wiring. 44 tests pass. No app code changes, no schema changes, no API changes, no auth behavior changes.
Why it changed: Establish a shared organization/tenant configuration foundation for future per-org branding, currency, timezone, module enable/disable, and notification preferences, without disrupting current live apps.
Files changed: packages/org-settings/package.json, packages/org-settings/README.md, packages/org-settings/src/index.js, packages/org-settings/src/constants/currencies.js, packages/org-settings/src/constants/timezones.js, packages/org-settings/src/constants/fields.js, packages/org-settings/src/constants/index.js, packages/org-settings/src/helpers/normalize.js, packages/org-settings/src/helpers/display.js, packages/org-settings/src/helpers/safeMetadata.js, packages/org-settings/src/helpers/index.js, packages/org-settings/src/types/index.js, packages/org-settings/test/org-settings.test.mjs, packages/notifications/src/index.js, packages/finance/src/index.js, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Additive foundation only. No database schema changes, no data writes, no API changes.
Security impact: Safer organization data handling. `stripSensitiveOrgSettings` blocks API keys, secrets, tokens, passwords, webhook secrets, and payment provider credentials from leaking into frontend payloads or public responses. All helpers return plain data objects — no automated fetch or transmission. Org data is never mixed across organizationId boundaries by the helpers (scoping remains app-owned).
Testing done: `node --test packages/org-settings/test/org-settings.test.mjs` — 44/44 tests pass. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` — clean.
Rollback notes: Remove the packages/org-settings directory and revert the @faako/notifications and @faako/finance TODO comment updates. No data rollback required — no persistence was added.
Next step: Module enable/disable persistence planning; org settings API endpoint design (scoped by authenticated organizationId, read-only first); Dev ERP Settings org display section (pending API).

### Admin operational activity feed

Date: 2026-05-13
Change name: Admin operational activity feed
Apps/packages affected: @faako/ui (ERPActivityFeed component + CSS), Dev ERP Settings
What changed: Created `ERPActivityFeed` shared presentation component in `@faako/ui`. Provides a timeline-style activity list with tone dots (success/error/warning/info/neutral), relative timestamps, status badges, actor/entity metadata lines, and detail lines. Supports loading, empty, error, and compact states. Full CSS added to `ui.css` with a 720px responsive breakpoint. Exported from `@faako/ui` index. Dev ERP Settings adopted `ERPActivityFeed` to display up to 5 recent offline sync queue events derived from the existing `useSyncQueueSummary` data. No new API calls — all data is local. No customer data, payment details, tokens, or secrets are surfaced; items contain action label, queue status (with underscores replaced), first 120 characters of any last error, and item timestamp. REEBS Portal and Dev ERP Dashboard adoption is documented as pending manual review.
Why it changed: Provide a shared operational activity feed foundation for admin/settings surfaces while keeping existing live app-owned feeds (Dev ERP Dashboard timeline, REEBS Portal ActivityPanel) unchanged.
Files changed: packages/ui/src/components/ERPActivityFeed.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Presentational only. Dev ERP Settings reads existing IndexedDB queue data already loaded by `useSyncQueueSummary`. No new reads, writes, or API calls.
Security impact: No tokens, secrets, passwords, payment details, customer data, or stack traces surfaced. Error strings capped at 120 characters. Actor/entity metadata is omitted from the queue activity items (not available on queue items). Status labels are formatted from queue status strings only.
Testing done: `pnpm --filter @faako/dev-erp run lint` — clean. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`.
Rollback notes: Remove `ERPActivityFeed` from Settings.jsx and the `syncActivityItems` useMemo. Remove the component from @faako/ui index.ts and delete ERPActivityFeed.tsx. Remove the activity feed CSS block from ui.css. No data rollback required.
Next step: REEBS Portal and Dev ERP Dashboard activity feed adoption (pending manual review).

### Audit logging and operational visibility foundation

Date: 2026-05-13
Change name: Audit logging and operational visibility foundation
Apps/packages affected: @faako/audit (new package), @faako/offline-sync (TODO updated), @faako/finance (TODO updated)
What changed: Created `packages/audit` as a new shared `@faako/audit` package. Provides audit event constants (AUDIT_ACTION_TYPES, AUDIT_ENTITY_TYPES, AUDIT_SEVERITIES, AUDIT_SOURCES, AUDIT_STATUSES), safe actor/org reference helpers (createActorRef, createOrgRef), sensitive metadata stripping (isSafeAuditMetadataKey, stripSensitiveMetadata), event normalization (createAuditEvent, createSyncAuditEvent, createSettingsAuditEvent), display formatting helpers (formatAuditEventSummary, formatAuditActor, formatAuditTimestamp, getAudit*Label), and JSDoc type definitions (AuditEvent, AuditActor, AuditOrganization). The package is a pure data/helper foundation — it does not emit, store, transmit, or log anything on its own. Actual persistence remains app-owned. Updated TODO comments in @faako/offline-sync and @faako/finance to reference the new package for future wiring. 26 tests pass.
Why it changed: Establish a shared audit event foundation for future operational visibility, accountability, and admin tooling without altering existing workflows, auth behavior, payment/booking/inventory logic, or database schema.
Files changed: packages/audit/package.json, packages/audit/README.md, packages/audit/src/index.js, packages/audit/src/constants/actionTypes.js, packages/audit/src/constants/entityTypes.js, packages/audit/src/constants/severities.js, packages/audit/src/constants/sources.js, packages/audit/src/constants/statuses.js, packages/audit/src/constants/index.js, packages/audit/src/helpers/actorHelpers.js, packages/audit/src/helpers/eventFormatting.js, packages/audit/src/helpers/metadataNormalization.js, packages/audit/src/helpers/index.js, packages/audit/src/types/index.js, packages/audit/test/audit.test.mjs, packages/offline-sync/src/index.js, packages/finance/src/index.js, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Additive foundation only. No database schema changes, no data writes, no API changes.
Security impact: Safer operational visibility. createActorRef never includes passwords/tokens/secrets. stripSensitiveMetadata blocks known sensitive key patterns. Error strings in sync events are capped at 200 characters. All helpers return plain data objects — no automated logging or transmission.
Testing done: `node --test packages/audit/test/audit.test.mjs` — 26/26 tests pass. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check`.
Rollback notes: Remove the packages/audit directory and revert the @faako/offline-sync and @faako/finance TODO comment updates. No data rollback required — no persistence was added.
Next step: Admin operational activity feed.

### Mobile-first responsive polish wave

Date: 2026-05-12
Change name: Mobile-first responsive polish wave
Apps/packages affected: @faako/theme (erp-shell.css), @faako/ui (ui.css)
What changed: Improved mobile-first responsive behavior, touch usability, and viewport accuracy across shared ERP shell and shared UI components. Changes are CSS-only with no schema, API, business logic, workflow, auth, or data changes. Specific improvements: (1) `min-height: 100vh` → `min-height: 100dvh` (with `100vh` fallback) on erp-shell-frame, erp-shell-frame__content, and erp-nav-sidebar so the shell fills the correct viewport height when mobile browser toolbars are visible or hidden; (2) `height: calc(100vh - 1.8rem)` → `height: calc(100dvh - 1.8rem)` (with `100vh` fallback) on erp-nav-sidebar__panel for the same reason; (3) `erp-bottom-nav` `bottom: 1rem` → `bottom: calc(1rem + env(safe-area-inset-bottom))` so the floating bottom nav clears the home indicator notch on iPhone; (4) `erp-bottom-nav__button` gained `min-height: 2.75rem` (WCAG 2.5.5 touch target) and `touch-action: manipulation` (removes 300ms tap delay on older iOS/Android); (5) `erp-bottom-nav__button:focus-visible` added with a themed outline for keyboard/assistive navigation; (6) `erp-nav-sidebar__nav` gained `overscroll-behavior: contain` to prevent sidebar scroll events from bubbling to the page; (7) `ui-erp-modal`/`ui-erp-drawer` `max-height: min(86vh, 58rem)` → `min(86dvh, 58rem)` (with `vh` fallback) and `ui-erp-drawer--bottom` `max-height: min(82vh, 48rem)` → `min(82dvh, 48rem)` (with `vh` fallback) so modal/drawer heights respect the visible viewport on mobile; (8) `ui-erp-dialog__body` gained `overscroll-behavior: contain` to prevent dialog scroll from chaining to the page; (9) `ui-erp-dialog__close` gained `min-height: 2.75rem; min-width: 2.75rem; display: inline-flex; align-items: center; justify-content: center` for WCAG touch target compliance; (10) `ui-erp-field__control` gained `font-size: 1rem` to prevent iOS Safari auto-zoom on input focus. All `dvh` values have `vh` fallbacks for Safari < 15.4.
Why it changed: Polish mobile usability and viewport accuracy without touching any app, workflow, or backend behavior.
Files changed: packages/theme/src/erp-shell.css, packages/ui/src/ui.css, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: CSS-only changes. No auth, permissions, API behavior, workflow logic, database schema, or data access behavior changed.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; visual review of changed CSS selectors; `git diff --check` on changed files.
Rollback notes: Revert erp-shell.css and ui.css to restore previous viewport-height values and remove touch-target additions. No data rollback required.
Next step: Audit logging and operational visibility foundation.

### Shared in-app notification and alert UI

Date: 2026-05-12
Change name: Shared in-app notification and alert UI
Apps/packages affected: @faako/ui, Dev ERP Settings, REEBS Portal documentation review
What changed: Added the shared `ERPNotice`, `ERPAlert`, `ERPBanner`, `ERPSyncAlert`, `ERPOfflineNotice`, `ERPToastStack`, `useERPToastStack`, `ERPToastProvider`, and `useERPToast` presentation foundation in `@faako/ui`. The components support eight tones (success, error, warning, info, loading, offline, sync, neutral), dismissible state, compact mode, actions slots, accessible aria-live behavior, and mobile-friendly layouts. CSS for the three new tones (offline, sync, neutral) was added to the existing shared inline-notice, notice-banner, and toast selectors. A new `ui-erp-banner` CSS class was added for full-width edge-to-edge system banners. Dev ERP Settings adopted `ERPNotice` for two static informational notices (SMS availability and storage mode). The dynamic save/load status notice was left unchanged as it can carry auth-related messages and is pending a separate manual review. REEBS Portal runtime adoption was left pending because notice/alert candidates are near POS, payments, bookings, inventory, receipts, auth/session-sensitive flows, and offline queue workflows.
Why it changed: Establish reusable in-app notification, alert, and notice UI primitives while keeping automated notification sending, backend email/SMS/WhatsApp behavior, payment/order/booking/inventory/offline workflows, and auth behavior entirely unchanged.
Files changed: packages/ui/src/components/ERPNotifications.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. No automated notification sending, backend email/SMS/WhatsApp behavior, auth behavior, payment/order/booking/inventory/offline workflow, database schema, API permissions, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on changed shared UI, Dev ERP Settings, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the shared ERP notification component/style exports and the Dev ERP Settings ERPNotice adoption to restore the previous inline `.notice` div markup. No data rollback is required.
Next step: Mobile-first responsive polish wave.

### Shared modal and action foundation

Date: 2026-05-12
Change name: Shared modal and action foundation
Apps/packages affected: @faako/ui, Dev ERP Settings, REEBS Portal documentation review, root README
What changed: Added the shared `ERPModal`, `ERPDrawer`, `ERPConfirmDialog`, `ERPActionBar`, `ERPButtonGroup`, `ERPPrimaryAction`, `ERPSecondaryAction`, `ERPDangerAction`, and `ERPIconAction` presentation foundation in `@faako/ui`. The components support accessible dialog labels, Escape-key close behavior, mobile-friendly modal/drawer layouts, confirmation/cancel patterns, destructive-action styling, loading states, and disabled states. Dev ERP Settings adopted only the shared action wrappers for alert preference buttons. REEBS Portal runtime modal/action adoption was left pending because likely candidates are near POS, payments, bookings, inventory, receipts, auth/session-sensitive flows, and offline queue workflows.
Why it changed: Establish reusable modal, drawer, confirmation, and action primitives while keeping open/close state, save/delete/submit handlers, API behavior, permissions, destructive-action rules, and production workflows app-owned.
Files changed: packages/ui/src/components/ERPActions.tsx, packages/ui/src/components/ERPModal.tsx, packages/ui/src/components/Primitives.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, apps/dev-erp/README.md, apps/reebs-portal/README.md, README.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. No auth, permissions, API behavior, payment/order/inventory/booking/rent/user-management workflow, offline sync processing, database schema, validation rule, modal state ownership, save/delete/submit behavior, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP Settings, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the shared ERP modal/action component/style exports and the Dev ERP Settings action wrapper adoption to restore the previous inline button markup. No data rollback is required.
Next step: Shared notification/in-app alert UI.

### Shared ERP form foundation

Date: 2026-05-12
Change name: Shared ERP form foundation
Apps/packages affected: @faako/ui, Dev ERP Settings, REEBS Portal documentation review, root README
What changed: Added the shared `ERPForm`, `ERPFormSection`, `ERPFormRow`, `ERPFormActions`, `ERPFieldGroup`, `ERPTextField`, `ERPSelectField`, `ERPDateField`, `ERPTextareaField`, `ERPSearchSelect`, `ERPValidationMessage`, and `ERPFormNotice` presentation foundation in `@faako/ui`. The components support required-field indicators, helper text, validation messages, disabled/loading-compatible states, mobile-friendly rows, accessible labels, save/cancel action areas, and display-only notices. Dev ERP Settings uses the shared field-group wrapper for alert subscription fields; action button wrappers are covered by the later modal/action foundation entry. REEBS Portal runtime form adoption was left pending because likely candidates are near POS, payments, bookings, inventory, receipts, and offline queue workflows.
Why it changed: Establish reusable ERP form presentation primitives after the shared form/table planning phase while keeping business logic, validation rules, submit handlers, API behavior, permissions, local drafts, and production workflows app-owned.
Files changed: packages/ui/src/components/ERPForm.tsx, packages/ui/src/components/Primitives.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, apps/dev-erp/README.md, apps/reebs-portal/README.md, README.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. No auth, permissions, API behavior, payment/order/inventory/booking/rent/user-management workflow, offline sync processing, database schema, validation rule, form submit behavior, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP Settings, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the shared ERP form component/style exports and the Dev ERP Settings field/action wrapper adoption to restore the previous inline form-field/action markup. No data rollback is required.
Next step: Shared modal/action foundation.

### Shared ERP table foundation

Date: 2026-05-12
Change name: Shared ERP table foundation
Apps/packages affected: @faako/ui, Dev ERP System Health, REEBS Portal documentation review, root README
What changed: Added the shared `ERPTable`, `ERPTableToolbar`, `ERPTableSearch`, `ERPTableFilters`, `ERPTablePagination`, `ERPTableEmptyState`, `ERPTableLoadingState`, `ERPStatusBadge`, and `ERPTableActions` presentation foundation in `@faako/ui`. The components support configurable columns, semantic table markup, controlled pagination, search/filter/action slots, loading and empty states, row action slots, status badges, and mobile card-style rendering. Dev ERP System Health adopted `ERPTable` and `ERPStatusBadge` for the read-only service status table only. REEBS Portal runtime tables were left pending because Orders, POS, Bookings, Inventory, Payments, receipts, and offline queue surfaces need separate visual/workflow checks.
Why it changed: Establish reusable shared table primitives after the planning phase while keeping business logic, data fetching, filtering, mutations, permissions, and production workflows app-owned.
Files changed: packages/ui/src/components/ERPTable.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/SystemHealth/SystemHealth.jsx, apps/dev-erp/README.md, README.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. No auth, permissions, API behavior, payment/order/inventory/booking/rent/user-management workflow, offline sync processing, database schema, row mutation, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP System Health, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the shared ERP table component/style exports and the Dev ERP System Health table adoption to restore the previous inline display table. No data rollback is required.
Next step: Shared form foundation implementation.

### Shared form and table system planning

Date: 2026-05-12
Change name: Shared form and table system planning
Apps/packages affected: REEBS Portal, Dev ERP, @faako/ui, platform docs
What changed: Added `docs/platform/shared-form-table-system-plan.md`, a planning-only audit for repeated ERP table, form, filter/search, pagination, modal, status badge, bulk action, empty/loading/error, and mobile patterns. The plan identifies shared component opportunities for table wrappers, data table patterns, filter/action toolbars, form section/layout wrappers, modal form shells, status badges, and pagination while classifying safe, medium-risk, and high-risk extraction candidates.
Why it changed: Forms and tables are heavily used around production-sensitive POS, orders, inventory, bookings, payments, reports, rent, and user-management workflows. A shared system needs a staged plan before implementation so future extraction does not alter live business behavior.
Files changed: docs/platform/shared-form-table-system-plan.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md, packages/ui/README.md
Data impact: None.
Security impact: Planning only. No auth, permissions, API behavior, payment/receipt logic, booking/order/inventory workflow, rent workflow, user-management behavior, offline sync processing, database schema, or data access behavior changed.
Testing done: Documentation review against source scans for REEBS and Dev ERP form/table/filter/modal/status/pagination patterns; `git diff --check` on tracked documentation/README updates; trailing-whitespace scan on the new plan and changed docs. No runtime tests were required because this is planning-only.
Rollback notes: Remove the shared form/table plan and related documentation references. No code or data rollback is required.
Next step: Shared table foundation implementation.

### Shared UI system cleanup and extraction

Date: 2026-05-12
Change name: Shared UI system cleanup and extraction
Apps/packages affected: @faako/ui, Dev ERP Settings, REEBS Portal documentation review, root README
What changed: Added low-risk shared UI presentation wrappers for ERP section headers, panel grids, panels, panel headers, stack groups, and form groups. The wrappers preserve existing legacy class names where used. Dev ERP Settings now uses the shared wrappers for alert settings panels and fields without changing alert preferences, Sync Review behavior, routes, API calls, auth, or storage behavior. REEBS Portal was reviewed and left as manual-review runtime adoption because candidate surfaces sit near active admin, POS, bookings, inventory, payments, receipts, and offline queue workflows.
Why it changed: Reduce repeated panel/form/header markup and establish a safer shared UI extraction path while keeping production workflows app-owned.
Files changed: packages/ui/src/components/Primitives.tsx, packages/ui/src/components/Fields.tsx, packages/ui/src/ErpPageHeader.tsx, packages/ui/src/ErpShellFrame.tsx, packages/ui/src/ErpShellTopbar.tsx, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, apps/dev-erp/README.md, README.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only cleanup. No auth, permissions, API behavior, payment/receipt logic, booking/order/inventory workflow, offline sync processing, database schema, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP Settings, README, and documentation files.
Rollback notes: Revert the shared UI wrapper additions and Dev ERP Settings wrapper usage to restore the previous inline markup. No data rollback is required.
Next step: Shared form/table system planning.

### Safe Cleanup Wave 1

Date: 2026-05-12
Change name: Safe Cleanup Wave 1
Apps/packages affected: reebs-portal, dev-erp, platform docs
What changed: Performed the first incremental cleanup pass from the codebase cleanup audit. Removed confirmed unused REEBS icon imports, removed obsolete REEBS `no-unused-vars` eslint-disable comments, replaced a REEBS catalog media control-character regex with an equivalent display-safety helper so source lint no longer errors, excluded REEBS generated/runtime folders from ESLint scans, removed an unused Dev ERP catch variable, and stabilized the Dev ERP Settings Sync Review refresh callback dependency. No files were deleted and no business workflows were refactored.
Why it changed: Reduce low-risk lint/tooling and display-helper debt while preserving live REEBS Portal and Dev ERP production workflows.
Files changed: apps/reebs-portal/eslint.config.js, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/src/utils/itemMediaBackgrounds.js, apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx, apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx, apps/dev-erp/src/pages/Dashboard/Dashboard.jsx, apps/dev-erp/src/pages/Settings/Settings.jsx, docs/platform/codebase-cleanup-audit.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Low-risk cleanup only. No auth, permissions, payment, receipt, booking, inventory, offline sync processing, API, database schema, or production workflow behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/reebs-portal exec eslint src` now reports warnings only and no source errors. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` was attempted and blocked by existing shared `@faako/ui` type errors outside this cleanup scope.
Rollback notes: Revert the listed cleanup edits to restore previous imports, comments, lint ignore list, and helper shape. No data rollback is required.
Next step: Shared UI system cleanup and extraction.

### Codebase cleanup audit

Date: 2026-05-12
Change name: Codebase cleanup audit
Apps/packages affected: Monorepo-wide documentation, REEBS Portal, Dev ERP, Stroane Web, Faako Website, Faako API, shared packages
What changed: Added a planning-only monorepo cleanup audit covering duplicate styling, candidate-unused files/components, long file breakdown candidates, duplicate helpers/utilities, module overlap, shared package opportunities, risk classification, recommended cleanup order, and manual verification checklist.
Why it changed: Recent shared platform work added packages, helpers, styles, and ERP foundations. Cleanup needs a production-sensitive plan before any implementation so live REEBS Portal and Dev ERP workflows are not disrupted.
Files changed: docs/platform/codebase-cleanup-audit.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/faako-website/implementation-notes.md, docs/apps/faako-api/implementation-notes.md, docs/apps/faako-erp/implementation-notes.md
Data impact: Documentation-only.
Security impact: Improves cleanup sequencing and production-safety classification. No auth, permissions, database schema, payment, receipt, booking, inventory, offline sync, notification, or runtime behavior changed.
Testing done: Documentation review against source file inventories, CSS/helper scans, shared package usage scans, and existing consolidation plans.
Rollback notes: Remove the cleanup audit and related progress-log/implementation-note references if the planning baseline needs to be withdrawn.
Next step: Documentation/README cleanup pass and static unused export/import report.

### Notification service foundation

Date: 2026-05-11
Change name: Notification service foundation
Apps/packages affected: reebs-portal, dev-erp, @faako/notifications, platform docs
What changed: Added `@faako/notifications` with notification channel constants, notification type constants, notification status constants, customer-safe message templates, channel availability helpers, text sanitizing helpers, and user-triggered `mailto:`/WhatsApp draft link helpers. REEBS order receipt preview now uses the shared receipt summary template for copy, email draft, and WhatsApp draft actions. Dev ERP Appointments now uses the shared booking confirmation draft formatter for the existing appointment link email action.
Why it changed: Create a shared notification foundation for future email, WhatsApp, SMS, and in-app notification work while keeping current customer communication privacy-safe and user-triggered.
Apps affected: REEBS Portal order receipt display/share area and Dev ERP Appointments email-link draft. Shared package: `@faako/notifications`.
Files changed: packages/notifications/package.json, packages/notifications/src/index.js, packages/notifications/src/constants/channels.js, packages/notifications/src/constants/types.js, packages/notifications/src/constants/statuses.js, packages/notifications/src/constants/index.js, packages/notifications/src/helpers/safeText.js, packages/notifications/src/helpers/channelAvailability.js, packages/notifications/src/helpers/index.js, packages/notifications/src/templates/customerMessages.js, packages/notifications/src/templates/index.js, packages/notifications/test/notifications.test.mjs, packages/notifications/README.md, apps/reebs-portal/package.json, apps/reebs-portal/src/pages/Orders/components/ReceiptViewer.jsx, apps/dev-erp/package.json, apps/dev-erp/src/pages/Bookings/Bookings.jsx, pnpm-lock.yaml, README.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Customer-safe message templates only. No automated WhatsApp messages, automated emails, SMS, notification persistence, Resend behavior change, backend send behavior change, receipt/payment/order behavior change, auth change, permission change, or schema change.
Testing done: `pnpm --filter @faako/notifications run test`; `pnpm --filter @faako/reebs-portal run build`; `pnpm --filter @faako/dev-erp run build`; documentation review. Manual checks documented for REEBS receipt summary copy/mailto/WhatsApp drafts, Dev ERP appointment email draft text, and unchanged backend send/payment/order/rent behavior.
Rollback notes: Remove `@faako/notifications`, remove app imports/usages and package dependencies, remove lockfile importer entries, and remove related README/docs updates. Existing backend email and receipt/payment/order workflows remain app-owned.
Next step: delivery/map helper foundation.

### Offline conflict review and sync reliability

Date: 2026-05-11
Change name: Offline conflict review and sync reliability
Apps/packages affected: reebs-portal, dev-erp, @faako/offline-sync, platform docs
What changed: Expanded `@faako/offline-sync` with queue review/reliability helpers for retry state, last error tracking, conflict metadata, local cancel, local mark-resolved, retry re-arming, and queue summary counts. Added shared `SyncReviewPanel`, `SyncConflictCard`, `useSyncQueueSummary`, `useQueuedActionRetry`, and `useQueuedActionCancel`. REEBS Admin Workspace now shows a Sync Review panel in Offline Sync for local POS, payment, inventory, and booking queue records. Dev ERP Settings now shows a Sync Review panel for local Dev ERP queue records, currently focused on offline rent payment visibility.
Why it changed: Failed, pending, and conflicting offline actions need visible recovery paths so queued production-sensitive work is not lost, silently ignored, or mistaken for server-confirmed data.
Apps affected: REEBS Portal Admin Workspace Offline Sync and Dev ERP Settings. Shared package: `@faako/offline-sync`.
Files changed: packages/offline-sync/src/constants/syncStates.js, packages/offline-sync/src/storage/queueStorage.js, packages/offline-sync/src/storage/queueActions.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/status/queueSummary.js, packages/offline-sync/src/status/index.js, packages/offline-sync/src/hooks/useSyncQueueSummary.js, packages/offline-sync/src/hooks/useQueuedActionRetry.js, packages/offline-sync/src/hooks/useQueuedActionCancel.js, packages/offline-sync/src/hooks/index.js, packages/offline-sync/src/components/SyncConflictCard.js, packages/offline-sync/src/components/SyncReviewPanel.js, packages/offline-sync/src/components/index.js, packages/offline-sync/test/offlineSync.test.mjs, apps/reebs-portal/src/pages/AdminWorkspace/AdminWorkspace.jsx, apps/dev-erp/src/pages/Settings/Settings.jsx, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: Local queued data only.
Security impact: Improves visibility and recovery for offline actions. Server remains source of truth; retry re-arms local queue items for existing sync paths and does not bypass auth, permissions, stock validation, booking availability validation, payment validation, receipt creation, or server validation.
Testing done: `pnpm --filter @faako/offline-sync run test`; `pnpm --filter @faako/reebs-portal run build`; `pnpm --filter @faako/dev-erp run build`; documentation review. Manual checks documented for Sync Review queue counts, retry, cancel, mark-resolved, scoped queue filtering, and unchanged online workflows.
Rollback notes: Remove the shared queue review helpers, hooks, and components; remove the Sync Review panel imports/usages from REEBS Admin Workspace and Dev ERP Settings; remove related tests and documentation. Existing app-specific queue sync paths remain intact.
Next step: WhatsApp receipt sharing.

### Offline booking queue foundation

Date: 2026-05-11
Change name: Offline booking queue foundation
Apps/packages affected: reebs-portal, dev-erp docs, @faako/offline-sync, platform docs
What changed: REEBS Bookings now saves offline booking create, edit, and status actions as `CREATE_BOOKING`, `UPDATE_BOOKING_DETAILS`, and `UPDATE_BOOKING_STATUS` queue items using `@faako/offline-sync`. Queued records store selected customer reference/details, event date/time, selected items, venue/delivery location, status action, timestamp/idempotency metadata, and user/org scope. When connectivity returns, REEBS submits queued booking actions to the existing `/.netlify/functions/bookings` endpoint and clears queue items only after confirmed success. UI notices show offline booking saved, pending sync, syncing, synced, needs review, and sync failed states. Dev ERP was reviewed and left unwired because its current Bookings/Appointments surface is calendar/settings/sync oriented rather than a safe manual booking create/update/status workflow.
Why it changed: Allow authenticated REEBS booking staff to preserve booking work during unstable internet while keeping existing online booking behavior, booking availability validation, rental reservation writes, permissions, payments, receipts, and inventory reservation logic server-owned.
Apps affected: REEBS Portal Bookings. Dev ERP reviewed as online-only for booking/calendar settings in this phase.
Files changed: packages/offline-sync/src/constants/queueActionTypes.js, apps/reebs-portal/src/pages/AdminBookings/offlineBookingQueue.js, apps/reebs-portal/src/pages/AdminBookings/offlineBookingQueue.test.js, apps/reebs-portal/src/pages/AdminBookings/AdminBookings.jsx, apps/reebs-portal/src/pages/AdminBookings/AdminBookings.css, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: Local queued booking actions only until sync. Server booking/reservation changes happen only after the existing online bookings endpoint validates and accepts queued actions.
Security impact: Server remains booking/availability source of truth. Queueing requires authenticated user/org context, stores only necessary booking data, does not reserve rental inventory offline, does not alter payment or receipt workflows, and does not bypass auth, permissions, booking availability validation, item/date conflict checks, customer validation, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS booking queue helper node tests, REEBS Portal Vite build, documentation review, and manual checks documented for offline booking save/sync/needs-review/sync-failed states and unchanged online booking behavior.
Rollback notes: Remove the REEBS booking queue helper, offline branch, sync effects, queue notices, CSS banner styles, helper tests, queue action constant if unused elsewhere, and README/docs updates, then return booking actions to online-only behavior. Existing online booking behavior remains app-owned.
Next step: Offline conflict review and sync reliability (completed 2026-05-11).

### Offline inventory adjustment queue

Date: 2026-05-11
Change name: Offline inventory adjustment queue
Apps/packages affected: reebs-portal, @faako/offline-sync docs, platform docs
What changed: REEBS Inventory stock adjustment modal now queues offline stock adjustments as `ADJUST_STOCK` actions using `@faako/offline-sync`. Queued records store the inventory item reference, optional variant reference, adjustment amount, adjustment type, optional notes/reference/sold month, timestamp/idempotency metadata, and user/org scope. When connectivity returns, REEBS submits queued adjustments to the existing `/.netlify/functions/stock` endpoint and clears queue items only after confirmed success. UI notices show offline adjustment saved, pending sync, syncing, synced, needs review, and sync failed states. Dev ERP was reviewed and left unwired because no current inventory adjustment surface was found.
Why it changed: Allow authenticated REEBS managers/admins to preserve stock adjustments during unstable internet while keeping existing online inventory behavior and server-side auth, permission, stock, rental, variant, booking-reservation, and validation rules as the source of truth.
Apps affected: REEBS Portal Inventory. Dev ERP reviewed as not applicable for this phase.
Files changed: apps/reebs-portal/src/pages/Admin/offlineInventoryAdjustmentQueue.js, apps/reebs-portal/src/pages/Admin/offlineInventoryAdjustmentQueue.test.js, apps/reebs-portal/src/pages/Admin/Admin.jsx, apps/reebs-portal/src/pages/Admin/styles/AdminInventoryOverview.css, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: Local queued adjustments only until sync. Server inventory changes happen only after the existing online stock endpoint validates and accepts queued adjustments.
Security impact: Server remains inventory source of truth. Queueing requires authenticated user/org context, stores only minimal adjustment data, does not mutate server inventory offline, does not alter stock deduction/reservation timing, and does not bypass auth, permissions, stock validation, rental restrictions, variant checks, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS inventory queue helper node tests, REEBS Portal Vite build, documentation review, and manual checks documented for offline adjustment save/sync/needs-review/sync-failed states and unchanged online stock adjustment behavior.
Rollback notes: Remove the REEBS inventory queue helper, offline branch, sync effects, queue notices, helper tests, and README/docs updates, then return inventory adjustments to online-only behavior. Existing online stock adjustment behavior remains app-owned.
Next step: Offline booking queue foundation.

### Queued offline manual payments

Date: 2026-05-11
Change name: Queued offline manual payments
Apps/packages affected: reebs-portal, dev-erp, @faako/offline-sync docs, platform docs
What changed: REEBS order detail and orders board manual payment forms now save offline payment submissions as `RECORD_PAYMENT` queue items using `@faako/offline-sync`. Dev ERP Rent now queues new rent payment records when offline while keeping existing rent payment edits online-only. Queued records store only the target order/rent reference, amount, method/reference/notes fields, timestamp/idempotency metadata, user/org scope, and pending status. When connectivity returns, each app submits queued payments to its existing server payment endpoint and clears queue items only after confirmed success. UI notices show offline payment saved, pending sync, syncing, synced, needs review, and sync failed states.
Why it changed: Allow authenticated staff to preserve manual payment submissions during unstable internet while keeping existing online payment behavior, server validation, receipt creation, balance updates, accounting effects, and permissions server-owned.
Apps affected: REEBS Portal order manual payments and Dev ERP Rent payment recording.
Files changed: apps/reebs-portal/src/pages/Orders/offlineManualPaymentQueue.js, apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx, apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx, apps/dev-erp/src/pages/Rent/offlineRentPaymentQueue.js, apps/dev-erp/src/pages/Rent/Rent.jsx, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: Local queued data only until server sync. Server data changes happen only after existing online payment endpoints validate and accept queued payments.
Security impact: Server remains source of truth. Queueing requires authenticated user/org context, stores only minimal payment data, does not create final receipt numbers offline, does not update balances offline, does not trigger accounting/report effects offline, and does not bypass auth, permissions, payment validation, receipt creation, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS Store Mode utility tests, REEBS Portal Vite build, Dev ERP Vite build, package export import check, and documentation review. Manual checks documented for offline payment queueing, pending/syncing/synced/needs-review/sync-failed notices, and unchanged online payment submission.
Rollback notes: Remove manual payment queue adapters and offline branches from REEBS order payment forms and Dev ERP Rent payment creation, remove queue notices, and return manual payments to draft-only/offline-blocked behavior. Existing online payment recording remains app-owned.
Next step: Offline inventory adjustment queue.

### Queued offline POS orders

Date: 2026-05-11
Change name: Queued offline POS orders
Apps/packages affected: reebs-portal, @faako/offline-sync docs, platform docs
What changed: REEBS Store Mode now saves offline POS sales as `CREATE_POS_ORDER` queue items using `@faako/offline-sync` queue helpers. Queued sales store the necessary order payload, minimal customer draft data, idempotency key, user/org scope, and pending status. When connectivity returns, Store Mode resolves the customer through the existing customer endpoint and submits the queued sale to the existing order creation endpoint. UI notices show offline sale saved, pending sync, syncing, synced, and needs review states.
Why it changed: Allow authenticated REEBS staff to keep selling during unstable internet while preserving the existing online POS flow and keeping the server as the source of truth.
Apps affected: REEBS Portal Store Mode/POS.
Files changed: apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx, apps/reebs-portal/src/pages/StoreMode/components/StoreModeLayout.jsx, apps/reebs-portal/README.md, packages/offline-sync/README.md, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Local queued data only until server sync. Server data changes happen only after the existing online customer/order endpoints validate and accept the queued sale.
Security impact: Server remains source of truth. Queueing requires authenticated user/org context, stores only minimal draft/customer/order data, does not generate final receipt numbers offline, does not permanently deduct stock offline, and does not bypass auth, permissions, stock validation, payment validation, receipt creation, idempotency, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS Store Mode utility tests, REEBS Portal Vite build, package export import check, and documentation review. Manual checks documented for offline sale queueing, pending/syncing/synced/needs-review notices, and unchanged online POS submission.
Rollback notes: Remove the offline queue branch and sync effects from Store Mode, remove the queue status notices, and restore Store Mode to draft-only offline behavior. Existing online POS sale creation remains unchanged.
Next step: Queued offline manual payments.

### Offline POS/payment drafts

Date: 2026-05-10
Change name: Offline POS/payment drafts
Apps/packages affected: @faako/offline-sync, reebs-portal, platform docs, root README
What changed: Added shared local draft storage helpers to `@faako/offline-sync` and wired draft-only local persistence into REEBS Store Mode POS, the order detail payment drawer, and the orders board payment modal. POS drafts save cart lines, selected customer draft data, payment method/reference, discounts, and cash received locally; manual payment drafts save unsent payment form fields locally. Draft notices show restored, saved, offline, and online-ready states, and drafts clear after successful online sale/payment recording.
Why it changed: Allow users to recover work-in-progress POS and manual payment input during unstable internet without syncing real business transactions or changing final server validation.
Apps affected: REEBS Portal only.
Files changed: packages/offline-sync/src/storage/localDraftStorage.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/types/draftTypes.js, packages/offline-sync/src/types/index.js, packages/offline-sync/test/offlineSync.test.mjs, packages/offline-sync/README.md, apps/reebs-portal/src/pages/StoreMode/storeModeShared.js, apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx, apps/reebs-portal/src/pages/StoreMode/components/StoreModeLayout.jsx, apps/reebs-portal/src/pages/StoreMode/StoreMode.css, apps/reebs-portal/src/pages/Orders/OrderDetail.jsx, apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx, apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx, apps/reebs-portal/README.md, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: No server data changes. Drafts are browser-local only and are cleared after successful online submission or user cancellation.
Security impact: Local draft storage only. Drafts are scoped by app, organization, user, and record where possible; backend auth, permissions, receipt creation, payment/order validation, stock handling, API behavior, and database schema remain unchanged.
Testing done: `@faako/offline-sync` node tests, REEBS Store Mode utility tests, REEBS Portal Vite build, and documentation review. Manual checks documented for POS draft restore/clear, manual payment draft restore/clear, and unchanged online submit flows.
Rollback notes: Remove the local draft helpers and tests from `@faako/offline-sync`, remove REEBS Store Mode and manual payment draft read/write/notice wiring, and remove related README/progress/status/implementation-note references. Existing online sale and payment paths remain app-owned.
Next step: Queued offline POS order creation.

### Offline Foundation Wave

Date: 2026-05-10
Change name: Offline Foundation Wave
Apps/packages affected: @faako/offline-sync, reebs-portal, dev-erp, platform docs, root README
What changed: Added `@faako/offline-sync` with IndexedDB queue storage helpers, memory queue storage for tests, offline queue item shapes, queue action constants, sync state constants, conflict status constants, online/offline detection, retry metadata helpers, aggregate sync status helpers, passive React hooks, and passive status UI components. Added visible online/offline indicators to the REEBS admin shell and Dev ERP topbar only.
Why it changed: Create shared offline infrastructure needed for future offline-safe ERP workflows while preserving live business logic, backend validation, auth, permissions, and app-owned persistence.
Apps affected: REEBS Portal and Dev ERP shell/status presentation only.
Files changed: packages/offline-sync/package.json, packages/offline-sync/README.md, packages/offline-sync/src/index.js, packages/offline-sync/src/constants/syncStates.js, packages/offline-sync/src/constants/queueActionTypes.js, packages/offline-sync/src/constants/conflictStatuses.js, packages/offline-sync/src/constants/storageConstants.js, packages/offline-sync/src/constants/index.js, packages/offline-sync/src/types/offlineQueueTypes.js, packages/offline-sync/src/types/syncMetadataTypes.js, packages/offline-sync/src/types/index.js, packages/offline-sync/src/storage/indexedDb.js, packages/offline-sync/src/storage/queueStorage.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/retry/retryMetadata.js, packages/offline-sync/src/status/onlineStatus.js, packages/offline-sync/src/status/syncStatus.js, packages/offline-sync/src/status/index.js, packages/offline-sync/src/hooks/useOnlineStatus.js, packages/offline-sync/src/hooks/useSyncStatus.js, packages/offline-sync/src/hooks/index.js, packages/offline-sync/src/components/OfflineStatusBadge.js, packages/offline-sync/src/components/PendingSyncBadge.js, packages/offline-sync/src/components/SyncStatusBanner.js, packages/offline-sync/src/components/index.js, packages/offline-sync/test/offlineSync.test.mjs, apps/reebs-portal/package.json, apps/reebs-portal/src/App.jsx, apps/reebs-portal/README.md, apps/dev-erp/package.json, apps/dev-erp/src/App.jsx, apps/dev-erp/README.md, pnpm-lock.yaml, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Offline infrastructure only, no unsynced production writes yet. Auth, permissions, organization isolation, backend validation, API behavior, database schema, and production workflows remain unchanged.
Testing done: `@faako/offline-sync` node tests, package export import checks, REEBS Portal Vite build, Dev ERP Vite build, and documentation review. Manual checks documented for visible indicators and unchanged online submit flows.
Rollback notes: Remove `@faako/offline-sync`, remove app package dependencies and passive indicator imports/usages, remove lockfile updates, and remove related README/progress-log/status/implementation-note references. Existing persistence and workflows remain app-owned.
Next step: Offline POS/payment draft integration.

### Shared Finance Foundation Wave

Date: 2026-05-10
Change name: Shared Finance Foundation Wave
Apps/packages affected: @faako/finance, reebs-portal, dev-erp, platform docs, root README
What changed: Expanded `@faako/finance` with pure currency helpers, `majorToCents`/`centsToMajor`, payment method/status normalization, receipt status normalization, finance status normalization, successful payment status checks, display-safe balance helpers, transaction/payment/receipt metadata normalization helpers, receipt display summaries, print-friendly receipt text, WhatsApp receipt message formatting, and email receipt placeholders. Adopted shared helpers only in low-risk display areas: REEBS order currency/payment-label presentation and Dev ERP Rent/Invoicing currency presentation.
Why it changed: Standardize low-risk finance, payment, and receipt terminology/presentation before any future shared payment service, receipt engine, invoice engine, offline queue, gateway integration, audit logging, MoMo reconciliation, or receipt automation work.
Apps affected: REEBS Portal and Dev ERP display layers only.
Files changed: packages/finance/package.json, packages/finance/README.md, packages/finance/src/index.js, packages/finance/src/constants/paymentMethods.js, packages/finance/src/helpers/currency.js, packages/finance/src/helpers/normalization.js, packages/finance/src/helpers/balances.js, packages/finance/src/helpers/metadata.js, packages/finance/src/helpers/index.js, packages/finance/src/receipts/formatters.js, packages/finance/src/receipts/index.js, packages/finance/test/financeHelpers.test.mjs, apps/reebs-portal/package.json, apps/reebs-portal/src/pages/Orders/orderUi.js, apps/dev-erp/package.json, apps/dev-erp/src/pages/Rent/Rent.jsx, apps/dev-erp/src/pages/Invoicing/Invoicing.jsx, pnpm-lock.yaml, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md, apps/reebs-portal/README.md, apps/dev-erp/README.md
Data impact: None.
Security impact: Standardizes finance terminology and presentation only. No auth, permissions, payment persistence, receipt creation, invoice persistence, order/rent balance calculations, API behavior, database schema, routes, stock/payment timing, or production workflows changed.
Testing done: `@faako/finance` node tests, package export import checks, REEBS Portal Vite build, Dev ERP Vite build, and documentation review. Manual checks documented for currency formatting, payment method/status normalization, receipt message formatting, and display-only page rendering.
Rollback notes: Revert the `@faako/finance` helper/receipt additions, remove the two app package dependencies and display-helper imports, restore local display formatters, remove the lockfile updates, and remove related README/progress-log/status/implementation-note entries. Existing app persistence and workflows are unaffected.
Next step: Offline Foundation Wave.

### Shared finance constants types foundation added

Date: 2026-05-10
Change name: Shared finance constants types foundation added
Apps/packages affected: @faako/finance, reebs-portal docs, dev-erp docs, platform docs, root README
What changed: Added `packages/finance` as the first shared finance foundation layer with payment method constants, payment status constants, receipt status constants, finance status constants, documented payment/receipt/transaction metadata shape descriptors, package indexes, package README, and TODO comments for future payment service, receipt service, gateway integration, offline sync, and audit logging work.
Why it changed: Establish shared terminology and safe shape contracts before any future shared payment/receipt services, helpers, gateways, offline sync, app adapters, or migrations are implemented.
Apps affected: REEBS Portal and Dev ERP documentation only; no app runtime code imports the package yet.
Files changed: packages/finance/package.json, packages/finance/src/index.js, packages/finance/src/constants/paymentMethods.js, packages/finance/src/constants/paymentStatuses.js, packages/finance/src/constants/receiptStatuses.js, packages/finance/src/constants/financeStatuses.js, packages/finance/src/constants/index.js, packages/finance/src/types/paymentTypes.js, packages/finance/src/types/receiptTypes.js, packages/finance/src/types/transactionTypes.js, packages/finance/src/types/index.js, packages/finance/README.md, pnpm-lock.yaml, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Standardizes finance terminology and future integration safety. No auth, permissions, payment calculations, receipt generation, invoice behavior, order/rent balances, APIs, database schema, routes, or workflows changed.
Testing done: Package export import check and documentation review.
Rollback notes: Remove `packages/finance`, remove the lockfile importer entry, and remove the related README/progress-log/status/implementation-note references. Existing apps will continue using their current app-owned constants and workflow behavior.
Next step: Shared finance helper utilities.

### Shared payment receipt architecture plan added

Date: 2026-05-10
Change name: Shared payment receipt architecture plan added
Apps/packages affected: reebs-portal, dev-erp, platform docs, root README
What changed: Added a planning-only shared Payment and Receipt architecture plan for Faako ERP apps. The plan summarizes current REEBS and Dev ERP payment/receipt/rent behavior, defines future package boundaries for payments, receipts, finance, and audit, documents service responsibilities, app-specific customization points, security and data-safety requirements, gateway and offline-payment considerations, implementation order, risks, mitigations, and manual testing.
Why it changed: The completed workflow reviews identified payment, receipt, invoice, order, rent, and balance behavior as production-sensitive. A shared architecture plan is needed before any shared payment or receipt constants, types, services, packages, gateways, or migrations are implemented.
Files changed: docs/platform/shared-payment-receipt-architecture.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md, README.md
Data impact: Documentation-only.
Security impact: Creates safety plan for future shared payment/receipt services. No auth, permissions, payment logic, receipt generation, invoice behavior, order/rent balances, APIs, database schema, routes, packages, or runtime behavior changed.
Testing done: Documentation review against the completed REEBS and Dev ERP order/payment/receipt workflow reviews.
Rollback notes: Remove the architecture plan and related progress-log, implementation-note, and README references if this planning baseline needs to be withdrawn.
Next step: Implement shared payment/receipt constants and types only.

### Orders payments receipts workflow review added

Date: 2026-05-10
Change name: Orders payments receipts workflow review added
Apps/packages affected: reebs-portal, dev-erp, platform docs, root README
What changed: Added documentation-only workflow reviews for REEBS Portal and Dev ERP covering order origins, POS/rent/invoice-linked flows, payment recording, receipts, invoices, balance calculations, shared dependencies, duplicated logic, high-risk areas, security considerations, future platform extraction opportunities, recommended package extraction order, rollback considerations, and manual testing checklists.
Why it changed: Payment, receipt, invoice, order, rent, and balance behavior is production-sensitive. The current workflows need to be mapped before any shared payment ledger, receipt engine, finance package, or order package is designed.
Files changed: docs/apps/reebs-portal/order-payment-receipt-workflow-review.md, docs/apps/dev-erp/order-payment-receipt-workflow-review.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, README.md
Data impact: Documentation-only.
Security impact: Improves finance/payment workflow understanding. No auth, permission, payment, receipt, invoice, order, rent, report, API, database, route, or runtime behavior changed.
Testing done: Documentation review against current REEBS order/payment/receipt/invoice code paths and Dev ERP rent/accounting/invoice/report code paths.
Rollback notes: Remove the two workflow review files and related README, progress-log, platform-status, and implementation-note references if this review baseline needs to be withdrawn.
Next step: Shared payment/receipt architecture foundation.

### Finance navigation grouping added

Date: 2026-05-10
Change name: Finance navigation grouping added
Apps/packages affected: reebs-portal, dev-erp docs, platform docs
What changed: Implemented low-risk REEBS Portal Finance navigation grouping so `/admin/accounting`, `/admin/expenses`, and `/admin/invoicing` resolve visually through the Finance module while preserving existing routes, calculations, payment recording, receipt generation, invoice generation, POS behavior, order balances, and access control. Reviewed Dev ERP Finance grouping and documented it as pending because rent payments, public invoice views, reports, and backend capabilities need a live workflow review before navigation reshaping.
Why it changed: Continue module consolidation using registry/navigation metadata only while keeping high-risk finance/payment workflows unchanged.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/finance-consolidation-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/finance-consolidation-plan.md
Data impact: None.
Security impact: No permission or payment logic changes. Existing route guards, backend permissions, payment/receipt/invoice behavior, and Dev ERP capability checks remain unchanged.
Testing done: REEBS registry ownership check, REEBS sidebar duplicate check, REEBS Portal Vite build, and documentation review against current Dev ERP finance/rent/invoice routes.
Rollback notes: Restore REEBS Finance to hidden navigation, restore Accounting/Expenses/Invoicing child sidebar visibility, and keep every route, API, calculation, payment, receipt, invoice, POS, order, rent, and accounting workflow untouched.
Next step: Orders/Payments/Receipts shared workflow review.

### Finance consolidation plans added

Date: 2026-05-10
Change name: Finance consolidation plans added
Apps/packages affected: reebs-portal, dev-erp, platform docs
What changed: Added planning-only Finance consolidation plans for REEBS Portal and Dev ERP. The plans document current finance-related routes, payment/receipt/invoice/accounting workflow mapping, target Finance structures, high-risk areas, data dependencies, security considerations, implementation order, rollback strategy, manual testing, and future shared platform opportunities.
Why it changed: Finance/payment-related workflows are production-sensitive. Planning the consolidation before implementation reduces the chance of disrupting payment recording, receipt generation, invoices, order logic, POS behavior, rent payments, accounting calculations, or reports.
Files changed: docs/apps/reebs-portal/finance-consolidation-plan.md, docs/apps/dev-erp/finance-consolidation-plan.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/implementation-notes.md, apps/reebs-portal/README.md, apps/dev-erp/README.md
Data impact: None. Planning-only documentation.
Security impact: Planning for safer finance workflows. No auth, permission, payment, receipt, invoice, accounting, database, route, or runtime behavior changed.
Testing done: Documentation review against current finance routes, registry metadata, Prisma models, and API surfaces.
Rollback notes: Remove the two Finance consolidation plan files and related README/progress-log/implementation-note entries if the planning baseline needs to be withdrawn.
Next step: Low-risk Finance grouping implementation.

### Bookings rentals schedule navigation consolidation added

Date: 2026-05-10
Change name: Bookings rentals schedule navigation consolidation added
Apps/packages affected: reebs-portal, dev-erp docs, platform docs
What changed: Consolidated REEBS Portal bookings/rentals/schedule navigation metadata so `/admin/bookings`, `/admin/rentals`, and `/admin/schedule` resolve visually through the Bookings module while preserving existing routes, access behavior, page logic, and workflows. Reviewed Dev ERP booking/rent routes and left Dev ERP behavior unchanged because `/bookings` is already nested under Rent as Appointments and deeper reshaping would require a live capability review.
Why it changed: Continue low-risk module consolidation by grouping event, rental, and scheduling surfaces under Bookings without touching payment recording, receipt generation, inventory stock deduction/reservation logic, booking creation/editing logic, auth, permissions, database schema, or route behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/module-consolidation-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Navigation grouping only; existing route guards, backend permission behavior, and Dev ERP capability checks remain unchanged.
Testing done: REEBS registry ownership check, REEBS sidebar duplicate check, REEBS Portal Vite build, and documentation review against current Dev ERP rent/bookings routes.
Rollback notes: Restore REEBS Rentals as an Inventory child, restore Schedule as a visible Bookings child, and remove `/admin/rentals` from Bookings match paths. Keep all route files, page logic, and workflows untouched.
Next step: Finance consolidation planning.

### Settings module navigation consolidation added

Date: 2026-05-10
Change name: Settings module navigation consolidation added
Apps/packages affected: reebs-portal, dev-erp docs, platform docs
What changed: Consolidated REEBS Portal settings/config-related navigation metadata so `/admin/settings`, `/admin/advanced`, `/admin/website-template`, `/admin/inventory/products`, and `/admin/inventory/templates` resolve visually through the Settings module while preserving existing routes, redirects, and sidebar behavior. Reviewed Dev ERP settings/config routes and left Dev ERP app behavior unchanged because `/settings` is the only current settings route.
Why it changed: Continue the lowest-risk module consolidation path by grouping configuration surfaces under Settings without touching payments, receipts, orders, bookings, inventory stock logic, customer workflows, auth, permissions, database schema, or route behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/module-consolidation-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Navigation grouping only; existing route guards, backend permission behavior, and Dev ERP capability checks remain unchanged.
Testing done: REEBS registry ownership check, REEBS Portal Vite build, and documentation review against current Dev ERP settings routes.
Rollback notes: Restore REEBS inventory product/template route matching to the Inventory module and remove the hidden Settings child metadata added for advanced, website template, inventory products, and inventory templates. Keep all route files and business pages untouched.
Next step: Bookings/Rentals consolidation planning or Finance consolidation planning.

### Team module navigation consolidation added

Date: 2026-05-10
Change name: Team module navigation consolidation added
Apps/packages affected: reebs-portal, dev-erp docs, platform docs
What changed: Consolidated REEBS Portal staff/user/team-related sidebar navigation into a visible Team module while preserving existing routes for users, employees, directory, HR, roles, and timesheets. Reviewed Dev ERP team/user routes and documented Team consolidation as pending because User Control and Profile have different access assumptions.
Why it changed: Implement the lowest-risk module consolidation first without touching finance, payments, orders, bookings, inventory, customer workflows, auth, permissions, database schema, or route behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/module-consolidation-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Navigation grouping only; existing route guards and backend permission behavior remain unchanged.
Testing done: REEBS registry visibility check confirmed Team is visible and old team child sidebar items are not duplicated; Vite build check for REEBS Portal.
Rollback notes: Restore the previous REEBS team child sidebar visibility and set the Team parent back to hidden from navigation; keep all existing routes and files untouched.
Next step: Settings consolidation or Bookings consolidation planning.

### ERP module consolidation plans added

Date: 2026-05-10
Change name: ERP module consolidation plans added
Apps/packages affected: reebs-portal, dev-erp, platform docs
What changed: Added app-specific module consolidation plans for REEBS Portal and Dev ERP, documenting current routes, target module structure, top-level modules, grouped modules, legacy routes to preserve, risks, data impact, security impact, implementation order, rollback notes, and manual testing checklists.
Why it changed: Establish a safe planning baseline for future app-specific module consolidation before any route, navigation, auth, schema, or business workflow implementation happens.
Files changed: docs/apps/reebs-portal/module-consolidation-plan.md, docs/apps/dev-erp/module-consolidation-plan.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/progress-log.md, docs/platform/platform-progress-log.md, apps/reebs-portal/README.md, apps/dev-erp/README.md
Data impact: None. Planning-only documentation.
Security impact: None. Planning-only documentation; future implementation must preserve backend auth, API permissions, route guards, and public-route behavior.
Testing done: Documentation review against current app registries and route declarations.
Rollback notes: Remove the two consolidation plan files and related README/progress-log entries if the planning baseline needs to be withdrawn.
Next step: App-specific module consolidation.

### Shared ERP shell and layout foundation added

Date: 2026-05-10
Change name: Shared ERP shell and layout foundation added
Apps/packages affected: reebs-portal, dev-erp, faako-erp, @faako/ui, @faako/layout, @faako/config, @faako/theme, @faako/types, platform docs, root README
What changed: Added shared ERP shell/layout contracts, reusable topbar/page-content/mobile-nav/sidebar/page-header/module-group/status-badge patterns, shell placeholder constants, and light app shell wrapper adoption across REEBS Portal, Dev ERP, and Faako ERP.
Why it changed: Standardize ERP app structure, layout patterns, responsive shell behavior, and shared navigation rendering while keeping app branding, modules, routes, workflows, auth, and business pages app-owned.
Files changed: packages/layout/package.json, packages/layout/src/index.ts, packages/layout/README.md, packages/config/src/erpShell/shellFoundation.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, packages/types/src/index.ts, packages/types/README.md, packages/ui/src/ErpShellFrame.tsx, packages/ui/src/ErpShellTopbar.tsx, packages/ui/src/ErpPageContent.tsx, packages/ui/src/ErpPageHeader.tsx, packages/ui/src/ErpMobileBottomNavFrame.tsx, packages/ui/src/ErpModuleGroupNav.tsx, packages/ui/src/ErpShellSidebarSlot.tsx, packages/ui/src/ErpStatusBadge.tsx, packages/ui/src/ErpNavSidebar.tsx, packages/ui/src/ErpBottomNav.tsx, packages/ui/src/index.ts, packages/ui/README.md, packages/theme/src/erp-shell.css, packages/theme/README.md, apps/reebs-portal/src/App.jsx, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.jsx, apps/reebs-portal/README.md, apps/dev-erp/src/App.jsx, apps/dev-erp/src/components/SideNav.jsx, apps/dev-erp/README.md, apps/faako-erp/src/App.jsx, apps/faako-erp/README.md, README.md, pnpm-lock.yaml, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md
Data impact: None.
Security impact: Structural UI standardization only. No auth behavior, API permission, route, database, billing, or data access behavior changed.
Testing done: Documentation review plus targeted import/build checks for shared shell packages and affected ERP apps.
Rollback notes: Revert the shared shell wrapper files, package docs, light app shell wrapper adoption, and documentation updates; keep existing routes, pages, and workflows untouched.
Next step: App-specific module consolidation.

### ERP module visibility and state layer added

Date: 2026-05-10
Change name: ERP module visibility and state layer added
Apps/packages affected: reebs-portal, dev-erp, faako-erp, @faako/config, @faako/types, @faako/ui, @faako/theme, platform docs, root README
What changed: Added shared module visibility and state constants/helpers for visible, hidden, disabled, internal, coming-soon, and experimental modules. ERP app registries now define safe default module state, navigation adapters ignore hidden modules, navigation items carry enabled/state/visibility/badge metadata, and shared/app navigation renders subtle badges and disabled visual states without blocking routes.
Why it changed: Prepare ERP apps for future module enable/disable support, internal modules, experimental modules, org-level module configuration, permissions integration, and SaaS plan/module gating while preserving existing production navigation and route behavior.
Files changed: packages/config/src/erpModules/moduleStates.js, packages/config/src/erpModules/registryHelpers.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, packages/types/src/index.ts, packages/ui/src/ErpNavSidebar.tsx, packages/ui/src/ErpBottomNav.tsx, packages/theme/src/erp-shell.css, apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.css, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.jsx, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.css, apps/reebs-portal/README.md, apps/dev-erp/src/config/adminModules.js, apps/dev-erp/src/app/navigation.js, apps/dev-erp/src/components/SideNav.jsx, apps/dev-erp/src/App.jsx, apps/dev-erp/src/index.css, apps/dev-erp/README.md, apps/faako-erp/src/config/adminModules.js, apps/faako-erp/src/config/erpShell.js, apps/faako-erp/README.md, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md
Data impact: None.
Security impact: Prepares future controlled feature exposure. No auth, API permission, access-control enforcement, billing, or database behavior changed.
Testing done: Documentation review, registry helper import checks, visibility/state helper checks, navigation adapter checks, and targeted app build checks.
Rollback notes: Revert the state constants/helpers, registry state metadata, navigation metadata/badge rendering, README/doc updates, and keep existing routes untouched.
Next step: App-specific module consolidation.

### ERP navigation wired to module registries

Date: 2026-05-10
Change name: ERP navigation wired to module registries
Apps/packages affected: reebs-portal, dev-erp, faako-erp, @faako/config, platform docs, root README
What changed: Wired ERP app navigation through app-specific admin module registries using shared registry helpers. REEBS Portal now adapts `src/config/adminModules.js` through `src/config/adminNavigation.js` for sidebar and bottom navigation. Dev ERP now builds sidebar and mobile navigation from `src/config/adminModules.js`. Faako ERP now has `src/config/adminModules.js` and adapts it through `src/config/erpShell.js`.
Why it changed: Move ERP navigation toward a shared registry model while preserving existing routes, labels, permissions behavior, page logic, and flat navigation.
Files changed: packages/config/src/erpModules/moduleGroups.js, packages/config/src/erpModules/moduleStatuses.js, packages/config/src/erpModules/registryHelpers.js, packages/config/README.md, apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.jsx, apps/reebs-portal/README.md, apps/dev-erp/src/config/adminModules.js, apps/dev-erp/src/app/navigation.js, apps/dev-erp/src/components/SideNav.jsx, apps/dev-erp/src/App.jsx, apps/dev-erp/README.md, apps/faako-erp/src/config/adminModules.js, apps/faako-erp/src/config/erpShell.js, apps/faako-erp/README.md, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md
Data impact: None.
Security impact: Navigation preparation only, no access control enforcement yet.
Testing done: Registry helper import checks, registry visibility/dedupe checks, Dev ERP navigation export checks, Faako ERP shell config generation checks, and Vite builds to `/private/tmp` for REEBS Portal, Dev ERP, and Faako ERP.
Rollback notes: Revert the navigation adapter imports/usages, remove the Faako ERP registry, restore the previous static nav arrays/config, and keep existing routes untouched.
Next step: Module visibility and enable/disable preparation.

### Shared ERP module registry foundation added

Date: 2026-05-10
Change name: Shared ERP module registry foundation added
Apps/packages affected: @faako/config, reebs-portal, dev-erp, platform docs, root README
What changed: Added shared ERP module group/status constants and registry lookup helpers in `packages/config/src/erpModules`, plus metadata-only admin module registries for REEBS Portal and Dev ERP.
Why it changed: Establish a consistent monorepo foundation for future ERP module registry work without changing live app behavior.
Files changed: packages/config/src/erpModules/moduleGroups.js, packages/config/src/erpModules/moduleStatuses.js, packages/config/src/erpModules/registryHelpers.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, apps/reebs-portal/src/config/adminModules.js, apps/dev-erp/src/config/adminModules.js, apps/dev-erp/package.json, pnpm-lock.yaml, README.md, apps/reebs-portal/README.md, apps/dev-erp/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md
Data impact: None. Registry-only foundation.
Security impact: None. No auth, API permissions, data access, route guards, navigation behavior, or database schema changed.
Testing done: Registry helper import and lookup checks.
Rollback notes: Remove the shared registry files, app registry files, exports, and related documentation if the foundation needs to be reverted.
Next step: Review live route and permission coverage before any future registry wiring.

### Corrected Dev ERP production status

Date: 2026-05-10
Change name: Corrected Dev ERP production status
Apps/packages affected: dev-erp, platform docs, root README
What changed: Updated documentation to classify Dev ERP as fully live, production-sensitive, and containing real operational data. Added general platform safety wording that REEBS Portal and Dev ERP are both live systems with real data, and that changes affecting auth, API permissions, customer/user data, payments, receipts, inventory, bookings, orders, rent, reports, email workflows, AI/productivity endpoints, or database schema must be treated as production-sensitive.
Why it changed: The previous documentation understated Dev ERP's production status by describing it as demo/internal. The platform docs now reflect the correct risk classification.
Files changed: apps/dev-erp/README.md, README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/system-status.md, docs/apps/dev-erp/pre-deploy-checklist.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md, docs/platform/pre-deploy-checklist.md
Data impact: Documentation-only.
Security impact: Improves production safety classification.
Testing done: Documentation review.
Rollback notes: Revert this documentation entry and the related wording changes if Dev ERP status needs to be reclassified.
Next step: Create REEBS admin module registry.

### README update rule added

Date: 2026-05-10
Change name: README update rule added
Apps/packages affected: monorepo documentation
What changed: Added a root README rule requiring relevant README updates whenever implemented work adds or changes features, modules, workflows, integrations, packages, API endpoints, environment variables, setup steps, deployment processes, or security-related behavior.
Why it changed: Keep implemented functionality documented at the same time it lands so future setup, operation, security review, and testing work has accurate references.
Files changed: README.md, docs/platform/platform-progress-log.md
Data impact: None. Documentation-only change.
Security impact: Positive documentation practice only. No runtime security behavior changed.
Testing done: Reviewed placement in the root README and logged the platform documentation change.
Rollback notes: Remove the README update rule section and this progress-log entry if the rule needs to be reverted.
Next step: Apply this rule to future app, package, API, deployment, environment, setup, and security-related changes.

### Documentation foundation added

Date: 2026-05-10
Change name: Documentation foundation added
Apps/packages affected: reebs-portal, stroane-web, dev-erp, faako-website, faako-api, platform docs
What changed: Added a consistent documentation structure for the requested apps, platform status, platform deploy checklist, decisions, and implementation notes.
Why it changed: Establish a shared documentation foundation for the monorepo as it grows into a platform with multiple apps.
Files changed: docs/apps/*, docs/platform/*, docs/decisions/README.md, docs/implementation-notes/README.md
Data impact: None. Documentation-only change.
Security impact: None. No application logic, database schema, secrets, permissions, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added documentation files and directories if this foundation needs to be reverted.
Next step: Use this log for shared changes and keep app-specific details in each app progress log.
