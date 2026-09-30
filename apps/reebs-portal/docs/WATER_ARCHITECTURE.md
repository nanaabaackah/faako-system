# REEBS Water Domain Architecture

## Business boundary

Water is a standalone REEBS business domain. It is not a rental/event subcategory and is not part of REEBS core commerce performance by default.

Water sales, revenue, costs, customers, margin, profitability, inventory movement, and forecasts must not be merged into core rental/event metrics unless a product requirement explicitly asks for a combined view. Any combined view must still expose separate Water and core subtotals and label the aggregation clearly.

## Current boundary

- Frontend entry point: `src/modules/water/index.js`
- Existing UI implementation: `src/pages/AdminWater`
- Route: `/admin/water`
- Access class: `water`, evaluated separately by `canAccessWaterPortalArea`
- Backend module: `backend/modules/water`
- Compatibility handlers: `/api/water` and `/api/water-momo-webhook`
- Database schema: existing Water-prefixed models and fields in `prisma/schema.prisma`

The backend registry marks Water with `standaloneBusinessDomain: true` and `includedInCoreMetricsByDefault: false`. The analytics module explicitly excludes the Water domain. Registry tests enforce these defaults.

## Data and metric rules

- Core rental/event dashboard, order, booking, customer, revenue, expense, cost, margin, profitability, and forecasting queries exclude Water records by default.
- Water reports query Water-owned records and present Water-labelled measures.
- A person or organisation participating in both domains may share identity infrastructure, but domain activity and lifetime value calculations remain separate unless an explicitly combined report is requested.
- Shared infrastructure costs may only be allocated to Water through a documented accounting rule. They must not be inferred from core expense totals.
- Water MoMo payments and webhook events remain Water transactions. They must not enter core order/payment ledgers through implicit joins or generic totals.
- Exports and analytics payloads include a domain discriminator when multiple business domains can appear.

## Security and tenancy

Frontend access checks are not authoritative. Water handlers must continue to validate the authenticated principal, organisation scope, required Water permissions, webhook authenticity, and input at the backend boundary. Client-supplied organisation identifiers must be verified against the authenticated session.

Water credentials, payment keys, webhook secrets, and private customer data remain server-side and redacted from logs. Audit events retain the existing request ID.

## Dashboard capabilities and restock cost

Every successful `/api/water` response, including mutation responses that replace the
browser's dashboard state, includes `permissions.canViewFinance`, `canViewCost`,
`canManagePricing`, and `canOverridePrice` derived from the authenticated user. The
frontend defaults missing capabilities to false. Omitting them hides the revenue
and net-profit cards, financial breakdown, and cost inputs even from administrators.

The owner confirmed on 2026-09-24 that Water-only staff handle sales, while only
owners/admins manage stock and purchase costs. The API allows Water staff only the
`sale`, `update_sale`, and `delete_sale` mutations. Stock/restock, expense, adjustment
and pricing writes return `WATER_ACTION_FORBIDDEN` before any Water-table mutation.
Operational dashboard responses allowlist stock and sale fields, omit purchase
costs/sale cost snapshots/finance aggregates, and return no expense records. The
full private ledger is retained only for server-side validation and calculations.

Authorized users enter **Cost price per pack (GHS)** under **Pricing & Restock**.
The `restock` action accepts `unitCost` in GHS and persists integer pesewas; the same
cost can be corrected through the existing restock editor. Selling prices continue
to use effective-dated Commercial Settings independently of this purchase cost.

The page reads the API's `unitCostAtSaleCents` sale snapshot when calculating Water
profit and accepts the legacy `unitCostAtTransaction` field for compatibility.
Missing snapshots remain unavailable rather than being treated as zero cost.

API and Portal now share `shared/waterFinancials.js` for cost completeness and
calculation. No fallback purchase price is used for an empty ledger or missing
sale cost. The explicit correction workflow, not a dashboard read, is responsible
for any persisted cost restatement. See the repository
[release readiness checklist](../../../docs/apps/reebs/water-release-readiness.md)
for local evidence and outstanding staging checks.

The legacy MoMo callback also uses the connection-error-aware database client.
It no longer backfills references across the sale table, ignores archived sales,
checks the exact amount/currency and prevents duplicate settlement on exact event
replays. These are handler-fixture checks, not a real-provider certification.

Regression checks cover actual handler responses with an in-memory database stub,
new-stock entry, historical cost correction, capability retention after saves, and
the existing responsive layout from 320px through 1440px. These checks do not apply
migrations or write to a deployed database.

The Water handler uses the shared database client with an error listener; a lost
connection is not retried automatically for mutations. Dashboard responses are
awaited before the request client is closed. Shared Payments settlement updates
`waterSale.updatedAt` along with paid fields so an in-flight Water edit can detect
the changed row. That application remains `WATER_ORDER`/`WATER` and creates no Core
order, journal or receipt. Database race/reload verification remains outstanding.

Loading Water no longer runs the legacy blanket payment-status/reference/date
updates. Pending MoMo remains pending, collected credit remains paid, and missing
historical references/dates are not invented. New-sale mutations still record
their own payment facts. Any earlier historical misclassification needs a separate
reviewed data audit; this change neither reconstructs nor repairs past collections.

## Target module shape

```text
src/modules/water/
  index.js
  pages/
  components/
  api/
  model/

backend/modules/water/
  index.js
  handlers/
  services/
  queries/
  validation/
```

Create these layers only as Water behavior is migrated; do not copy unrelated core rental/event code to fill the structure. Compatibility exports in `backend/functions` remain until an approved API routing migration retires them.

## Review checklist

Any change touching Water and another domain must answer:

1. Does a query, KPI, export, or chart combine Water with core rental/event activity?
2. If yes, was that combination explicitly requested and are separate subtotals visible?
3. Are costs and customers classified without double counting?
4. Are Water permissions and organisation scope enforced in the backend?
5. Do tests prove core metrics remain unchanged when Water records are added?
