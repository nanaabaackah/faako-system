# REEBS Water architecture

Status: local implementation extended 2026-10-01; deployed data/provider verification pending.

Release evidence and manual go-live checks: [Water release readiness](water-release-readiness.md).

Historical product-price scheduling, effective-window safety and snapshot rules:
[Water historical pricing](water-historical-pricing.md). This is a Water-only
exception to the generic current/future commercial-rule scheduling restriction.

## Boundary

Water is a standalone business domain inside the shared REEBS platform. It may reuse authentication, organisation scoping, customers, vendors, audit logging and the portal shell, but its stock, sales, payments, expenses, revenue and profitability remain Water-scoped.

Default REEBS rental/event dashboards and financial totals must not include Water. Any future consolidated view must label `REEBS Core`, `Water` and `Consolidated` explicitly and apply finance permissions.

## Current request path

`/admin/water` → `AdminWater` → `/api/water` → authenticated Water handler → organisation-scoped Water tables → permission-shaped response → Water UI.

The Water API allows owners, admins and Water operators, with Water permission and organisation enforcement. A Core manager role alone does not grant Water access. Navigation visibility is not authoritative.

## Data ownership

- `waterProductPrice` owns effective-dated retail, bulk and company selling prices. `commercialConfiguration` owns the Water discount limit. Legacy `waterProductConfig` remains for compatibility/linkage; it is not the authoritative new-sale price resolver.
- `waterRestock` owns Water stock-in records and their editable unit-cost snapshots.
- `waterSale` owns Water orders, payment state, selling-price and cost snapshots. Authorised price overrides do not require a recorded reason.
- `waterAdjustment` owns Water-only stock corrections.
- `waterExpense` owns Water-only expenses.
- `customer` and `vendor` identities may be shared, but Water activity is derived only through Water records.

The generic inventory product can remain linked for identity/vendor context. It is not the authoritative Water stock ledger.

The Water flow supports `gwater-15pk` and `sachet-water-30pk` (30pcs sachet water).
Quantities and prices are per whole pack. Header selection scopes every ledger,
KPI, price lookup, inventory lock and record-id mutation to one product within
the authenticated organisation. Omitted product keys retain the 15-pack API
default. The new pack starts with no stock or prices, never copied legacy values.
Choose its preset in Commercial Settings to configure selling prices; stock
entry records its own actual purchase cost. See the
[product setup and rollout notes](../../../apps/reebs-portal/docs/WATER_ARCHITECTURE.md#water-product-selection-2026-10-01).

Core Inventory APIs, stock activity, public inventory counts and Core inventory analytics exclude products whose source is `WATER` or which have an active `waterProductConfig` link. The Inventory screen may link staff to Water Business, but it must not fetch or present Water stock, revenue, cost or profit as Core Inventory data. Water movements remain in the Water ledgers and are not written to the Core `stockMovement` ledger.

## Pricing flow

New sale pricing follows:

`Water product key + organisation + transaction date` → server resolves effective `waterProductPrice` and Water commercial rules → optional owner/admin override → server calculates the total → `waterSale` stores the transaction snapshot.

The browser preview is informational. Missing required selling price blocks the sale with a controlled configuration error. No production fallback literal is used.

New sale cost follows the recorded purchase history:

`latest eligible waterRestock.unitCost at the sale date` → `waterSale.unitCostAtSaleCents` snapshot → shared Water-only cost calculation.

A new sale without an eligible recorded purchase cost fails closed. Changing a
selling-price setting does not rewrite historical sales. Explicit restock
correction can restate affected sale costs inside its scoped transaction and
records a cost-correction audit event. Dashboard reads do not restate anything.
API and Portal use `shared/waterFinancials.js`: missing historical snapshots leave
COGS/profit unavailable, rather than substituting zero, a hardcoded cost, or a
later restock price. The legacy `unitCostAtTransaction` field is accepted when
present. Unknown restock spend/cash position and stock valuation also stay null.
An empty ledger does not pre-fill a guessed purchase cost.

## Cost and finance access

Only owners/admins can manage purchase costs, stock, expenses, adjustments and
pricing. Water staff handle sales; their responses omit purchase costs, sale-cost
snapshots, private finance aggregates and expenses. Backend action checks and
response projection enforce this policy even for forged browser requests.

## Core Dashboard boundary

The Portal Core Dashboard uses `/api/dashboardOverview?scope=core`. That endpoint never returns Water sales, revenue, costs, customers, stock, payments, expenses or profit. Core order, booking and inventory queries exclude Water by business unit when available, Water source category and active `waterProductConfig` linkage. The Dashboard includes only a boundary notice and, for users with `water:read`, a link to `/admin/water`; it does not fetch Water data.

No consolidated Dashboard exists. A future consolidated view remains an explicit product decision and must require both Core and Water authorization while displaying `REEBS Core`, `Water` and `Consolidated` as separate labelled scopes.

Public inventory/storefront DTOs expose customer selling prices only. They must never add `purchasePriceGhs`, Water cost, supplier cost or margin.

## Migration and deployment

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
