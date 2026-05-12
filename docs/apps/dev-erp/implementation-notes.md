# Dev ERP Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Dev ERP without changing application behavior.

## Known technical notes

- The app combines a Vite frontend with an Express and Prisma backend.
- Dev ERP is fully live and contains real operational data.
- `backend/server.js` owns runtime composition while feature routes are organized into focused slices.
- The frontend boots auth state from `/api/auth/session`.
- Session state is cookie-based, with the shared API client handling credentials, CSRF headers, JSON parsing, and normalized errors.
- `APP_ENV` and `ENFORCE_DATABASE_ISOLATION` are important safeguards for database targeting.
- `OAUTH_TOKEN_ENCRYPTION_KEY` is required when Google Calendar integration is enabled.
- `src/config/adminModules.js` defines the Dev ERP admin module registry for home, dashboard, rent, appointments, customers/organizations, payments, reports, users, profile, and settings.
- `src/app/navigation.js` adapts the registry into the current sidebar and mobile navigation without changing route guards, API permissions, backend capabilities, or data access.
- Registry metadata includes group, status, visibility, and state fields for future grouped rendering and module exposure controls, plus child modules for current detailed routes that should not be consolidated yet.
- Hidden modules are filtered out of sidebar and mobile navigation. Disabled, internal, coming-soon, and experimental metadata is currently visual only and does not block routes, redirect users, or change backend access.
- The app shell uses shared ERP topbar, page-content, mobile-bottom-nav, and status-badge wrappers from `@faako/ui`, but Dev ERP sidebar behavior, auth, notification polling, offline banner, backend capabilities, pages, and workflows remain app-owned.
- Shared shell placeholders for offline/sync/notifications/org switching are available structurally only. Dev ERP live behavior should stay app-owned until backend-owned shell metadata exists.
- Settings now uses low-risk shared ERP panel, panel-header, stack, and form-group wrappers from `@faako/ui`. The wrappers preserve existing legacy class names and do not change alert settings API calls, Sync Review behavior, auth, routes, storage behavior, or live workflows.
- System Health now uses shared `ERPTable` and `ERPStatusBadge` presentation components from `@faako/ui` for the read-only service status table. Health data loading, refresh actions, incident-note local storage, status mapping, auth, and API behavior remain app-owned.
- Team consolidation is pending for Dev ERP. User Control and Profile are both team-adjacent, but they have different access assumptions, so they should not be forced under one visible Team module until capability behavior is reviewed.
- Settings consolidation was reviewed and left unchanged. `/settings` is the only current Dev ERP settings/config route, while system health and audit logs remain Reports-owned.
- Bookings/Rentals/Schedule consolidation was reviewed and left unchanged. `/bookings` is already nested under Rent as Appointments, and Dev ERP has no separate rentals or schedule route to safely group under a new Bookings module in this low-risk phase.
- Finance consolidation is planning-only in `finance-consolidation-plan.md`. The plan covers accounting entries, invoices, rent payments, reports, public invoice views, backend capabilities, data dependencies, and security risks before any Finance grouping implementation happens.
- Finance grouping was reviewed and left pending. Accounting and Invoicing remain separate visible routes, Rent Payments remain under Rent, Reports remain under Reports, and public invoice views remain outside authenticated navigation assumptions until a live workflow/capability review is complete.
- `order-payment-receipt-workflow-review.md` maps Dev ERP rent payment, accounting, invoice, public invoice, report-adjacent finance flows, missing dedicated receipt source of truth, balance calculations, duplicated invoice/accounting document paths, and future shared package extraction order.
- Dev ERP does not currently have a REEBS-style order or POS source of truth in the reviewed paths. Future shared order extraction should not force rent payments into an order model without a product/data decision.
- `docs/platform/shared-payment-receipt-architecture.md` defines the planning-only target architecture for future shared payment, receipt, finance, and audit packages. Dev ERP rent payments, operational records, reports, accounting paid state, public invoice tokens, and future receipt ownership remain app-owned until separate implementation work.
- `@faako/finance` now provides shared payment/receipt constants, pure display helpers, normalization helpers, display-safe balance helpers, metadata helpers, and receipt presentation helpers. Dev ERP consumes it only in Rent and Invoicing currency display helpers; current rent payment, accounting, invoice, report, public-token, and balance behavior remain app-owned.
- `@faako/notifications` now provides shared notification constants, customer-safe message templates, channel availability helpers, and user-triggered share link helpers. Dev ERP consumes it only in Appointments for the existing appointment-link email draft text; backend email behavior, Resend usage, booking/calendar settings, rent payments, reports, and operational records remain app-owned.
- `@faako/offline-sync` now provides shared offline constants, queue storage helpers, retry metadata helpers, online/offline hooks, and passive status UI. Dev ERP consumes it for shell online/offline status and queued new rent payment recording. Existing rent payment edits, invoice actions, accounting changes, reports, public-token actions, and broader production sync remain online-only.
- New rent payments can queue offline as `RECORD_PAYMENT`. The queued payload includes the tenant/rent reference, amount, payment month, method/reference/notes, idempotency metadata, user/org scope, and pending status. Sync posts to the existing `/api/rent/payments` endpoint when online.
- Queued rent payment sync marks auth, permission, duplicate, invalid tenant, changed balance, and tenant-scope failures as needs-review placeholders. Staff must treat needs-review payments as unresolved until the server accepts them; no server balance update, notification, accounting/report effect, or final payment record exists while the queue item is pending.
- Offline inventory adjustment queueing was reviewed and left unwired. Dev ERP currently has no inventory/stock adjustment surface comparable to REEBS Inventory, so no Dev ERP runtime code changed for `ADJUST_STOCK`.
- Offline booking queueing was reviewed and left unwired. Dev ERP currently has a Bookings/Appointments surface focused on calendar visibility, appointment settings, booking link copy/email, and Google Calendar sync/disconnect actions rather than a safe manual booking create/update/status workflow comparable to REEBS Bookings.
- Settings now includes the shared `SyncReviewPanel` from `@faako/offline-sync`. It summarizes local Dev ERP queue items by user/org scope, shows pending/failed/conflict/needs-review/retrying/cancelled/resolved counts, displays only safe metadata and last error text, and exposes local retry, cancel, and mark-resolved controls.
- Sync Review retry re-arms local queue items for existing app-specific sync paths; it does not bypass server endpoints, update rent balances, trigger notifications/reports/accounting effects, or alter online rent/settings workflows. Cancel and mark-resolved are local review states only and must not be treated as proof of server completion.
- `docs/platform/codebase-cleanup-audit.md` flags Dev ERP cleanup hotspots including `backend/server.js`, repeated global CSS primitives, long operational pages, duplicate display helpers, public-route fetch differences, and high-risk rent/accounting/invoice/report/auth boundaries.
- Safe Cleanup Wave 1 fixed the current Dev ERP lint issue with an unused Dashboard catch binding and stabilized the Settings Sync Review refresh callback reference. The cleanup did not touch backend routes, auth/capabilities, rent payments, accounting, invoices, reports, public routes, or database behavior.

## Open questions

- Which modules or endpoints require additional production runbooks because they touch live operational data?
- What is the long-term split between internal ERP, reusable ERP shell, and client-specific ERP apps?
- Which integrations require formal runbooks before broader use?
- Which module visibility rules should become registry metadata before any database-backed enable/disable work starts?
- Which live Dev ERP modules should become app-specific consolidated modules before module toggles are exposed to admins or orgs?
- Which Dev ERP shell controls can move into shared wrappers without changing live notification, offline, or capability behavior?
- Should Profile remain a personal account route outside Team while User Control becomes the Team module?
- Which future integration, module-toggle, or organization configuration routes should eventually live under Settings?
- Should Appointments remain under Rent, or should a future Bookings module exist after rent-only navigation and capability behavior are reviewed?
- Should Rent Payments remain under Rent, appear as Finance cross-links, or become a Finance child only after rent-only navigation and capability behavior are reviewed?
- Should the hidden Payments registry parent be renamed to Finance only after Accounting/Invoicing product language, mobile tabs, and rent-only user expectations are reviewed?
- Should Dev ERP introduce immutable receipts for rent payments, and if so, how should historical rent payments receive receipt metadata without mutating operational history unsafely?
- Should invoice paid status stay manual/status-based, or should it eventually connect to a shared payment ledger?
- Which Dev ERP payment/receipt constants can be shared first without implying shared persistence, receipt generation, or invoice ledger behavior?
- Which Dev ERP notification templates should become server-rendered only after notification preferences, audit logs, consent/opt-in rules, and provider-specific delivery requirements are defined?

## Future cleanup

- Continue extracting shared shell and form patterns into reusable packages where appropriate.
- Clarify local-only data lifecycle and reset procedures without implying live data is disposable.
- Add operational runbooks for integrations, jobs, email workflows, AI/productivity endpoints, and reporting workflows.
- Review the registry against live route and permission coverage before using it for access checks, consolidated modules, or backend capability behavior.
- Connect database-backed module toggles, org-level module config, permissions integration, and SaaS plan gating only after route, backend capability, and live-data access reviews are complete.
- Revisit shared shell adoption after app-specific module consolidation, but avoid moving complex live operational UI into shared packages prematurely.
- Revisit Dev ERP Team consolidation after role/capability review for User Control and Profile.
- Design module enable/disable settings only after backend-owned module config, org-level controls, permissions integration, SaaS plan gating, and live audit expectations are defined.
- Review any future booking/rental/calendar consolidation against rent-only users, public booking routes, Google Calendar integration, operational records, and backend capability behavior before changing navigation.
- Use the Finance consolidation plan before any Finance registry change; preserve AccountingEntry, Invoice, InvoiceLineItem, RentPayment, public invoice token behavior, reporting summaries, and backend capabilities until separately reviewed.
- Keep Dev ERP Finance grouping pending until rent payment access, public invoice token behavior, reports, accounting summaries, mobile tabs, and backend capability checks can be tested together.
- Use `order-payment-receipt-workflow-review.md` before creating shared payment/receipt/order runtime packages or expanding `@faako/finance` beyond constants, helpers, and presentation utilities for Dev ERP. Start with read-only adapters and fixtures, then design ledger/receipt contracts around rent payments, invoices, and accounting entries.
- Use `docs/platform/shared-payment-receipt-architecture.md` before adding shared payment/receipt constants and types. Keep the first implementation limited to constants/types and non-mutating helpers.
- Keep Dev ERP adoption of `@faako/finance` limited to display helpers until app-specific fixtures prove that rent payment, invoice, report, and public-token behavior remains unchanged.
- Keep Dev ERP adoption of `@faako/notifications` limited to customer-safe display/share drafts until Resend email sender integration, WhatsApp Business API integration, SMS provider integration, notification preferences, audit logging, and retry handling are designed.
- Keep Dev ERP offline adoption limited to passive indicators and queued new rent payment recording until invoice, report, accounting, inventory, booking/calendar settings, public-token, auth refresh, server validation, idempotency, conflict handling, and audit requirements are designed and tested.
- Review Dev ERP Bookings/Appointments separately before any offline booking queue work, especially Google Calendar sync, booking settings writes, public booking links, rent-only navigation, backend capabilities, and operational records.
- Add app-specific deep links from Settings Sync Review cards to Rent records only after permission behavior and payload-redaction rules are reviewed.
- Use the platform cleanup audit before splitting backend routes, consolidating CSS, or moving finance/date/status helpers. Start with documentation, route maps, display-only helpers, and visual checks before touching live backend or rent/accounting workflows.
- Continue cleanup with shared UI/style extraction only after visual checks and route coverage. Backend route splitting remains high risk and out of scope for cleanup waves without a dedicated plan.
- Continue shared UI extraction with display-only surfaces first. Productivity, Reports, Dashboard, Invoicing, User Control, Profile, and System Health still contain repeated panel/form/table patterns but require route-specific visual checks before adopting shared wrappers.
- `docs/platform/shared-form-table-system-plan.md` maps Dev ERP form/table extraction opportunities across Rent, Invoicing, Reports, User Control, Audit Logs, Productivity, System Health, and Settings/Profile-style surfaces. Treat rent payments, invoice create/edit, user roles/password actions, reports, email workflows, AI/productivity actions, and public-token behavior as high risk until shared wrappers are proven in lower-risk read-only areas.
- Continue shared table adoption with read-only/reporting tables first. Do not migrate Rent payment, Invoicing create/edit, User Control role/password, Reports scheduling, Productivity AI, or public-token tables until each workflow has route-specific visual checks and rollback notes.

## Risks to monitor

- Permission mismatches between frontend route guards and backend capabilities.
- Operational record, rent/payment, accounting, invoicing, and reporting calculation drift.
- Integration failures caused by missing encryption keys or environment values.
- Email workflow or AI/productivity endpoint changes affecting real users or records.
- Future registry wiring into access checks, route guards, backend capabilities, database-backed toggles, org-level config, or SaaS plan gating could affect live navigation or permissions and must be reviewed separately.
- Shared shell wrapper changes can affect live topbar spacing, mobile navigation, and operational workflow ergonomics even when data behavior is unchanged.
- Forcing Team grouping before capability review could hide Profile or User Control from live users with restricted module access.
- Forcing future Settings grouping before route/capability review could hide operational monitoring or configuration routes from live users.
- Forcing a Bookings parent before rent-only navigation review could disrupt live users who currently understand Appointments as Rent-adjacent.
- Finance consolidation could disrupt live rent payments, public invoices, reporting, or rent-only users if navigation grouping is mistaken for backend capability enforcement.
- Renaming or exposing the hidden Payments parent too early could confuse current Accounting/Invoicing users or alter rent-only navigation expectations.
- Shared payment or receipt extraction could alter live rent balances, invoice statuses, reports, public invoice token behavior, or accounting summaries if it assumes REEBS-style orders, immutable receipts, or ledger-backed invoices before Dev ERP-specific contracts exist.
- Shared architecture work could be mistaken for shared runtime behavior; keep Dev ERP rent payment writes, balance calculations, reports, invoice statuses, and public invoice token behavior unchanged until app-specific adapters are proven.
- Shared notification templates could be mistaken for automated delivery. Current Dev ERP use is the user-triggered appointment-link email draft only; do not send automated messages or include internal notes, audit metadata, raw database IDs, secrets, or environment values in customer messages.
- Offline queue constants could be mistaken for broader enabled offline workflows. Dev ERP currently queues new rent payment recording only; it must not queue rent payment edits, inventory adjustments, booking/calendar settings, Google Calendar sync, invoices, reports, accounting changes, or public-token actions until backend permission rechecks and conflict handling exist.
- Queued rent payments may fail when tenant access, balances, permissions, or duplicate payment context changes before sync. The current placeholder keeps failed/needs-review queue items local; do not update server balances, notifications, accounting summaries, or reports offline.
- Sync Review can make local queue state easier to change. Operators should treat retry as a request for existing server validation, and treat cancel/mark-resolved as local housekeeping after manual review, not as a production data write.
- Cleanup work could disrupt live operational data if backend routes, capability checks, rent payments, invoices, reports, public booking, public invoice, email workflows, or AI/productivity endpoints are refactored without dedicated tests and rollback plans.
