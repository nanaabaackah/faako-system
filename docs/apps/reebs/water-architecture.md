# REEBS Water architecture

Status: Phase 7 verified implementation (2026-08-28)

## Boundary

Water is a standalone business domain inside the shared REEBS platform. It may reuse authentication, organisation scoping, customers, vendors, audit logging and the portal shell, but its stock, sales, payments, expenses, revenue and profitability remain Water-scoped.

Default REEBS rental/event dashboards and financial totals must not include Water. Any future consolidated view must label `REEBS Core`, `Water` and `Consolidated` explicitly and apply finance permissions.

## Current request path

`/admin/water` → `AdminWater` → `/api/water` → authenticated Water handler → organisation-scoped Water tables → permission-shaped response → Water UI.

The portal route and navigation allow owners, admins, managers and Water operators. The API repeats role and organisation enforcement; navigation visibility is not authoritative.

## Data ownership

- `waterProductConfig` owns the current product name, retail/bulk/company selling prices, bulk threshold, optional cost price and active state. The current UI manages name and prices; active/inactive management is not yet exposed.
- `waterRestock` owns Water stock-in records and their editable unit-cost snapshots.
- `waterSale` owns Water orders, payment state, selling-price snapshot, optional cost snapshot and explicit price-override context.
- `waterAdjustment` owns Water-only stock corrections.
- `waterExpense` owns Water-only expenses.
- `customer` and `vendor` identities may be shared, but Water activity is derived only through Water records.

The generic inventory product can remain linked for identity/vendor context. It is not the authoritative Water stock ledger.

Core Inventory APIs, stock activity, public inventory counts and Core inventory analytics exclude products whose source is `WATER` or which have an active `waterProductConfig` link. The Inventory screen may link staff to Water Business, but it must not fetch or present Water stock, revenue, cost or profit as Core Inventory data. Water movements remain in the Water ledgers and are not written to the Core `stockMovement` ledger.

## Pricing flow

New sale pricing follows:

`Water product key` → server loads `waterProductConfig` → server selects the applicable configured selling price → optional authorised override → server calculates the total → `waterSale.unitPrice` stores the transaction snapshot.

The browser preview is informational. Missing required selling price blocks the sale with a controlled configuration error. No production fallback literal is used.

Cost follows when it is known:

`waterProductConfig.costPrice` → new `waterSale.unitCostAtTransaction` snapshot → Water gross-profit calculation.

Changing current cost never rewrites historical sale cost. Existing sales created before cost snapshots remain `NULL`; their profitability is reported as unavailable rather than using zero or today's cost.
Selling prices can be configured while cost remains unknown, so a missing internal cost does not create a free sale or force a fabricated profitability value.

## Cost and finance access

Owners, admins and managers can view and edit Water selling/cost configuration and can perform authorised price overrides. A reason is not required. Operational Water users can create Water activity but responses omit current cost, sale cost snapshots, override actor IDs and profitability fields.

## Core Dashboard boundary

The Portal Core Dashboard uses `/api/dashboardOverview?scope=core`. That endpoint never returns Water sales, revenue, costs, customers, stock, payments, expenses or profit. Core order, booking and inventory queries exclude Water by business unit when available, Water source category and active `waterProductConfig` linkage. The Dashboard includes only a boundary notice and, for users with `water:read`, a link to `/admin/water`; it does not fetch Water data.

No consolidated Dashboard exists. A future consolidated view remains an explicit product decision and must require both Core and Water authorization while displaying `REEBS Core`, `Water` and `Consolidated` as separate labelled scopes.

Public inventory/storefront DTOs expose customer selling prices only. They must never add `purchasePriceGhs`, Water cost, supplier cost or margin.

## Migration and deployment

Migration `20260828143000_water_pricing_integrity` creates the Water pricing configuration and transaction snapshot fields. It initializes existing organisations from an eligible linked Water product when available and otherwise preserves the previously established Water rates. It intentionally does not backfill historical cost snapshots.

Apply the reviewed migration in each environment before deploying code that requires it:

```sh
pnpm --filter @faako/reebs-portal run db:deploy:dev
pnpm --filter @faako/reebs-portal run db:deploy:prod
```

Production deployment is a manual release step. Phase 7 does not apply production migrations.

## Deferred work

- Dedicated Water reporting exports and a labelled consolidated REEBS/Water report do not currently exist.
- Water payment records remain embedded in `waterSale`; a separate shared payment ledger integration requires an explicit accounting design.
- Runtime defensive DDL in the legacy Water handler should eventually be removed after migration adoption is verified in every environment.
- The frontend remains a large page component and should be decomposed gradually without changing the domain contract.
