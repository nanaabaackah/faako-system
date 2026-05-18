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

### Production verification and monitoring stabilization

Date: 2026-05-17
Feature/change name: Production verification and monitoring stabilization
Apps affected: Dev ERP
What changed: Dev ERP monitoring now reads monitored app metadata from `@faako/config` instead of a local hardcoded `SITE_PAGES` array. The monitoring list covers REEBS Portal, Dev ERP, Stroane Web, Faako Website, Faako API, REEBS Website, the portfolio site, and Faako ERP while preserving existing legacy dashboard ids for `nana`, `reebs`, and `faako`. Shared app-mode helpers and generic maintenance/read-only/degraded UI wrappers were added at the platform level for future opt-in use, but Dev ERP runtime maintenance behavior was not wired or enforced in this phase. Dev ERP lint, type check, and production build were re-run during the stabilization sprint.
Why it changed: Keep Dev ERP monitoring aligned with the current monorepo app set without fragile local duplication, and verify the fully live system before more feature work.
Files changed: apps/dev-erp/backend/server.js, apps/dev-erp/README.md, packages/config/src/appModes/appModes.js, packages/config/src/monorepoApps/appRegistry.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, packages/ui/src/components/ERPNotifications.tsx, packages/ui/src/ui.css, packages/ui/README.md, docs/platform/codex-handoff-verification.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Read-only monitoring metadata plus presentation/config-only maintenance foundations. No auth, permissions, operational records, rent/payment records, reports, email workflows, AI/productivity endpoints, or schema behavior changed.
Testing done: Dev ERP config import check returned 8 monitored entries. `pnpm --filter @faako/dev-erp run lint` passed. `pnpm --filter @faako/dev-erp exec tsc --noEmit` passed. `pnpm --filter @faako/dev-erp run build` passed.
Rollback notes: Revert Dev ERP `backend/server.js` to the previous local `SITE_PAGES` array and remove the shared app registry export. No data rollback required.
Next step: Route-level visual QA for System Health, Dashboard site monitoring, Settings Sync Review, and activity feed.

### Theme and styling consistency fix

Date: 2026-05-13
Feature/change name: Theme and styling consistency fix
Apps affected: Dev ERP Settings
What changed: Dev ERP Settings now wraps `<SyncReviewPanel>` and `<ERPActivityFeed>` in a single `<StackGroup>` from `@faako/ui` instead of using two inline `style={{ marginTop: "1rem" }}` overrides. The existing Dev ERP `.stack { display: grid; gap: 1rem }` rule and the outer `.page { gap: 1.2rem }` rule together provide the same vertical rhythm without inline styles, satisfying the "remove inline styles where they duplicate theme concerns" rule. Dev ERP visual appearance is unchanged. The shared `ERPActivityFeed` component was also fixed at the package level: `.ui-erp-activity-detail` is now tone-aware (default muted; red only when the item's tone is `error`; warning when `warning`) instead of always rendering detail text in danger color; and the component now accepts optional `className`/`style` props so Dev ERP and any future consumer can apply app-specific theming or spacing without forking. No Dev ERP business logic, auth, alert settings, rent/payment records, invoices, reports, email workflows, offline sync behavior, or database schema changed.
Why it changed: Align newly-added components with Dev ERP's existing theme conventions and remove inline-style duplication.
Files changed: packages/ui/src/components/ERPActivityFeed.tsx, packages/ui/src/ui.css, apps/dev-erp/src/pages/Settings/Settings.jsx, packages/ui/README.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md
Data impact: None.
Security impact: UI-only styling consistency. No auth, permissions, API behavior, rent/payment records, invoices, reports, email workflows, AI/productivity endpoints, offline queue processing, database schema, or data access behavior changed.
Testing done: `pnpm --filter @faako/dev-erp run lint` — clean. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` — clean.
Rollback notes: Restore the two inline `marginTop: "1rem"` styles and remove the `<StackGroup>` wrapper if any visual regression appears.
Next step: Continue module enable/disable persistence planning; consider migrating `@faako/offline-sync` `SyncReviewPanel` inline JS styles to shared CSS classes after separate manual review.

### Organization settings and tenant foundation

Date: 2026-05-13
Feature/change name: Organization settings and tenant foundation
Apps affected: Dev ERP (shared platform foundation only — no Dev ERP app code changed)
What changed: The new shared `@faako/org-settings` package is available. It provides `normalizeOrganizationSettings`, `getOrganizationDisplayName`, `getOrganizationCurrency`, `getOrganizationCurrencySymbol`, `getOrganizationTimezone`, `getOrganizationBranding`, `getOrganizationContactInfo`, `stripSensitiveOrgSettings`, currency constants (GHS default), timezone constants (Africa/Accra default), and `ORG_SETTINGS_FIELDS`. No Dev ERP app code, backend routes, auth behavior, alert settings, rent/payment records, invoices, reports, email workflows, offline queue behavior, or database schema changed. Future Dev ERP adoption starting points: display businessName/currency/timezone in a new org section of the Settings page after a safe /api/org/settings endpoint exists; use getOrganizationCurrencySymbol in Rent/Invoicing display helpers after currency is persisted per org.
Why it changed: Establish a shared org configuration foundation for future per-org branding and settings display without touching live workflows.
Files changed: packages/org-settings/* (new), packages/notifications/src/index.js, packages/finance/src/index.js, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Additive foundation only. No data changes.
Security impact: Foundation only. stripSensitiveOrgSettings blocks credentials from leaking. No app behavior changed.
Testing done: 44/44 tests pass in @faako/org-settings. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`.
Rollback notes: Remove packages/org-settings and revert TODO updates. No data rollback required.
Next step: Design /api/org/settings read endpoint (scoped by authenticated session organizationId); add org display section to Dev ERP Settings after endpoint is available.

### Admin operational activity feed

Date: 2026-05-13
Feature/change name: Admin operational activity feed
Apps affected: Dev ERP Settings
What changed: Dev ERP Settings now renders `ERPActivityFeed` from `@faako/ui` below the `SyncReviewPanel`. The feed shows up to 5 recent offline sync queue events derived from the existing `useSyncQueueSummary` data already loaded on the page. No new API calls are made. Items display: action label (`getQueueActionLabel`), queue status formatted as a human-readable badge, tone mapped from queue status (SYNCED→success, FAILED/NEEDS_REVIEW→error, CONFLICT→warning, CANCELLED/RESOLVED→neutral, others→info), first 120 characters of last error if present, and item timestamp. Customer data, payment details, tokens, and secrets are not surfaced. The feed is hidden when there are no items and the queue is not loading. Existing Sync Review Panel behavior, alert preference state, save/test handlers, API calls, auth/session handling, SMS availability checks, and offline sync logic are unchanged.
Why it changed: Give Dev ERP admins a quick glance at recent sync activity without leaving the Settings page, using data already loaded locally. Proves the shared ERPActivityFeed component in a low-risk settings surface before considering dashboard or workflow-heavy surfaces.
Files changed: packages/ui/src/components/ERPActivityFeed.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Presentational only. Reads existing IndexedDB queue data already loaded by `useSyncQueueSummary`. No new reads, writes, or API calls.
Security impact: No tokens, secrets, passwords, payment details, customer data, or stack traces surfaced. Error strings capped at 120 characters. Queue status and action labels only.
Testing done: `pnpm --filter @faako/dev-erp run lint` — clean. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`.
Rollback notes: Remove the `syncActivityItems` useMemo and `<ERPActivityFeed>` render block from Settings.jsx. Remove the `ERPActivityFeed` import from the @faako/ui import. No data rollback required.
Next step: Dev ERP Dashboard activity feed adoption (pending manual review of existing timeline).

### Audit logging and operational visibility foundation

Date: 2026-05-13
Feature/change name: Audit logging and operational visibility foundation
Apps affected: Dev ERP (shared platform foundation only — no Dev ERP app code changed)
What changed: The new shared `@faako/audit` package is available. It provides audit event constants, safe actor/org reference helpers, sensitive metadata stripping, event normalization (createAuditEvent, createSyncAuditEvent, createSettingsAuditEvent), and display formatting helpers. No Dev ERP app code, backend routes, auth behavior, rent/payment records, invoices, reports, email workflows, offline queue behavior, or database schema changed. Future Dev ERP audit adoption starting points: createSyncAuditEvent for rent payment queue sync outcomes, createSettingsAuditEvent for settings saves, and AUDIT_ACTION_TYPES for future server-side audit log writes.
Why it changed: Establish a shared audit foundation for future operational visibility without touching live workflows.
Files changed: packages/audit/* (new), packages/offline-sync/src/index.js, packages/finance/src/index.js, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: Additive foundation only. No data changes.
Security impact: Foundation only. No automated logging or transmission. Sensitive metadata is stripped by design.
Testing done: 26/26 tests pass in @faako/audit. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`.
Rollback notes: Remove packages/audit and revert TODO updates. No data rollback required.
Next step: Admin operational activity feed.

### Mobile-first responsive polish wave

Date: 2026-05-12
Feature/change name: Mobile-first responsive polish wave
Apps affected: Dev ERP (shared shell and shared UI packages only)
What changed: CSS-only improvements to the shared ERP shell and shared UI components used by Dev ERP. No Dev ERP app code, backend routes, auth, operational records, rent/payment records, invoices, reports, email workflows, or database behavior changed. Shared improvements: `dvh` viewport height with `vh` fallbacks on shell frame and sidebar panel; bottom nav safe-area positioning for notched phones; bottom nav button touch targets (min-height 2.75rem) and `touch-action: manipulation`; bottom nav keyboard focus-visible outline; sidebar nav `overscroll-behavior: contain`; modal/drawer `dvh` max-height with `vh` fallbacks; dialog body `overscroll-behavior: contain`; dialog close button touch target; and `ui-erp-field__control font-size: 1rem` for iOS auto-zoom prevention.
Why it changed: Polish mobile usability and viewport accuracy for the shared shell and UI layer used by Dev ERP without changing any app, workflow, or backend behavior.
Files changed: packages/theme/src/erp-shell.css, packages/ui/src/ui.css, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/reebs-portal/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: CSS-only changes. No auth, permissions, API behavior, workflow logic, database schema, or data access behavior changed.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; visual review of changed CSS selectors; `git diff --check`.
Rollback notes: Revert erp-shell.css and ui.css. No data rollback required.
Next step: Audit logging and operational visibility foundation.

### Shared in-app notification and alert UI

Date: 2026-05-12
Feature/change name: Shared in-app notification and alert UI
Apps affected: Dev ERP Settings
What changed: Dev ERP Settings now uses `ERPNotice` from `@faako/ui` for two static informational notices: the SMS availability notice (tone "info") and the storage mode notice (tone "success" or "warning" based on storageMode). The dynamic save/load status notice (`status.message`) was left unchanged because it can carry auth-related error text and is marked pending manual review. All other Settings behavior — alert preferences state, save/test handlers, API calls, auth/session handling, SMS availability checks, and Sync Review — is unchanged.
Why it changed: Prove the shared ERP notice foundation in a low-risk static settings surface before considering workflow-heavy or auth-adjacent notice areas.
Files changed: packages/ui/src/components/ERPNotifications.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. Auth, permissions, alert preferences API behavior, save/test handlers, SMS availability, Sync Review, rent/payment records, invoices, reports, email workflows, and production workflows are unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on changed files; trailing-whitespace scan.
Rollback notes: Revert the Dev ERP Settings ERPNotice adoption to restore the previous inline `.notice` div markup. No data rollback is required.
Next step: Mobile-first responsive polish wave.

### Shared modal and action foundation

Date: 2026-05-12
Feature/change name: Shared modal and action foundation
Apps affected: Dev ERP Settings
What changed: Dev ERP Settings now uses the shared `ERPActionBar`, `ERPPrimaryAction`, and `ERPSecondaryAction` presentation wrappers for alert preference action buttons. The page still owns alert preference state, save/test handlers, loading flags, API calls, auth/session handling, SMS availability checks, and local Sync Review behavior.
Why it changed: Prove the shared ERP action foundation in a low-risk settings surface before considering workflow-heavy modals or actions such as invoices, rent payments, user access changes, appointment settings, reports, or AI/productivity actions.
Files changed: packages/ui/src/components/ERPActions.tsx, packages/ui/src/components/ERPModal.tsx, packages/ui/src/components/Primitives.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, apps/dev-erp/README.md, apps/reebs-portal/README.md, README.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. Auth, permissions, alert preferences API behavior, rent/payment records, invoices, reports, email workflows, AI/productivity endpoints, offline queue processing, database schema, modal state ownership, save/delete/submit behavior, and production workflows are unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP Settings, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the Dev ERP Settings action wrapper adoption and shared modal/action component additions. No data rollback is required.
Next step: Shared notification/in-app alert UI.

### Shared ERP form foundation

Date: 2026-05-12
Feature/change name: Shared ERP form foundation
Apps affected: Dev ERP Settings
What changed: Dev ERP Settings now uses the shared `ERPFieldGroup` presentation wrapper for alert subscription fields. Action button wrappers are covered by the later modal/action foundation entry. The page still owns alert preference state, save/test handlers, API calls, auth/session handling, SMS availability checks, and local Sync Review behavior.
Why it changed: Prove the shared ERP form foundation in a low-risk settings surface before considering workflow-heavy forms such as rent payments, invoices, user access changes, appointment settings, reports, or AI/productivity actions.
Files changed: packages/ui/src/components/ERPForm.tsx, packages/ui/src/components/Primitives.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, apps/dev-erp/README.md, apps/reebs-portal/README.md, README.md, docs/platform/platform-status.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. Auth, permissions, alert preferences API behavior, rent/payment records, invoices, reports, email workflows, AI/productivity endpoints, offline queue processing, database schema, validation rules, and production workflows are unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP Settings, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the Dev ERP Settings `ERPFieldGroup` adoption and shared form component additions. No data rollback is required.
Next step: Shared modal/action foundation.

### Shared ERP table foundation

Date: 2026-05-12
Feature/change name: Shared ERP table foundation
Apps affected: Dev ERP System Health
What changed: Dev ERP System Health now uses the shared `ERPTable` and `ERPStatusBadge` presentation components for the read-only service status table. The page still owns health data loading, refresh behavior, incident notes, status mapping, and all API behavior.
Why it changed: Prove the shared ERP table foundation in a low-risk display-heavy area before considering workflow-heavy tables such as Rent, Invoicing, Reports, User Control, or payment-adjacent views.
Files changed: packages/ui/src/components/ERPTable.tsx, packages/ui/src/index.ts, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/SystemHealth/SystemHealth.jsx, apps/dev-erp/README.md, README.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only shared UI. Auth, permissions, system health API behavior, incident note local storage behavior, reports, rent/payment records, invoices, email workflows, AI/productivity endpoints, database schema, and production workflows are unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP System Health, README, and documentation files; trailing-whitespace scan on the same files.
Rollback notes: Revert the System Health `ERPTable`/`ERPStatusBadge` adoption and shared table component additions. No data rollback is required.
Next step: Shared form foundation implementation.

### Shared UI system cleanup and extraction

Date: 2026-05-12
Feature/change name: Shared UI system cleanup and extraction
Apps affected: Dev ERP Settings
What changed: Dev ERP Settings now uses low-risk shared ERP panel, panel-header, stack, and form-group wrappers from `@faako/ui` for the alert settings presentation. The wrappers preserve existing `panel-grid`, `panel`, `panel-header`, `stack`, and `form-field` class names, so the rendered CSS hooks stay equivalent.
Why it changed: Reduce repeated presentation markup and prepare for a shared UI system while preserving Dev ERP's live alert settings, Sync Review behavior, routes, auth, API calls, and storage behavior.
Files changed: packages/ui/src/components/Primitives.tsx, packages/ui/src/components/Fields.tsx, packages/ui/src/ErpPageHeader.tsx, packages/ui/src/ErpShellFrame.tsx, packages/ui/src/ErpShellTopbar.tsx, packages/ui/src/ui.css, packages/ui/README.md, apps/dev-erp/src/pages/Settings/Settings.jsx, apps/dev-erp/README.md, README.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/reebs-portal/progress-log.md, docs/apps/reebs-portal/implementation-notes.md
Data impact: None.
Security impact: Presentation-only cleanup. Auth, permissions, alert preferences, offline queue review, rent/payment records, operational records, reports, email workflows, AI/productivity endpoints, APIs, database schema, and production workflows are unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`; `pnpm --filter @faako/dev-erp run build`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `git diff --check` on the changed shared UI, Dev ERP Settings, README, and documentation files.
Rollback notes: Revert the Dev ERP Settings wrapper imports/usages and shared UI wrapper additions. No data rollback is required.
Next step: Shared form/table system planning.

### Safe Cleanup Wave 1

Date: 2026-05-12
Feature/change name: Safe Cleanup Wave 1
Apps affected: Dev ERP
What changed: Removed an unused activity-log catch binding in Dashboard and stabilized the Settings Sync Review refresh callback reference used by retry/cancel/resolve controls. No rent, accounting, invoice, auth, report, booking, public route, or backend behavior changed.
Why it changed: Clear the low-risk Dev ERP lint issue found during the cleanup audit without touching production-sensitive workflows.
Files changed: apps/dev-erp/src/pages/Dashboard/Dashboard.jsx, apps/dev-erp/src/pages/Settings/Settings.jsx, docs/platform/codebase-cleanup-audit.md, docs/platform/platform-progress-log.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Low-risk cleanup only. Auth, permissions, rent/payment records, accounting, invoices, reports, email workflows, AI/productivity endpoints, APIs, database schema, and production workflows are unchanged.
Testing done: `pnpm --filter @faako/dev-erp run lint`.
Rollback notes: Revert the listed Dev ERP cleanup edits. No data rollback is required.
Next step: Shared UI system cleanup and extraction.

### Notification service foundation

Date: 2026-05-11
Feature/change name: Notification service foundation
Apps affected: Dev ERP Appointments email-link draft
What changed: Added `@faako/notifications` and wired the Appointments page's existing email-link action to use the shared customer-safe booking confirmation draft formatter. The action remains a user-triggered `mailto:` draft and does not send automated email.
Why it changed: Give Dev ERP a shared notification-text foundation before future automated reminders, appointment notifications, or email/WhatsApp/SMS work, while keeping live operational customer data privacy-safe.
Files changed: packages/notifications/package.json, packages/notifications/src/index.js, packages/notifications/src/constants/channels.js, packages/notifications/src/constants/types.js, packages/notifications/src/constants/statuses.js, packages/notifications/src/constants/index.js, packages/notifications/src/helpers/safeText.js, packages/notifications/src/helpers/channelAvailability.js, packages/notifications/src/helpers/index.js, packages/notifications/src/templates/customerMessages.js, packages/notifications/src/templates/index.js, packages/notifications/test/notifications.test.mjs, packages/notifications/README.md, apps/dev-erp/package.json, apps/dev-erp/src/pages/Bookings/Bookings.jsx, pnpm-lock.yaml, README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: None.
Security impact: Customer-safe message templates only. No automated email, WhatsApp, SMS, notification persistence, Resend behavior change, backend send behavior change, booking/calendar behavior change, rent/payment behavior change, auth change, permission change, or schema change.
Testing done: `pnpm --filter @faako/notifications run test`; `pnpm --filter @faako/dev-erp run build`; documentation review. Manual checks documented for appointment link email draft text and unchanged backend send/booking/calendar/rent behavior.
Rollback notes: Remove the Dev ERP Appointments notification import/mailto draft usage, remove the app dependency on `@faako/notifications`, remove the shared package if not used elsewhere, and remove related README/docs entries.
Next step: delivery/map helper foundation.

### Offline conflict review and sync reliability

Date: 2026-05-11
Feature/change name: Offline conflict review and sync reliability
Apps affected: Dev ERP Settings
What changed: Added the shared `SyncReviewPanel` to Dev ERP Settings and expanded `@faako/offline-sync` with queue summary, retry, cancel, mark-resolved, last-error, and conflict metadata helpers. The panel shows local Dev ERP queue counts and review cards for failed or needs-review queue records without exposing raw queue payloads.
Why it changed: Dev ERP is fully live with real operational data, so failed or conflicting offline rent payment queue records need visible recovery paths instead of being hidden inside browser-local storage.
Files changed: packages/offline-sync/src/constants/syncStates.js, packages/offline-sync/src/storage/queueStorage.js, packages/offline-sync/src/storage/queueActions.js, packages/offline-sync/src/storage/index.js, packages/offline-sync/src/status/queueSummary.js, packages/offline-sync/src/status/index.js, packages/offline-sync/src/hooks/useSyncQueueSummary.js, packages/offline-sync/src/hooks/useQueuedActionRetry.js, packages/offline-sync/src/hooks/useQueuedActionCancel.js, packages/offline-sync/src/hooks/index.js, packages/offline-sync/src/components/SyncConflictCard.js, packages/offline-sync/src/components/SyncReviewPanel.js, packages/offline-sync/src/components/index.js, packages/offline-sync/test/offlineSync.test.mjs, apps/dev-erp/src/pages/Settings/Settings.jsx, packages/offline-sync/README.md, README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: Local queued data only.
Security impact: Improves visibility and recovery for offline actions. Retry re-arms local queue items for existing sync paths; server validation, auth, permissions, rent/payment validation, organization scoping, reports, and final writes remain server-owned.
Testing done: `pnpm --filter @faako/offline-sync run test`; `pnpm --filter @faako/dev-erp run build`; documentation review. Manual checks documented for Settings Sync Review counts, retry, cancel, mark-resolved, scoped queue filtering, and unchanged online rent/settings workflows.
Rollback notes: Remove the Sync Review panel from Settings, remove shared review helpers/components if no longer needed, and revert related README/docs/test updates. Existing rent payment queue creation and sync paths remain app-owned.
Next step: WhatsApp receipt sharing.

### Offline booking queue reviewed

Date: 2026-05-11
Feature/change name: Offline booking queue foundation
Apps affected: Dev ERP documentation only
What changed: Reviewed Dev ERP Bookings/Appointments for offline booking queue applicability and documented that no current manual booking create/update/status workflow is safe to wire in this phase. The reviewed surface remains online-only because it focuses on appointment visibility, settings, booking links, and Google Calendar sync/disconnect actions.
Why it changed: Keep the ERP-wide offline booking rollout explicit without forcing offline queues into live calendar/settings/integration workflows that need a separate capability and conflict review.
Files changed: apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: None.
Security impact: Server remains booking/calendar source of truth. Dev ERP booking/settings/calendar workflows remain online-only; auth, permissions, operational records, reports, Google Calendar integration, and API behavior are unchanged.
Testing done: Documentation review and Dev ERP booking-surface search. No Dev ERP build was required because no Dev ERP runtime files changed.
Rollback notes: Remove this documentation note if Dev ERP later gains a reviewed manual booking create/update/status surface and a separate offline implementation plan.
Next step: Offline conflict review and sync reliability (completed 2026-05-11).

### Offline inventory adjustment queue reviewed

Date: 2026-05-11
Feature/change name: Offline inventory adjustment queue
Apps affected: Dev ERP documentation only
What changed: Reviewed Dev ERP for inventory/stock adjustment surfaces and documented that no current inventory adjustment workflow is safe or applicable for offline queue wiring in this phase. No Dev ERP runtime code changed.
Why it changed: Keep the ERP-wide offline inventory queue rollout explicit without forcing stock concepts into Dev ERP's live rent, accounting, invoicing, reporting, and productivity workflows.
Files changed: apps/dev-erp/README.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: None.
Security impact: Server remains source of truth. Dev ERP inventory adjustments remain unwired; auth, permissions, rent/payment records, reports, accounting, invoices, and API behavior are unchanged.
Testing done: Documentation review and Dev ERP inventory-surface search. No Dev ERP build was required because no Dev ERP runtime files changed.
Rollback notes: Remove the documentation note if Dev ERP later gains a reviewed inventory adjustment surface and a separate implementation plan.
Next step: Offline booking queue foundation.

### Queued offline manual payments

Date: 2026-05-11
Feature/change name: Queued offline manual payments
Apps affected: Dev ERP Rent payment recording
What changed: Dev ERP Rent now queues new offline rent payment submissions as `RECORD_PAYMENT` actions using `@faako/offline-sync`. Queued records include the tenant/rent reference, amount, payment month, method/reference/notes, idempotency metadata, user/org scope, and pending status. When online returns, Dev ERP submits queued payments to the existing `/api/rent/payments` endpoint and clears queue items only after confirmed success. Existing rent payment edits remain online-only. UI notices show offline payment saved, pending sync, syncing, synced, needs review, and sync failed states.
Why it changed: Allow authenticated rent managers to preserve new rent payment submissions during unstable internet while preserving existing online rent payment behavior and server-side auth, permission, tenant, balance, notification, and report validation.
Files changed: apps/dev-erp/src/pages/Rent/offlineRentPaymentQueue.js, apps/dev-erp/src/pages/Rent/Rent.jsx, packages/offline-sync/README.md, README.md, apps/dev-erp/README.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/apps/dev-erp/progress-log.md, docs/apps/dev-erp/implementation-notes.md
Data impact: Local queued data only until server sync.
Security impact: Server remains source of truth. Queueing requires authenticated user/org context, does not update balances offline, does not trigger notifications/accounting/report effects offline, does not edit existing payment records offline, and does not bypass auth, permissions, tenant scoping, payment validation, or organization isolation.
Testing done: `@faako/offline-sync` node tests, Dev ERP Vite build, package export import check, and documentation review. Manual checks documented for offline rent payment queueing, pending/syncing/synced/needs-review/sync-failed notices, online-only edits, and unchanged online rent payment recording.
Rollback notes: Remove the Dev ERP rent payment queue helper, offline branch, sync effects, and queue notices from Rent, then return rent payments to online-only behavior. Existing online rent payment recording remains unchanged.
Next step: Offline inventory adjustment queue.

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
