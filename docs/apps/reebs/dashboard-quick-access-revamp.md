# Module 3 — Dashboard and Quick Access revamp

Status: approved layout implemented locally, 2026-10-01; verification continued
2026-10-02. **Not deployed or a
production-readiness certification.** The user approved the proposal before
implementation. Sidecar, business routes, authentication and database records
are preserved. The discovery notes below are historical; the implementation
handoff records what changed and what still requires isolated-staging proof.

## Implementation handoff

### 1–4. Findings and implementation

The previous Dashboard lacked a primary collections chart, used order-only
receipts, did not period-filter recent activity, and failed as a whole when an
optional query failed. Quick Access included Buy, placed POS fourth and gave it
the same weight as secondary destinations.

The approved KPI–chart–KPI composition now uses existing Faako bubble/glass
cards and theme tokens. Recent activity is a sortable, five-row-per-page shared
table over the latest eight events; attention remains actionable. System health
is secondary and checks only when opened or manually refreshed. Loading retains
the actual card backgrounds and shared skeleton shimmer, with reduced motion.
Empty periods, unavailable sections, retries and stale-data labels are distinct.

### 5–10. Navigation and account

Sidecar's component and navigation hierarchy were not replaced. Quick Access
uses the shell's topbar on desktop and fixed bottom placement at 1024px and below,
with safe-area and content padding. Where Sidecar remains visible on tablets,
the bar uses the existing sidebar offset so no action sits underneath it.
Home, Stock, POS, Payments and Water retain
their existing routes. Buy was removed only from Quick Access, not its module.
POS is larger and occupies the third of five slots, even where permissions leave
slots empty. Unauthorized links are never added to fill space. Water-only and
driver navigation retain their existing specialized destinations. The desktop
account link uses the authenticated user and existing profile route; appearance,
logout and other account controls remain in Sidecar. No second session/menu model.

### 11–14. Metrics, integration, isolation and API

All visible values come through authenticated `dashboardOverview` and existing
server-authoritative organization/permission checks. No generated fixture data
ships in the page.

| Output | Source and calculation | Time/status boundary |
| --- | --- | --- |
| Bookings in period | Core `booking` count | Event date in selected half-open interval; cancelled/canceled excluded |
| Open orders | Existing Core `order` lifecycle count | Current workload; completed/cancelled/canceled/refunded excluded |
| Outstanding balance | Existing Core order balance-due expression | Current unpaid/partially-paid orders; cancelled/canceled/refunded excluded; **not all receivables** |
| Payments received and chart | Payments-domain `collectionSummary`: Core GHS `paymentRecord` with applied Core Order/Booking/Invoice application, plus unlinked legacy `orderPayment` | Paid/successful/confirmed, paid timestamp in selected interval; count a receipt once, exclude mixed-domain applications and linked legacy mirrors |
| Comparison | Same receipt calculation for preceding equal-duration interval | No percentage for zero/negative previous total or negative current total |
| Inventory attention | Active Core product stock/reorder/price fields | Current snapshot; not rental-date availability |
| Other attention | Existing order, booking and delivery lifecycle queries | Current operational workload; failed checks never imply all-clear |
| Recent activity | Existing order events, booking updates and stock movements | Selected interval, existing permission/Core filters; bounded per-source queries and final latest eight |

Supported periods remain Today, rolling 7/30 days and month-to-now. Boundaries
use UTC, equivalent to Accra; chart labels explicitly use Africa/Accra. The
eight server-aggregated buckets use equal durations, including partial periods.
They are not necessarily calendar days. Cash receipts are not earned revenue or
profit. Invoice totals are not added to source-order balances. Water is link-only
and excluded by Core entity filters and explicit payment business-unit guards.

Cross-module query contracts and route mappings were inspected and covered with
fixtures. Live SQL execution, ledger reconciliation, refund treatment and historical
data quality have **not** been certified. Existing order-balance logic and
RI-012 linked-invoice settlement remain dependencies; this pass does not claim
to repair or consolidate those balances.

### 15–17. Performance, boundaries and tests

Collections aggregate in SQL (at most nine bucket rows including comparison),
not downloaded ledgers. Recent activity is bounded. Optional queries isolate
failure without fabricated zeros. One pg Client stays sequential; no superficial
parallel promises on a single connection. Dashboard uses the shared API client,
aborts superseded reads and preserves successful data on refresh failures.
Routine health polling and the old broad AdminWorkspace CSS import were removed;
Quick Access imports the shared admin styles directly to preserve themes.
Existing Sidecar search/notification fetching remains outside this scoped pass.
No new dependencies, chart library, backend service or database migration.

Boundaries created: `DashboardCollections`, `DashboardActivity`,
`DashboardSkeleton`, Payments-domain `collectionSummary`, and Water-domain
`actionErrors`. Tests cover bounded/date-scoped queries, Water exclusion,
deduplication query guards, comparisons, safe HTTP errors, themes, roles,
navigation, touch sizes, loading/reduced motion, retry, sorting and pagination.

### 18–19. Validation and remaining release checks

- Portal Node suite: results recorded in the linked design QA; 107 test files,
  synthetic/in-memory inputs.
- Scoped ESLint and repository security scan/gate passed.
- Browser and final build evidence: see [design QA](../../../apps/reebs-portal/design-qa.md).
- No environment files, real credentials, database connections, migrations,
  seeds, writes, deployments or Git commands were used for validation.
- Before release: reconcile all new collections queries against isolated staging
  payments and source balances; exercise real role sessions, source destinations,
  dialogs over the bottom bar and physical mobile keyboards. This browser pass
  is not an all-module/modal or production authentication certification.
- Existing shared admin CSS remains large. No before/after bundle saving is
  claimed without a comparable baseline; no dependency cleanup is implied.
- Continue roadmap RI-012 and RI-018 after these release checks, not a new design
  pass. Public commerce stays paused and financial/history records protected.

### Production Water incident (same work session)

This incident guidance records the state on 2026-10-01 and is superseded for
Water selling prices by the current-price model introduced on 2026-10-07.

Read-only production `/live`, `/ready` and `/health/water` probes passed around
18:52 UTC on 2026-10-01. These do not certify authenticated writes or the selected
organization/product/date. The user then supplied response code
`MISSING_WATER_PRICE`. The local resolver emits this when retail candidates are
absent for the organization/product/quantity/effective date. No database inspection
was performed, so the absent/expired/future/mismatched schedule is not distinguished.

Owner/admin action at that time: review the correct product's selling prices and
Water discount rule. Water now uses current Retail, Company and Bulk prices on
the Water page; no sale date or effective-price period selects its standard
price. The 15pk product key is `gwater-15pk`; the 30pcs sachet key is
`sachet-water-30pk`. Use real approved prices, never copy a different product's
price. Restock purchase cost is separate.

Local `actionErrors` now exposes curated corrective guidance for known Water
configuration failures through the real HTTP adapter, while arbitrary server
exceptions stay generic. Structured diagnostics preserve request IDs and omit
bodies, raw exception text and financial amounts. This corrects reporting; it
does **not** populate production prices or claim the incident is resolved.
Missing-price reads/restock behavior from the previous Water-product pass is
preserved. Do not blindly repeat a failed create action before checking its ledger.

### 20. Files changed in this implementation

- `apps/reebs-portal/src/app/AppShell.jsx`, `roadmapModuleIntegrity.test.js`
- `src/config/adminNavigation.js`
- `src/components/AdminBottomNav/AdminBottomNav.jsx`, `AdminBottomNav.css`
- `src/pages/AdminDashboard/AdminDashboard.jsx`, `AdminDashboard.css`,
  `DashboardCollections.jsx`, `DashboardActivity.jsx`, `DashboardSkeleton.jsx`,
  `useDashboardOverview.js`
- `src/pages/AdminWater/waterPeriodUtils.test.js` (stale request-count assertion)
- `backend/functions/dashboardOverview.js`, `water.js`, `water-dashboard.test.js`
- `backend/modules/dashboard/dashboardRepository.js`, `dashboardRepository.test.js`
- `backend/modules/payments/collectionSummary.js`, `collectionSummary.test.js`
- `backend/modules/water/actionErrors.js`, `actionErrors.test.js`
- `tests/dashboard.spec.ts`, `design-qa.md`
- This document, the roadmap process-integrity log, Water architecture runbook,
  visual-audit README and five final synthetic screenshots (`05`–`09`)

Paths after the first entry are relative to `apps/reebs-portal`, except the
repository documentation. Existing 30pcs Water and other user work is preserved.

## Scope and invariants

Use the supplied reference for composition only. Keep Faako tokens, cards,
typography, Iconsax, themes and Sidecar's navigation structure. Only Quick Access
moves: top on desktop, persistent bottom on smaller screens. POS remains
`/admin/store-mode`; Payments replaces Buy and uses `/admin/payments`. Never
broaden a role's access to fill five visual slots. Water-only users remain
Water-only; driver destinations retain their existing permission model.

No Git operations, deployment, migration, production/test-provider calls or real
secret inspection are part of this checkpoint. Browser fixtures are synthetic,
not evidence of production values or real authentication.

## Historical discovery findings

1. `config/adminNavigation.js` defines Home, Stock, Buy, POS, with Water appended
   for eligible users. POS is fourth, not central. `AdminBottomNav` renders all
   actions using the same button treatment. It is separate from `PortalSidebar`;
   the latter must not be replaced.
2. The Dashboard is stacked summary/attention/actions/activity/health sections.
   It has no central performance time series or previous-period comparison.
3. The API supports Today, 7 days, 30 days and this month. Orders-in-window,
   bookings-in-window and collections use period bounds; live open orders,
   outstanding balances, today's events and stock snapshots use other clocks.
   These need explicit period versus "as of now" labels, not a blanket claim
   that every card follows the selected dates.
4. Order, Booking and Inventory recent-activity queries have no period parameter.
   Changing the date selector does not filter those records.
5. Dashboard collections use only `orderPayment`; the Payments register also
   reads `paymentRecord`/`paymentApplication` with legacy-link deduplication.
   The Dashboard cannot represent all Core collections until reconciled with
   that source. Cash collected must not be relabelled as earned revenue.
6. The legacy payment query counts method `paystack` as Mobile Money, although
   provider identity alone does not establish the payment channel.
7. The overview performs bounded backend queries sequentially on one `pg.Client`.
   Do not replace this with superficial `Promise.all` on that same connection.
   Any optional query failure currently rejects the whole overview. Plan
   independent widget error states and shared aggregate queries where suitable.
8. Existing Core Order/Booking/Inventory filters exclude Water category/config
   links; Order scope also uses business unit where deployed. Retain these
   filters and add explicit payment-domain isolation to new aggregates.
9. Existing Sidecar account controls already provide profile, appearance and
   sign-out functionality. Reuse that functionality rather than adding a second
   session or mock identity; avoid duplicating popover refs/outside-click state.

These are source findings, not a completed source-module reconciliation or a
security certification. Archived/status handling, inventory variant availability,
payment applications and linked-invoice obligations still require focused review.

## Approved layout proposal

- Preserve Sidecar and its current mobile menu.
- Desktop content begins with a compact secondary bar: Home, Stock, **POS**,
  Payments, Water (where authorized), with the signed-in account area at right.
- Header: Dashboard/welcome, supported period selector and one useful authorized
  creation action; no repetitive section eyebrows or additional branding.
- Main grid: supporting operational KPIs on the left, a broad Core collections
  chart in the centre, collections/outstanding information on the right.
- Lower area: existing meaningful recent records in the shared Faako table
  pattern, plus compact actionable alerts. Keep health secondary.
- Mobile: priority-stacked cards and readable chart; the same secondary actions
  sit at the bottom, POS larger and centred for authorized users, with safe-area
  padding and content clearance. Profile stays out of the bottom bar.
- The preview contains no claimed live numbers. Actual values and identity must
  come from authenticated APIs/session data once implementation is approved.

## Data contract and implementation plan

| Display | Authoritative source / intended meaning | Time rule |
| --- | --- | --- |
| Core collections + main chart | Applied Core payments plus unlinked legacy Order payments; deduplicate shared/legacy references | Paid timestamp inside selected half-open interval |
| Bookings | Core Booking records, reconciled with Bookings filters/statuses | Clearly distinguish events within period from today's/next-seven-day work |
| Orders | Core Order records and existing lifecycle | Period order count separate from current open workload |
| Outstanding | Authoritative payable balances, never a sum of invoice and its linked source | Current balance; show scope explicitly |
| Inventory alerts | Core Inventory availability/reorder rules | Current snapshot, not period revenue |
| Recent records | Existing Order events, Booking updates and stock movements | Period-filtered, bounded and permission-filtered |
| Water | Link only on Core Dashboard | No contribution to Core figures |

Reuse the existing chart approach where practical; inspect its implementation
before adding dependencies. Aggregate buckets server-side, bound custom ranges
before exposing them, and never download entire ledgers to draw the chart.
Show no percentage for an undefined/zero comparison denominator; compare
equivalent elapsed intervals and document the date/timezone rule.

After layout approval: add calculation/reconciliation regressions, implement the
scoped API changes, separate meaningful Dashboard/Quick Access concerns, and
validate loading/partial errors, roles, routes and all requested viewport widths
(320, 375, 768, 1024 and desktop), light/dark themes, keyboard/focus and modal
clearance. Then run the widest secret-safe Portal tests, lint, build, security
scan and gate. Do not deploy or mutate either database.

## Baseline verification

The existing policy/repository-filter/view-model tests pass: 10 tests. These are
limited pure/query-shape checks, not full reconciliation. Three current-screen
capture checks passed (1440/light, 375/light, 320/dark), with no document overflow.
Screenshots use mocked APIs and an explicitly secret-free local Vite environment,
and were inspected before preparing the approval concept. See the
[visual baseline and proposed layout](../../ux-audits/reebs-dashboard-revamp/README.md).
No revamp-completion or full-validation claim is made at this approval checkpoint.
