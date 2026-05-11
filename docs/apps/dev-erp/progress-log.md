# Dev ERP Progress Log

## Purpose

Track meaningful changes to Dev ERP, the fully live operational system in the Faako monorepo.

## Current app status

Fully live operational system with real operational data. Changes are production-sensitive, especially when they affect auth, API permissions, operational records, rent/payment records, customer/client data, reports, environment variables, database migrations, email workflows, or AI/productivity endpoints.

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

### Offline Foundation Wave

Date: 2026-05-10
Feature/change name: Offline Foundation Wave
Apps affected: Dev ERP shell/status presentation
What changed: Added shared `@faako/offline-sync` infrastructure and replaced Dev ERP's local online/offline listener with the shared passive online/offline hook plus a visible topbar indicator.
Why it changed: Prepare future offline-safe ERP workflows while keeping Dev ERP rent payments, invoices, accounting, reports, public invoice links, auth, permissions, APIs, and persistence unchanged.
Files changed: packages/offline-sync/package.json, packages/offline-sync/README.md, packages/offline-sync/src/index.js, packages/offline-sync/src/constants/syncStates.js, packages/offline-sync/src/constants/queueActionTypes.js, packages/offline-sync/src/constants/conflictStatuses.js, packages/offline-sync/src/constants/storageConstants.js, packages/offline-sync/src/constants/index.js, packages/offline-sync/src/types/offlineQueueTypes.js, packages/offline-sync/src/types/syncMetadataTypes.js, packages/offline-sync/src/types/index.js, packages/offline-sync/src/storage/indexedDb.js, packages/offline-sync/src/storage/queueStorage.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/retry/retryMetadata.js, packages/offline-sync/src/status/onlineStatus.js, packages/offline-sync/src/status/syncStatus.js, packages/offline-sync/src/status/index.js, packages/offline-sync/src/hooks/useOnlineStatus.js, packages/offline-sync/src/hooks/useSyncStatus.js, packages/offline-sync/src/hooks/index.js, packages/offline-sync/src/components/OfflineStatusBadge.js, packages/offline-sync/src/components/PendingSyncBadge.js, packages/offline-sync/src/components/SyncStatusBanner.js, packages/offline-sync/src/components/index.js, packages/offline-sync/test/offlineSync.test.mjs, apps/dev-erp/package.json, apps/dev-erp/src/App.jsx, apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, README.md, pnpm-lock.yaml
Data impact: None.
Security impact: Offline infrastructure only, no unsynced production writes yet. Dev ERP auth, permissions, organization isolation, backend validation, API behavior, database schema, public routes, and production workflows remain unchanged.
Testing done: `@faako/offline-sync` node tests, package export import checks, Dev ERP Vite build, and documentation review. Manual checks documented for the online/offline indicator and unchanged submit flows.
Rollback notes: Restore Dev ERP's previous local online/offline listener if needed, remove the topbar indicator, remove the app dependency on `@faako/offline-sync`, remove the shared package if needed, and remove related documentation references. Dev ERP business workflows remain unaffected.
Next step: Offline POS/payment draft integration.

### Shared Finance Foundation Wave

Date: 2026-05-10
Feature/change name: Shared Finance Foundation Wave
Apps affected: Dev ERP display layer
What changed: Expanded `@faako/finance` with shared pure finance helpers and adopted shared currency formatting helpers in Dev ERP Rent and Invoicing display utilities only.
Why it changed: Standardize finance terminology and presentation before any future shared payment or receipt service work while preserving live Dev ERP rent payment, invoice, accounting, report, public-token, and balance behavior.
Files changed: packages/finance/package.json, packages/finance/README.md, packages/finance/src/index.js, packages/finance/src/constants/paymentMethods.js, packages/finance/src/helpers/currency.js, packages/finance/src/helpers/normalization.js, packages/finance/src/helpers/balances.js, packages/finance/src/helpers/metadata.js, packages/finance/src/helpers/index.js, packages/finance/src/receipts/formatters.js, packages/finance/src/receipts/index.js, packages/finance/test/financeHelpers.test.mjs, apps/dev-erp/package.json, apps/dev-erp/src/pages/Rent/Rent.jsx, apps/dev-erp/src/pages/Invoicing/Invoicing.jsx, apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, README.md, pnpm-lock.yaml
Data impact: None.
Security impact: Standardizes finance terminology and presentation only. No Dev ERP auth, permissions, payment persistence, receipt creation, invoice persistence, rent balance calculations, report behavior, public routes, API behavior, database schema, routes, or production workflows changed.
Testing done: `@faako/finance` node tests, package export import checks, Dev ERP Vite build, and documentation review. Manual display checks documented for Dev ERP Rent and Invoicing currency display.
Rollback notes: Revert the Dev ERP Rent/Invoicing display-helper imports, remove the app dependency on `@faako/finance`, remove the shared package helper additions if needed, and restore local display formatting. Live Dev ERP rent/payment/invoice/report workflows are unaffected.
Next step: Offline Foundation Wave.

### Dev ERP shared finance constants types foundation noted

Date: 2026-05-10
Feature/change name: Dev ERP shared finance constants types foundation noted
Apps affected: Dev ERP documentation only
What changed: Added the shared `@faako/finance` constants/types foundation and documented Dev ERP as an affected future consumer. The package defines shared payment methods, payment statuses, receipt statuses, finance statuses, and documented payment/receipt/transaction metadata shapes, but Dev ERP runtime code does not import it yet.
Why it changed: Prepare a safe shared terminology layer before any future Dev ERP rent payment, accounting, invoice, public-token, report, receipt, or balance adapter work.
Files changed: packages/finance/package.json, packages/finance/src/index.js, packages/finance/src/constants/paymentMethods.js, packages/finance/src/constants/paymentStatuses.js, packages/finance/src/constants/receiptStatuses.js, packages/finance/src/constants/financeStatuses.js, packages/finance/src/constants/index.js, packages/finance/src/types/paymentTypes.js, packages/finance/src/types/receiptTypes.js, packages/finance/src/types/transactionTypes.js, packages/finance/src/types/index.js, packages/finance/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, README.md, pnpm-lock.yaml
Data impact: None.
Security impact: Standardizes finance terminology and future integration safety. No Dev ERP auth, permissions, payment calculations, receipt generation, invoice behavior, rent balances, reports, public routes, APIs, database schema, routes, or workflows changed.
Testing done: Package export import check and documentation review.
Rollback notes: Remove `packages/finance` and related documentation references. Dev ERP will continue using current app-owned constants and payment/rent/invoice behavior.
Next step: Shared finance helper utilities.

### Dev ERP shared payment receipt architecture plan added

Date: 2026-05-10
Feature/change name: Dev ERP shared payment receipt architecture plan added
Apps affected: Dev ERP
What changed: Added Dev ERP to the shared Payment and Receipt architecture plan as a fully live ERP app with rent payments, operational records, reports, accounting paid state, invoice/public-token behavior, missing dedicated immutable receipt flow, and rent/report balance risks.
Why it changed: Dev ERP rent payments, invoices, accounting entries, public invoice links, reports, and balances need a safe shared-architecture plan before any shared payment/receipt constants, types, wrappers, packages, gateways, or migrations are introduced.
Files changed: docs/platform/shared-payment-receipt-architecture.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, README.md
Data impact: Documentation-only.
Security impact: Creates safety plan for future shared payment/receipt services. No auth, permissions, payment logic, receipt generation, invoice behavior, rent balances, reports, public routes, APIs, database schema, routes, or runtime behavior changed.
Testing done: Documentation review against the Dev ERP order/payment/receipt workflow review.
Rollback notes: Remove the shared architecture plan and related Dev ERP progress-log, implementation-note, and README references if this planning baseline needs to be withdrawn.
Next step: Implement shared payment/receipt constants and types only.

### Dev ERP order payment receipt workflow review added

Date: 2026-05-10
Feature/change name: Dev ERP order payment receipt workflow review added
Apps affected: Dev ERP
What changed: Added a documentation-only review that maps Dev ERP rent payment, accounting, invoice, public invoice view, report-adjacent finance flows, receipt gaps, balance calculations, shared dependencies, high-risk areas, security considerations, future platform extraction opportunities, package extraction order, rollback considerations, and manual testing.
Why it changed: Dev ERP is fully live with real operational data. Rent payments, invoices, accounting entries, reports, public invoice tokens, and balance calculations need a documented source-of-truth map before any shared payment/receipt/finance/order foundation is introduced.
Files changed: docs/apps/dev-erp/order-payment-receipt-workflow-review.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, apps/dev-erp/README.md
Data impact: Documentation-only.
Security impact: Improves finance/payment workflow understanding. No auth, permission, payment, invoice, rent, accounting, report, API, database, public-route, or runtime behavior changed.
Testing done: Documentation review against current Dev ERP rent payment, accounting, invoice, public invoice, report, and Prisma model code paths.
Rollback notes: Remove the workflow review file and related README/progress-log/implementation-note references if this review baseline needs to be withdrawn.
Next step: Shared payment/receipt architecture foundation.

### Dev ERP Finance grouping reviewed as pending

Date: 2026-05-10
Feature/change name: Dev ERP Finance grouping reviewed as pending
What changed: Reviewed Dev ERP Finance grouping against the finance consolidation plan and documented grouping as pending rather than forcing a live navigation change. Accounting and Invoicing remain separate visible routes, Rent Payments remain under Rent, Reports remain under Reports, and public invoice views remain outside authenticated navigation assumptions.
Why it changed: Dev ERP finance/rent workflows are fully live with real data. Grouping rent payments, invoices, reports, and accounting/payment summaries needs a live workflow and capability review before implementation.
Files changed: apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/finance-consolidation-plan.md
Data impact: None.
Security impact: No permission or payment logic changes. Documentation-only review for Dev ERP; existing backend capabilities, public invoice token behavior, rent-only access, and reporting access remain unchanged.
Testing done: Documentation review against current Dev ERP finance registry, routes, and finance consolidation plan.
Rollback notes: Remove this progress-log entry and pending notes if Dev ERP Finance grouping is later implemented directly.
Next step: Orders/Payments/Receipts shared workflow review.

### Dev ERP Finance consolidation plan added

Date: 2026-05-10
Feature/change name: Dev ERP Finance consolidation plan added
What changed: Added a planning-only Finance consolidation plan for Dev ERP covering current accounting, invoicing, rent payment, report, and public invoice routes; workflow mapping; target Finance structure; high-risk areas; data dependencies; security considerations; implementation order; rollback strategy; manual testing; and future shared platform opportunities.
Why it changed: Dev ERP finance and rent payment workflows are fully live with real data. A safe plan is needed before any future grouping implementation touches accounting, invoices, rent payments, reports, public invoice access, backend capabilities, or data dependencies.
Files changed: docs/apps/dev-erp/finance-consolidation-plan.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, apps/dev-erp/README.md
Data impact: None. Planning-only documentation.
Security impact: Planning for safer finance workflows. No auth, permission, payment, invoice, accounting, rent payment, database, route, public invoice, or runtime behavior changed.
Testing done: Documentation review against current Dev ERP finance routes, Prisma models, backend APIs, and registry metadata.
Rollback notes: Remove the Finance consolidation plan and related README/progress-log/implementation-note entries if the planning baseline needs to be withdrawn.
Next step: Low-risk Finance grouping implementation.

### Dev ERP Bookings/Rentals/Schedule consolidation reviewed as unchanged

Date: 2026-05-10
Feature/change name: Dev ERP Bookings/Rentals/Schedule consolidation reviewed as unchanged
What changed: Reviewed Dev ERP booking/rent/scheduling routes and documented this consolidation as unchanged rather than forcing a navigation change. `/bookings` is already nested under Rent as Appointments, and no separate rentals or schedule route exists to safely group under a new Bookings module in this low-risk phase.
Why it changed: Apply Bookings/Rentals/Schedule consolidation only where safe while preserving Dev ERP live navigation, rent-only user behavior, auth, backend capabilities, and operational workflows.
Files changed: apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Documentation-only review for Dev ERP.
Testing done: Documentation review against the current Dev ERP registry and route declarations.
Rollback notes: Remove this progress-log entry and pending notes if Dev ERP Bookings/Rentals/Schedule consolidation is later implemented directly.
Next step: Finance consolidation planning.

### Dev ERP Settings consolidation reviewed as unchanged

Date: 2026-05-10
Feature/change name: Dev ERP Settings consolidation reviewed as unchanged
What changed: Reviewed Dev ERP settings/config/admin routes and documented Settings consolidation as unchanged rather than forcing a navigation change. The live app currently has `/settings` as its Settings module, while system health and audit logs remain under Reports.
Why it changed: Apply Settings consolidation only where safe while preserving Dev ERP live navigation, auth, backend capabilities, and operational workflows.
Files changed: apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Documentation-only review for Dev ERP.
Testing done: Documentation review against the current Dev ERP registry and route declarations.
Rollback notes: Remove this progress-log entry and pending notes if Dev ERP Settings consolidation is later implemented directly.
Next step: Bookings/Rentals consolidation planning or Finance consolidation planning.

### Dev ERP Team consolidation reviewed as pending

Date: 2026-05-10
Feature/change name: Dev ERP Team consolidation reviewed as pending
What changed: Reviewed Dev ERP team/user/staff/admin routes and documented Team consolidation as pending rather than forcing a navigation change. User Control and Profile remain separate in behavior because they have different access assumptions, and Dev ERP is fully live with real operational data.
Why it changed: Apply the lowest-risk consolidation only where safe while preserving Dev ERP live navigation, auth, capability, and public-route behavior.
Files changed: apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/dev-erp/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Documentation-only review for Dev ERP.
Testing done: Documentation review against current Dev ERP registry and route declarations.
Rollback notes: Remove this progress-log entry and pending notes if Dev ERP Team consolidation is later implemented directly.
Next step: Settings consolidation or Bookings consolidation planning.

### Dev ERP module consolidation plan added

Date: 2026-05-10
Feature/change name: Dev ERP module consolidation plan added
What changed: Added a planning-only module consolidation plan for Dev ERP covering current routes, target module structure, top-level modules, grouped modules, legacy routes, risks, data/security impact, implementation order, rollback notes, and manual testing.
Why it changed: Create a safe implementation guide before consolidating overlapping live Dev ERP modules such as Finance, Reports, Team, Rent/Appointments, and Organizations.
Files changed: docs/apps/dev-erp/module-consolidation-plan.md, docs/apps/dev-erp/progress-log.md, apps/dev-erp/README.md
Data impact: None. Planning-only documentation.
Security impact: None. Planning-only documentation; future implementation must preserve auth, sessions, CSRF, backend capabilities, organization scoping, and public-route behavior.
Testing done: Documentation review against current Dev ERP registry and route declarations.
Rollback notes: Remove the Dev ERP module consolidation plan and related README/progress-log entries if the planning baseline needs to be withdrawn.
Next step: App-specific module consolidation.

### Dev ERP shared shell wrapper foundation added

Date: 2026-05-10
Feature/change name: Dev ERP shared shell wrapper foundation added
What changed: Adopted shared ERP topbar, page-content, mobile-bottom-nav, and status-badge wrappers in the Dev ERP app shell while keeping Dev ERP sidebar behavior, routes, auth, notification polling, offline banner, and business workflows unchanged.
Why it changed: Align the fully live Dev ERP system with the shared ERP shell/layout foundation without changing production behavior or live-data workflows.
Files changed: apps/dev-erp/src/App.jsx, apps/dev-erp/src/components/SideNav.jsx, apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Structural UI standardization only. No auth, route, permission, API, database, or data access behavior changed.
Testing done: Documentation review and Dev ERP shell/build checks.
Rollback notes: Revert the Dev ERP wrapper imports/usages and documentation updates; keep all route, auth, and backend files untouched.
Next step: App-specific module consolidation.

### Dev ERP module visibility and state layer added

Date: 2026-05-10
Feature/change name: Dev ERP module visibility and state layer added
What changed: Added default module visibility/state metadata to the Dev ERP admin registry and updated sidebar/mobile navigation adapters/components to ignore hidden modules, carry enabled/state/visibility metadata, and render subtle disabled, internal, coming-soon, and experimental badges/classes when present.
Why it changed: Prepare the fully live Dev ERP system for future hidden modules, disabled modules, internal-only modules, experimental modules, org-level toggles, permissions integration, and SaaS plan/module gating without changing current routes, API permissions, backend capabilities, or live data behavior.
Files changed: apps/dev-erp/src/config/adminModules.js, apps/dev-erp/src/app/navigation.js, apps/dev-erp/src/components/SideNav.jsx, apps/dev-erp/src/App.jsx, apps/dev-erp/src/index.css, apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Prepares future controlled feature exposure. No access control enforcement changed.
Testing done: Documentation review, registry helper checks, Dev ERP navigation export checks, and Dev ERP build checks.
Rollback notes: Revert the Dev ERP registry state defaults, adapter metadata, badge/disabled UI additions, and documentation updates; keep existing route files untouched.
Next step: App-specific module consolidation.

### Dev ERP navigation wired to admin module registry

Date: 2026-05-10
Feature/change name: Dev ERP navigation wired to admin module registry
What changed: Wired Dev ERP sidebar and mobile navigation to read from `src/config/adminModules.js` through `src/app/navigation.js`, preserving current labels, links, module-access filtering, rent-only navigation, and legacy route targets.
Why it changed: Move Dev ERP navigation toward the shared ERP registry model without changing live routes, auth behavior, API permissions, backend capabilities, or page logic.
Files changed: apps/dev-erp/src/config/adminModules.js, apps/dev-erp/src/app/navigation.js, apps/dev-erp/src/components/SideNav.jsx, apps/dev-erp/src/App.jsx, apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Navigation preparation only, no access control enforcement yet.
Testing done: Registry helper import checks, visible module/dedupe checks, Dev ERP navigation export checks, legacy route target checks, and Vite build to `/private/tmp/dev-erp-registry-build`.
Rollback notes: Restore the previous static `NAV_ITEMS`, `MOBILE_TAB_ITEMS`, rent-only arrays, and component metadata changes; keep all existing routes untouched.
Next step: Module visibility and enable/disable preparation.

### Dev ERP admin module registry foundation added

Date: 2026-05-10
Feature/change name: Dev ERP admin module registry foundation added
What changed: Added a metadata-only Dev ERP admin module registry for home, dashboard, rent, customers, payments, reports, users, and settings.
Why it changed: Create the foundation for a consistent ERP module registry without changing current navigation, route guards, API permissions, backend capabilities, or app behavior.
Files changed: apps/dev-erp/src/config/adminModules.js, apps/dev-erp/package.json, pnpm-lock.yaml, apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None. Registry-only foundation.
Security impact: None. No auth, API permissions, or data access changed.
Testing done: Registry helper import and lookup checks.
Rollback notes: Remove the Dev ERP registry file and related documentation if the foundation needs to be reverted.
Next step: Review Dev ERP live routes and permissions before any future registry wiring.

### Corrected Dev ERP production status

Date: 2026-05-10
Feature/change name: Corrected Dev ERP production status
What changed: Updated Dev ERP documentation to classify the app as fully live, production-sensitive, and containing real operational data. Expanded high-risk areas to include auth, API permissions, operational records, rent/payment records, customer/client data, reports, environment variables, database migrations, email workflows, and AI/productivity endpoints.
Why it changed: The previous documentation understated Dev ERP's production status by describing it as demo/internal. The docs now reflect the actual operational risk profile.
Files changed: apps/dev-erp/README.md, README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/system-status.md, docs/apps/dev-erp/pre-deploy-checklist.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md, docs/platform/pre-deploy-checklist.md
Data impact: Documentation-only.
Security impact: Improves production safety classification.
Testing done: Documentation review.
Rollback notes: Revert this documentation entry and the related wording changes if Dev ERP status needs to be reclassified.
Next step: Create REEBS admin module registry.

### Documentation foundation added

Date: 2026-05-10
Feature/change name: Documentation foundation added
What changed: Added the standard app documentation set for progress tracking, system status, deploy readiness, and implementation notes.
Why it changed: Establish a consistent documentation baseline for Dev ERP as part of the Faako monorepo platform.
Files changed: docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/system-status.md, docs/apps/dev-erp/pre-deploy-checklist.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None. Documentation-only change.
Security impact: None. No auth, permission, secret, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added Dev ERP documentation files if this documentation foundation needs to be reverted.
Next step: Keep this log updated for internal ERP features, demos, backend changes, migrations, and deployment changes.
