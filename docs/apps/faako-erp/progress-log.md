# Faako ERP Progress Log

## Purpose

Track meaningful changes to Faako ERP, the shared-shell ERP frontend reference app.

## Current app status

Demo/reference ERP app. Changes should preserve current demo routes, shared shell behavior, scenario labels, and deployment behavior.

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

### Demo access code leak removed

Date: 2026-06-16
Feature/change name: Demo access code leak removed
What changed: Removed browser-generated demo access codes, preview-code rendering, and local challenge helpers from the Faako ERP demo gate. The frontend now defaults to the API mode, refuses local verification mode, calls `/api/demo-access`, and stores only non-sensitive demo metadata.
Why it changed: Demo access codes must be delivered through email by the backend, not displayed in the browser.
Files changed: apps/faako-erp/src/components/DemoAccessGate.jsx, apps/faako-erp/src/utils/demoAccessSession.js, apps/faako-erp/src/styles/global.css, apps/faako-erp/.env.example, apps/faako-erp/README.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md.
Data impact: Browser storage shape changed for demo access. Existing local demo sessions with old token fields are normalized without carrying the token forward.
Security impact: Positive. Browser-visible codes and bearer-style demo token persistence were removed; the server-owned Faako API access-code flow is now required.
Testing done: `node --test apps/faako-api/src/demoAccess.test.mjs apps/stroane-web/backend/auth.test.js` passed. `pnpm run security:gate` passed. `pnpm run security:scan` passed.
Rollback notes: Revert the frontend demo gate/session changes only if the API route is unavailable, but keep local/browser preview-code generation disabled.
Next step: Smoke-test the deployed ERP demo after Faako API env values are configured.

### Shared app update notice shell adoption

Date: 2026-06-15
Feature/change name: Shared app update notice shell adoption
What changed: Mounted `AppUpdateNotice` from `@faako/ui` in the Faako ERP shell so demo/reference users receive a user-controlled refresh prompt when a newer deployed frontend bundle exists.
Why it changed: Keep the ERP reference app aligned with the shared shell convention without forcing reloads during demo workflows.
Files changed: apps/faako-erp/src/App.jsx, apps/faako-erp/README.md, packages/ui/src/components/AppUpdateNotice.tsx, packages/ui/src/ui.css, docs/apps/faako-erp/progress-log.md, docs/platform/platform-progress-log.md.
Data impact: None.
Security impact: Frontend presentation/shell-only change. No demo access, routing, permissions, API, or database behavior changed.
Testing done: `git diff --check` passed at repo level. Shared update-notice validation is covered by the platform entry; full cross-app builds were not run in this pass.
Rollback notes: Remove the `AppUpdateNotice` import/render and revert the shared UI/docs changes.
Next step: Smoke-test the deployed demo shell after the next frontend build.

### Faako ERP shared shell wrapper foundation added

Date: 2026-05-10
Feature/change name: Faako ERP shared shell wrapper foundation added
What changed: Adopted shared ERP topbar and page-content wrappers in the Faako ERP shell while keeping demo routes, scenario labels, page components, and demo access behavior app-owned.
Why it changed: Keep the ERP reference app aligned with the shared shell/layout foundation without redesigning business pages or changing route behavior.
Files changed: apps/faako-erp/src/App.jsx, apps/faako-erp/README.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md
Data impact: None.
Security impact: Structural UI standardization only. No auth, route, permission, API, database, or data access behavior changed.
Testing done: Documentation review and Faako ERP shell/build checks.
Rollback notes: Revert the Faako ERP wrapper imports/usages and documentation updates; keep existing routes and demo pages untouched.
Next step: App-specific module consolidation.

### Faako ERP module visibility and state layer added

Date: 2026-05-10
Feature/change name: Faako ERP module visibility and state layer added
What changed: Added default module visibility/state metadata to the Faako ERP registry and updated the shell adapter/shared navigation metadata so hidden modules are ignored and disabled, internal, coming-soon, and experimental modules can render subtle badges/classes when present.
Why it changed: Keep the ERP reference app aligned with the shared module registry conventions while preserving current demo routes, scenario labels, and shell behavior.
Files changed: apps/faako-erp/src/config/adminModules.js, apps/faako-erp/src/config/erpShell.js, apps/faako-erp/README.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md
Data impact: None.
Security impact: Prepares future controlled feature exposure. No access control enforcement changed.
Testing done: Documentation review, registry helper checks, Faako ERP shell config checks, and Faako ERP build checks.
Rollback notes: Revert the Faako ERP registry state defaults, shell adapter metadata, shared navigation badge rendering, and documentation updates; keep existing route files untouched.
Next step: App-specific module consolidation.

### Faako ERP navigation wired to admin module registry

Date: 2026-05-10
Feature/change name: Faako ERP navigation wired to admin module registry
What changed: Added a Faako ERP admin module registry and wired `src/config/erpShell.js` to build sidebar and bottom navigation from it while preserving existing paths and scenario-specific labels.
Why it changed: Include the existing ERP reference app in the shared ERP registry navigation model without changing route behavior or demo access behavior.
Files changed: apps/faako-erp/src/config/adminModules.js, apps/faako-erp/src/config/erpShell.js, apps/faako-erp/README.md, docs/apps/faako-erp/progress-log.md, docs/apps/faako-erp/implementation-notes.md
Data impact: None.
Security impact: Navigation preparation only, no access control enforcement yet.
Testing done: Faako ERP shell config generation check and Vite build to `/private/tmp/faako-erp-registry-build`.
Rollback notes: Remove `src/config/adminModules.js` and restore the previous static sidebar and bottom-nav arrays in `src/config/erpShell.js`.
Next step: Module visibility and enable/disable preparation.
