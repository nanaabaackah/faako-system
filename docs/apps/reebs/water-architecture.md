# REEBS Water architecture

Status: current-price implementation updated 2026-10-07; migration and deployed data/provider verification pending.

Release evidence and manual go-live checks: [Water release readiness](water-release-readiness.md).
Latest local stabilization evidence and remaining gaps: [Water production integrity checkpoint](water-production-integrity.md).
Standalone deployment decision: [REEBS Water standalone application ADR](../../decisions/reebs-water-standalone-app.md).

The former Water scheduled-pricing design is retired. The historical scheduling
documents are retained only as implementation history and are superseded by the
current-price model below.

## Boundary

Water is an independently deployable React/Vite application at
`https://water.reebspartythemes.com`, with its own entry point, routes, shell and
static-hosting fallback under `apps/reebs-water`. It reuses the shared REEBS
cookie-session provider, API client, organisation scoping, customers, vendors
and audit logging. It does not mount the REEBS Portal shell or import Portal UI.
Water stock, sales, payments, expenses, revenue and profitability remain
Water-scoped.

Default REEBS rental/event dashboards and financial totals must not include Water. Any future consolidated view must label `REEBS Core`, `Water` and `Consolidated` explicitly and apply finance permissions.

## Current request path

`water.reebspartythemes.com` → standalone Water SPA → shared authenticated API
origin → `/api/water` handler → organisation-scoped Water tables →
permission-shaped response → Water UI.

The legacy Portal URL `/admin/water` is only an external redirect. Portal
navigation and the Core Dashboard link directly to the Water application. The
Water app uses the shared `@faako/auth` provider and the same session/login/
logout endpoints as Portal; it does not create a separate account or role
system. Its current Water dashboard request is the frontend access check: a
backend 403 renders the authenticated access-denied state.

Water app access includes Owners, REEBS Admins, existing Managers, and dedicated
Water operators. Managers have read-only access; the API still checks the
required Water permission for each request. Owners and REEBS Admins remain
organisation-scoped under the existing platform administrator rules. Water
access does not itself grant cross-organisation access, and navigation
visibility is not authoritative.

Standalone navigation uses the REEBS sidebar layout, whose unchanged styles are
shared with Portal through `@faako/ui/reebs-sidebar.css`, and five module routes:
Dashboard `/`, Sales `/sales`, Orders `/orders`, Customers `/customers`, and
Stock `/stock`. These render distinct content within the shared Water product
workspace; navigation does not discard the selected product or sales drafts.
Pricing and authorized corrections live under Stock. Customer reads use the
existing Water-scoped directory, and creation uses `create_customer` on the
Water API. No Core inventory or financial endpoints are introduced by these
routes. Mobile navigation is an expandable inline sidebar.

## Data ownership

- `waterProductConfig` owns each product's current `retailPrice`, `companyPrice` and `bulkPrice`. `waterPriceChange` is an informational audit log; it never determines an active selling price. `commercialConfiguration` continues to own the Water discount limit.
- `waterRestock` owns Water stock-in records and their editable unit-cost snapshots.
- `waterSale` owns Water orders, payment state, selling-price and cost snapshots. Authorised price overrides do not require a recorded reason.
- `waterAdjustment` owns Water-only stock corrections.
- `waterExpense` owns Water-only expenses.
- Shared `paymentRecord` / `paymentApplication` rows scoped to `WATER` and `WATER_ORDER` own verified collections. Sale payment status is a projection, not editable payment history.
- `waterMutation` owns durable command retry markers; commands include tenant, product, actor and payload fingerprint validation.
- `customer` and `vendor` identities may be shared, but Water activity is derived only through Water records.

The generic inventory product can remain linked for identity/vendor context. It is not the authoritative Water stock ledger.

The Water flow supports `gwater-15pk` and `sachet-water-30pk` (30pcs sachet water).
Quantities and prices are per whole pack. Header selection scopes every ledger,
KPI, price lookup, inventory lock and record-id mutation to one product within
the authenticated organisation. Omitted product keys retain the 15-pack API
default. A new pack starts with no stock or prices, never copied legacy values.
Configure its current prices in Water's Pricing section or alongside a restock;
stock entry records its separate actual purchase cost. See the
[product setup and rollout notes](../../../apps/reebs-portal/docs/WATER_ARCHITECTURE.md#water-product-selection-2026-10-01).

Core Inventory APIs, stock activity, public inventory counts and Core inventory analytics exclude products whose source is `WATER` or which have an active `waterProductConfig` link. The Inventory screen may link staff to Water Business, but it must not fetch or present Water stock, revenue, cost or profit as Core Inventory data. Water movements remain in the Water ledgers and are not written to the Core `stockMovement` ledger.

## Pricing flow

New sale pricing follows:

`Water product key + organisation + sale channel + quantity` → server reads the product's current selling price (using the existing bulk threshold for retail) → optional owner/admin override → server calculates the total → `waterSale` stores the transaction snapshot.

The sale date does not select a selling price. The browser preview is informational.
Missing current selling prices block the sale with a controlled configuration
error. Current-price validation uses non-negative integer pesewas; zero is a
valid configured price. No production fallback literal is used.

Owners/admins can edit all three prices in the Water Pricing section or review
and change them during a restock. Restock purchase cost remains separate. Each
changed price writes a `waterPriceChange` audit row with the prior/new cents,
price type, actor when available, timestamp and source. A migration preserves
historical price records as audit-only rows, copies each product's currently
effective values into `waterProductConfig`, and removes the active schedule table
and sale-to-schedule reference. Existing sale price snapshots are retained.

New sale cost follows the recorded purchase history:

`latest eligible waterRestock.unitCost at the sale date` → `waterSale.unitCostAtSaleCents` snapshot → shared Water-only cost calculation.

A new sale without an eligible recorded purchase cost fails closed. Changing a
selling-price setting does not rewrite historical sales. Explicit restock
correction can restate affected sale costs inside its scoped transaction and
records a cost-correction audit event. Dashboard reads do not restate anything.
The Water app and API use `@faako/water-domain` for shared calculations: missing historical snapshots leave
COGS/profit unavailable, rather than substituting zero, a hardcoded cost, or a
later restock price. The legacy `unitCostAtTransaction` field is accepted when
present. Unknown restock spend/cash position and stock valuation also stay null.
An empty ledger does not pre-fill a guessed purchase cost.

Collections and settlement calculations also live in `@faako/water-domain`.
Period collection totals use `paidAt`; revenue uses the sale date. Live balances
remain separate from the selected historical period. Reversed application
history remains authoritative even when its net collected amount is zero.
Legacy paid flags are separately labelled and never invented as verified cash.
Recorded-price corrections cannot lower a sale below its collected amount or
rewrite payment facts; legacy paid totals require reconciliation first.

## Cost and finance access

Only owners/admins can manage purchase costs, stock, expenses, adjustments and
pricing. Water staff handle sales; their responses omit purchase costs, sale-cost
snapshots, private finance aggregates and expenses. Backend action checks and
response projection enforce this policy even for forged browser requests.
The additive `canRecordSales` response flag controls sales form/editor visibility;
managers are read-only. A missing flag fails closed in the standalone UI.

## Collection projection

The dashboard reads existing GHS `paymentApplication` / `paymentRecord` rows
scoped to `WATER_ORDER`, `WATER`, the organisation and selected active sale
product. Applied collections override a legacy sale paid flag, including partial
collections and fully reversed applications. Collections are not additional
revenue and do not create Core records. Rows without application history retain
the legacy paid-status fallback; this is not an immutable manual cash ledger.

New MoMo orders default pending. Selecting MoMo does not initiate a charge or
prove payment. Shared settlement marks an order paid only when fully covered.
Dashboard reads never persist these projections. Collection summaries follow
the selected sale period, not a collection-date cashflow reporting period.

## Core Dashboard boundary

The Portal Core Dashboard uses `/api/dashboardOverview?scope=core`. That endpoint never returns Water sales, revenue, costs, customers, stock, payments, expenses or profit. Core order, booking and inventory queries exclude Water by business unit when available, Water source category and active `waterProductConfig` linkage. The Dashboard includes only a boundary notice and, for users with `water:read`, an external link to the Water app; it does not fetch Water data.

No consolidated Dashboard exists. A future consolidated view remains an explicit product decision and must require both Core and Water authorization while displaying `REEBS Core`, `Water` and `Consolidated` as separate labelled scopes.

Public inventory/storefront DTOs expose customer selling prices only. They must never add `purchasePriceGhs`, Water cost, supplier cost or margin.

## Migration and deployment

Build and deploy `apps/reebs-water` independently from `apps/reebs-portal`.
The Water static host must serve its SPA fallback and set
`VITE_API_BASE_URL` to the browser-reachable REEBS API origin. The API's
production allowlist includes `https://water.reebspartythemes.com`; staging
deployments must add their exact Water origin to `CORS_ORIGINS_STAGING` (or the
existing environment-specific allowlist). Do not use wildcard CORS.

For existing Portal sessions to be shared on the Water subdomain, set the
backend's `USER_SESSION_COOKIE_DOMAIN` to the approved parent domain
`.reebspartythemes.com` in each deployed environment and retain HTTPS/Secure
cookies. This setting requires deployment-owner confirmation before rollout;
never put credentials or environment values in the frontend. The local standalone
development command is `pnpm dev:reebs-water`; it prepares the existing local
REEBS database and serves the app at `http://localhost:5179`.

For the two-product flow, deploy additive migration
`20260930190000_water_product_expense_scope` before the new API. Existing expenses
remain assigned to the former sole product, `gwater-15pk`; no quantities, amounts,
sales or payment facts are changed. New expenses use the selected product key.
This migration has been authored and schema-validated locally, not applied here.

Migration `20260828143000_water_pricing_integrity` creates the Water pricing configuration and transaction snapshot fields. It initializes existing organisations from an eligible linked Water product when available and otherwise preserves the previously established Water rates. It intentionally does not backfill historical cost snapshots.

The effective-dated commercial tables and sale cost snapshot also depend on the
reviewed Phase 6 commercial migration. Verify the complete migration history in
the intended environment, not just the Phase 7 migration. Previously reported
failed migration state has not been checked against a live database here. Never
mark a failed migration applied blindly or reset a shared database. Deployment
and migration execution remain manual; this review performs neither.

`/ready` checks database `SELECT 1` only. `/health/water` checks for at least one
organisation with one current price per tier and a current Water discount rule;
it returns status only. It does not certify the signed-in organisation, available
stock, historical cost completeness, migration history, providers or concurrency.

## Deferred work

- Dedicated Water reporting exports and a labelled consolidated REEBS/Water report do not currently exist.
- Direct Water payment state remains embedded in `waterSale`. The existing shared Payments application targets `WATER_ORDER`/`WATER`; it must not create Core order/journal/receipt entries. Selecting MoMo in the Water form does not itself initiate a provider charge.
- The legacy MoMo callback locks the active target sale, validates exact amount/currency, and ignores exact replays. It no longer backfills unrelated sale references or settles archived sales. Real PostgreSQL/provider replay and race checks remain outstanding.
- New Water sale/restock submissions have no durable request-idempotency key. After an ambiguous save failure, reload and inspect the ledger before manually retrying.
- Runtime defensive DDL in the legacy Water handler should eventually be removed after migration adoption is verified in every environment.
- The frontend remains a large page component and should be decomposed gradually without changing the domain contract.
