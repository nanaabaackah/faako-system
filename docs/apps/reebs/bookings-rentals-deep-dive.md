# REEBS Bookings & Rentals deep dive

Status: implemented and optimized foundation, not production-ready
Date: 2026-08-30
Business owner: REEBS core rental/event operations
Explicit boundary: Water is a separate business domain and is not a booking, rental, revenue, cost, customer, utilization, or profitability source for this module.

## Architecture discovered

```text
REEBS Website /book (Astro page + React booking island)
              │ public, customer-safe request
              ▼
       /api/bookings and /api/bookingAvailability
              │
REEBS Portal /admin/bookings ── authenticated booking read/write
              │
              ▼
backend/functions/bookings.js (API adapter and transaction coordinator)
              │
              ├── backend/modules/bookings/bookingPolicy.js
              ├── backend/modules/bookings/commercialRules.js
              ├── backend/modules/bookings/bookingRepository.js
              ├── backend/modules/bookings/bookingNotifications.js
              ├── Customers (canonical customer table)
              ├── Inventory + variants + maintenance
              ├── Delivery (linked by bookingId)
              ├── Invoicing/documents (sourceType=bookings, sourceId=booking.id)
              ├── Expenses (linked by bookingId)
              ├── Notifications (email, manager push, manager WhatsApp)
              └── Audit log
                         │
                         ▼
               PostgreSQL Booking + BookingItem
```

There is no separate booking service deployment. The function handler remains the app-owned orchestration boundary; pure lifecycle and commercial-rule logic now has a representative domain module boundary. Existing Customers, Inventory, Delivery, Invoicing, Notifications, Audit, and offline-sync implementations were reused rather than duplicated.

## Capability audit

| Capability | Before | After | End-to-End | Classification |
|---|---|---|---|---|
| Booking creation | Portal and storefront POST | Public customer details resolved in one transaction; staff customer linkage preserved; idempotency required | Yes after migration | IMPLEMENTED_AND_CONNECTED |
| Human-readable reference | Raw database ID | Stable `RB-YYYY-NNNNNN`, searchable and shown to staff/customer | Yes after migration | IMPLEMENTED_AND_CONNECTED |
| Availability | Same-day stock/maintenance check | Inclusive start/end overlap, quantity, active reservations, maintenance and final server recheck | Yes after migration | IMPLEMENTED_AND_CONNECTED |
| Reservation concurrency | Product advisory lock; variant row lock | Product lock no longer varies by requested dates; variant lock retained | Yes | IMPLEMENTED_AND_CONNECTED |
| Reservation release | Completed/cancelled variant counter release existed | Closing transitions release; ordinary status/detail edits avoid counter churn | Yes | IMPLEMENTED_AND_CONNECTED |
| Pricing | Server catalogue rate, but portal override/discount UI was disconnected | Catalogue/variant rate loaded server-side, effective rate and line total snapshotted | Yes after migration | IMPLEMENTED_AND_CONNECTED |
| Price override | UI_ONLY; server ignored it | Manager/admin authorization, original/effective rate snapshot and audit; no mandatory reason | Yes after migration | IMPLEMENTED_AND_CONNECTED |
| Bundle discount | Hardcoded on website and handler | Server commercial configuration is authoritative; public read model keeps estimate aligned | Yes | IMPLEMENTED_AND_CONNECTED |
| Attendant fee | Environment/default and duplicated browser value | Server commercial configuration is authoritative and snapshotted in booking fee | Yes | IMPLEMENTED_AND_CONNECTED |
| Deposit | 70% hardcoded in emails/invoice UI | Booking snapshots configured deposit rate/amount; email uses snapshot | Calculation only | PARTIALLY_IMPLEMENTED |
| Tax | Invoice documents support tax | Booking tax remains zero; no confirmed authoritative booking-tax applicability rule | No | NOT_IMPLEMENTED |
| Payments | Payment instructions only; order payments exist separately | Unchanged; no booking payment ledger or provider adapter was invented | No | NOT_IMPLEMENTED |
| Paystack | Shared finance package explicitly marks gateway integration TODO | Unchanged; adding a second provider architecture was rejected | No | NOT_IMPLEMENTED |
| Manual booking payment | Order manual payments exist | No booking-specific safe ledger | No | NOT_IMPLEMENTED |
| Invoicing | Booking-linked invoice documents | Preserved | Partial: separate document truth | PARTIALLY_IMPLEMENTED |
| Delivery | Booking-linked delivery route/status | Preserved; no route-planning logic added | Yes for link | IMPLEMENTED_AND_CONNECTED |
| Returns/inspection | No booking return state or inventory-return record | Unchanged | No | NOT_IMPLEMENTED |
| Damage/late charges | No authoritative rule/workflow | Unchanged | No | NOT_IMPLEMENTED |
| Cancellation | Status could be set arbitrarily | Server transition, explicit staff action, reservation release and audit | Yes | IMPLEMENTED_AND_CONNECTED |
| Customer self-service | Customer login exists, but no secure booking ownership/read API | Unchanged | No | NOT_IMPLEMENTED |
| Offline staff booking | Browser queue existed | Server idempotency now makes replay safe; validation remains authoritative at sync | Yes after migration | IMPLEMENTED_AND_CONNECTED |
| Audit | Create/update only | Create/update/confirm/cancel/complete/price override with readable target | Yes | IMPLEMENTED_AND_CONNECTED |
| Reporting | Existing booking totals/popular items/conflict query | Multi-day conflict reporting corrected; core booking sources remain separate from Water | Partial | PARTIALLY_IMPLEMENTED |

## Lifecycle

The four existing states were retained to avoid inventing enterprise workflow:

| Current state | Business meaning | Allowed next state |
|---|---|---|
| Pending | Request received; availability is reserved while staff reviews it | Confirmed, Cancelled |
| Confirmed | REEBS accepted the booking | Completed, Cancelled |
| Completed | Rental/event work is closed | None |
| Cancelled | Booking is closed and reservation released | None |

Before this pass, the UI and API could assign any allowed status string, including skipping Pending directly to Completed or reopening Cancelled. Transitions are now checked on the server and invalid changes return `INVALID_BOOKING_TRANSITION`. Completed and Cancelled records are locked. The detail view exposes the next appropriate Confirm or Complete action and a distinct Cancel action.

This lifecycle is still not a full rental return lifecycle. “Completed” does not prove returned quantities, inspection, damage resolution, or late-fee resolution. Those require a future app-owned return record and Inventory interface before more statuses are justified.

## Availability and inventory integrity

- Pending and Confirmed bookings reserve inventory.
- Date overlap is inclusive: an existing range overlaps when its start is on/before the requested end and its end is on/after the requested start.
- Multi-day availability is used by public availability checks and final booking writes.
- Non-variant products use a transaction-scoped advisory lock by organization/product, so different but overlapping ranges cannot race under different lock keys.
- Variant products retain row-level `FOR UPDATE` locking.
- Server code re-reads reservations inside the transaction; browser inventory state is never authoritative.
- Maintenance/unavailable products cannot be added to an active reservation.
- Cancellation and completion release variant display counters. Product-level availability remains derived from authoritative booking lines rather than a competing booking-owned stock total.
- Inventory capacity reduction and conflict reporting now expand multi-day bookings across each reserved day.
- No reservation-expiry rule was found. None was invented.

The existing minimum-one fallback for rental stock remains for compatibility. A business/data decision is still required on whether zero-stock rental records mean one physical unit or unavailable.

## Financial integrity

New bookings snapshot:

- currency
- catalogue/variant unit rate
- authorized override rate, actor, and timestamp where used
- quantity and line total
- subtotal
- discount
- service/attendant fees
- tax (currently zero until applicability is confirmed)
- configured deposit rate and required amount
- final booking total

Historical rows are backfilled without recalculation: old `BookingItem.price` becomes its catalogue snapshot and line total; old `Booking.totalAmount` becomes its subtotal with zero newly inferred fees/discount/tax. This preserves history instead of guessing how a legacy total was composed.

Portal item-price changes are now explicit server-validated overrides. Managers/admins have the role-level capability; staff and public callers do not. The original catalogue rate and effective override are both retained. No override reason is required or reintroduced.

The Phase 6 `commercialConfiguration` records are now read for bundle threshold, bundle discount basis points, attendant fee, and service deposit basis points. The fallback values match the values seeded by that migration and exist only to keep an older local database usable during migration-first rollout. The public `/api/bookingRules` response exposes only customer-safe calculation values.

Booking payment truth is not complete. Invoice document payment status and order payment records are separate concepts. No booking payment ledger, balance, provider verification, refund, receipt, or idempotent webhook linkage exists, so payment acceptance criteria are not met.

## Customers and Ghana readiness

- Storefront booking now sends customer contact details to the booking boundary rather than looking up and trusting a browser-supplied customer ID.
- The server normalizes Ghana numbers such as `0244123456`, `233244123456`, and `+233244123456` to `+233244123456`; valid international `+` numbers remain supported.
- Customer matching uses normalized email/phone under an advisory lock before creating a canonical Customer record.
- Staff customer search/selection and the existing quick-create path remain unchanged. Staff quick-create still captures only a name from Bookings; fuller contact capture remains Customer-module work.
- Written venue address remains required. GhanaPost GPS is optional and never replaces the written address, so mapping failure cannot make the booking unusable.
- Same-day and optional multi-day rentals are supported using date-only business inputs. Existing time-window strings remain for compatibility.
- Individual customers work. Organization/customer plus contact-person ownership is not represented by the current Customer schema and was not invented inside Bookings.

## Ghana business readiness matrix

| Area | Supported | Implementation | Remaining issue |
|---|---|---|---|
| Ghana phone numbers | Yes, public booking | Normalized on server | Existing Customer records are not backfilled |
| Individual customers | Yes | Canonical Customer linkage | None for basic flow |
| Organization customers | No | — | Customer schema decision required |
| Contact persons | No | — | Customer-module relationship required |
| GhanaPost GPS | Yes | Optional booking field, portal/storefront display/edit | No provider validation, intentionally |
| Practical delivery addresses | Yes | Required free-text venue plus optional GPS | Pickup-specific booking mode not modeled |
| GHS | Yes | Currency snapshot/display | Multi-currency booking policy unconfirmed |
| Mobile Money-ready payment UX | Partial | Neutral payment instructions already exist | No booking payment ledger/provider flow |
| Paystack | No | Shared finance contract is planning-only | Shared provider adapter/verification/webhook required |
| Manual/offline payments | No for bookings | Order flow only | Booking ledger and permission model required |
| Mobile staff operations | Partial | Existing responsive Faako booking UI retained | Manual device QA required |
| Weak-network recovery | Yes for booking writes | Scoped offline queue plus server idempotency | Conflict UI still classifies some errors by message |
| Human-readable references | Yes | Stable booking reference | Invoice/delivery cross-module UI should adopt it further |
| Simple status language | Yes | Four-state lifecycle | Return lifecycle absent |
| Configurable commercial rules | Partial | Bundle, attendant fee, deposit server config | Booking tax/delivery applicability still separate |

## Security and privacy

- Authenticated GET requires `bookings:read`; authenticated POST/PUT requires `bookings:write`.
- The Water role has neither permission, preventing Water-only staff from reading or mutating core rental bookings.
- Tenant scope comes from the authenticated session or configured public organization, not from an unverified browser tenant/customer identifier.
- Public create responses omit internal notes, staff assignment, actor IDs, customer IDs/contact details, override actors, and audit data.
- Public booking status is forced to Pending.
- Quantities, product/variant ownership, dates, availability, prices, discounts, status transitions, customer existence, and organization scope are validated on the server.
- Idempotency-Key is mandatory for creation and protected by a per-organization unique index.
- High-risk price overrides and discounts are role-authorized and price overrides are separately audited.
- Cancellation is server controlled, audited, locks the booking, and releases reservation counters.
- No public booking read-by-reference endpoint exists, preventing a new reference-enumeration/IDOR surface.

Known security debt: Booking-specific granular permissions are role-level; the legacy Admin Roles checkbox object is not the authoritative backend permission model. Payment, refund, return, damage, and archive permissions cannot be verified because those booking capabilities do not exist.

## Reconciliation

The read-only consistency check now also reports:

- booking without a valid customer
- invalid date range
- booking line without product
- non-positive line quantity
- line-total mismatch
- booking-total mismatch
- variant reservation-counter mismatch

It does not rewrite data. The previously reported 11 active REEBS products without a positive selling price and two order subtotal mismatches remain untouched. A newly selected non-positive-price rental now fails closed with `BOOKING_PRICE_UNAVAILABLE`; an authorized manager can explicitly set a positive booking-line override, which preserves/audits both prices. Existing historical zero-price lines remain editable for non-pricing/status purposes without fabricated corrections.

## UI and Faako theme

No branding or navigation redesign was made. The existing Faako/REEBS theme classes, glass/bubble cards, typography, spacing, status pills, page header, modal/detail layout, responsive rules, Iconsax adapter, and focus behavior remain the source of presentation truth.

Enhancements within that system:

- readable reference in list/table/map/detail and customer receipt
- optional rental end date and GhanaPost GPS
- customer and staff-only notes
- rate × quantity = line total display
- server-backed pricing/deposit breakdown rather than a misleading “booking + expenses = full total” customer amount
- allowed status choices only, next-action buttons, and explicit cancellation
- completed/cancelled lock messaging
- configured storefront estimate values

Manual desktop/mobile visual approval is still required. A larger visual redesign was intentionally not attempted.

## Notifications and integrations

- Manager push, manager WhatsApp, internal email, and customer email remain best-effort after the booking transaction.
- Email subjects/payment references use the readable booking reference.
- Deposit wording uses the booking snapshot rather than a hardcoded 70% string.
- Customer notes can be retained; internal notes are not included in the public response or booking email templates.
- Delivery and invoice links still use internal booking IDs at their database/API boundary. Their user-facing screens should gradually display `reference` without changing foreign keys.

## Migration and rollout

Created, not applied:

`apps/reebs-portal/prisma/migrations/20260829150000_booking_rental_integrity/migration.sql`

It adds booking reference/idempotency, inclusive end date, GhanaPost/notes, financial snapshots, price-override snapshots, constraints, and indexes. It preserves historical monetary values.

The new data-quality checks are `NOT VALID` initially where legacy values could otherwise block an additive deploy. PostgreSQL still enforces them for new writes. Validate the constraints only after the read-only reconciliation has identified and the business has approved treatment of any legacy exceptions.

Required deployment order:

1. Take and verify a production backup using the existing REEBS operations runbook.
2. Deploy the migration before the API/frontend code.
3. From the Railway production environment, run `pnpm --filter @faako/reebs-portal run db:deploy:prod` (or use the documented explicit one-off approval variable outside Railway).
4. Run `pnpm --filter @faako/reebs-portal run db:status:prod`.
5. Deploy backend, then Portal/Website.
6. Run the read-only production consistency check with its documented production guard.
7. Smoke-test public create/idempotent replay, staff confirm/cancel, overlap rejection, reference search, invoice link, delivery link, and Water-role denial.

Rollback is code rollback plus database restore/forward correction. Do not drop snapshot columns or rewrite historical rows during an incident.

## Deferred decisions and work

1. Confirm whether Pending requests should reserve inventory or whether a separate non-reserving enquiry/quote concept is genuinely needed.
2. Confirm whether zero rental stock means one physical unit or unavailable.
3. Define organization customers and contact persons in Customers, not Bookings.
4. Define pickup versus delivery at booking level and readiness rules with Delivery.
5. Establish an app-owned booking payment ledger and shared provider adapter before Paystack/manual payments.
6. Confirm tax applicability and effective-rate source before non-zero booking tax snapshots.
7. Define return, inspection, damaged/missing quantity, late fee, and completion readiness with Inventory/Maintenance.
8. Decide whether cancellation needs an optional reason field; it must not become a mandatory price-override reason.
9. Add secure customer self-service using authenticated ownership; never authorize by reference alone.
10. Replace offline conflict message matching with the new server error codes.

## Files changed

Domain/backend:

- `apps/reebs-portal/backend/modules/bookings/bookingPolicy.js`
- `apps/reebs-portal/backend/modules/bookings/bookingPolicy.test.js`
- `apps/reebs-portal/backend/modules/bookings/commercialRules.js`
- `apps/reebs-portal/backend/modules/bookings/bookingRepository.js`
- `apps/reebs-portal/backend/modules/bookings/bookingRepository.test.js`
- `apps/reebs-portal/backend/modules/bookings/bookingNotifications.js`
- `apps/reebs-portal/backend/modules/bookings/bookingNotifications.test.js`
- `apps/reebs-portal/backend/functions/bookings.js`
- `apps/reebs-portal/backend/functions/bookingAvailability.js`
- `apps/reebs-portal/backend/functions/bookingRules.js`
- `apps/reebs-portal/backend/functions/inventory.js`
- `apps/reebs-portal/backend/functions/orderStats.js`
- `apps/reebs-portal/backend/functions/_shared/accessControl.js`
- `apps/reebs-portal/backend/functions/_shared/accessControl.test.js`
- `apps/reebs-portal/backend/functions/_shared/databaseClient.js`
- `apps/reebs-portal/backend/functions/_shared/databaseClient.test.js`
- `apps/reebs-portal/backend/functions/_shared/inventoryExtensions.js`
- `apps/reebs-portal/backend/functions/_shared/transactionEmailTemplates.js`
- `apps/reebs-portal/backend/server.js`

Schema/operations:

- `apps/reebs-portal/prisma/schema.prisma`
- `apps/reebs-portal/prisma/migrations/20260829150000_booking_rental_integrity/migration.sql`
- `apps/reebs-portal/scripts/checkDataConsistency.mjs`

Portal/storefront:

- `apps/reebs-portal/src/pages/AdminBookings/AdminBookings.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/AdminBookings.css`
- `apps/reebs-portal/src/pages/AdminBookings/components/BookingEditorModal.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/components/BookingDetailModal.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/components/BookingDetailSections.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/components/BookingCustomerPicker.jsx`
- `apps/reebs-portal/src/pages/AdminBookings/bookingViewModel.js`
- `apps/reebs-portal/src/pages/AdminBookings/bookingViewModel.test.js`
- `apps/reebs-portal/src/pages/AdminBookings/services/bookingsApi.js`
- `apps/reebs-portal/src/pages/AdminBookings/services/bookingsApi.test.js`
- `apps/reebs-portal/src/pages/AdminBookings/offlineBookingQueue.js`
- `apps/reebs-portal/src/pages/AdminBookings/offlineBookingQueue.test.js`
- `apps/reebs-portal/src/pages/AdminInvoicing/AdminInvoicing.jsx`
- `apps/reebs-portal/tests/bookings-modal.spec.ts`
- `apps/reebs-website/src/views/Book/Book.jsx`

Documentation:

- `docs/apps/reebs/bookings-rentals-deep-dive.md`
- `docs/apps/reebs-portal/implementation-notes.md`

## Optimization and refactor pass

This pass reviewed the complete Bookings & Rentals implementation boundary: the portal route and its CSS/components/offline queue, the public Astro booking view, booking/availability/rules API functions, booking-domain modules, schema/migration, linked Expense/Delivery/Invoice adapters, relevant tests, and the route/dependency configuration. It deliberately did not refactor the whole Inventory, Delivery, Invoicing, Customers, or Website applications.

Responsibility changes:

- `backend/functions/bookings.js` remains the HTTP, authorization, validation, transaction, audit, and cross-module coordinator. Booking reads, sequence repair, user resolution, and assignment queries moved to `bookingRepository.js`; manager/WhatsApp message composition moved to `bookingNotifications.js`. The handler fell from 1,480 to 1,252 lines without changing routes, response models, tenant enforcement, transaction ordering, or database schema.
- `AdminBookings.jsx` remains page orchestration and state. Formatting, filter/query state, editor normalization, date/time/currency helpers, and stable UI constants moved to `bookingViewModel.js`; customer selection moved to `BookingCustomerPicker.jsx`; fetch/parsing/mutation contracts moved to `services/bookingsApi.js`. The page fell from 2,882 to 2,312 lines.
- `BookingDetailModal.jsx` remains modal composition and workflow wiring. Rental-item editing, linked expense entry/history, and pricing breakdown moved to `BookingDetailSections.jsx`. The modal fell from 1,037 to 751 lines. Existing Faako class names and the 2,119-line responsive stylesheet were retained to avoid an unapproved visual change.
- The booking editor and detail modal are now interaction-loaded chunks. `App.jsx` already lazy-loaded the Bookings route, so no application/router redesign was required.

Confirmed duplicate/dead cleanup:

- Thirteen page-level `fetch` sites now use one JSON/error/idempotency adapter. Privileged overview requests are still gated, and read-only users request only the compact booking list.
- Repeated response parsing and fallback-error branches were removed from the page.
- The obsolete page-local JSON parser and stale mechanical optimization comments were removed.
- Debounced filter callbacks now cancel pending timers during unmount; the previous optional call to a nonexistent `flush` method could leave a callback running after teardown.
- Booking operational warnings/errors now use the existing structured, redacted logger and propagate the existing request ID. No competing correlation mechanism was introduced.

Query and payload findings:

- The compact list remains one organization-scoped query and deliberately excludes item aggregation. Full item/price detail remains one organization-scoped aggregate query fetched only when a booking is opened or edited.
- Public availability now resolves product state and open-maintenance state in one query instead of two, then performs the relevant variant/reservation lookup. The common product-level check falls from three database round trips to two; response fields and maintenance behavior are unchanged.
- The initial privileged page still performs three concurrent, purpose-specific API calls (compact bookings, users, compact invoice documents), then hydrates deliveries/expenses without blocking the primary list. This preserves existing cross-module behavior. Read-only users do not request users/documents.
- Support data remains lazy: products/customers/castles load only for create/edit; full booking detail loads only for open/edit. Rental filtering remains isolated from Water and excludes non-rental stock and pump accessories.
- Server pagination/search is the principal remaining scaling gap: the compact endpoint still returns all organization bookings, and expenses/deliveries are hydrated as module-wide collections. Adding cursor pagination and booking-ID batching requires a compatible API/UI contract pass rather than a hidden refactor.

Bundle comparison (Vite production output):

| Asset | Before | After | Impact |
|---|---:|---:|---:|
| Initial `AdminBookings` JS | 88.81 kB / 22.12 kB gzip | 57.72 kB / 16.41 kB gzip | -31.09 kB raw / -5.71 kB gzip (about 26% gzip) |
| Booking editor | included above | 7.42 kB / 2.46 kB gzip, interaction-loaded | Deferred until create/edit |
| Booking detail + sections | included above | 26.26 kB / 6.10 kB gzip, interaction-loaded | Deferred until a row/detail is opened |
| `AdminBookings` CSS | 300.31 kB / 47.33 kB gzip | 300.31 kB / 47.33 kB gzip | Unchanged to preserve approved Faako design |

No package dependency changed. The module uses existing `@faako/ui`, `@faako/offline-sync`, React/router, the Iconsax-backed app icon adapter, and native lazy map iframes. It does not import PDF, chart, animation, or map-library packages. The large shared icon/vendor and CSS assets remain application-wide debt, not safe Bookings-only removals.

Remaining complexity is explicit: the page still coordinates a large offline/customer/editor workflow; the handler still owns the write transaction and cross-module side effects; and CSS remains oversized because it contains all approved responsive views. The reviewed 1,189-line storefront `Book.jsx` remains a single conversion flow; its API calls are already limited to inventory, castles, commercial rules, and final booking submission, so splitting its form steps without dedicated component coverage was deferred. The 1,128-line invoice-document function is Finance-owned and was not refactored from inside Bookings. Future extraction should be driven by a concrete feature/API contract, not line count alone. No Water query, metric, customer, expense, revenue, or profitability path was introduced.

## Verification handoff

Commands completed successfully:

- Portal unit tests: 109 passed, including new repository, notification, view-model, API-adapter, idempotency, tenant-scope, and rental-filter coverage.
- Website unit tests: 8 passed.
- Portal lint: 0 errors; 89 pre-existing warnings outside this module baseline. Targeted lint for every touched booking file has 0 errors and 0 warnings.
- Portal has no TypeScript project/typecheck script; JavaScript module resolution and syntax were validated by ESLint, explicit Node syntax checks, the Vite production build, unit tests, and Playwright.
- Website lint: 0 errors; 8 pre-existing warnings outside this module change.
- Targeted lint for all touched booking files: 0 errors and 0 warnings.
- Website Astro typecheck: 139 files, 0 errors, 0 warnings, 0 hints.
- Prisma development-schema validation: passed.
- Prisma client generation: passed.
- Portal production build: passed with the interaction-loaded bundle split above.
- Website production build: passed; 1,125 pages generated.
- Static route audit: 1,125 HTML routes, 22 rental details, 1,045 shop details and 18 linked assets passed.
- Sitemap validation: 1,119 canonical public URLs matched expected paths; transactional paths excluded.
- Storefront Playwright: 10 passed across 320, 375, 390, 430, 768 and 1,440 px, keyboard navigation, hydration, 404 and serious/critical axe checks.
- Portal booking Playwright: 3 passed for desktop/mobile modal containment and expense-to-invoice refresh linkage.
- Repository security scan: passed across 2,237 non-ignored files.
- Repository security gate: passed for app config, header baselines, environment exposure, auth storage and CORS.

No migration or data mutation was run against the shared Railway database. Consequently, database-backed create/update, overlap concurrency, reservation release, tenant denial, delivery/invoice linkage and reconciliation queries must be smoke-tested after the migration-first deployment. Paystack, manual booking payment, refunds, partial payment, webhook and return/damage tests are not applicable yet because those booking capabilities were not found and were not invented.

The new implementation is therefore a materially safer Bookings & Rentals foundation, but is deliberately not labelled industry-standard or production-ready until the migration, data reconciliation and post-deploy operational checks above pass.

## Modal, invoice, and connection-resilience follow-up

The booking detail modal had four expense controls in a three-column desktop grid. This caused a real 49 px overflow inside the financial section at desktop modal width. The financial section now gives the expense form sufficient width, switches to a single column at the existing responsive breakpoint, constrains Faako field controls to their container, and retains the established visual tokens.

Adding a booking expense continues to create a canonical Expense linked by `bookingId`. The booking invoice details endpoint reads that link live, and Invoicing merges newly linked expenses into existing saved documents without deleting operator-edited document content. It now also uses the booking reference, currency, price/line snapshots, discount, service fee and deposit snapshot. The obsolete invoice-side hardcoded 70% deposit fallback is no longer used for bookings.

Raw PostgreSQL clients used by Inventory and the booking/expense/invoice path now attach connection-error listeners. A dropped Railway socket is logged as a structured operational error, active queries reject normally, and the request can return/retry without the error event shutting down the whole API. Inventory compatibility checks stop at the first dead-client error instead of issuing repeated queries on an unusable connection. The API process also has a narrow connection-error backstop; non-database uncaught exceptions still follow the existing graceful shutdown path.

## Boundary for the Orders module

Orders may link to a Booking but must not become the booking availability, reservation, or rental-return owner. Bookings owns rental dates, rental lines, reservation, configured booking pricing snapshots, and lifecycle. Orders owns shop-sale lines, order payments/receipts, and fulfillment. A future shared payment adapter may serve both through explicit app adapters, but must not merge their ledgers or duplicate financial side effects. Water orders/sales remain outside both core rental metrics and profitability unless an explicitly scoped cross-domain report is requested.
