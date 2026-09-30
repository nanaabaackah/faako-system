# REEBS Dashboard deep dive

Status: focused operational foundation implemented; production data/browser approval still required
Date: 2026-08-30
Scope: REEBS Portal Core Dashboard only

## Architecture discovered

Before this pass, `/admin` mounted the 3,542-line `AdminWorkspace` and its 1,101-line `AdminWorkspaceHomeView`. The home effect loaded full Inventory, Customers, Orders, Bookings and Users arrays, then separately requested Order Stats, Advanced Analytics, two Financial windows, Stock Activity, Vendors and User Stats. The browser derived alerts, approvals, overdue work, customer health and several KPIs from those records. Privileged first load could issue about 12 Dashboard-owned API requests, followed by five requests every minute.

The old information order was Store Mode hero, many quick actions, assigned work, mixed summary cards, recommendations, advanced insights, then a collapsed business-details region containing finance, charts, top performers, team load, customer health and activity. Useful operational actions were mixed with vanity metrics and report-level analysis.

The new request path is:

```text
/admin
  -> lazy AdminDashboard (React/Vite)
  -> GET /api/dashboardOverview?scope=core&window=...
  -> authenticated organization context
  -> backend/modules/dashboard policy + repository
  -> narrow permission-shaped Core aggregates and recent activity

System Health
  -> existing GET /api/health
  -> current API/database readiness
  -> in-session presentation samples only (no second monitoring store)

/admin/water
  -> existing AdminWater and /api/water flow (unchanged)
```

`AdminWorkspace` remains for Purchases and Offline Queue. Its legacy home renderer is no longer routed; removing the remaining unreachable home-only state from that shared file is a staged refactor because it is intertwined with those operational sections.

## Information architecture

The Core Dashboard is now ordered:

1. Immediate Attention
2. Operational Summary
3. Quick Actions
4. Recent Activity
5. System Health
6. Explicit Water boundary

Detailed revenue mix, trend charts, forecasts, repeat-customer analysis, top performers, customer-health scoring, logged-in duration and team-load widgets were removed from the Dashboard route. Reports/Accounting remain the destination for analysis. Customer, invoice and expense summary cards were not retained because the available data did not provide a small authoritative operational action without reintroducing full-dataset reads or ambiguous metrics.

The visual layer now uses the established Faako `glass-card` section containers, `bubble-card` KPI/action cards, shared admin header, shared theme tokens and neutral card borders used across REEBS and Stroane portals. The earlier page-specific gradient, coloured card-edge accents and repeated section eyebrows were removed. Light and dark theme inheritance, border consistency and contrast are browser-tested.

## Core and Water scoping

The endpoint accepts `scope=core` only. Any other scope returns `DASHBOARD_SCOPE_UNSUPPORTED`; it cannot silently produce a consolidated result.

Core product scope requires an active, non-archived, non-deleted product and excludes both `sourceCategoryCode = WATER` and an active matching `waterProductConfig`. Core Order scope uses `businessUnit = REEBS_CORE` when the deployed column is available and also excludes Water source/order items. Core Booking scope excludes bookings containing Water-category or Water-configured products. This defence-in-depth supports databases that are still completing the additive Orders migration.

Water Dashboard data and layout were not redesigned. The Core page fetches no Water endpoint and receives only a `canReadWater` capability used to decide whether to show a link.

## Immediate Attention and priority

Alerts are server-built from aggregate records, filtered by permission, and sorted by explicit priority:

| Priority | Condition | Scope | Action |
|---|---|---|---|
| Critical | Open order past expected fulfilment/delivery date | Core Orders | filtered Orders |
| Critical | Today's delivery has no driver | Core Booking Delivery | Delivery board |
| Warning | Confirmed booking ended but is not completed | Core Bookings | filtered Bookings |
| Warning | Order is unpaid/partially paid and not closed | Core Orders | payment-filtered Orders |
| Warning | Booking is Pending | Core Bookings | pending Bookings |
| Warning | Active product unavailable/at reorder level | Core Inventory | low-stock Inventory |
| Warning | Active Core product has no positive selling price | inventory configurators only | product pricing |
| Warning | Saved Core subtotal differs from saved line sum | `financials:read` only | Accounting reconciliation |

Zero-count alerts are omitted. The Phase 9 pricing and historical subtotal counts are queried; the values 11 and 2 are not hardcoded and no record is corrected automatically.

## KPI definition matrix

| KPI | Definition | Scope | Source | Drill-down |
|---|---|---|---|---|
| Bookings today | Pending/Confirmed booking with event start during current UTC day | REEBS Core | Booking | Bookings today filter |
| Upcoming bookings | Pending/Confirmed booking starting now through seven days | REEBS Core | Booking | Bookings |
| Open orders | Order not Completed, Cancelled or Refunded | REEBS Core | Order | Open Orders |
| Orders in period | Order date inside selected window | REEBS Core | Order | Orders |
| Payments received | Successful/confirmed/paid OrderPayment paid in selected window | REEBS Core; finance permission | OrderPayment + Order | Accounting |
| Outstanding order payment | Positive authoritative balance for Unpaid/Partially Paid open order | REEBS Core; finance permission | Order | Accounting/Orders |
| Low stock | Active Core product above zero at/below its reorder level | REEBS Core | Product | low-stock Inventory |
| Unavailable stock | Active Core product with no available stock | REEBS Core | Product | out-of-stock Inventory |
| Deliveries today | Active delivery whose booking starts today | REEBS Core | Delivery + Booking | Delivery today filter |
| Pending deliveries | Delivery in Scheduled/Pending state | REEBS Core | Delivery + Booking | Delivery |

Booking payment totals are not shown because Bookings does not yet have an authoritative payment ledger. Water values are never used as a substitute.

## Authorization and privacy

The backend first resolves the authenticated user and authoritative organization, then calculates a permission DTO using existing role permissions. Each aggregate and activity source is queried only when its read capability is present. Financial amounts and reconciliation counts require `financials:read`; inventory configuration warnings require `inventory:approve`. Recent Activity contains a safe summary, human-readable reference, status, timestamp and internal drill-down only. It omits customer contacts, costs, payment internals and HR data.

Owners, admins and managers receive the API/database health rows. Other Core roles receive only the overall operational state. This is presentation shaping for `/api/health`; backend data permissions remain authoritative for business data.

## Freshness, health and failure behaviour

Business data is fetched once when the Dashboard/window changes and refreshed manually. A changing request aborts the previous request, and a refresh failure retains the last successful response with an explicit stale warning. The server marks the response stale after five minutes.

System Health has a separate two-minute refresh and manual check. It consumes the existing REEBS `/api/health`; it does not persist probes or create a second monitoring platform. The horizontal segmented display records only checks observed during the current browser session, labels the percentage `session uptime`, and begins as `Current check` rather than inventing historical uptime. Central cross-application history and Storefront probes remain owned by the existing Dev ERP monitoring registry.

## Mobile and accessibility

The page is designed down to 320 px. At 760 px alerts stack their actions and health rows move the segmented history below the service/status. At 350 px header actions, alert content, status and percentage become single-column. Grid tracks use `minmax(0, ...)`, page/container widths are bounded, values can wrap, and no fixed-width chart is present.

Semantic headings, ordered activity, labelled controls, visible focus, 44 px-class controls, text status labels, screen-reader activity context and reduced-motion rules are included. Health does not rely on colour: every status is labelled Operational, Degraded or Down.

## Capability matrix

| Capability | Before | After | End-to-End | Status |
|---|---|---|---|---|
| Immediate Attention | browser-derived mixed recommendations | prioritized server aggregates | Yes, pending live-data QA | IMPLEMENTED |
| Booking Summary | full Booking dataset | narrow aggregate | Yes | IMPLEMENTED |
| Order Summary | full Orders + stats | narrow aggregate | Yes | IMPLEMENTED |
| Payment Summary | multiple finance requests | Core order-payment aggregate, finance-only | Yes | IMPLEMENTED |
| Inventory Summary | full Inventory dataset | Water-excluding aggregate | Yes | IMPLEMENTED |
| Delivery Summary | indirect booking data | Booking-linked delivery aggregate | Yes | IMPLEMENTED |
| Recent Activity | user stats/full records | permission-shaped domain activity | Yes | IMPLEMENTED |
| Quick Actions | broad role menus | four maximum, capability-filtered | Yes | IMPLEMENTED |
| System Health | local queue snapshot | existing health endpoint + session segments | Partial | CENTRAL_HISTORY_EXTERNAL |
| Water Dashboard | separate existing page | unchanged and linked only when authorized | Yes | PRESERVED |
| Consolidated View | ambiguous mixed metrics possible | rejected by Core endpoint | No | NOT_IMPLEMENTED_BY_DESIGN |
| Drill-down | mixed | explicit links and destination-supported filters | Yes | IMPLEMENTED |
| Mobile | dense workspace | responsive operational page | code complete | MANUAL_QA_REQUIRED |

## Ghana business readiness matrix

| Area | Supported | Implementation | Remaining issue |
|---|---|---|---|
| GHS formatting | Yes | `Intl.NumberFormat(en-GH, GHS)` from pesewas | none for retained amounts |
| Ghana-friendly dates | Yes | `en-GH`, `Africa/Accra` display | aggregate day boundary currently UTC |
| Mobile usability | Yes in code | 320–1440 responsive rules | physical-device approval required |
| Simple business language | Yes | direct operational labels | owner copy approval |
| Outstanding-payment visibility | Yes | finance-only authoritative Order balance | Booking ledger absent |
| Mobile Money/payment awareness | Partial | successful MoMo/Paystack records counted server-side | not separately shown to avoid KPI clutter |
| Delivery operational visibility | Yes | today/pending/unassigned | Order Delivery remains booking-only debt |
| Human-readable references | Yes | Order/Booking/stock reference in activity | some legacy stock references may use SKU |
| Weak-network recovery | Yes | abort, retained last data, scoped errors | Dashboard data is not offline persisted |
| Quick actions | Yes | capability-filtered | Record Payment opens unpaid Orders |
| Role-aware experience | Yes | backend permission-shaped DTO | custom per-user grants are not modelled |

## Optimization matrix

| Area | Before | Change | Result |
|---|---|---|---|
| Dashboard API calls | about 12 privileged initial, five/minute poll | one overview + separately refreshed health | two initial; no business polling |
| Backend aggregate queries | stats plus full-table APIs | up to nine narrow scoped queries (capabilities reduce this) | no full datasets for counts |
| API payload | full Inventory/Customers/Orders/Bookings/Users plus stats | narrow DTO | materially reduced; live byte count pending |
| Large frontend files | 3,542 + 1,101 lines on route | 360-line focused page plus hook/view model | old workspace no longer in Dashboard route |
| Large backend files | 543-line Order Stats plus other handlers | 480-line repository + small policy/adapter | clear representative Dashboard boundary |
| Duplicate KPI logic | browser status/count logic | repository aggregates | removed from active Dashboard route |
| Dead widgets | many home-only widgets | not loaded on `/admin` | legacy source remains staged debt |
| Render performance | one-second clock + broad state | no clock; small DTO | avoidable rerender removed |
| Chart loading | multiple dashboard charts | none | report-level charts excluded |
| Dependencies | broad workspace graph | existing React/UI/Iconsax only | no dependency added |
| CSS | 323.86 kB Dashboard route chunk | 13.76 kB focused themed chunk | 310.10 kB uncompressed reduction |

Production bundle measurement:

- before: `AdminWorkspace` JS 94.91 kB / 26.57 kB gzip; CSS 323.86 kB / 51.55 kB gzip;
- after: `AdminDashboard` JS 14.63 kB / 4.71 kB gzip; CSS 13.76 kB / 2.75 kB gzip;
- route-specific JS reduction: 80.28 kB (84.6%) uncompressed, 21.86 kB (82.3%) gzip;
- route-specific CSS reduction: 310.10 kB (95.8%) uncompressed, 48.80 kB (94.7%) gzip.

The shared application/vendor chunks are unchanged in purpose. Maps, PDFs, Water and Advanced Analytics are not imported by the new Dashboard route.

## Database and rollout

No schema change or migration was created or applied. The repository introspects only whether the additive Order `businessUnit` column is deployed so Core scoping stays safe during rollout. Existing useful indexes include Order organization/date/payment/fulfillment, Booking organization/event/status, Product organization/category/active state and StockMovement organization/date. No speculative index was added without production query-plan evidence.

The repository deliberately sequences reads on its one authenticated tenant-scoped `pg.Client`. Starting concurrent promises on that client only queues work and emits a pg deprecation warning; true concurrency requires a reviewed pool abstraction that applies the same authoritative tenant context to every connection.

## Remaining Dashboard debt and decisions

- Run authenticated live-data QA after the relevant unapplied Orders/Bookings migrations are deployed in the target environment.
- Confirm that UTC operational day boundaries should become Africa/Accra database boundaries; Ghana currently matches UTC, but the definition should be explicit if organization time zones are introduced.
- Confirm the production records returned by the new Orders reconciliation filter with the finance owner; the query is read-only and never corrects historical values.
- Remove legacy home-only state/components from `AdminWorkspace` after Purchases and Offline Queue are disentangled and regression-tested.
- Decide whether Storefront/current central monitor status should be exposed through an authorized, shared monitoring read model. Do not add a Portal-owned second monitor.
- Decide whether managers should retain detailed technical health or receive only the simple state.
- Booking outstanding payment remains unavailable until the Bookings domain owns a real payment ledger.
- A consolidated Core + Water Dashboard remains intentionally not implemented.

Prerequisites for the Inventory deep dive: complete target-environment Dashboard smoke tests, approve the Core/Water filters, verify pricing-warning drill-down, record query plans/timings on representative data, and preserve the Water exclusion helper when Inventory aggregation is refactored.
