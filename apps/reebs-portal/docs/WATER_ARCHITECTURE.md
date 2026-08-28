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
