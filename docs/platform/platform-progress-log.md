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
