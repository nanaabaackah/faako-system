# REEBS Water domain boundary

Status: mandatory architecture and reporting rule.

## Business rule

Water is a standalone REEBS business domain. Water sales, revenue, cost of goods, expenses, customers, credit, cash position and profitability must not be merged into REEBS rental, event, shop or core finance metrics by default.

Any combined-company view must be explicitly named, opt-in, and show Water as
a separate segment. A generic `revenue`, `customer`, `profit` or `sales` total
is not permission to include Water.

## Ownership

The Water domain owns:

- Water stock periods, restocks, stock corrections and inventory value;
- The recorded cost price per pack for each Water restock, including later
  corrections to an already-recorded restock;
- Water orders and Water customer transaction context;
- Water pricing, units sold, payment method and collection state;
- Water credit, cash/MoMo totals and outstanding balances;
- Water cost of goods, extra expenses, gross profit, net profit and cash position;
- Water-specific permissions, navigation and webhook behavior.

REEBS core owns rental/event/shop operations and their ordinary dashboards, reporting and finance views. Shared primitives may represent money, dates, users, organisations and UI controls, but shared representation does not imply shared aggregation.

## Frontend rules

- Navigation labels the area `Water Business` and gives it a visually distinct treatment.
- The Water page states that its figures are Water-only and excluded from REEBS rental/event metrics.
- Labels use `Water revenue`, `Water orders` and `Water net profit` where ambiguity is possible.
- Primary Water indicators are separated from detailed cash, credit and cost breakdowns.
- Water-role access remains available in the mobile navigation.

## Backend and analytics rules

- The backend module registry marks Water as excluded from core analytics by default.
- Core dashboard/report queries must exclude Water-owned records unless an explicit segmented report opts in.
- Water endpoints retain backend-authoritative role, permission, organisation and webhook enforcement.
- The core `manager` role does not inherit Water access. Water access is limited to
  the dedicated Water role and deliberate owner/admin wildcard roles; route checks
  require `water:read` or `water:write` as appropriate.
- Water data must not be copied into a generic analytics total to simplify frontend presentation.
- New Water sales retain `unitCostAtSaleCents`. Ordinary commercial
  configuration and Water selling-price changes preserve that cost snapshot and
  all historical selling-price snapshots. A sale without a resolvable stored
  cost uses the latest Water restock at or before the sale for reporting; legacy
  sales that predate every recorded restock retain the GHS 22 compatibility
  cost until reconciled.
- When a new or explicitly repriced Water sale uses today's date-only UI value,
  its effective Water price and discount resolve at the current server
  transaction timestamp. This honours a same-day rule saved after midnight
  without changing the persisted Water sale business date or its restock-cost
  date.
  Explicit non-midnight timestamps and earlier/backdated or other dates retain
  their supplied effective time.
- Creating a restock (including a backdated insertion), changing an existing
  restock's cost/date, or deleting a restock can change historical cost basis.
  Each action invokes the same restatement inside its transaction: it
  re-resolves every non-archived Water sale against its latest positive restock
  at the sale date and updates each resolvable `unitCostAtSaleCents` that
  differs, including null legacy snapshots.
- A cost/date update is the explicit audited historical correction. Its
  `WATER_RESTOCK_COST_BASIS_CORRECTED` event records the old/new cost and date,
  restock quantity and `restatedSaleCostCount`. Backdated creation and deletion
  use the same snapshot re-resolution even though this correction event belongs
  to update.
- If an update or deletion would leave a non-archived sale that already has a
  positive cost snapshot with no positive restock at or before its sale date,
  the operation returns `409 WATER_COST_BASIS_REQUIRED` and the transaction
  rolls back.
- A cost-basis restatement can change Water COGS/profit, restock spend and
  current inventory valuation. The snapshot step does not change sale
  quantities, Water selling prices, discounts, revenue or Core totals; intended
  stock changes from creating/deleting the restock remain part of that restock
  operation.
- Current Water inventory value uses the latest recorded Water restock cost.
  All-time restock spend remains the sum of each restock quantity multiplied by
  its own recorded cost.
- Tests must fail if Water is silently included in core revenue or profitability.
- Water API responses identify `scope: "water"` and `businessUnit: "WATER"`.
- General REEBS analytics identify `scope: "reebs-core"` and
  `businessUnit: "REEBS_CORE"`; omission never implies a consolidated report.
- A consolidated contract uses `scope: "consolidated"` and separate
  `components.reebsCore` and `components.water` objects. It never returns one
  unexplained revenue or profit value.
- Water browser routes are not aliases of rental, booking, or ordinary order routes.
  Water provider webhooks remain outside the shared frontend API client.

## API contracts

Dedicated Water types cover `WaterOrder`, `WaterOrderLine`, `WaterCustomer`,
`WaterProduct`, `WaterInventory`, `WaterPayment`, `WaterFinancialSummary`, and the
Water dashboard. Shared primitives such as dates, currency, identifiers, and users may
be reused, but rental/event DTO inheritance is prohibited.

The existing `/api/water` handler remains the compatibility endpoint during the
incremental migration. Its successful dashboard shape is preserved with additive
Water scope fields. It is intentionally not exposed through the initial public
`/api/v1` catalogue, booking, customer, or checkout aliases.

The public `GET /api/v1/commercial-config/public` endpoint returns Core booking
and payment terms only. The public `POST /api/v1/checkout/quote` endpoint quotes
ordinary Core shop products and delivery only. Neither endpoint exposes or
authorises Water prices, discounts, customers, stock, costs or sales. Effective
Water selling prices remain in `WaterProductPrice`, are read through
Water-authorised operational/settings surfaces, and are snapshotted on a Water
sale.

Public `/api/v1/checkout/orders` requires the current valid quote fingerprint;
it rejects a missing, malformed or stale fingerprint and re-resolves shop
prices/fees before creating the Order. Both the quote and Order paths reject a
Product classified as Water. Core invoice create/update likewise rejects linked
Products whose source category is `WATER` or whose identity is explicitly
linked from `WaterProductPrice`. Water billing must remain in a Water-specific
workflow; free-text names are not used as a substitute classifier.

## Implemented combined reporting

A combined report is allowed only when all of the following are true:

1. the view is explicitly requested and named as a combined-company view;
2. Water and core REEBS remain separate segments in the response and UI;
3. metric definitions state inclusion rules;
4. permissions permit every included segment; and
5. tests cover both segment totals and the combined calculation.

Phase 6 provides the explicit
`GET /api/financials?scope=consolidated` contract. It requires
`financials:read` plus `financials:consolidated` and returns separate
`components.reebsCore`, `components.water` and `components.shared` objects with
an exact summed `summary`. Shared cost allocation is currently unsupported, so
the Shared component reports zero with `allocationApplied: false`; it is not
folded into Core or Water. The same endpoint without scope (or with
`scope=reebs-core`) remains Core-only. The dedicated Water endpoint remains the
Water-only view.

The consolidated endpoint is a segmented operational P&L view, not authority
to post Water into the current unsegmented general ledger, classify Water as
retail, or label billed revenue as cashflow. Those accounting integrations
remain deferred.

## Migration guidance

Existing Water pages and handlers may be re-exported through domain entry points during incremental migration. Do not rewrite the workflow solely to satisfy folder structure. Move logic only with focused contract, permission, calculation and UI tests.

Before a production backdated create, cost/date update or delete, rehearse
against an isolated copy and capture the pre-change restock set, Water P&L and
sale-cost snapshots. For a correction, reconcile `restatedSaleCostCount` from
the finance audit event; for create/delete, reconcile the direct pre/post
snapshot difference. Reconcile affected-period COGS/profit and restock spend,
confirm sale quantities, selling prices, Water revenue and all Core totals are
unchanged, and test that an orphaning mutation returns
`409 WATER_COST_BASIS_REQUIRED` with no persisted change. The workflow is not a
general-purpose historical business-unit or price backfill. Until a persisted
correction-reason, pre-save-impact and formal approval workflow exists, the
approved production change record must supply that context and name the
reconciliation owner.

The financial source map, effective-dated commercial policy, Water/Core P&L
definitions, explicit consolidation contract, production checklist and
read-only business-unit classification procedure are documented in
`docs/apps/reebs-portal/financial-domain-architecture.md`. That document extends
this boundary; it does not weaken Water isolation.
