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
