# REEBS roadmap process-integrity audit

Audit started: 2026-09-24. **In progress — not a release certification.**
Continued: 2026-09-25.

## Executive summary and evidence standard

The seven documented module deep dives cover Bookings/Rentals, Orders, Dashboard,
Inventory, Customers, Payments and Invoicing. These are completed implementation
passes, not claims that every requested capability shipped. Water and the earlier
commercial-configuration/settings work are also in scope. Accounting, Expenses,
Delivery, Documents and Maintenance are checked at their implemented integration
boundaries. No completed deep-dive evidence was found for HR, Marketing or Content
Studio; their mere presence in the module registry does not make them complete.

The evidence baseline is current source and the module reports, not pre-staging
commits. Prior reports sometimes describe capabilities superseded by later phases
(for example Payments added Booking applications after the Bookings report).

No real secret files, live database records or deployed provider accounts are
inspected. No Git commands, migrations, seeds, deployments or data repairs are run.
Existing Faako presentation is preserved; no visual redesign is authorized.

The current pass restores Water's owner/admin finance controls and enforces that
same boundary on the API, protects payment facts from read-time rewrites, repairs
payment retries/closed-source guards, checks paid cancellation under the Order
lock, and fixes CRM routing and Order loading regressions. A screenshot-discovered
Dashboard mobile/tablet header defect is corrected without changing the design
system. Storefront Shop pickup now obtains and confirms the server-required quote
before Order creation, including explicit review when prices or fees change.
Linked-invoice settlement and combined Shop/Rental delivery remain confirmed
exceptions, and real database/provider outcomes remain unverified. This is not
ready for unconditional release sign-off.

Statuses: **PASS** means the stated output has been demonstrated at the stated
test boundary; **PARTIAL** means a path exists but persistence/downstream proof is
incomplete; **FAIL** means a reproduced defect; **AMBIGUOUS** means an unresolved
business rule; **FUTURE** means not implemented, not an accidental regression.
Mocked HTTP/UI tests do not prove SQL persistence, constraints or concurrent locks.
Prior report test counts are historical evidence, not results of this audit.

## Discovery: completion evidence

| Module | Current entry/boundary | Completion evidence | Scope of this audit |
| --- | --- | --- | --- |
| Bookings/Rentals | `/admin/bookings`, `/book`, `functions/bookings.js`, `modules/bookings` | `bookings-rentals-deep-dive.md` | Existing reservation, pricing, lifecycle and integrations; not a fabricated return system |
| Orders | Portal Orders/POS, website Checkout, `orders.js`, `createOrder.js`, `_shared/shopOrders.js` | `orders-deep-dive.md` | Core sales, payments, stock, receipts and cancellation |
| Dashboard | `/admin`, `dashboardOverview.js`, `modules/dashboard` | `dashboard-deep-dive.md` | Core aggregates, permissions, drill-downs and freshness |
| Inventory | `/admin/inventory`, `inventory.js`, `stock.js`, `modules/inventory` | `inventory-deep-dive.md` | Core CRUD, variants, adjustments, maintenance and availability |
| Customers | `/admin/crm`, `customers.js`, `modules/customers` | `customers-deep-dive.md` | Identity, duplicates, archive, scoped history |
| Payments | `/admin/payments`, `orderPayments.js`, `modules/payments` | Portal `docs/PAYMENTS_PHASE_06_REPORT.md` | Manual Core settlement and implemented provider foundation; activation is separate |
| Invoicing | Invoice register/builder, `invoice-documents.js`, `modules/invoicing` | Portal `docs/INVOICING_PHASE_07_REPORT.md` | Draft/issue/void/send, snapshots and payment projections |
| Water | `/admin/water`, `water.js`, `water-momo-webhook.js` | Both Water architecture documents; current source | Standalone stock, costs, sales, payments, expenses, adjustments and KPIs |
| Settings/commercial rules | `portal-settings.js`, `commercial-config.js` | Phase-6 integrations, settings tests and current source | Preferences/document identity and effective-dated Core/Water configuration |
| Connected modules | Accounting, Expenses, Delivery, Documents, Maintenance, Analytics/Audit | Calls from the above modules | Verify the actual boundary; do not certify untraced standalone workflows |
| Future deep dives | HR, Marketing, Content Studio; other unimplemented capabilities | No completed deep-dive report found | Inventory as dependencies, not invented implementation |

## Process inventory (recorded before new audit fixes)

API paths below are canonical compatibility handlers; versioned aliases delegate
where configured. `U` = pure/domain tests, `R` = repository/SQL-client doubles,
`H` = handler with isolated dependencies, `B` = browser with mocked APIs.
All initial statuses are PARTIAL unless a known limitation/defect is explicit.
Every row needs persistence and downstream verification before module-level PASS.

| ID / Module | Process and trigger | Expected output / entities | API or service / downstream | External dependency | Existing coverage | Initial status |
| --- | --- | --- | --- | --- | --- | --- |
| B01 Bookings | Public booking submit | Scoped Customer + Pending Booking/items + reference, price/deposit snapshot | `bookings` → Customers, reservations, notifications | PostgreSQL; email/push optional | U/R; storefront browser | PARTIAL |
| B02 Bookings | Staff create / offline replay | One Booking/items per request key, actor retained | `bookings`, offline queue → Inventory, Audit | PostgreSQL | U/R | PARTIAL |
| B03 Bookings | Date/quantity availability search | Inclusive overlapping reservations and maintenance exclusion | `bookingAvailability` → catalogue availability | PostgreSQL | Policy/query tests | PARTIAL |
| B04 Bookings | Edit items/dates/prices/discounts | Authorized snapshots and recomputed reservation delta | `bookings` PUT → Inventory, documents, Dashboard | PostgreSQL | U/R | PARTIAL |
| B05 Bookings | Confirm, complete, cancel | Allowed transition; terminal lock; reservation release once | `bookingPolicy`, `bookings` → Inventory, Audit, Dashboard | PostgreSQL | U | PARTIAL |
| B06 Bookings | Search/filter/list/detail/assign staff | Scoped list/detail, stable reference and assignments | `bookingRepository` → Portal | PostgreSQL | R/B | PARTIAL |
| B07 Bookings | Add linked expense / refresh invoice | Expense retains bookingId; invoice reads linked expense as intended | `expenses`, invoice detail/build flow → Finance | PostgreSQL | `bookings-modal.spec.ts` B | PARTIAL |
| B08 Bookings | Notifications after save | Committed booking survives delivery failure; safe customer copy | `bookingNotifications` → email/push/WhatsApp | Providers | U | PARTIAL |
| B09 Bookings | Deposit/balance payment | Applied collection against trusted booking balance | Payments payable/application service | PostgreSQL/Paystack | U/R | PARTIAL: backend foundation, no complete booking payment UI |
| B10 Rentals | Return/inspection/damage/late charge | No authoritative per-unit return/charge model exists | Inventory boundary only | — | — | FUTURE |
| O01 Orders | Public quote then checkout | Server-priced Core order/customer/items; one reference; no client totals | `checkoutQuote`, `createOrder`, `createShopOrder` → Customers | PostgreSQL; notifications | U/B | FAIL found in follow-up: UI omitted required quote; see RI-017 |
| O02 Orders | Staff/POS create, offline replay | Scoped Core order; authorized overrides; idempotent replay | `orders`, `shopOrders` → Inventory, Payments | PostgreSQL | U/B | PARTIAL |
| O03 Orders | Search/filter/sort/page/detail | Stable Core register and linked history | `orders`, order detail | PostgreSQL | B | PARTIAL |
| O04 Orders | Manual full/partial payment | Payment + receipt + balance + stock/journal/event atomically | `orderPayments` → Payments, Inventory, Accounting, Dashboard | PostgreSQL | U/R/B | PARTIAL |
| O05 Orders | Pickup/delivery fulfillment transition | Forward-only state, paid handover guard | `orders`, `orderPolicy` → Dashboard | PostgreSQL | U/B | PARTIAL |
| O06 Orders | Cancel unpaid/paid, replay | Cancel once; restore committed stock once; paid becomes refund-pending | `orders` DELETE, `shopOrders` → Inventory, Finance | PostgreSQL | U; persistence gap | PARTIAL |
| O07 Orders | Print receipt / create invoice | Receipt proves payment; invoice owns billing separately | OrderReceipt, invoice document → PDF | Browser PDF library | B boundary only | PARTIAL |
| O08 Orders | Refund / order driver routing | Refund ledger and order-linked delivery routing absent | Existing Delivery is Booking-linked | Provider | — | FUTURE |
| D01 Dashboard | Initial load/window/refresh | Permission-shaped Core-only aggregates, bounded activity | `dashboardOverview`, repository → Portal | PostgreSQL | U/R/B | PARTIAL |
| D02 Dashboard | KPI and attention drill-down | Destination filters represent same source population | dashboard policy/view model → Orders/Bookings/Inventory/Delivery | — | B | PARTIAL |
| D03 Dashboard | Failed refresh / health check | Retain last data with stale warning; observed health only | overview hook, `health` | API/DB | B | PARTIAL |
| D04 Dashboard | Reconcile cards against source records | Exclude Water, cancelled/refunded and duplicate payment representations | repository → Reports/Finance | Isolated PostgreSQL needed | SQL/policy tests, not SQL execution | PARTIAL |
| I01 Inventory | Core/public list/detail/search/filter | Scoped eligible products/variants, public-safe fields | `inventory`, `inventoryVariants` → storefront | PostgreSQL | B/policy tests | PARTIAL |
| I02 Inventory | Create product / opening stock | Product + opening stock movement atomically | `inventory` → movement history | PostgreSQL | Boundary/source tests | PARTIAL |
| I03 Inventory | Edit / staff request / approve/reject | Allowed fields; no stock bypass; approved changes audited | `inventory` PATCH → catalogue | PostgreSQL | Limited | PARTIAL |
| I04 Inventory | Receive/remove stock, retry/concurrency | One positive-whole delta, nonnegative stock, movement + actor | `stock`, inventory service → stock history/Orders | PostgreSQL | U/R simulated locks | PARTIAL |
| I05 Inventory | Variant edit/archive/aggregate | Parent matches active variants; reserved quantity protected | `inventoryVariants` → Bookings/Orders | PostgreSQL | Limited | PARTIAL |
| I06 Inventory | Rental capacity correction | Cannot reduce below peak active bookings | inventory service/repository → availability | PostgreSQL | U/R | PARTIAL |
| I07 Inventory | Maintenance create/resolve | Unavailable until all open maintenance resolves | `maintenance` → product/availability | PostgreSQL | Limited | PARTIAL |
| I08 Inventory | Archive/unarchive/delete | Existing relationships/history preserved; public visibility correct | `inventory` → storefront/Orders/Bookings | PostgreSQL | Limited | PARTIAL |
| I09 Inventory | Item movement paging/report | Bounded Core-only movement/source/balance history | `stockActivity`, reconciliation | PostgreSQL | U/R | PARTIAL |
| I10 Inventory | CSV import | Staging-only dry-run and guarded import; no unsafe legacy reset | `scripts/imports/importCoreInventoryCsv.mjs` | CSV/isolated database | Import tests | PARTIAL; not executed against database |
| C01 Customers | Create/quick-create/public resolution | Normalized identity + stable reference; scoped duplicate reuse | `customers`, customer repository/contact policy | PostgreSQL | U/R/B | PARTIAL |
| C02 Customers | Edit/organization duplicate confirmation | Validated contact/address, no silent merge | `customers` POST/PUT | PostgreSQL | U/R/B | PARTIAL |
| C03 Customers | Archive/reactivate | Identity lifecycle changes; transactions retained | `customers` → selectors/history | PostgreSQL | U/R | PARTIAL |
| C04 Customers | Search/filter/page/compact selector | Bounded authorized identity lookup | `customers` GET → other forms | PostgreSQL | R/B | PARTIAL |
| C05 Customers | Core history/payment/invoice detail | Core totals only; field permissions enforced | Customer repository → Orders/Bookings/Payments/Invoicing | PostgreSQL | R/B | PARTIAL |
| C06 Customers | Water customer selection/history | Shared identity but explicitly Water transactions/totals | `customers?scope=water` → Water | PostgreSQL | R/B | PARTIAL |
| C07 Customers | Customer login/self-service/merge | No customer session or safe merge flow implemented | `/customer-login` is booking continuation | — | — | FUTURE |
| P01 Payments | Manual Order collection | Trusted balance, reference/method checks, atomic payment effects | manual service → legacy Order settlement | PostgreSQL | U/R | PARTIAL |
| P02 Payments | Initialize provider, repeat click | One trusted active attempt, no collection recognized yet | `paymentService`, provider registry | Paystack | U/R mocked provider | PARTIAL |
| P03 Payments | Verify provider / webhook / replay/race | Exact amount/currency/reference; one payment/application | `paystack-webhook`, service → owning payable | Paystack/PostgreSQL | U/R/H | PARTIAL |
| P04 Payments | Failed/expired/timeout/overapplication | No false paid state, structured recoverable error | payment service/application | Paystack/PostgreSQL | U/R | PARTIAL |
| P05 Payments | Core register/filter/page/detail | Universal + unlinked legacy without duplication; no Water | payment repository → Portal/Customers | PostgreSQL | R/B | PARTIAL |
| P06 Payments | Booking/Invoice/Water apply | Correct owning-domain balance and downstream updates | payable/application services → billing/Water | PostgreSQL | U/R | PARTIAL |
| P07 Payments | Refund/reassign/correct/export mutation | No immutable refund/correction workflow implemented | — | Provider | — | FUTURE |
| V01 Invoicing | Manual/linked draft create/edit/save | Server-owned Core source/amounts; unnumbered editable draft | `invoice-documents` → Customer/Order/Booking | PostgreSQL | U/R/B | PARTIAL |
| V02 Invoicing | Issue/retry/concurrent issue | Locked immutable customer/source/financial snapshots; unique sequence | invoice repository/handler → Documents/Payments | PostgreSQL | U/R | PARTIAL |
| V03 Invoicing | Paid/balance/status register/detail | Applied/source payments correctly projected; no fabricated receipts | invoice payment summary → Portal/Customers/Finance | PostgreSQL | U/R/B | PARTIAL |
| V04 Invoicing | Pay balance | Trusted issued Core payable; provider amount reload | Payments initialize → applications | Paystack | U/R | PARTIAL |
| V05 Invoicing | Send/resend email | Stored issued ID/snapshots; failed delivery does not unissue | `invoice-document-email` → Audit | Email | U | PARTIAL |
| V06 Invoicing | PDF/print | Snapshot totals/customer/reference match issued document | dynamic PDF features | Browser PDF | Limited | PARTIAL |
| V07 Invoicing | Archive draft / void issued | Draft-only archive; permission/reason/unpaid void; history retained | `invoice-documents` → Audit/Payments | PostgreSQL | U/R | PARTIAL |
| V08 Invoicing | Credit/refund/reminder/Water invoice | Not implemented; Core path rejects Water | — | — | — | FUTURE |
| W01 Water | Dashboard load and mutation refresh | Standalone metrics and authenticated capability DTO | `water` → four existing KPI cards | PostgreSQL | H/B added in restoration | FAIL → fix under verification |
| W02 Water | Add stock with cost | Restock quantity + integer-pesewa cost; stock/cash/profit update | `water` restock → Water summary | PostgreSQL | U/H/B | PARTIAL |
| W03 Water | Edit/delete historic restock | Guard stock; explicit correction restates affected cost snapshots | `water` update/delete_restock → Water profit | PostgreSQL | U/R/B | PARTIAL |
| W04 Water | Sale/price override/discount | Server scheduled price or authorized override; no required reason | `water` sale → stock/COGS/revenue | PostgreSQL | U/B | PARTIAL |
| W05 Water | Edit/archive sale, stale/conflicting edit | Stock and cost constraints; no lost update; recomputed Water summary | `water` update/delete_sale | PostgreSQL | Limited | PARTIAL |
| W06 Water | Record/update/archive expense | Water-only expense and net profit/cash effect | `water` expense actions | PostgreSQL | Limited | PARTIAL |
| W07 Water | Add/edit/delete adjustment | Whole signed quantity; no negative resulting stock | `water` adjustment actions | PostgreSQL | Limited | PARTIAL |
| W08 Water | MoMo notification/replay/out-of-order | Authenticated reference; paid cannot downgrade; Water-only event | `water-momo-webhook` → Water sale | MoMo notification provider | U/H | PARTIAL |
| W09 Water | Operator read/write authorization | Operational user receives no private costs/profit; no cost mutation | `water`, permission projection | PostgreSQL | H/B | FAIL: UI flags alone do not redact API |
| W10 Water | Filters/tables/finance/export/reload | Consistent scoped records and snapshot-based financial totals | `AdminWater`, shared waterFinancials | PostgreSQL/browser export | U/B | PARTIAL |
| S01 Settings | Save theme/style/preferences, reload | Validated per-user tenant settings; active Faako theme applied | `portal-settings` → AppShell | PostgreSQL | U/R/B theme checks | PARTIAL |
| S02 Settings | Document identity update | Authorized organization identity used by issued documents | portal settings → Invoicing | PostgreSQL | U/R | PARTIAL |
| S03 Commercial | Effective-dated Core terms | Authoritative quote/booking/deposit/delivery rules, historical snapshots retained | `commercial-config` → Core checkout/Bookings/Invoicing | PostgreSQL | U/R | PARTIAL |
| S04 Commercial | Water price schedule/link | Authorized Water configuration; no Core product link | `commercial-config` → Water pricing | PostgreSQL | U/R | PARTIAL |
| X01 Boundaries | Expense/Delivery/Document actions from completed modules | Correct parent identifiers, permissions, and refreshed downstream views | existing linked handlers | PostgreSQL/provider | B booking expense, limited others | PARTIAL |
| X02 Boundaries | Audit/reconciliation/report read | Redacted actor/request events; Core/Water separated; no repair | audit + financialPolicy + maintenance scripts | PostgreSQL/analytics optional | U/R | PARTIAL |

## Cross-module flow matrix

| Initiating flow | Authoritative write | Required downstream outputs | Proof still required |
| --- | --- | --- | --- |
| Storefront quote → Order | Core Order/items + Customer | Same trusted total in staff detail; pending payment; no stock double-count | Isolated SQL + reload |
| Order → Payment | orderPayment + receipt; universal records when provider applies | Order paid/balance; stock movement; journal; register/customer/dashboard count once | Transaction rollback/concurrent callback proof |
| Booking → Inventory | Booking/items + reservation | Availability/capacity; release on terminal transition | Overlapping two-session writes |
| Booking → Expense → Invoice | Linked expense; invoice snapshot on issue | Correct line/total; expense does not silently become customer debt | Business-rule and isolated persistence trace |
| Order/Booking → Invoice → Payment | Issued document; applied payment | Owning source balance, invoice balance and reports agree without double collection | Application cross-source trace |
| Water restock → Sale | Water stock ledger and sale cost snapshot | Stock, COGS, gross/net profit; historical cost edit is explicit | SQL transaction/reload plus partial failures |
| Water payment → Water sale | Water application/event | Water paid/credit totals only; no Core journal/payment | Isolated callback/application trace |
| Config → transaction | Effective configuration read at transaction time | Snapshot persists after config changes | Historical record preservation |

## Defect register

| ID | Priority / severity | Process | Root cause and impact | Fix / regression | State |
| --- | --- | --- | --- | --- | --- |
| RI-001 | P1 | W01/W02 | Water response omitted capabilities; frontend defaults hid administrator finance cards and cost field | Verified-principal capabilities on GET and mutation responses; await dashboard before closing request client | Fixed; handler/browser checks |
| RI-002 | P1 | W10 | UI read legacy cost field instead of canonical sale snapshot; profit appeared unavailable | Canonical `unitCostAtSaleCents` with legacy compatibility | Fixed; cost-edit browser check |
| RI-003 | P2 | W02 | Successful stock save reset cost input to previous dashboard cost | Keep submitted cost after save | Fixed; add-stock browser check |
| RI-004 | P3 | Browser evidence | API mocks matched `/src/api/` frontend modules and missed versioned session requests | Match API pathname prefix and both session aliases in completed-module specs; deterministic Water skeleton gate | Fixed; Water and completed-module browser cases pass across the documented runs |
| RI-005 | P0 / High | W09 | `water.js` returned raw costs/finance to operational users despite UI-only restrictions (REACT-AUTHZ-001) | Response allowlist and authoritative owner/admin cost-action checks; retain private calculation ledger | Fixed; handler/projection/browser checks |
| RI-006 | P1 | P02/P04 | Provider factory failure occurred outside initialization catch, leaving a pending attempt | Mark prepared attempt FAILED for configuration/factory failure | Fixed; red→green regression |
| RI-007 | P1 | P02/P06 | Closed sources with positive historical balances and archived Water sales remained collectable | Reject closed source status and exclude archived Water payable before application reads | Fixed; unit/repository regression; callback reconciliation still manual |
| RI-008 | P1 | O04/P01 | Current-balance/closed checks ran before exact payment replay, rejecting retry after settlement | Return original payment/receipt before new-collection checks; no legacy backfill on replay | Fixed; 8 replay/new-collection regressions |
| RI-009 | P1 / High | O06 | Paid-cancellation permission was checked before the Order lock; cancellation also bypassed lifecycle | Check capability from authenticated caller against locked row; enforce existing transitions | Fixed; 8 cancellation regressions; actual concurrency still unverified |
| RI-010 | P1 | W05/P06 | Water provider settlement did not update sale edit timestamp | Update `updatedAt` with settlement; preserve Water-only application | Fixed; application regression |
| RI-011 | P2 | W01–W09 | Water still created raw pg Client without socket-error listener | Use existing shared `createDatabaseClient` (no automatic mutation retry) | Fixed; shared-client and Water handler tests |
| RI-012 | P1 / High | P06/V03/V04/V07 | Linked invoices read/write a separate payment obligation, not their Order/Booking; source-paid invoice may look unpaid or be collectable again | Canonical source settlement and all read/void projections need repair; temporary linked-collection guard proposed | OPEN — release blocker for this path; decision requested |
| RI-013 | P0 / High | W01/W08/W10 | Water schema helper ran blanket payment-data updates on GET and mutations: pending MoMo became paid, paid credit became unpaid, dates/references were invented | Remove read-time normalization/backfill; preserve existing payment facts and let owning workflows update them | Fixed; handler regression; historical impact requires separate review |
| RI-014 | P2 | C04/C05 | CRM used generic standard-role routing despite navigation/API allowing driver read access; drivers were redirected to Bookings | Use existing CRM route policy; API permissions unchanged; warehouse/Water-only remain excluded | Fixed; route/policy and driver read-only browser checks passed |
| RI-015 | P1 | O03 | Order hook recognized only native AbortError; shared normalized cancellation could overwrite a successful current load | Guard aborted/superseded response, error and loading updates | Fixed; 3 hook lifecycle tests and desktop/mobile pickup workflow passed |
| RI-016 | P3 | D01 / mobile/tablet layout | Shared desktop header flex basis could override the equally specific Dashboard mobile rule, stretching the text container to 288px; wrapper-only tests missed the visible gap | Make the existing rule more specific and reset text flex at the shared 860px column breakpoint; measure visible text-to-controls gap after content/fonts load | Fixed; 213.8px text gap reproduced before correction; all Dashboard follow-up cases pass, including a final 390px/768px pair; mobile/tablet screenshots reviewed |
| RI-017 | P1 | O01 storefront | Checkout sent old item `price` fields and no quote fingerprint while `createOrder` requires a current quote; unconditional browser 201 hid the mismatch | Connect quote preflight, cents-based expected prices, fingerprint and explicit re-confirmation for changed prices/fees; use existing modal/total/status styling | Fixed; 11 pricing tests within the 23-test Website suite, both normal/changed-price checkout browser cases, and final Astro build pass |
| RI-018 | P1 | O01 mixed-cart delivery | The "deliver shop with rentals" option sends no distance and the draft sanitizer drops it; authoritative delivery pricing requires a positive recorded distance | Do not fabricate distance or bypass delivery pricing; a distance/location capture or approved staff-review flow must be agreed and implemented | OPEN — this combined-delivery option is not verified/complete |

## Financial integrity, persistence and status results

Not yet certified. Existing tests cover pesewa calculations, configured commercial
terms, lifecycle graphs and simulated stock/payment writes. None proves the current
deployed database is migrated, reconciled or free of historical discrepancies.
Historical discrepancies in prior reports must be rechecked manually in an approved
environment; those old counts are not new findings and no historical values are
silently changed in this audit.

Cancelled-source collection, manual replay, locked cancellation authorization and
Water settlement timestamps have targeted fixes. Reservation release, real stock/
payment rollback and two-session races still require an isolated PostgreSQL test.
Provider success alone is not evidence that all downstream records settled.

RI-012 is source-confirmed: `payableRepository.loadInvoice` subtracts only INVOICE
applications; `paymentApplicationService.applyPaymentToPayable` only invokes the
Order settlement pipeline for ORDER attempts and only updates invoice status for
INVOICE attempts. `invoiceRepository.loadInvoicePaymentState` also totals only
INVOICE applications (receipts use their snapshot). The UI's source-paid projection
does not repair those backend paths. Existing records must not be automatically
merged, counted twice, credited or refunded. A safe repair needs explicit canonical
application rules plus source/invoice/receipt/register/dashboard outcome tests.

A read-only in-memory reproduction loaded a fully paid 8,000-pesewa Order and
its linked invoice: the Order charge resolver returned `PAYABLE_ALREADY_SETTLED`,
while the invoice resolver still offered an 8,000-pesewa charge. Those are fixture
amounts, not a claim that a real customer has been charged twice.

RI-013 was discovered during the cross-module follow-up. Its former SQL lacked an
explicit organization predicate as well as changing payment facts on read. Removing
the three updates prevents future read-time rewrites, not recovery of earlier
misclassified rows. Fixture outcomes preserve 3,000 pesewas pending MoMo and 3,000
pesewas collected credit separately. Runtime compatibility DDL and vendor-link
normalization are still legacy debt; replacing them requires reviewed migrations.

RI-017 was source-confirmed after the Portal checks: `sanitizePublicCheckoutPayload`
rejects a missing fingerprint with `CHECKOUT_QUOTE_REQUIRED`, while the Website
never called the existing quote endpoint. The restored preflight validates the
quote's currency, line arithmetic, totals and requested items; no createOrder call
is made when quoting fails or a changed price/fee still needs review. A second
explicit confirmation re-fetches the quote and cannot reuse an acknowledgement
when its fingerprint changes again. Rental totals remain labelled estimates;
their separate Booking workflow is not replaced with Shop pricing. Existing
mixed-cart partial-success handling and RI-018 still need a full reviewed solution.

## Security/authorization and Water separation

Review uses the security-best-practices skill for Express, React and general browser
boundaries. Authorization must be enforced by the API, not hidden fields or buttons.
RI-005 was confirmed at `backend/functions/water.js` `buildDashboard`. The new
`backend/modules/water/dashboardAccess.js` projects operator responses at the HTTP
boundary, stripping costs, profit, private supplier details, snapshots and expenses.
It never mutates the ledger used by stock/cost calculations. Future fields are
excluded unless explicitly added to the operator allowlist. Legacy Core-manager
pricing flags cannot grant cost access through this projection.

User-confirmed policy: **owner/admin only; Water staff handle sales**. The API
rejects stock, expense, adjustment and cost-management actions from Water-only
users before Water-table work. They retain sale create/edit/archive and approved
selling prices; the UI hides the unavailable management controls. Handler tests
exercise ten forbidden action types and verify cost-bearing fields are absent.
No live account, exploit, credential or tenant data was used.

Core and Water remain separate in the audit. A shared Customer identity does not
authorize a shared commercial total. No Core/Water consolidation is enabled.

## Dashboard reconciliation / error and exception coverage

Pending end-to-end source recomputation. The policy and repository tests provide
useful guardrails but SQL string assertions do not establish aggregate correctness.
Missing, invalid, duplicate, stale, unauthorized, insufficient-stock and provider
failure cases are mapped above; each needs its real output and rollback checked.

## Tests, optimization and verification log

- Full Portal Node suite: **462 passed**, zero failures/skips, with dotenv disabled
  and a dummy database URL. Local TCP adapter test required sandbox approval;
  no real backend/database/provider was used. Includes Water payment-fact preservation,
  nested pricing redaction, CRM routing and Order request-lifecycle regressions.
  Targeted batches overlap the full suite; do not add counts.
- Payment replay batch: 43 passed; cancellation/policy batch: 11 passed; Water
  handler/restock/database-client/application batch: 32 passed. Reproduced failures
  before fixes for replay, provider config, closed payables, cancellation and timestamp.
- Website tests: **23 passed** against the final rebuilt static output, including
  all 11 checkout-pricing cases. Route audit:
  **1,125 HTML routes**, 22 rental and 1,045 shop details, 18 linked assets. Sitemap:
  **1,119 canonical URLs**, transactional routes excluded. This is local output,
  not a claim about CDN deployment or live API data.
- Both final production-mode builds passed with dotenv disabled. Portal includes
  CRM routing, Order request-lifecycle and Dashboard mobile/tablet selector fixes
  (1,621 transformed modules). Astro includes the checkout quote-contract repair
  and generated 1,125 pages, six CSP hashes and 22 catalogue redirects. These builds
  used explicit non-production loopback API settings for validation; do not deploy
  these local artifacts. A release must rebuild with its approved public deployment
  configuration. No branding, navigation or component redesign was introduced.
- Portal lint: zero errors, 11 pre-existing hook/refresh warnings. Website lint:
  zero errors, one existing CartContext hook warning. Shared types typecheck passed.
  Final Website Astro check: 134 files, zero errors, warnings or hints. Its first
  follow-up found six implicit-type errors in the new checkout browser fixture;
  an explicit item type corrected them without changing runtime assertions.
  The Portal ESLint configuration does not cover TypeScript browser specs; a
  targeted invocation reported those as ignored, not lint-verified. Playwright
  executes the specs; adding TS lint coverage remains tooling debt.
- Prisma schema validation and client generation passed using a dummy URL. No
  migration/status/connect operation was run; generated schema is not deployment proof.
- Latest security scan: **2,952 non-ignored files passed**. Environment contracts:
  66 Portal and 12 Website variable names. Monitoring registry, 30 workspace
  manifests and 3,413-file conflict-marker check passed. The earlier security gate
  and hosting-readiness checks passed, but the latest whole-workspace rerun fails
  outside REEBS: `apps/ttngh/appSystem.js` is missing (security gate) and
  `apps/ttngh/public/_redirects` is missing (Cloudflare readiness). No REEBS findings
  were reported by those checks. TTNGH is outside this audit and was not modified;
  the overall workspace gates must not be reported as green.
- Water browser suite: **17/17 passed together**, using mocked API requests only.
  Covers 320–1440px overflow/KPI/input, restock-cost correction, stock addition,
  owner/operator and skeleton behavior. Initial runs exposed fixture matching and
  cold-route readiness failures; those were corrected and the whole suite rerun.
  Screenshots reviewed at 320px and 1440px; no CSS/branding/navigation redesign.
- Completed-module browser run: **39/40 passed initially**. Investigation of the
  Dashboard failure distinguished a non-atomic measurement from a real stretched
  text container that the wrapper-only assertion missed. The strengthened test
  reproduced a 213.8px text-to-controls gap. After correcting selector specificity,
  **all 12 Dashboard/Order follow-up cases passed together**, including all 10
  Dashboard cases and both desktop/mobile Order mutation-and-reload cases. Thus
  all 40 distinct completed-module cases have passing current evidence across
  these runs, not a single claimed 40/40 run. Together with Water this covers
  57 distinct browser cases. A final **2/2** Dashboard rerun at 390px and 768px
  passed after extending the flex reset to the shared tablet breakpoint; reviewed
  screenshots show compact visible-text spacing. These overlap the 57 cases.
  No API fixture is evidence of SQL persistence.
- Storefront browser run: **10/12 passed initially**; the two six-page hydration
  and accessibility sweeps exhausted their shared 150-second budgets near the
  final route. Both passed together on rerun with 300-second budgets and all
  assertions/routes retained. All **12 distinct storefront cases** therefore have
  passing evidence across these runs, not one claimed 12/12 run. Coverage includes
  unchanged/changed-price pickup checkout, 18 routes at each of 320/375/390/430/768/
  1440px, keyboard navigation/search, hydration, useful 404 output and serious/
  critical axe checks. APIs were mocked and the local proxy fallback was disabled.
  Earlier development-server output included Astro audit fetch errors and
  navigation-time fetch diagnostics; this is not a clean-console certification.
- Bundle inspection: Portal entry **86.4 KiB**, over its existing 80 KiB budget;
  Water lazy chunk 79.7 KiB; total emitted Portal JS 2,840.7 KiB and CSS 5,651.9 KiB.
  Website client JS 976.2 KiB, CSS 919.2 KiB, largest chunk 351.3 KiB and 16 source
  hydration directives. Website JS was 972.9 KiB in the earlier pre-quote-repair
  build (a measured 3.3 KiB increase for this follow-up, not an audit-wide baseline).
  Emitted totals are not initial download costs. No valid pre-audit baseline was
  captured, so no audit-wide savings claim.
- Low-risk optimization: cancellation removes duplicate unlocked reads; response
  projection excludes private operator payload data; no parallel queries on one
  transaction client, cache/ledger redesign or dependency removal introduced.
- Deferred optimization: large repeated Portal CSS, entry-budget excess and remaining
  broad handlers. Correctness/source-payment boundaries take priority over extraction.

## Remaining manual verification

An approved isolated database is required to prove SQL execution, migration state,
RLS, transactional rollbacks and two-session concurrency. Test-mode Paystack, email
recipient policy/provider delivery and MoMo notifications require separately managed
test credentials. Staging rollout, edge headers and real-device confirmation remain
manual. None is replaced by a mocked result or a production smoke test.

### Isolated-environment acceptance sequence (not executed)

Use synthetic records in an explicitly approved, migrated test organization. Do
not copy production customers or payments, reset a shared database, or place
provider credentials in the report. Retain IDs/request IDs for the verifier, not
private payloads in logs.

1. Create a public Shop pickup Order from its live quote. Compare quoted prices,
   persisted line snapshots, Order detail, Customer history and the response after
   reload. Repeat the exact request key and prove no second Order/items/event.
   Change a catalogue price between quote and create: creation must reject until
   the customer reviews a fresh quote. Do not treat the mixed delivery option as
   accepted while RI-018 is open.
2. Record a partial then final Order payment. Verify payment, receipt, balance,
   stock movement, journal and reporting contribution together after reload.
   Replay each key and check record counts and quantities do not increase.
   Inject a failure between writes and verify the transaction rolls everything
   back. Concurrent collectors must not overapply the remaining balance.
3. Try paid cancellation as ordinary staff while another session settles the
   Order; authority must be checked against the locked row. Owner/admin
   cancellation must restore only previously committed stock, once, and preserve
   refund-pending rather than pretend a provider refund occurred.
4. Create/edit/cancel a Booking across overlapping dates and maintenance blocks.
   Verify availability before and after each operation, including two competing
   sessions and reload. Add a linked expense, then read the invoice source from a
   fresh session. Verify the approved billing treatment, not merely presence of
   the expense row.
5. Issue an invoice twice/concurrently and verify one immutable issued snapshot
   and number. Exercise unpaid void and send failure against stored state. Do
   **not** activate separate linked-invoice collection while RI-012 is unresolved;
   source balance, invoice balance, void eligibility, receipt and dashboard must
   agree after its repair without counting one collection twice.
6. Add Water stock with purchase cost; record cash, pending MoMo and credit sales;
   correct a historical restock cost as owner/admin. Recalculate stock and Water
   COGS/profit from the agreed snapshots and verify after reload. Repeated GETs
   must not change payment facts. Test staff denial directly against cost-bearing
   actions and responses, not only hidden UI. Prove Core reports are unchanged.
7. Exercise tenant/role boundaries with separate verified sessions: cross-tenant
   IDs must not resolve; driver CRM remains read-only; Water operators receive no
   private purchase costs. Save per-user settings and verify light/dark styles and
   document identity after a new session, without changing another user's settings.
8. Only after the above, use separately configured provider test accounts for
   Paystack initialize/verify/webhook replay, Water MoMo notification, and staging
   email recipient policy/delivery. Compare actual owning-domain outputs and
   reconciliation results; a provider success or HTTP 200 alone is insufficient.

## Browser outcome coverage by completed module

All rows below use a local frontend and controlled HTTP fixtures. The source API
must separately prove the same outcome against an isolated database; passing UI
tests cannot establish ledger correctness, transaction rollback or RLS.

| Module / cases | Output observed | Evidence limit / next check |
| --- | --- | --- |
| Bookings / 3 | Desktop/mobile modal controls stay inside the panel; adding an expense submits the linked booking, shows success and re-reads that expense through the invoice route | Proves client wiring and refresh, not expense/invoice SQL persistence or billing policy |
| Orders / 2 | Only the permitted next pickup step is available; one PATCH advances the workflow; reload re-reads the updated step without another mutation; desktop/mobile fit | Mock handler retains the update; database status/stock/journal effects remain separate |
| Dashboard / 10 | Core-only labels, KPI drill-down targets, role-limited widgets, light/dark cards, automated accessibility, 320–1440px fit and mobile text/control spacing | Fixture aggregates are not a reconciliation against real source transactions |
| Inventory / 3 | Supported screen sizes fit; operational stock states stay Core-only; detail opens and requests movement history lazily | Does not prove stock writes, competing reservations or real history persistence |
| Customers / 5 | Ghana-ready organization form submits; payment/invoice history is presented; driver workspace is read-only; keyboard and automated accessibility checks pass | Driver browser test proves navigation/read-only controls, not server financial redaction; role/tenant enforcement needs independent API evidence |
| Payments / 9 | 320–1440px register retains source separation; keyboard-operable detail dialog; light/dark and automated accessibility pass | Collection/provider/database effects are not exercised by register fixtures |
| Invoicing / 8 | Register fits 320–1440px with pagination; issued document controls are immutable; linked Order paid/balance values display | Frontend projection does not repair RI-012 backend collection/void inconsistency |
| Water / 17 | Owner/admin four-card view and editable stock cost; cost edit recomputes fixture profit; stock addition retains entered cost; operator cannot access cost controls; skeleton/navigation and 320–1440px fit | Backend cost authorization/redaction has separate isolated handler tests; SQL cost restatement and concurrent settlement remain manual |

## Current process verification matrix

The initial inventory is deliberately retained; the table below supersedes only the
listed statuses. **PASS (isolated)** verifies a named boundary, not production or a
whole module. No module is certified end-to-end. Other implemented rows remain
PARTIAL; future rows remain FUTURE.

| Process | Verified output / test boundary | Status / remaining evidence |
| --- | --- | --- |
| W01/W09 | Principal-derived permissions; four admin cards; operator sales-only API payload/actions | PASS (isolated handler/projection); actual session/RLS manual |
| W02/W03/W10 | 24.50 GHS persists in payload as GHS and backend converts to 2,450 pesewas; stock-add retains input; cost-edit recomputes profit without stock change | PASS (fixtures/browser); SQL reload/cost restatement partial |
| W04 | Authorized selling-price change needs no reason; operator price input read-only | PASS (domain/browser); persisted concurrent effective-price selection partial |
| W05/P06 Water | Provider application targets WATER/WATER_ORDER only and updates edit timestamp | PASS (repository double); callback vs edit race partial |
| O04/P01 | Paid/completed/cancelled exact retry returns original receipt; changed amount conflicts; fresh closed/settled collection blocked | PASS (SQL-client fixture); real side-effect rollback partial |
| O06 | Locked paid-authority guard; delivered/completed/refunded transitions rejected; cancel replay no second side effect | PASS (SQL-client fixture); two-session race/stock restoration partial |
| P02/P04 | Missing provider config marks failed attempt; closed payables reject collection; archived Water not found | PASS (isolated); provider sandbox/reconciliation partial |
| O03/O05 UI | Superseded requests cannot replace current Order state; fulfillment mutation is reflected immediately and after reload on desktop/mobile | PASS (hook/browser fixtures); database fulfillment side effects partial |
| C04/C05 driver UI | Existing backend-authorized CRM route is reachable and operational controls remain read-only | PASS (route/policy/browser); actual session/RLS partial |
| D01 UI | Core-only role-shaped cards, theme checks, drill-down links and visible mobile header spacing | PASS (browser/screenshot); source aggregate reconciliation partial |
| B07 UI | Booking expense mutation links its parent and invoice navigation re-reads the added expense | PASS (browser fixture); actual persistence and customer billing policy partial |
| O01 Shop pickup UI | Quote precedes one idempotent createOrder request; unchanged price proceeds; changed and re-changed prices need fresh explicit confirmation; no protected Customer call | PASS (browser with real pure server quote guard); transaction/notification persistence partial |
| O01 combined delivery | Shop delivery requires distance that the current combined-cart form cannot supply | FAIL / OPEN RI-018; no fabricated distance or waived pricing guard |
| P06/V03/V04/V07 linked invoice | Independent application does not settle source; inconsistent paid/balance/void projection | FAIL / OPEN RI-012 |
| Public catalogue/routes | Static pages, assets, metadata/sitemap and rental/shop detail targets exist | PASS (built artifact); live API, CDN and conversion/browser flows partial |
| B01–B09, O01–O03/O05/O07, D01–D04, I01–I10, C01–C06, P03/P05, V01/V02/V05/V06, W06–W08, S01–S04, X01/X02 | Existing domain/repository tests, source trace and documented boundaries | PARTIAL; not a new end-to-end certification |
| B10/O08/C07/P07/V08 | No approved end-to-end implementation present | FUTURE; not fabricated |

## Files changed in this audit pass

- Water: `backend/functions/water.js`, `backend/modules/water/dashboardAccess.js`
  and their new tests; AdminWater page, WaterRestockCard, WaterLedgersSection;
  Water restock/responsive specs and `packages/types/src/reebs.ts`.
- Payments: payableRepository, paymentService, paymentApplicationService and their
  tests, including new paymentManualReplay/paymentApplicationService tests.
- Orders: `backend/functions/orders.js`, `_shared/shopOrders.js`, new
  `backend/modules/orders/orderCancellation.test.js`.
- Browser fixtures: Bookings, Orders, Dashboard, Inventory, Customers, Payments and
  Invoicing API-path/session mocks. These prevent test code from replacing JS modules.
- Follow-up browser-discovered fixes: CRM routeConfig and access-policy regressions;
  Order `hooks/useOrder.js` and its isolated request-lifecycle test; Dashboard mobile
  header selector specificity and visible-content spacing regression. Order browser
  checks now reload after fulfillment changes to rule out component-only state.
- Storefront contract repair: Checkout view and `utils/checkoutPricing.js` connect
  the existing server quote guard; checkout-pricing unit tests and checkout-order
  browser tests cover review/re-confirmation. Storefront responsive API mocks now
  match only the API pathname, not frontend source modules.
- Documentation: this report, Water architecture, Payments/Invoicing architecture
  and the dated Orders deep-dive addendum. Existing restoration/navigation/import
  work was preserved; no Git-based change inventory was attempted.

No deployment, migration, seed, historical backfill, real-provider call, Git command,
secret-file read/edit or production/staging data mutation was performed.

## 2026-09-26 — Public commerce pause and table-control continuation

This addendum supersedes the earlier **enabled** O01 public Shop/Booking browser
checkpoint for the current release. The owner's current instruction is to keep
the catalogue browseable but prevent public purchases and rental submissions.
The enabled-checkout tests remain explicitly skipped until reopening is approved;
their earlier passes are not evidence of current public checkout availability.

### Changes and protected boundaries

- A frozen shared `reebsPublicCommerce` policy blocks public checkout quote,
  order creation and anonymous booking submission at the API, before database or
  provider work. Legacy and versioned aliases resolve to the guarded handlers.
  Staff authentication/permission/tenant checks remain authoritative. Internal
  Portal orders/POS and the separate Water Business are not paused.
- Storefront Checkout/Book render a contact/browse state without mounting the
  transaction forms. Add-to-cart/context writes are disabled; saved carts are
  preserved. Public product structured data retains product identity but omits
  purchase offers. No branding, navigation or gallery redesign was introduced.
- Portal table helpers provide value-aware sort, accessible Iconsax headers,
  native mixed-state page selection and sequential archive that stops at the
  first error without retries. Rental catalogue bulk archive uses its existing
  owner/admin inventory endpoint; Inventory now reflects confirmed successes
  after a partial batch failure. Failed/unattempted records remain available.
- Data headers/pagination were integrated in Orders, Bookings, Rentals, Payments,
  Invoicing, Water ledgers, Expenses, Maintenance, Marketing and Roles. Payments
  sort the full register in allowlisted SQL before pagination and ignore stale
  frontend responses. Directory Users/Vendors sort their full returned lists.
  Reports retain Faako DataTable and gain optional independent pagination.
- Posted payments, issued invoices, accounting/audit history and Water ledger
  records receive no new bulk archive. Existing lifecycle actions were not
  repurposed. Core/Water financial separation and private purchase-cost access
  remain unchanged.
- Visual checks found and repaired missing Iconsax SVG paths, overlapping Rental
  selection cells, narrow Water pagination clipping and a global CSS rule that
  compressed Rental columns despite their intended minimum width. Rental rows
  now scroll inside their own focusable region, not the entire page.
- The Reports mobile test exposed a shared SelectField focus bug: opening its
  body-portalled menu could scroll the document while fixed positioning was
  applied, moving both trigger and menu off-screen. Initial/return focus now
  preserves document scroll. Stable positioning callbacks also remove the two
  shared UI hook warnings; no theme tokens or picker design were changed.

See [public-commerce-and-table-controls.md](public-commerce-and-table-controls.md)
for the per-register implementation matrix and remaining work. This is a
checkpoint, **not a claim that every module/table is complete**.

### Verification and release limits

- Portal Node tests: **480 passed**, using environment-file loading disabled and
  a dummy non-listening PostgreSQL address. No shared database was used.
- Storefront Node/static tests: **23 passed**; public pause browser tests passed
  at 390px and 1440px, including saved carts and forged client flags. The catalogue
  browse/disabled-action/structured-data browser check passed after correcting
  its JSON-LD array parser. Public enabled-commerce tests are intentionally
  skipped under this release policy.
- A final targeted Portal run passed **11/11**: desktop/mobile Booking modal,
  linked expense refresh, Order pickup progression, Payments sort request and
  persisted dark/light theme, Rental partial archive, and populated Water
  sorting/pagination. Earlier broader failures prompted fixes and reruns; they
  were not counted as passes. The subsequent Rental width assertion and new
  Directory/Reports checks are recorded separately below when complete.
- `@faako/ui` typecheck and its two existing dialog tests passed. Shared UI lint
  and typecheck were rerun after the picker fix with zero errors or warnings.
  The new pagination's
  functional behavior is covered by the Reports browser test, not those dialog
  tests.
- The latest security gate run fails on an unrelated workspace prerequisite:
  `@faako/ttngh` is missing `apps/ttngh/appSystem.js`. The broad security scan was
  initially withheld after filename-only discovery of a credential-named CSV.
  Its walker now classifies sensitive exports by path and fails before content
  reads when they are present. The later scan **passed across 2,974 non-ignored
  workspace files**, with two path-guard tests passing. No secret file was opened
  or changed. This is not an assertion about the Git index, which was not read.
- Builds use dummy API addresses for verification and are not release artifacts.
  Release API before/together with the disabled storefront and verify in isolated
  staging; no claim is made about the currently deployed public site.
- Final builds passed: Portal **1,631 modules** and Astro storefront **1,125
  pages**, with six CSP hashes and 22 catalogue redirects finalized. Post-build
  checks passed: **23/23** storefront tests, **1,125** static HTML routes and
  **1,119** canonical sitemap URLs. Portal lint passed with no errors and 11
  existing warnings; storefront lint earlier in this continuation had no errors
  and one existing warning. Astro check reported no errors/warnings across 136
  files before the optional shared-UI pagination addition; shared UI typecheck
  was rerun after that addition and passed.
- The subsequent Directory/Rental/operational browser run passed **9** cases:
  Expenses, Maintenance, Marketing, Roles, Directory Users/Vendors, Rental
  desktop/mobile sorting and partial archive, and staff archive-control denial.
  The stricter Rental check asserts a minimum readable table width, contained
  horizontal scrolling and no page overflow. Its updated mobile screenshot was
  reviewed. Reports sorting/pagination passed up to the range picker; its first
  run failed on a test selector expecting a native named combobox instead of the
  existing Faako picker button. The next run exposed the actual focus/viewport
  bug described above. After its repair, **5/5** browser cases passed: the full
  Reports sort/page/range/keyboard/viewport check plus the three Booking modal
  and linked-expense cases and Payment keyboard-dialog case. Assertions were
  strengthened to require the open picker to fit inside the mobile viewport.
- Bundle report (raw emitted assets, not per-navigation transfer): Portal JS
  **2,859.9 KiB** versus the pre-pass **2,840.7 KiB** (+19.2 KiB); Portal CSS
  **5,653.3 KiB** versus **5,651.9 KiB** (+1.4 KiB). Website JS **980.6 KiB**
  versus **976.2 KiB** (+4.4 KiB), CSS unchanged at **919.2 KiB**, with 16
  hydration directives. This functional pass is not a bundle reduction. The
  Portal entry remains above its 80 KiB review budget at **86.8 KiB**; PDF/map
  vendor boundaries remain separate. Repeated Portal CSS output is existing debt.
- CRM global sorting/segment semantics, its reversible bulk archive, Directory
  customer pagination, Accounting/nested registers and mobile-card sort controls
  remain open. RI-012 linked settlement and RI-018 delivery distance remain open;
  the public pause does not repair those financial contracts. Real PostgreSQL
  rollback/RLS/concurrency, provider and live release checks remain manual.

## 2026-09-27 — Water readiness continuation

This supplements the earlier checkpoints, without certifying deployed state.
The full Portal suite now passes **495 tests**, including eight legacy MoMo
handler regression cases and new cost-completeness/health cases. The latest
Water browser run passed **21 cases** before the additional theme/dialog audit.

- The legacy MoMo callback no longer backfills payment references across the
  Water sale table; both lookup paths and settlement exclude archived sales.
  Exact replay, wrong/missing amount, wrong currency and tenant mismatch are
  tested against the actual handler with a stubbed database. No Core financial
  records are written by those fixture flows.
- API and Portal now share purchase-cost completeness calculations. Missing sale
  snapshots produce unavailable COGS/profit, not a compatibility/default cost or
  an inferred restock cost. Empty stock ledgers require explicit purchase cost.
  Explicit, audited restock corrections still restate the relevant snapshots.
- Shared pricing capabilities now enforce the confirmed owner/admin-only policy.
  Water-only staff retain sales, with private cost/finance fields omitted.
- `/health/water` now probes effective price tiers and the Water discount rule,
  not the obsolete product-config cost. This remains a global configuration
  signal, not a per-tenant stock/provider/migration/RLS certification.
- The extra accessibility audit found an unlabeled refresh button, low-contrast
  light-theme summary labels and duplicate modal banner landmarks. Fixes use
  existing Faako tokens and unchanged modal markup/layout. Water edit dialogs now
  reuse the shared Faako focus/Escape lifecycle, including return focus. Select
  popovers own their first Escape and close on Tab before focus returns to the
  trigger; closing a picker must not discard its parent form.
- Builds at the pre-dialog checkpoint passed (Portal 1,632 modules; storefront
  1,125 pages). Website tests **23/23**, static routes **1,125**, sitemap **1,119**,
  Astro check (136 files, zero errors/warnings/hints) and shared UI typecheck passed.
  Portal lint has zero errors/11 existing warnings, website zero errors/one.

See [Water release readiness](water-release-readiness.md) for the final check
results, staged-data go/no-go checklist and **manual-only Git flow**. Production
use remains pending staging/database/provider evidence and the TTNGH security
gate decision. No Git, deployments, migrations, seeds or real secret reads were
performed.

The final UI regression run initially passed 30/32, with a cold-load Payments
timeout during concurrent builds and a fast-Tab SelectField race. After fixing the
trigger/listbox Tab paths, **7/7** isolated cases passed: both Water themes with
automated contrast/accessibility scans, modal focus wrap/return and nested picker
Escape/Tab; Payments 320px; Booking desktop/mobile and linked expense; Reports.
Both mobile restock-dialog screenshots were reviewed. Shared UI lint/typecheck,
its two dialog tests, and shared types typecheck passed. The secret-safe scan was
rerun successfully across **2,975** non-ignored workspace files. The TTNGH gate
failure remains; no gate/hook was disabled.

The final sequential rebuilds passed after the last keyboard fix: Portal 1,632
modules; storefront 1,125 pages, six CSP hashes and 22 catalogue redirects. Final
raw bundle totals are Portal JS **2,863.4 KiB**, CSS **5,653.4 KiB**; website JS
**981.0 KiB**, CSS **919.2 KiB**. The Portal entry budget warning remains at
**86.8 KiB** against 80 KiB. These supersede the earlier pre-dialog bundle totals.

### TTNGH gate follow-up — 2026-09-27

The owner authorized completing TTNGH's partially created `appSystem.js` and
confirmed that Cloudflare is not configured. Metadata now matches its existing
pink/black Astro site and unauthenticated contact handoff; no design was changed.
The repository security gate now passes, superseding the earlier missing-config
failure. The hosting gate passes for non-deferred apps and explicitly reports
only TTNGH as deferred through an exact package/path policy. Security, build,
Railway and legacy-hosting checks remain enabled. Six focused configuration,
hosting-policy and secret-path tests passed; the secret-safe scan passed across
2,980 non-ignored files. Changed JavaScript lint and both registry checks pass.
See [TTNGH deployment status](../ttngh/deployment.md) for the required removal of
that deferral before launch. No Git, deployment, migration or secret-file operation
was performed. Water still needs the manual staging/database/provider evidence
listed in its release-readiness runbook.
