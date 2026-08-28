# REEBS financial domain and commercial policy architecture

Status: normative boundary and reporting definition for Phase 6. The additive
commercial-policy foundation, Core-default financial scope, explicitly
segmented consolidation, public Core terms, shop checkout quote guard and
invoice-deposit integration described below are implemented. The ledger,
historical-data and cross-workflow work listed as deferred is not implied to be
complete.

## Purpose

This document defines which REEBS records are authoritative for operational
finance, how commercial values are governed, and how Core, Water and an
explicit consolidated view must behave. It is the reference for future report,
API, migration and reconciliation work.

This document does not authorise a broad data backfill, rewrite posted journals,
or merge Water into ordinary REEBS finance.

## Non-negotiable business-unit boundary

REEBS has these reporting scopes:

| Scope | Identifier | Meaning |
| --- | --- | --- |
| Core | `REEBS_CORE` | Rental, event, shop and ordinary REEBS operations |
| Water | `WATER` | The standalone Water business and its own stock, customers, sales, costs, expenses and profit |
| Shared | `SHARED` | A deliberately shared identity, resource or commercial setting; never an instruction to duplicate a financial fact into both units |
| Consolidated | `consolidated` response scope, not a record classification | An explicitly requested company view containing separate Core and Water components |

Water facts are excluded from Core metrics by default. Shared representation of
a customer, product identity, currency, user or UI primitive does not make
Water revenue, cost or profit a Core fact. A customer or product used by both
domains is `SHARED`; each transaction remains owned by exactly one business
unit.

A consolidated report is allowed only when it is explicitly requested, the
caller is authorised for every component, and the response keeps
`components.reebsCore` and `components.water` visible. An omitted scope never
means consolidated.

## Authoritative financial domain map

Amounts in operational tables are integer pesewas unless the existing model is
explicitly documented as a legacy major-unit source.

| Concern | Authoritative record or configuration | Recognition or valuation date | Scope | Important exclusions and limits |
| --- | --- | --- | --- | --- |
| Shop/order billing | `Order` and selling-price snapshots in `OrderItem` | `Order.orderDate` | Core | Exclude cancelled and refunded records; use the persisted grand total once |
| Order collections | Successful `OrderPayment` rows | `OrderPayment.paidAt` | Core | Collections are not revenue recognition and failed/pending attempts are not cash |
| Order receipt proof | `OrderReceipt` snapshot linked to a payment | `OrderReceipt.issuedAt` | Core | A receipt is evidence of collection, not another sale |
| Rental/event billing | `Booking` and `BookingItem.price` snapshots | `Booking.eventDate` | Core | Recognise only `confirmed` or `completed`; pending/cancelled bookings are excluded |
| Invoice/receipt presentation | `invoiceDocument` compatibility table, including persisted deposit and due-date terms | `issueDate`/`sentAt` according to the rule below | Core or ambiguous | A document linked to an Order/Booking does not create additional revenue; Core invoice writes reject linked products classified as Water, while runtime DDL, unlinked manual-line classification and major-unit money remain debt |
| Core expenses | `Expense`; approved Maintenance cost only under one deduplicated policy | `Expense.date` or maintenance service date | Core | Never infer Water business ownership from an expense description containing “water” |
| Water sales | `WaterSale`, including its recorded unit price, discount and total | `WaterSale.date` | Water | Never write or report this as an ordinary Order solely for aggregation convenience |
| Water COGS | `WaterSale.unitCostAtSaleCents`; `WaterRestock` resolves the initial cost and restatements | Cost snapshot at sale, or restated cost after a restock create/edit/delete cost-basis change | Water | Ordinary configuration/price changes do not mutate the snapshot. Restock creation (including backdated insertion), cost/date correction and deletion re-resolve non-archived sales transactionally; a change that would orphan a previously snapshotted sale fails with `409 WATER_COST_BASIS_REQUIRED` and rolls back |
| Water operating expense | `WaterExpense` | `WaterExpense.date` | Water | Do not copy into generic `Expense` for Core reporting |
| Water stock corrections | `WaterAdjustment` | `WaterAdjustment.date` | Water | A correction affects Water quantity, not sales revenue |
| Water selling policy | Effective `WaterProductPrice` row by product, channel/price type and quantity | Transaction time | Water | The applied standard price and any override must be retained on the sale |
| Core/shared commercial policy | Effective `CommercialConfiguration` row | Transaction time | Explicit `businessUnit` | Missing or overlapping effective rows fail closed; they do not fall back silently to code |
| Accounting ledger | Posted `JournalEntry` and `JournalLine` | Journal date | Currently unsegmented | Posted GL is accounting truth, but current operational coverage is incomplete and business-unit classification is deferred |
| Manual sales history | `AccountingManualSales` | Stored year/month | Legacy Core history | Major-unit JSON; reconcile against imported journals before use to avoid duplication |
| Historical accounting import | `HistoricalImportBatch`, posted journal entries and lines | Import period/journal date | Currently Core-only import contract | Existing retail/rental split cannot accept Water as retail |
| Statutory settings | `TaxRate`, `AccountingConfig`, approved `SystemConfig` values | Effective date where supported | Shared/company or explicit reporting scope | Tax rules need finance/legal approval and must not be treated as ordinary pricing policy |

Relevant implementation paths are:

- `apps/reebs-portal/prisma/schema.prisma`
- `apps/reebs-portal/backend/functions/_shared/shopOrders.js`
- `apps/reebs-portal/backend/functions/bookings.js`
- `apps/reebs-portal/backend/functions/water.js`
- `apps/reebs-portal/shared/waterFinancials.js`
- `apps/reebs-portal/backend/functions/financials.js`
- `apps/reebs-portal/backend/functions/invoice-documents.js`
- `apps/reebs-portal/backend/functions/commercial-config.js`
- `apps/reebs-portal/backend/functions/_shared/commercialConfig.js`
- `apps/reebs-portal/backend/functions/publicCommercialConfig.js`
- `apps/reebs-portal/backend/functions/checkoutQuote.js`
- `apps/reebs-portal/backend/functions/_shared/checkoutQuote.js`
- `apps/reebs-portal/backend/functions/_shared/invoiceCommercialTerms.js`
- `apps/reebs-portal/backend/versionedRoutes.js`
- `apps/reebs-portal/backend/functions/accounting-journals.js`
- `apps/reebs-website/src/views/Book/Book.jsx`
- `apps/reebs-website/src/views/Checkout/Checkout.jsx`

## Source precedence and duplicate prevention

One economic event is counted once:

1. A linked Order is the billing source; its invoice document is presentation.
2. A linked Booking is the rental/event billing source; its invoice document is
   presentation.
3. An issued, non-draft manual document may be recognised only when it is not a
   duplicate of an Order, Booking, receipt or imported historical record.
4. An OrderReceipt proves a payment and is never added to billed revenue.
5. OrderPayment drives collections and payment cash reporting; it is never
   added to the recognised Order total as a second revenue source.
6. Restock spend creates Water inventory/cost basis. It is not also an operating
   expense when COGS is recognised.
7. A shared customer or product relationship does not duplicate its
   transactions across business units.

When sources disagree, preserve the original records and report the
reconciliation difference. Do not overwrite a source merely to make a dashboard
balance.

## Recognition definitions

All report periods use an organisation-approved timezone and half-open windows:
`from <= date < to`. The current operating timezone is Africa/Accra unless the
organisation has an approved replacement. Currency must be explicit; no report
may add different currencies without an approved conversion source and date.

### Core recognised revenue

Core recognised revenue for a period is:

```text
eligible Order grand totals recognised by orderDate
+ eligible Booking totals recognised by eventDate
+ eligible issued, non-draft, unlinked manual-document totals
- recorded refunds/credit notes attributable to those facts
```

Rules:

- An Order is recognised by `orderDate` and excluded when cancelled or
  refunded. Payment status does not move its recognition date.
- Use the persisted inclusive Order total exactly once. Delivery and service
  fees may be displayed as components but must not be added again.
- A Booking is recognised by `eventDate` only when its status is `confirmed` or
  `completed`.
- A draft document is excluded. A document is eligible only after it is issued:
  it has a non-draft lifecycle and issue/sent evidence required by the document
  contract.
- A document linked to an Order or Booking is excluded as a separate revenue
  row. Its type (`invoice` or `receipt`) does not override its source.
- A fully refunded transaction is excluded. Partial-refund netting remains
  deferred until a durable refund/credit-note ledger exists.

### Core profit

```text
Core gross profit = Core recognised revenue - known Core COGS
Core operating profit = Core gross profit - eligible Core operating expenses
```

For new order lines, `OrderItem.unitCostCents` is the historical cost snapshot.
A null legacy snapshot means cost is unknown or requires reconciliation; the
current Product purchase cost must not silently rewrite historical COGS.
Booking-specific cost allocation is not yet authoritative and must be shown as
unallocated rather than invented.

### Water profit

```text
Water revenue = sum of eligible WaterSale.totalAmount by WaterSale.date
Water COGS = sale quantity × snapshotted unit cost (legacy: applicable restock-period unit cost)
Water gross profit = Water revenue - Water COGS
Water net profit = Water gross profit - eligible WaterExpense amounts
```

New Water sales snapshot the latest valid restock cost at the sale date. A sale
without a resolvable stored snapshot uses the latest restock at or before the
sale for reporting; a sale before all recorded restocks uses the documented
compatibility cost until it is reconciled. Creating or scheduling a commercial
configuration or Water selling-price row does not rewrite
`WaterSale.unitCostAtSaleCents`.

A restock create, update or delete can change which acquisition cost applies at
a historical sale date. That includes inserting a backdated restock and changing
an existing restock's unit cost or date. Within the same Water transaction, the
backend re-resolves the latest positive restock cost at each non-archived sale
date and updates every resolvable `unitCostAtSaleCents` that differs, including a
null legacy snapshot. If the proposed update or deletion would leave a
non-archived sale that already has a positive snapshot with no positive restock
at or before its sale date, the backend returns
`409 WATER_COST_BASIS_REQUIRED` and rolls back the restock change and all
snapshot writes.

An update that changes an existing restock's unit cost or date is the explicit
audited historical correction. It writes
`WATER_RESTOCK_COST_BASIS_CORRECTED` with the previous/new cost and date,
restock quantity and `restatedSaleCostCount`. The cost-basis mutation and
restatement can change Water COGS/profit, restock spend and current inventory
value. Rewriting the sale snapshots does not independently change sale
quantity, selling price, discount, sale total or Core financials; intended
stock changes from restock creation/deletion remain part of the restock
operation. Later restock periods retain their own applicable cost.

Water inventory value, outstanding credit, cash collected and restock spend are
important financial indicators but are not additional P&L revenue. Water cash
collected includes only successfully paid sales by payment date/status.

### Consolidated P&L

```text
Consolidated revenue = Core recognised revenue + Water revenue
Consolidated COGS = known Core COGS + Water COGS
Consolidated operating expense = Core expense + Water expense + one approved shared-cost allocation
Consolidated profit = consolidated revenue - consolidated COGS - consolidated operating expense
```

Every consolidated response must show the Core and Water components next to the
sum. Until allocation rules and inter-unit eliminations are implemented, shared
costs remain an explicit unallocated component and the report carries that
limitation. No shared expense may be charged once to Core and again to Water.

The implemented consolidated contract is
`GET /api/financials?scope=consolidated`. It requires both
`financials:read` and the deliberate `financials:consolidated` permission and
returns `components.reebsCore`, `components.water`, `components.shared` and the
exact component sum in `summary`. The current Shared component is visibly zero
and `allocationApplied: false`; it is not silently assigned to either business
unit. An omitted scope, or `scope=reebs-core`, returns only Core. Water-only
reporting remains on the Water API.

## Revenue trend is not cashflow

An order-date/event-date/document-date series is a recognised or billed revenue
trend. It must not be labelled `cashflow`, `cash collected`, or `cash received`.

Cash reporting is built from successful payment facts by payment date, together
with durable refunds and disbursements when those ledgers exist. Outstanding
balances and accounts receivable are stock measures at an as-of time, not
period cash inflows. Until Booking payments, Water refunds, Core refunds and
expense disbursements have complete ledgers, a company cashflow statement is
explicitly deferred.

## Commercial-value classification and inventory

Commercial and financial values are classified before choosing their storage:

| Classification | Examples | Required treatment |
| --- | --- | --- |
| Effective commercial policy | Bundle threshold/discount, attendant fee, delivery rate, deposit percentage/due days | Typed `CommercialConfiguration`, explicit business unit, effective dates, audit |
| Water product selling price | Retail, bulk-retail and company price; bulk minimum quantity | Typed `WaterProductPrice`, Water-only permissions, effective dates, transaction snapshot |
| Transaction fact/snapshot | Order/Booking item selling price, Water actual and standard price, line cost | Preserved on ordinary configuration changes; mutable only through an explicit audited correction/reprice/restatement workflow |
| Cost fact | Product purchase cost, Water restock unit cost | Record at acquisition/restock; snapshot COGS where the policy requires; correction affects only its documented cost period |
| Statutory/accounting rule | Tax rates, VAT scheme, fiscal period | Separate effective-dated finance configuration with finance/legal approval |
| Payment instruction or secret | MoMo/bank destination, provider secret, webhook secret | Server environment/secret manager; never browser config, general commercial history or logs |
| Operational default | Reminder interval, display preference, UI default | Typed System/feature configuration when changeable; not a transaction amount |
| Derived metric | Revenue, margin, stock value, outstanding balance | Code/SQL definition over authoritative facts; never manually overwritten as a shortcut |

The inventory CAD-to-GBP helper now applies only the accepted exchange rate.
It does not invent a Canadian tax uplift. Any actual tax, duty, freight or
other landed-cost component must be entered from source documentation through
an approved cost workflow; it is not inferred from the source currency.

### Phase 6 commercial inventory

| Business unit | Key or price | Seeded compatibility value | Unit |
| --- | --- | --- | --- |
| Core | `booking_bundle_min_items` | `3` | items |
| Core | `booking_bundle_discount_bps` | `1000` | basis points (10%) |
| Core | `booking_attendant_unit_fee_cents` | `10000` | pesewas (GHS 100) |
| Core | `delivery_per_km_fee_cents` | `50` | pesewas/km (GHS 0.50/km) |
| Core | `service_deposit_bps` | `7000` | basis points (70%) |
| Core | `service_deposit_due_days` | `2` | days |
| Water | `water_discount_limit_bps` | `9999` | validation ceiling, not a recommended discount |
| Water | `RETAIL` price for `gwater-15pk` | `2700`; product link remains null pending deterministic review | pesewas |
| Water | `BULK_RETAIL` price for `gwater-15pk` | `2600`, minimum quantity `10` | pesewas per pack |
| Water | `COMPANY` price for `gwater-15pk` | `2500` | pesewas per pack |

These seed values preserve behavior; they are not newly approved prices or tax
advice. Payment destination details are deliberately absent from this table and
document. The Water GHS 22 pre-restock compatibility cost is a historical cost
fallback, not a selling price and not an editable commercial-policy row.

### Public Core terms and checkout revalidation

The website consumes two deliberately narrow, no-store public contracts:

- `GET /api/v1/commercial-config/public` resolves the effective Core bundle
  minimum, bundle discount, attendant fee, service-deposit rate and default
  service-deposit due period for the configured public organisation. It returns
  `scope: "reebs-core"`, `businessUnit: "REEBS_CORE"`, the effective time and
  applied configuration IDs. It exposes no Water prices, payment destination or
  server secret. Missing or overlapping required rows fail closed.
- `POST /api/v1/checkout/quote` reloads authoritative shop product/variant
  prices and the applicable delivery rule, calculates the server total, reports
  stale cart prices and returns a canonical `v1` SHA-256 fingerprint. The
  fingerprint is an integrity-neutral staleness token, not price authority and
  not an authorisation credential. A shop delivery quote requires a positive,
  confirmed distance; missing distance fails closed instead of producing a
  zero delivery charge. In a mixed cart, the customer can keep shop items for
  pickup when that distance is not yet known.

Public organisation context is resolved on the server. Both endpoints enforce
allowed browser origins and rate limits. The order-creation endpoint reloads
the catalogue and commercial configuration again, recomputes the total, and
compares the submitted quote fingerprint and price acknowledgement. Public
`/api/v1/checkout/orders` creation requires a syntactically valid current quote
fingerprint even when no cart price changed: a missing fingerprint returns
`409 CHECKOUT_QUOTE_REQUIRED`, while a malformed fingerprint is rejected. A
stale quote returns `409` for another customer review; client totals and fees
are not trusted.

The quote currently covers shop lines and their delivery fee only. Rental lines
are priced by the booking endpoint using the effective Core booking rules. A
mixed storefront cart still creates a shop Order and a Booking as two sequential
mutations; the quote fingerprint does not make that pair atomic. If the Order
succeeds and the Booking fails, the UI preserves the Order reference and tells
the customer not to resubmit, but operational reconciliation is still required.

### Invoice deposit and due-date terms

For a new invoice, the backend calculates the deposit amount from the persisted
document grand total and the effective Core `service_deposit_bps` rule. If the
request does not contain an explicit due date, it also calculates the default
from `service_deposit_due_days`: event-backed invoices are due that many days
before the event, while other invoices use that many days after issue. Receipts
always have a zero deposit.

An unsent draft invoice refreshes its deposit using the configuration effective
at the document creation time and persists the resulting deposit amount and due
date. A pre-Phase-6 draft whose creation time predates available configuration
uses the current authoritative configuration rather than a code literal. Once
an invoice is no longer a draft or has been sent, its stored deposit amount and
due date are preserved on ordinary edits so a later policy change cannot rewrite
issued customer terms. An explicitly selected due date remains a document term;
the configured due period supplies the server default.

Core invoice product validation is also server authoritative. Invoice create
and update load linked Product records inside the organisation and reject a
line when its `sourceCategoryCode` is `WATER` or the Product has an explicit
`WaterProductPrice.productId` relationship. The Core invoice workflow must not
be used for Water billing. An unlinked free-text line is not classified by a
fuzzy name match and remains part of the documented manual-record data debt.

Invoice tax is not part of this commercial-policy foundation. Saved documents
persist their `taxRate`, but the initial Invoicing value can still originate in
the legacy device-local `reebs_erp_config`, while statutory accounting rates
also exist in `AccountingConfig`/`TaxRate`. These sources are not yet one
approved effective-dated tax authority and require finance/legal review before
unification.

## Effective dates, history and overrides

- Effective windows are half-open: `effectiveFrom <= at < effectiveTo`; a null
  `effectiveTo` is open-ended.
- A transaction resolves its policy using the organisation, explicit business
  unit and transaction time. Server time is used for a transaction being
  created now and for the documented Water same-day date-only create/reprice
  case below; it is not a general historical-policy override.
- For a new or explicitly repriced Water sale, a UI date-only value for today
  arrives as midnight. Water price and discount configuration resolve at the
  current server transaction timestamp so a same-day rule saved later than
  midnight is honoured. The persisted Water sale business date is not changed,
  and its restock cost basis still uses that sale date. A non-midnight timestamp,
  an earlier/backdated date, or another supplied date retains its own effective
  time for commercial lookup.
- Exactly one record must be effective for a required key. Missing or
  overlapping records are configuration errors and fail closed.
- A policy change creates a new effective record and closes/splits the previous
  window. It does not edit the meaning of an already-applied transaction.
- Current administrative writes must not silently create retroactive policy.
  A historical correction is a separate finance-controlled workflow with an
  audit trail and reconciliation evidence. An existing Water restock cost/date
  correction currently records actor, old/new basis and restated-row count; a
  persisted correction reason, automated impact preview and approval workflow
  remain deferred and must be supplied by the production change process
  meanwhile.
- Manual transaction overrides store the standard value, actual value, reason,
  actor and time. An override never changes business-unit ownership.
- Water restock cost-basis changes are the documented exception that
  deliberately restate cost snapshots. Restock creation (including backdated
  insertion), cost/date update and deletion re-resolve all non-archived Water
  sales and update only resolvable snapshots whose applicable latest-restock
  cost differs. They must preserve sale quantities, selling-price snapshots and
  Core totals. A cost/date correction audit records
  `restatedSaleCostCount`.
- A restock update or deletion that would leave a previously snapshotted sale
  without a positive restock cost at or before its sale date fails with
  `409 WATER_COST_BASIS_REQUIRED`; the transaction rolls back both the restock
  mutation and any snapshot changes.
- A resolvable legacy null cost snapshot may be populated only by that explicit
  restock cost-basis re-resolution workflow or an explicit sale-basis
  correction. It must not be populated from today's catalogue price or an
  unrelated current cost merely to remove nulls. Unresolvable rows remain
  null/unknown.

The compatibility tables are `CommercialConfiguration` and
`WaterProductPrice`; `OrderItem.unitCostCents` and the Water sale standard-price
and override fields provide additive snapshot foundations. Future snapshots
must remain in integer minor units and reference the applied policy row when
available.

## Permissions and audit

Backend authorisation is authoritative. Frontend visibility is only UX.

- Commercial-policy writes are restricted to Owner/Admin plus the applicable
  server permission. Reads are organisation-scoped and filtered by business
  unit.
- The Water role may read Water pricing and Water operational records; it does
  not gain Core commercial configuration, accounting, or consolidated access.
- Core operational roles do not gain Water data from a generic finance or
  customer permission.
- Consolidated reports require deliberate permission to every component. A
  Core-only permission cannot reveal Water through a total.
- Tenant context is applied before every query; client-supplied organisation
  identifiers are selectors, not authority.
- Creating a commercial rule or Water price records the old window/value, new
  value/window, actor, organisation, request ID and overlap actions in AuditLog.
- Restock cost edits, manual price overrides, refunds, reclassifications and
  historical corrections require domain-specific audit events. Metadata must
  contain safe IDs and changed fields, not payment credentials or unnecessary
  customer data.
- `WATER_RESTOCK_COST_BASIS_CORRECTED` is a warning-severity finance audit
  event. Its metadata includes previous/new unit cost and date, restock
  quantity and the number of Water sale cost snapshots restated; that count is
  part of production reconciliation evidence.

Follow `docs/security/roles-and-permissions.md` and
`docs/architecture/audit-events.md` for the shared permission and audit
contracts.

## Business-unit classification dry run

Run the report for one explicit organisation:

```bash
pnpm --dir apps/reebs-portal run business-units:classify:dry -- --org=1
```

The script is `apps/reebs-portal/scripts/backfills/reportBusinessUnitClassification.js`.
It:

- starts a PostgreSQL `READ ONLY` transaction and always rolls it back;
- performs only metadata and `SELECT` queries;
- classifies Customers from real Order/Booking/WaterSale relationships;
- classifies Products from real OrderItem/BookingItem relationships and an
  explicit `WaterProductPrice.productId` link;
- recognises explicit commercial-configuration business units;
- classifies only InvoiceDocuments with a valid linked Order/Booking as Core;
- leaves unsegmented JournalEntries and unlinked/manual records ambiguous;
- never uses a name, description, note, email or fuzzy text match as evidence;
- never changes, creates, relinks or deletes a record.

`SHARED` in this report means an identity has structural use in both domains or
is explicitly marked shared. It does not combine transaction amounts. Review
all ambiguous records and unlinked Water-price rows manually before proposing a
separate, approved write-capable backfill.

## Migration and rollout order

1. Back up the target database and rehearse against a production-shaped,
   isolated copy. Confirm the environment and organisation inventory.
2. Run the classification dry run before migration for baseline Core/Water
   customer evidence. Save the output as restricted operational evidence, not
   in source control if it could expose production identifiers.
3. Deploy prerequisite migrations in timestamp order, including the Phase 5
   payment-integrity migration before
   `20260815100000_phase6_commercial_configuration`.
4. Apply the additive commercial-configuration migration before any runtime
   that requires those rows. In the approved production change window, the
   repository commands are:

   ```bash
   pnpm --dir apps/reebs-portal run db:status:prod
   pnpm --dir apps/reebs-portal run db:deploy:prod
   pnpm --dir apps/reebs-portal exec prisma generate
   pnpm --dir apps/reebs-portal run db:status:prod
   ```

   These commands are deployment instructions, not permission to apply the
   migration from a development or review session.
5. Verify every organisation has exactly one current value for each required
   Core rule and every active Water product/channel/quantity tier. The
   migration seeds organisations that exist when it runs; an organisation
   created later needs its required Core and Water rows provisioned and reviewed
   before its booking, checkout, invoicing or Water workflows are enabled. If a
   compatibility seed is no longer the approved live value, use the controlled
   Settings workflow to schedule a replacement effective row; do not edit or
   erase the historical seed in place.
6. Review every persisted Water Product link. Do not approve a link solely
   because a product name contains “water” or “gwater”.
7. Run the classifier again. Investigate changed classifications, ambiguous
   records, shared identities and unlinked Water prices.
8. Deploy the compatible backend before or together with the public website and
   Portal consumers. Verify the authenticated configuration API, public Core
   terms endpoint, shop checkout quote/order revalidation, booking creation,
   invoice drafts and Water sale creation all fail closed on missing or
   overlapping policy.
9. Reconcile representative new Orders, Bookings and Water sales against the
   seeded behavior before enabling price changes. Also compare a new invoice's
   stored deposit/due date with the effective Core rules and confirm a later
   configuration change does not rewrite an issued invoice.
10. Treat any production restock mutation that changes historical cost basis—a
    backdated create, cost/date update or delete—as a financial restatement.
    Rehearse it on the isolated copy and capture the restock set, Water summary
    and sale-cost snapshots before the change. After a cost/date correction,
    review `WATER_RESTOCK_COST_BASIS_CORRECTED` and reconcile its
    `restatedSaleCostCount`; after a create/delete, reconcile the pre/post
    snapshot difference directly. In every case reconcile affected-period
    COGS/profit and restock spend, confirm sale quantities, selling prices,
    Water revenue and Core totals did not change, and verify an orphaning case
    returns `409 WATER_COST_BASIS_REQUIRED` without persisting any mutation.
11. Defer every other historical cost/business-unit write until a separate
    backfill plan, preview, approval, rollback and reconciliation report exist.

Rollback is application-first: restore the previous compatible runtime while
retaining additive tables and history for investigation. Never reset or drop a
shared database as a routine rollback.

## Production configuration checklist

- [ ] Correct production database and organisation list verified; no
      development process points to production unintentionally.
- [ ] Exactly one of the supported public-tenant settings,
      `PUBLIC_ORGANIZATION_ID` or `REEBS_PUBLIC_ORGANIZATION_ID`, resolves to the
      intended website organisation; conflicting values are not configured.
- [ ] `REEBS_WEBSITE_URL`/approved origin configuration includes the production
      website origin used for the public terms and checkout quote requests.
- [ ] Required migrations are deployed and Prisma reports no pending migration.
- [ ] RLS is enabled/forced on commercial tables and tenant context is verified
      with allowed and cross-organisation tests.
- [ ] Exactly one effective Core row exists for every required commercial key.
- [ ] The compatibility values seeded for each existing organisation have been
      reviewed as current business decisions rather than accepted merely
      because the migration inserted them.
- [ ] Every active Water product has reviewed Retail, Bulk Retail and Company
      prices, correct thresholds, currency and effective windows.
- [ ] Every `WaterProductPrice.productId` link is reviewed from record identity
      and operational evidence, not a fuzzy name match.
- [ ] Classification dry-run output has no unexplained shared or ambiguous
      high-value record.
- [ ] Payment instructions and provider credentials exist only in approved
      server environment/secret storage; no actual credentials appear in code,
      browser variables, logs or this checklist.
- [ ] Owner/Admin write access, Core read access, Water read access, denied role
      behavior and cross-tenant denial are tested.
- [ ] Commercial changes create redacted, organisation-scoped AuditLog rows.
- [ ] A new Order snapshots selling price and available line cost without
      changing legacy rows.
- [ ] A new Booking retains its applied totals on ordinary edit; repricing is
      explicit.
- [ ] Public Core terms return only `REEBS_CORE` booking/payment fields and fail
      closed when a required effective row is missing or overlaps.
- [ ] Shop checkout quotes current catalogue/delivery values; public Order
      creation rejects a missing/invalid fingerprint, a stale fingerprint or
      unacknowledged price change, and recomputes rather than trusting browser
      totals.
- [ ] Mixed shop+rental partial-failure support has an assigned operator and a
      tested reconciliation procedure; customers are not instructed to submit
      the already-created shop Order twice.
- [ ] A new/draft invoice uses the server-resolved deposit/default due terms,
      receipts retain a zero deposit, and issued/sent documents retain their
      stored customer terms after a configuration change.
- [ ] Core invoice create/update rejects a linked Product classified as Water
      by source category or an explicit Water product-price relationship.
- [ ] A new Water sale retains standard price, actual price and override reason
      when applicable.
- [ ] Ordinary commercial/Water price configuration changes leave existing
      `WaterSale.unitCostAtSaleCents` snapshots unchanged.
- [ ] Restock creation (including a backdated insert), cost/date update and
      deletion re-resolve non-archived Water sale cost snapshots within the
      restock transaction.
- [ ] An approved restock cost/date correction creates
      `WATER_RESTOCK_COST_BASIS_CORRECTED`; its
      `restatedSaleCostCount` reconciles to the changed/resolved Water sale
      snapshots and Water COGS/profit, while sale quantity, selling price, sale
      revenue and Core totals remain unchanged. Create/delete restatements
      receive the same pre/post reconciliation even though this correction
      event belongs to update.
- [ ] A restock update/delete that would orphan the cost basis of a previously
      snapshotted sale returns `409 WATER_COST_BASIS_REQUIRED`; the restock and
      sale snapshots remain unchanged after rollback.
- [ ] Core, Water and consolidated fixtures independently reconcile revenue,
      COGS, expenses and profit.
- [ ] Revenue trend labels are distinct from collections/cash labels.
- [ ] Rollback owner, monitoring, reconciliation window and user communication
      are assigned.

## Explicitly deferred work and data debt

The following are not solved by the commercial-configuration foundation:

- first-class business-unit segments on JournalEntry/JournalLine and complete
  Water GL posting;
- Booking payment/receivable ledger and deferred-revenue automation;
- expense disbursement, refund, credit-note and partial-refund ledgers;
- shared-cost allocation and inter-unit elimination rules;
- reliable consolidated cashflow;
- historical OrderItem cost backfill where acquisition cost is unknown;
- unresolvable or archived historical Water sale cost snapshots, plus a reviewed
  accounting costing policy beyond the current restock-period operational
  method;
- a persisted correction reason, automated pre-save impact preview and formal
  approval workflow for historical Water restock-cost restatements;
- Customer/Product business-unit membership tables and an approved write
  backfill for ambiguous/shared identities;
- migration-owned `invoiceDocument`, cents conversion, numbering and corrected
  invoice/receipt uniqueness;
- reconciliation of `AccountingManualSales` major-unit history against imported
  journal history in minor units;
- removal of runtime DDL and legacy tables lacking consistent organisation
  scoping;
- dedicated Water chart-of-account mapping and an import contract that does not
  label Water as retail;
- deduplication rules between Expense and Maintenance cost;
- statutory tax-rule verification, approval ownership and fully effective-dated
  tax calculation;
- unification of the legacy device-local invoice tax default with approved
  `AccountingConfig`/`TaxRate` records and persisted invoice tax snapshots;
- one atomic, idempotent orchestration for mixed storefront checkout. The
  current shop Order and rental Booking are separate mutations, so a successful
  Order can require manual reconciliation if the Booking fails;
- a single customer-reviewed quote/fingerprint covering both shop and rental
  lines; shop delivery now fails closed without distance, but rental delivery
  charges remain outside that combined quote;
- correction journals for already-posted accounting classifications.

Deferred data must remain visible as unknown, ambiguous or unallocated. It must
not be estimated, text-classified or assigned to Core merely to make a report
complete.

## Related documents

- `docs/architecture/reebs-water-domain.md`
- `docs/architecture/reebs-boundaries.md`
- `docs/apps/reebs-portal/finance-consolidation-plan.md`
- `docs/apps/reebs-portal/order-payment-receipt-workflow-review.md`
- `docs/security/reebs-payment-data.md`
- `docs/security/roles-and-permissions.md`
- `docs/architecture/audit-events.md`
