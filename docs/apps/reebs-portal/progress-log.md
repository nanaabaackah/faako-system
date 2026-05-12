# REEBS Portal Progress Log

## Purpose

Track meaningful changes to REEBS Portal, the live/private beta operational portal used by authenticated REEBS users.

## Current app status

Live/private beta. Changes should assume real operational users, role-gated workflows, bookings, orders, inventory, receipts, and customer data may be affected.

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

### Shared ERP table foundation reviewed

Date: 2026-05-12
Feature/change name: Shared ERP table foundation
Apps affected: REEBS Portal documentation review
What changed: Reviewed REEBS Portal for initial shared ERP table adoption and documented runtime adoption as pending. No REEBS runtime tables were migrated in this phase.
Why it changed: REEBS table candidates are close to live/private-beta Orders, POS, Bookings, Inventory, Payments, receipts, bulk actions, and offline queue workflows, so they need separate visual and workflow checks before shared table adoption.
Files changed: docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: None.
Security impact: Documentation-only review. No auth, roles, payments, receipts, orders, bookings, inventory, offline queue processing, APIs, routes, database schema, or production workflow behavior changed.
Testing done: Documentation review; no REEBS runtime verification was required because no REEBS app code changed for this shared table wave.
Rollback notes: Remove this documentation-only review note if REEBS receives a separate runtime shared table adoption pass.
Next step: Shared form foundation implementation.

### Shared UI system cleanup reviewed

Date: 2026-05-12
Feature/change name: Shared UI system cleanup and extraction
Apps affected: REEBS Portal documentation review
What changed: Reviewed REEBS Portal for shared UI runtime adoption and documented that REEBS app surfaces remain pending manual visual review for this wave. No REEBS runtime files were changed for shared UI extraction.
Why it changed: The likely REEBS extraction candidates sit near active admin, POS, booking, inventory, payment, receipt, and offline queue workflows, so this wave keeps REEBS behavior untouched while shared UI wrappers mature in lower-risk surfaces.
Files changed: docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: None.
Security impact: Documentation-only review. No auth, roles, payments, receipts, bookings, inventory, offline queue processing, APIs, routes, database schema, or production workflow behavior changed.
Testing done: Documentation review; no REEBS runtime verification was required because no REEBS app code changed for this shared UI wave.
Rollback notes: Remove this documentation-only review note if REEBS receives a separate runtime shared UI adoption pass.
Next step: Shared form/table system planning.

### Safe Cleanup Wave 1

Date: 2026-05-12
Feature/change name: Safe Cleanup Wave 1
Apps affected: REEBS Portal
What changed: Removed confirmed unused icon imports from sidebar/navigation source, removed obsolete `no-unused-vars` eslint-disable comments from Orders List and Store Mode, replaced the catalog media control-character regex with an equivalent helper to satisfy lint without weakening URL safety checks, and excluded `.netlify` and generated Prisma output from REEBS ESLint scans.
Why it changed: Reduce low-risk cleanup debt from the platform audit while keeping live/private-beta REEBS workflows unchanged.
Files changed: apps/reebs-portal/eslint.config.js, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/src/utils/itemMediaBackgrounds.js, apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx, apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx, docs/platform/codebase-cleanup-audit.md, docs/platform/platform-progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Low-risk cleanup only. URL safety behavior remains equivalent; auth, roles, payments, receipts, bookings, inventory, offline queue processing, APIs, routes, and database schema are unchanged.
Testing done: `pnpm --filter @faako/reebs-portal exec eslint src` completed with warnings only and no source errors. Remaining hook/Fast Refresh warnings were left in place because changing them could affect runtime behavior.
Rollback notes: Revert the listed REEBS cleanup edits. No data rollback is required.
Next step: Shared UI system cleanup and extraction.

### Notification service foundation

Date: 2026-05-11
Feature/change name: Notification service foundation
Apps affected: REEBS Portal order receipt display/share area
What changed: Added `@faako/notifications` and wired the order receipt preview to use the shared customer-safe receipt summary template for copy, email draft, and WhatsApp draft actions. The actions are user-triggered and display/share-only.
Why it changed: Give REEBS a shared notification-text foundation before future automated receipt, reminder, delivery, or WhatsApp/email/SMS work, while keeping customer data privacy-safe.
Files changed: packages/notifications/package.json, packages/notifications/src/index.js, packages/notifications/src/constants/channels.js, packages/notifications/src/constants/types.js, packages/notifications/src/constants/statuses.js, packages/notifications/src/constants/index.js, packages/notifications/src/helpers/safeText.js, packages/notifications/src/helpers/channelAvailability.js, packages/notifications/src/helpers/index.js, packages/notifications/src/templates/customerMessages.js, packages/notifications/src/templates/index.js, packages/notifications/test/notifications.test.mjs, packages/notifications/README.md, apps/reebs-portal/package.json, apps/reebs-portal/src/pages/Orders/components/ReceiptViewer.jsx, pnpm-lock.yaml, README.md, apps/reebs-portal/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Customer-safe message templates only. No automated WhatsApp messages, automated emails, SMS, notification persistence, backend send behavior change, receipt/payment/order behavior change, auth change, permission change, or schema change.
Testing done: `pnpm --filter @faako/notifications run test`; `pnpm --filter @faako/reebs-portal run build`; documentation review. Manual checks documented for receipt summary copy/mailto/WhatsApp drafts and unchanged order/payment/receipt behavior.
Rollback notes: Remove the REEBS receipt preview notification imports/share draft actions, remove the app dependency on `@faako/notifications`, remove the shared package if not used elsewhere, and remove related README/docs entries.
Next step: delivery/map helper foundation.

### Offline conflict review and sync reliability

Date: 2026-05-11
Feature/change name: Offline conflict review and sync reliability
Apps affected: REEBS Portal Admin Workspace Offline Sync
What changed: Added the shared `SyncReviewPanel` to the Admin Workspace Offline Sync view and expanded `@faako/offline-sync` with queue summary, retry, cancel, mark-resolved, last-error, and conflict metadata helpers. The panel shows local POS, payment, inventory, and booking queue counts and review cards without exposing raw queue payloads.
Why it changed: Staff/admins need a safe place to see pending, failed, and conflicting offline work so production-sensitive POS, payment, inventory, and booking queue items are not lost or silently ignored.
Files changed: packages/offline-sync/src/constants/syncStates.js, packages/offline-sync/src/storage/queueStorage.js, packages/offline-sync/src/storage/queueActions.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/status/queueSummary.js, packages/offline-sync/src/status/index.js, packages/offline-sync/src/hooks/useSyncQueueSummary.js, packages/offline-sync/src/hooks/useQueuedActionRetry.js, packages/offline-sync/src/hooks/useQueuedActionCancel.js, packages/offline-sync/src/hooks/index.js, packages/offline-sync/src/components/SyncConflictCard.js, packages/offline-sync/src/components/SyncReviewPanel.js, packages/offline-sync/src/components/index.js, packages/offline-sync/test/offlineSync.test.mjs, apps/reebs-portal/src/pages/AdminWorkspace/AdminWorkspace.jsx, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Local queued data only.
Security impact: Improves visibility and recovery for offline actions. Retry re-arms local queue items for existing sync paths; server validation, auth, permissions, stock validation, booking availability, payment validation, receipt creation, and final writes remain server-owned.
Testing done: `pnpm --filter @faako/offline-sync run test`; `pnpm --filter @faako/reebs-portal run build`; documentation review. Manual checks documented for Offline Sync counts, retry, cancel, mark-resolved, scoped queue filtering, and unchanged online POS/payment/inventory/booking flows.
Rollback notes: Remove the Sync Review panel from Admin Workspace, remove shared review helpers/components if no longer needed, and revert related README/docs/test updates. Existing queue creation and app-specific sync paths remain app-owned.
Next step: WhatsApp receipt sharing.

### Offline booking queue foundation

Date: 2026-05-11
Feature/change name: Offline booking queue foundation
Apps affected: REEBS Portal Bookings
What changed: REEBS Bookings now queues offline booking create, edit, and status actions as `CREATE_BOOKING`, `UPDATE_BOOKING_DETAILS`, and `UPDATE_BOOKING_STATUS` actions using `@faako/offline-sync`. Queued records include the selected customer reference/details, event date/time, selected items, venue/delivery location, status action, idempotency/timestamp metadata, and user/org scope. When online returns, REEBS submits queued actions to the existing `/.netlify/functions/bookings` endpoint and clears queue items only after confirmed success. UI notices show offline booking saved, pending sync, syncing, synced, needs review, and sync failed states.
Why it changed: Allow authenticated REEBS booking staff to preserve booking work during unstable internet while preserving existing online booking creation/editing/status behavior and server-side availability/reservation validation.
Files changed: packages/offline-sync/src/constants/queueActionTypes.js, apps/reebs-portal/src/pages/AdminBookings/offlineBookingQueue.js, apps/reebs-portal/src/pages/AdminBookings/offlineBookingQueue.test.js, apps/reebs-portal/src/pages/AdminBookings/AdminBookings.jsx, apps/reebs-portal/src/pages/AdminBookings/AdminBookings.css, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, apps/dev-erp/README.md
Data impact: Local queued booking actions only until sync.
Security impact: Server remains booking/availability source of truth. Queueing requires authenticated user/org context, stores only necessary booking data, does not reserve rental inventory offline, does not alter payment or receipt workflows, and does not bypass auth, permissions, booking availability validation, reservation writes, item/date conflict checks, customer validation, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS booking queue helper node tests, REEBS Portal Vite build, and documentation review. Manual checks documented for offline booking create/edit/status queueing, pending/syncing/synced/needs-review/sync-failed notices, and unchanged online booking behavior.
Rollback notes: Remove the REEBS booking queue helper, offline branch, sync effects, queue notices, CSS banner styles, helper tests, and `UPDATE_BOOKING_DETAILS` queue action constant if unused elsewhere, then return booking actions to online-only behavior. Existing online booking behavior remains app-owned.
Next step: Offline conflict review and sync reliability (completed 2026-05-11).

### Offline inventory adjustment queue

Date: 2026-05-11
Feature/change name: Offline inventory adjustment queue
Apps affected: REEBS Portal Inventory
What changed: Inventory stock adjustment modal now queues offline submissions as `ADJUST_STOCK` actions using `@faako/offline-sync`. Queued records include the inventory item reference, optional variant reference, adjustment amount, adjustment type, optional notes/reference/sold month, idempotency/timestamp metadata, and user/org scope. When online returns, REEBS submits queued adjustments to the existing `/.netlify/functions/stock` endpoint and clears queue items only after confirmed success. UI notices show offline adjustment saved, pending sync, syncing, synced, needs review, and sync failed states.
Why it changed: Allow authenticated owners/admins/managers to preserve stock adjustments during unstable internet while preserving existing online inventory behavior and server-side stock validation.
Files changed: apps/reebs-portal/src/pages/Admin/offlineInventoryAdjustmentQueue.js, apps/reebs-portal/src/pages/Admin/offlineInventoryAdjustmentQueue.test.js, apps/reebs-portal/src/pages/Admin/Admin.jsx, apps/reebs-portal/src/pages/Admin/styles/AdminInventoryOverview.css, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Local queued adjustments only until sync.
Security impact: Server remains inventory source of truth. Queueing requires authenticated user/org context, does not mutate server inventory offline, does not alter booking reservations or stock deduction timing, and does not bypass auth, permissions, stock validation, rental restrictions, variant checks, idempotency preparation, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS inventory queue helper node tests, REEBS Portal Vite build, and documentation review. Manual checks documented for offline adjustment queueing, pending/syncing/synced/needs-review/sync-failed notices, and unchanged online stock adjustment behavior.
Rollback notes: Remove the REEBS inventory adjustment queue helper, offline branch, sync effects, queue notices, and helper tests, then return inventory adjustments to online-only behavior. Existing online stock adjustment behavior remains unchanged.
Next step: Offline booking queue foundation.

### Queued offline manual payments

Date: 2026-05-11
Feature/change name: Queued offline manual payments
Apps affected: REEBS Portal order manual payments
What changed: Order detail payment ledger and orders board payment action modal now queue offline manual payment submissions as `RECORD_PAYMENT` actions using `@faako/offline-sync`. Queued records include the order reference, amount, payment method, provider/reference/phone/notes, idempotency metadata, user/org scope, and pending status. When online returns, REEBS submits queued payments to the existing `orderPayments` endpoint and clears queue items only after confirmed success. UI notices show offline payment saved, pending sync, syncing, synced, needs review, and sync failed states.
Why it changed: Allow authenticated REEBS staff to preserve manual payment submissions during unstable internet while preserving existing online payment behavior and server-side payment/receipt/balance validation.
Files changed: apps/reebs-portal/src/pages/Orders/offlineManualPaymentQueue.js, apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx, apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx, packages/offline-sync/README.md, README.md, apps/reebs-portal/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Local queued data only until server sync.
Security impact: Server remains source of truth. Queueing requires authenticated user/org context, does not create final receipt numbers offline, does not update balances offline, does not trigger accounting effects offline, and does not bypass auth, permissions, payment validation, receipt creation, stock handling, idempotency preparation, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS Store Mode utility tests, REEBS Portal Vite build, package export import check, and documentation review. Manual checks documented for offline payment queueing, pending/syncing/synced/needs-review/sync-failed notices, and unchanged online manual payment recording.
Rollback notes: Remove the REEBS manual payment queue helper, offline branches, sync effects, and queue notices from order payment forms, then return manual payments to draft-only offline behavior. Existing online payment recording remains unchanged.
Next step: Offline inventory adjustment queue.

### Queued offline POS orders

Date: 2026-05-11
Feature/change name: Queued offline POS orders
Apps affected: REEBS Portal Store Mode/POS
What changed: Store Mode now queues offline POS sales as `CREATE_POS_ORDER` actions using `@faako/offline-sync`. Offline queue records include the order payload, minimal customer draft, idempotency key, user/org scope, and pending status. When online returns, Store Mode resolves the customer through the existing customer endpoint and submits the queued order to the existing order endpoint. The UI now shows offline sale saved, pending sync, syncing, synced, and needs review states.
Why it changed: Allow authenticated staff to save POS sales during unstable internet while preserving existing online POS behavior and server-side validation.
Files changed: apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx, apps/reebs-portal/src/pages/StoreMode/components/StoreModeLayout.jsx, apps/reebs-portal/README.md, packages/offline-sync/README.md, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Local queued data only until server sync.
Security impact: Server remains source of truth. Queueing requires authenticated user/org context, does not create final receipt numbers offline, does not permanently deduct stock offline, and does not bypass auth, permissions, stock validation, payment validation, receipt creation, idempotency, or organization isolation.
Testing done: `@faako/offline-sync` node tests, REEBS Store Mode utility tests, REEBS Portal Vite build, package export import check, and documentation review. Manual checks documented for offline sale queueing, pending/syncing/synced/needs-review notices, and unchanged online POS submission.
Rollback notes: Remove Store Mode queue creation/sync wiring and queue notices, then return offline POS behavior to local drafts only. Existing online POS sale creation remains unchanged.
Next step: Queued offline manual payments.

### Offline POS/payment drafts

Date: 2026-05-10
Feature/change name: Offline POS/payment drafts
Apps affected: REEBS Portal
What changed: Added draft-only local persistence for Store Mode POS and manual order payment forms. Store Mode now restores cart lines, selected customer draft data, customer contact, payment method/reference, discount, and cash received after refresh, shows local draft/online/offline notices, and clears the draft after successful online sale. Order detail and orders board payment forms now save unsent payment fields locally, restore drafts, show pending/draft notices, and clear after successful online payment recording or cancellation.
Why it changed: Help authenticated REEBS users avoid losing work-in-progress POS/payment input during unstable internet while keeping final payment/order recording server-owned.
Files changed: packages/offline-sync/src/storage/localDraftStorage.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/types/draftTypes.js, packages/offline-sync/src/types/index.js, packages/offline-sync/test/offlineSync.test.mjs, packages/offline-sync/README.md, apps/reebs-portal/src/pages/StoreMode/storeModeShared.js, apps/reebs-portal/src/pages/StoreMode/StoreMode.jsx, apps/reebs-portal/src/pages/StoreMode/components/StoreModeLayout.jsx, apps/reebs-portal/src/pages/StoreMode/StoreMode.css, apps/reebs-portal/src/pages/Orders/OrderDetail.jsx, apps/reebs-portal/src/pages/Orders/components/PaymentLedger.jsx, apps/reebs-portal/src/pages/OrdersList/OrdersList.jsx, apps/reebs-portal/README.md, README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: No server data changes.
Security impact: Local draft storage only. Draft keys are scoped by app, organization, user, and order where possible; backend auth, permissions, server validation, receipt creation, POS order creation, payment persistence, stock handling, APIs, and schema remain unchanged.
Testing done: `@faako/offline-sync` node tests, REEBS Store Mode utility tests, REEBS Portal Vite build, and documentation review. Manual checks documented for draft restore/clear and unchanged online submit flows.
Rollback notes: Remove the POS/payment draft helpers and notices, remove shared local draft helpers if not needed, and remove documentation references. Existing online sale/payment paths remain intact.
Next step: Queued offline POS order creation.

### Offline Foundation Wave

Date: 2026-05-10
Feature/change name: Offline Foundation Wave
Apps affected: REEBS Portal shell/status presentation
What changed: Added shared `@faako/offline-sync` infrastructure and wired a passive online/offline indicator into the REEBS admin shell status slot.
Why it changed: Prepare future offline-safe ERP workflows while keeping REEBS POS, payments, orders, bookings, inventory, delivery, receipts, auth, permissions, APIs, and persistence unchanged.
Files changed: packages/offline-sync/package.json, packages/offline-sync/README.md, packages/offline-sync/src/index.js, packages/offline-sync/src/constants/syncStates.js, packages/offline-sync/src/constants/queueActionTypes.js, packages/offline-sync/src/constants/conflictStatuses.js, packages/offline-sync/src/constants/storageConstants.js, packages/offline-sync/src/constants/index.js, packages/offline-sync/src/types/offlineQueueTypes.js, packages/offline-sync/src/types/syncMetadataTypes.js, packages/offline-sync/src/types/index.js, packages/offline-sync/src/storage/indexedDb.js, packages/offline-sync/src/storage/queueStorage.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/retry/retryMetadata.js, packages/offline-sync/src/status/onlineStatus.js, packages/offline-sync/src/status/syncStatus.js, packages/offline-sync/src/status/index.js, packages/offline-sync/src/hooks/useOnlineStatus.js, packages/offline-sync/src/hooks/useSyncStatus.js, packages/offline-sync/src/hooks/index.js, packages/offline-sync/src/components/OfflineStatusBadge.js, packages/offline-sync/src/components/PendingSyncBadge.js, packages/offline-sync/src/components/SyncStatusBanner.js, packages/offline-sync/src/components/index.js, packages/offline-sync/test/offlineSync.test.mjs, apps/reebs-portal/package.json, apps/reebs-portal/src/App.jsx, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, README.md, pnpm-lock.yaml
Data impact: None.
Security impact: Offline infrastructure only, no unsynced production writes yet. REEBS auth, permissions, organization isolation, backend validation, API behavior, database schema, and production workflows remain unchanged.
Testing done: `@faako/offline-sync` node tests, package export import checks, REEBS Portal Vite build, and documentation review. Manual checks documented for the online/offline indicator and unchanged submit flows.
Rollback notes: Remove the REEBS offline indicator import/usage, remove the app dependency on `@faako/offline-sync`, remove the shared package if needed, and remove related documentation references. REEBS business workflows remain unaffected.
Next step: Offline POS/payment draft integration.

### Shared Finance Foundation Wave

Date: 2026-05-10
Feature/change name: Shared Finance Foundation Wave
Apps affected: REEBS Portal display layer
What changed: Expanded `@faako/finance` with shared pure finance helpers and adopted shared currency/payment-label helpers in REEBS order UI display utilities only.
Why it changed: Standardize finance terminology and presentation before any future shared payment or receipt service work while preserving live REEBS order, payment, receipt, invoice, POS, stock, and balance behavior.
Files changed: packages/finance/package.json, packages/finance/README.md, packages/finance/src/index.js, packages/finance/src/constants/paymentMethods.js, packages/finance/src/helpers/currency.js, packages/finance/src/helpers/normalization.js, packages/finance/src/helpers/balances.js, packages/finance/src/helpers/metadata.js, packages/finance/src/helpers/index.js, packages/finance/src/receipts/formatters.js, packages/finance/src/receipts/index.js, packages/finance/test/financeHelpers.test.mjs, apps/reebs-portal/package.json, apps/reebs-portal/src/pages/Orders/orderUi.js, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, README.md, pnpm-lock.yaml
Data impact: None.
Security impact: Standardizes finance terminology and presentation only. No REEBS auth, permissions, payment persistence, receipt creation, invoice persistence, order balance calculations, API behavior, database schema, routes, stock/payment timing, or production workflows changed.
Testing done: `@faako/finance` node tests, package export import checks, REEBS Portal Vite build, and documentation review. Manual display checks documented for REEBS order currency display and payment method labels.
Rollback notes: Revert the REEBS order UI display-helper import, remove the app dependency on `@faako/finance`, remove the shared package helper additions if needed, and restore local display formatting. Live REEBS payment/receipt workflows are unaffected.
Next step: Offline Foundation Wave.

### REEBS shared finance constants types foundation noted

Date: 2026-05-10
Feature/change name: REEBS shared finance constants types foundation noted
Apps affected: REEBS Portal documentation only
What changed: Added the shared `@faako/finance` constants/types foundation and documented REEBS as an affected future consumer. The package defines shared payment methods, payment statuses, receipt statuses, finance statuses, and documented payment/receipt/transaction metadata shapes, but REEBS runtime code does not import it yet.
Why it changed: Prepare a safe shared terminology layer before any future REEBS payment, receipt, invoice, POS, order, booking, rental, stock, or balance adapter work.
Files changed: packages/finance/package.json, packages/finance/src/index.js, packages/finance/src/constants/paymentMethods.js, packages/finance/src/constants/paymentStatuses.js, packages/finance/src/constants/receiptStatuses.js, packages/finance/src/constants/financeStatuses.js, packages/finance/src/constants/index.js, packages/finance/src/types/paymentTypes.js, packages/finance/src/types/receiptTypes.js, packages/finance/src/types/transactionTypes.js, packages/finance/src/types/index.js, packages/finance/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, README.md, pnpm-lock.yaml
Data impact: None.
Security impact: Standardizes finance terminology and future integration safety. No REEBS auth, permissions, payment calculations, receipt generation, invoice behavior, POS/order behavior, stock behavior, APIs, database schema, routes, or workflows changed.
Testing done: Package export import check and documentation review.
Rollback notes: Remove `packages/finance` and related documentation references. REEBS will continue using current app-owned constants and payment/receipt behavior.
Next step: Shared finance helper utilities.

### REEBS shared payment receipt architecture plan added

Date: 2026-05-10
Feature/change name: REEBS shared payment receipt architecture plan added
Apps affected: REEBS Portal
What changed: Added REEBS Portal to the shared Payment and Receipt architecture plan as a production-sensitive ERP app with POS payments, manual order payments, order receipts, booking-linked orders, rentals/party-item workflows, delivery/setup touchpoints, stock side effects, invoice documents, and receipt source-of-truth risks.
Why it changed: REEBS payment, receipt, invoice, order, POS, stock, booking, and balance workflows need a safe shared-architecture plan before any shared payment/receipt constants, types, wrappers, packages, gateways, or migrations are introduced.
Files changed: docs/platform/shared-payment-receipt-architecture.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, README.md
Data impact: Documentation-only.
Security impact: Creates safety plan for future shared payment/receipt services. No auth, permissions, payment logic, receipt generation, invoice behavior, POS/order behavior, inventory behavior, APIs, database schema, routes, or runtime behavior changed.
Testing done: Documentation review against the REEBS order/payment/receipt workflow review.
Rollback notes: Remove the shared architecture plan and related REEBS progress-log, implementation-note, and README references if this planning baseline needs to be withdrawn.
Next step: Implement shared payment/receipt constants and types only.

### REEBS order payment receipt workflow review added

Date: 2026-05-10
Feature/change name: REEBS order payment receipt workflow review added
Apps affected: REEBS Portal
What changed: Added a documentation-only review that maps REEBS order origins, POS flow, booking-linked order support, invoice-linked document paths, payment recording, receipt generation, balance calculations, shared dependencies, high-risk areas, security considerations, future platform extraction opportunities, package extraction order, rollback considerations, and manual testing.
Why it changed: REEBS payment, receipt, invoice, order, POS, stock, and balance workflows are production-sensitive. They need a documented source-of-truth map before any shared payment/receipt/finance/order foundation is introduced.
Files changed: docs/apps/reebs-portal/order-payment-receipt-workflow-review.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, apps/reebs-portal/README.md
Data impact: Documentation-only.
Security impact: Improves finance/payment workflow understanding. No auth, permission, payment, receipt, invoice, order, POS, inventory, API, database, route, or runtime behavior changed.
Testing done: Documentation review against current REEBS order, payment, receipt, invoice document, POS, and booking-link code paths.
Rollback notes: Remove the workflow review file and related README/progress-log/implementation-note references if this review baseline needs to be withdrawn.
Next step: Shared payment/receipt architecture foundation.

### REEBS Finance navigation grouped

Date: 2026-05-10
Feature/change name: REEBS Finance navigation grouped
What changed: Grouped `/admin/accounting`, `/admin/expenses`, and `/admin/invoicing` under the Finance module in REEBS navigation metadata while preserving each existing route and workflow.
Why it changed: Implement the lowest-risk Finance consolidation step from the plan without changing payment logic, receipt generation, invoice generation, POS logic, order balance calculations, permissions, backend APIs, database schema, or route behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/finance-consolidation-plan.md
Data impact: None.
Security impact: No permission or payment logic changes. Navigation grouping only; existing route guards and backend permission behavior remain unchanged.
Testing done: Registry ownership check confirmed Finance owns accounting, expenses, and invoicing routes without duplicate sidebar items; REEBS Portal Vite build.
Rollback notes: Restore Finance as hidden from navigation and restore Accounting, Expenses, and Invoicing child sidebar visibility.
Next step: Orders/Payments/Receipts shared workflow review.

### REEBS Finance consolidation plan added

Date: 2026-05-10
Feature/change name: REEBS Finance consolidation plan added
What changed: Added a planning-only Finance consolidation plan for REEBS Portal covering current finance routes, payment/receipt/invoice/accounting workflow mapping, target Finance structure, high-risk areas, data dependencies, security considerations, implementation order, rollback strategy, manual testing, and future shared platform opportunities.
Why it changed: Finance/payment workflows are production-sensitive. REEBS needs a safe plan before any grouping implementation touches finance navigation, payment recording, receipt generation, invoices, order/POS workflows, accounting, reports, or data dependencies.
Files changed: docs/apps/reebs-portal/finance-consolidation-plan.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, apps/reebs-portal/README.md
Data impact: None. Planning-only documentation.
Security impact: Planning for safer finance workflows. No auth, permission, payment, receipt, invoice, accounting, database, route, or runtime behavior changed.
Testing done: Documentation review against current REEBS finance routes, Prisma models, Netlify Functions, and registry metadata.
Rollback notes: Remove the Finance consolidation plan and related README/progress-log/implementation-note entries if the planning baseline needs to be withdrawn.
Next step: Low-risk Finance grouping implementation.

### REEBS Bookings navigation consolidated

Date: 2026-05-10
Feature/change name: REEBS Bookings navigation consolidated
What changed: Grouped `/admin/bookings`, `/admin/rentals`, and `/admin/schedule` under the Bookings module in REEBS navigation metadata while preserving each existing route and workflow.
Why it changed: Continue the low-risk module consolidation plan by treating booking, rental, and scheduling surfaces as Bookings-owned without changing booking creation/editing logic, inventory stock deduction/reservation logic, payment recording, receipt generation, route behavior, auth, or permissions.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Navigation grouping only; existing route guards and backend permission behavior remain unchanged.
Testing done: Registry ownership check confirmed Bookings owns rentals and schedule routes without duplicate sidebar items; REEBS Portal Vite build.
Rollback notes: Restore Rentals as an Inventory child, restore Schedule as a visible Bookings child, and remove `/admin/rentals` from Bookings match paths.
Next step: Finance consolidation planning.

### REEBS Settings navigation consolidated

Date: 2026-05-10
Feature/change name: REEBS Settings navigation consolidated
What changed: Grouped `/admin/settings`, `/admin/advanced`, `/admin/website-template`, `/admin/inventory/products`, and `/admin/inventory/templates` under the Settings module in REEBS navigation metadata while preserving each existing route and existing advanced/website-template redirect targets.
Why it changed: Continue the low-risk module consolidation plan by treating settings, template, advanced, and inventory admin configuration surfaces as Settings-owned without changing inventory stock logic or business workflows.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Navigation grouping only; existing route guards and backend permission behavior remain unchanged.
Testing done: Registry ownership check confirmed Settings owns the grouped config routes without duplicate sidebar items; REEBS Portal Vite build.
Rollback notes: Restore inventory product/template route matching to Inventory and remove the hidden Settings child metadata for advanced, website template, inventory products, and inventory templates.
Next step: Bookings/Rentals consolidation planning or Finance consolidation planning.

### REEBS Team navigation consolidated

Date: 2026-05-10
Feature/change name: REEBS Team navigation consolidated
What changed: Grouped `/admin/users`, `/admin/employees`, `/admin/directory`, `/admin/hr`, `/admin/roles`, and `/admin/timesheets` under the visible Team module in REEBS Portal navigation while preserving each existing route.
Why it changed: Implement the lowest-risk consolidation from the module consolidation plan and reduce duplicate staff/user/team navigation entries.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md, docs/apps/reebs-portal/module-consolidation-plan.md
Data impact: None.
Security impact: No permission changes. Navigation grouping only; existing route guards and backend permission behavior remain unchanged.
Testing done: Registry visibility check confirmed Team is visible and old team child sidebar items are not duplicated; REEBS Portal Vite build.
Rollback notes: Restore the previous child sidebar visibility for Directory, HR, Users/Roles, and Timesheets, and hide the Team parent from navigation again.
Next step: Settings consolidation or Bookings consolidation planning.

### REEBS module consolidation plan added

Date: 2026-05-10
Feature/change name: REEBS module consolidation plan added
What changed: Added a planning-only module consolidation plan for REEBS Portal covering current routes, target module structure, top-level modules, grouped modules, legacy routes, risks, data/security impact, implementation order, rollback notes, and manual testing.
Why it changed: Create a safe implementation guide before consolidating overlapping REEBS modules such as Finance, Bookings, Team, Customers, and Settings.
Files changed: docs/apps/reebs-portal/module-consolidation-plan.md, docs/apps/reebs-portal/progress-log.md, apps/reebs-portal/README.md
Data impact: None. Planning-only documentation.
Security impact: None. Planning-only documentation; future implementation must preserve route guards, role behavior, and backend permission enforcement.
Testing done: Documentation review against current REEBS registry and route declarations.
Rollback notes: Remove the REEBS module consolidation plan and related README/progress-log entries if the planning baseline needs to be withdrawn.
Next step: App-specific module consolidation.

### REEBS shared shell wrapper foundation added

Date: 2026-05-10
Feature/change name: REEBS shared shell wrapper foundation added
What changed: Added shared ERP page-content and status-badge wrappers to the REEBS admin shell and navigation while keeping the REEBS sidebar, bottom navigation, routes, pages, auth, notifications, and workflows app-owned.
Why it changed: Align REEBS Portal with the shared ERP shell/layout foundation without redesigning business pages or changing production workflows.
Files changed: apps/reebs-portal/src/App.jsx, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.jsx, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Structural UI standardization only. No auth, route, permission, API, database, or data access behavior changed.
Testing done: Documentation review and REEBS shell/build checks.
Rollback notes: Revert the REEBS wrapper imports/usages and documentation updates; keep all route and page files in place.
Next step: App-specific module consolidation.

### REEBS module visibility and state layer added

Date: 2026-05-10
Feature/change name: REEBS module visibility and state layer added
What changed: Added default module visibility/state metadata to the REEBS admin registry and updated sidebar and bottom navigation adapters/components to ignore hidden modules, carry enabled/state/visibility metadata, and render subtle disabled, internal, coming-soon, and experimental badges/classes when present.
Why it changed: Prepare the live/private-beta REEBS Portal for future hidden modules, disabled modules, internal-only modules, experimental modules, org-level toggles, permissions integration, and SaaS plan/module gating without changing current routes or access behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.css, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.jsx, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.css, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Prepares future controlled feature exposure. No access control enforcement changed.
Testing done: Documentation review, registry helper checks, and REEBS navigation/build checks.
Rollback notes: Revert the REEBS registry state defaults, adapter metadata, badge/disabled UI additions, and documentation updates; keep existing route files untouched.
Next step: App-specific module consolidation.

### REEBS navigation wired to admin module registry

Date: 2026-05-10
Feature/change name: REEBS navigation wired to admin module registry
What changed: Wired REEBS Portal sidebar and bottom navigation to registry-backed adapter helpers while preserving current labels, links, role filtering, driver/water behavior, and legacy route targets.
Why it changed: Move REEBS navigation toward the shared ERP registry model without consolidating modules or changing production route/access behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/src/config/adminNavigation.js, apps/reebs-portal/src/components/PortalSidebar/PortalSidebar.jsx, apps/reebs-portal/src/components/AdminBottomNav/AdminBottomNav.jsx, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Navigation preparation only, no access control enforcement yet.
Testing done: Registry helper import checks, visible module/dedupe checks, legacy route target checks, navigation adapter review, and Vite build to `/private/tmp/reebs-portal-registry-build`.
Rollback notes: Restore the previous static `DEFAULT_APPS`, bottom-nav arrays, and component imports; keep all existing routes untouched.
Next step: Module visibility and enable/disable preparation.

### REEBS admin module registry foundation added

Date: 2026-05-10
Feature/change name: REEBS admin module registry foundation added
What changed: Added a metadata-only REEBS admin module registry for home, POS, orders, bookings, inventory, customers, delivery, finance, reports, team, and settings.
Why it changed: Create the foundation for a consistent ERP module registry without changing current navigation, route guards, permissions, or app behavior.
Files changed: apps/reebs-portal/src/config/adminModules.js, apps/reebs-portal/README.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None. Registry-only foundation.
Security impact: None. No auth, API permissions, or data access changed.
Testing done: Registry helper import and lookup checks.
Rollback notes: Remove the REEBS registry file and related documentation if the foundation needs to be reverted.
Next step: Wire the registry into navigation only after a separate review of live/private-beta behavior, permissions, and route coverage.

### Documentation foundation added

Date: 2026-05-10
Feature/change name: Documentation foundation added
What changed: Added the standard app documentation set for progress tracking, system status, deploy readiness, and implementation notes.
Why it changed: Establish a consistent documentation baseline for REEBS Portal as part of the Faako monorepo platform.
Files changed: docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/system-status.md, docs/apps/reebs-portal/pre-deploy-checklist.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None. Documentation-only change.
Security impact: None. No auth, permission, secret, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added REEBS Portal documentation files if this documentation foundation needs to be reverted.
Next step: Keep this log updated for each REEBS Portal change that affects users, data, deployment, or operations.
