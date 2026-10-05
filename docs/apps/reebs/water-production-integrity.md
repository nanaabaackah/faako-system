# Water production integrity — stabilization work log

Status: **in progress; not cleared for production or staging acceptance**.
Scope: existing `/admin/water`, shared authentication/database and PaymentRecord /
PaymentApplication, never Core order/payment/receipt/journal side effects. No new
app, production access, Git mutation or deployment is authorized by this work.

## Phase A: pre-change process inventory (2026-10-04)

Evidence: `backend/functions/water.js`, `water-momo-webhook.js`,
`commercial-config.js`, `customers.js`, `backend/modules/payments/*`,
`src/pages/AdminWater/*`, Water/Payments migrations and Prisma models.
PASS below means source plus existing isolated tests for that behavior, **not**
deployed/PostgreSQL acceptance. Other statuses identify work before acceptance.

Common Water command path: AdminWater form → `POST /api/water` action → internal
session/tenant + Water role/action permission → boundary validation → transaction
and product inventory/commercial locks where present → Water ledger SQL → rebuilt
product dashboard → UI state replacement → GET on reload. Read-only Water staff
projections suppress costs/profits. Exceptions and gaps are listed per process.

| # | Process / trigger → persistence → output | Baseline | Evidence / gap |
|---|---|---|---|
| 1 | Product selector → keyed GET → product ledger → dashboard | PARTIAL | Key propagated; customer history not product scoped |
| 2 | Dashboard load → scoped ledger reads → summaries → reload | PARTIAL | Stock/cost scoped; cash derived from sale status |
| 3 | Settings schedule → owner/admin → locked price insert → active prices | PARTIAL | Same-start unique index includes superseded rows |
| 4 | Historical schedule → Water-only date path → split/close → history | PARTIAL | Prior 99 tests/6 browser checks; real SQL constraints untested |
| 5 | Restock form → owner/admin → inventory lock → restock → stock/cost | PARTIAL | No durable retry protection; create restates sale costs |
| 6 | Edit restock → validation + re-lock → update → cost restatement | PARTIAL | In-request race check, no client revision token |
| 7 | Remove restock → stock check → physical DELETE → restatement | FAIL | Erases restock history |
| 8 | New sale → customer + historical price/cost → locked insert → stock | PARTIAL | No durable idempotency / creation audit / cash application |
| 9 | Edit sale → basis resolve + lock → sale update → totals | FAIL | Editable payment facts; stale browser revision not enforced |
| 10 | Archive sale → inventory lock → archivedAt → active totals | PARTIAL | No settlement guard or archive audit |
| 11 | Cash sale → embedded paid status → cash summary | FAIL | No atomic payment/application evidence |
| 12 | MoMo sale → pending state → callback settlement | PARTIAL | No charge initiation (intentional); ledger split |
| 13 | Credit sale → unpaid sale + stock leaves → credit total | PARTIAL | Initial stock correct; later collection path missing |
| 14 | Record collection → payment/application → balance | NOT IMPLEMENTED | Manual service handles Core Orders only |
| 15 | Partial collection → applications → remaining balance | NOT IMPLEMENTED | Shared foundation exists; Water projection sets paid unconditionally |
| 16 | Provider callback → authentication + fingerprint → locked sale | PARTIAL | Exact amount checked; currency/ref may be omitted; no common settlement |
| 17 | Customer selector/create → scoped compact API → shared identity | PASS | Existing role/tenant tests; no private Core history |
| 18 | Water customer detail → waterSale reads → history/totals | FAIL | Includes archived sales; no collections/balance/product filter |
| 19 | Expense form → owner/admin → insert → net profit | PARTIAL | Product scoped; no transaction/audit/idempotency |
| 20 | Expense edit/archive → update/archive → net profit | PARTIAL | No row lock/client revision/audit |
| 21 | Adjustment → owner/admin + inventory lock → signed ledger | PARTIAL | Zero/negative stock checks exist; no audit/idempotency |
| 22 | Adjustment edit/remove → lock → update/DELETE → stock | FAIL | Physical delete; browser revision not checked |
| 23 | Explicit cost correction → history resolution → sale cost update | PARTIAL | Product-scoped/transactional; creation currently also restates |
| 24 | Historical sale → transaction-date resolver → snapshots | PASS | Isolated real-handler tests; cost/discount must exist on date |
| 25 | Historical correction → changed quantity/channel/date → new snapshot | PARTIAL | Pricing works; settlement/amount protection missing |
| 26 | Discount → Water rule on sale date → validated total | PASS | Server authoritative; Core rules separate |
| 27 | Override → pricing permission → actual/standard snapshots | PASS | Price-only correction retains historical standard/cost |
| 28 | Financial summary → ledger reductions → revenue/cost/profit | FAIL | Cash timing follows sales; outstanding not applied-amount based |
| 29 | Product/date reporting → frontend filtering → KPIs | PARTIAL | Duplicated calculations; point-in-time vs flow mixed |
| 30 | Permissions → internal API + action gate → private DTO | PASS | Existing owner/admin vs Water-staff policy retained |
| 31 | Audit → writeAuditLog → history | PARTIAL | Cost and price correction events; many ordinary writes absent |
| 32 | Save/reload → rebuilt dashboard / GET → same records | PARTIAL | Network retry can duplicate; schema DDL still on requests |
| 33 | Concurrent edits → locks/comparison → conflict | PARTIAL | Locks protect stock; old client revision and expenses unprotected |
| 34 | Retry → request key/fingerprint → single persisted effect | FAIL | Provider fingerprints only; ordinary command keys absent |
| 35 | Staging → preview/API/DB separation → integration acceptance | AMBIGUOUS | Not accessed; no local PostgreSQL binaries found initially |

## Confirmed high-risk defects

1. A generic sale edit may fabricate/remove payment state and make collected cash
   change when a sale total changes; no authoritative collection reconciliation.
2. Shared provider settlement marks Water paid even for a partial amount; the
   payable loader takes `max(applied, legacy total)`, masking partial balances.
3. Legacy callback updates sale status rather than shared immutable collections.
4. Restock/adjustment removal physically deletes operational history.
5. New stock currently restates sale costs, not only explicit cost corrections.
6. Water expense edits have no stale-write protection; customer history counts
   archived sales. Ordinary writes lack durable idempotency and broad audit coverage.
7. Prisma omits real migrated snapshot/update/archive columns and WaterProductPrice.
8. Price uniqueness on all rows blocks same-start replacement after supersession.

## Execution order

1. Map and inspect (above), then shared Water settlement and commercial-edit guards.
2. Idempotent command boundary, archival, revisions, audit and schema alignment.
3. Collections UI, truthful terminology, scoped customer/report/export models.
4. Isolated PostgreSQL transaction/constraint/concurrency tests plus existing Core
   payment regressions, Water unit/handler/browser tests, lint/build and safe checks.
5. Staging-only fixture/runbook and final evidence/remaining blockers. Retain runtime
   DDL until staging proves the complete migration path, as explicitly required.

## Evidence still required

No production access or real secret inspection. Isolated PostgreSQL and deployed
staging acceptance must establish locks, rollback, schema compatibility and API/DB
separation. Unit/browser mocks alone cannot clear production readiness. Legacy
embedded paid rows must be reported separately, never assigned invented payment
records, dates or references.
