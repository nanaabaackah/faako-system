# REEBS Orders deep dive

Status: implemented foundation with explicit deployment prerequisites; not certified production-ready
Date: 2026-08-30
Scope: REEBS core retail Orders only

## Boundary and architecture

Orders is the REEBS core retail-sale domain. It is distinct from rental Bookings and from the standalone Water business. New Order and OrderItem records are stamped `REEBS_CORE`. Products configured in `waterProductConfig`, and products categorized as `WATER` or `RENTAL`, are rejected by the Orders pricing path.

The current request path is:

```text
Storefront Checkout (Astro-hosted React island)
  -> POST /api/createOrder (public, narrow checkout boundary)
  -> customer contact resolution
  -> createShopOrder transaction
  -> server catalogue pricing + row locks
  -> order + immutable lines + event
  -> customer/manager notification after commit

Portal Orders / POS / Order Builder (React/Vite)
  -> authenticated /api/orders and /api/orderPayments
  -> permission + organization context
  -> order policy + shopOrders transaction service
  -> order/payment/receipt/stock/journal/event records
```

Backend domain modules now prove the intended boundary:

- `backend/modules/orders/orderPolicy.js`: lifecycle, transition and next-action policy.
- `backend/modules/orders/orderNotifications.js`: safe order notification content.
- `backend/modules/customers/contactPolicy.js`: Ghana/international phone normalization reused by Bookings and Orders.
- `backend/functions/_shared/shopOrders.js`: still the large transactional application service and the main remaining extraction target.

## Discovered capabilities and gaps

Before this pass, Orders already had server catalogue price lookup, product/variant row locks, conditional stock decrement, stock movements, manual/partial payments, receipt snapshots, accounting journals, cancellation/restock behavior, audit events, a portal list/board/ledger, POS offline order queuing, and manual-payment drafts.

The important disconnected or unsafe areas were:

- `/api/createOrder` was only a re-export of the staff-authenticated Orders handler, while website checkout called it without a staff session.
- Checkout called the protected Customers API and trusted a returned numeric customer ID.
- Creation accepted client origin/status/discount/fee values too broadly.
- zero-price catalogue or variant values could create zero-value lines;
- order and fulfillment states could be changed without a forward transition graph;
- online and offline manual-payment idempotency keys were not enforced end-to-end;
- Prisma omitted the already-migrated `orderPayment.idempotencyKey` field;
- mutable product cost was not snapshotted on order lines;
- Order detail fetched its payments twice;
- Astro's separate storefront islands could start with different cart state, and restoring a stored cart during hydration caused server/client markup mismatches;
- Vite could discover storefront dependencies after Astro began hydration, returning `504 Outdated Optimize Dep` for an island on cold development starts;
- the Paystack references in product copy/plans had no REEBS runtime implementation;
- Delivery currently models Bookings only, not Orders;
- customer organization/contact-person fields and customer order self-service do not exist in the current shared customer model.

## Lifecycle

The retained compatibility states are `draft`, `pending_payment`, `partially_paid`, `paid`, `processing`, `ready_for_pickup`, `out_for_delivery`, `delivered`, `completed`, `cancelled`, and `refunded`. Payment writes remain server-controlled and derive `unpaid`, `partially_paid`, `paid`, or legacy `overpaid` state from successful payment rows.

Manual order edits now use forward-only policy. Fulfillment follows one of two paths:

```text
Pickup:   not_started -> preparing -> ready_for_pickup -> picked_up -> completed
Delivery: not_started -> preparing -> out_for_delivery -> delivered -> completed
```

Handover/dispatch steps require a zero balance. Cancellation continues through the dedicated cancellation operation so paid orders become `refund_pending` and committed stock is restored once. The fulfillment selector now displays only server-returned next actions; it cannot be used as a cancellation shortcut.

## Creation, origin and customer handling

Public creation now requires:

- a configured public organization;
- an allowed storefront origin;
- JSON content type;
- an `Idempotency-Key`;
- IP window rate limiting;
- customer name and valid email or normalized phone;
- a non-empty, bounded item set.

The public API resolves the customer inside the server transaction and does not accept a customer ID as authority. It returns only reference, status, GHS totals, payment status, and fulfillment method. Public source is fixed to `Storefront`, channel to `Online`, status to `pending_payment`, and commercial overrides to zero/server calculation.

Staff order creation remains authenticated and organization-scoped. Owner/admin/manager roles may submit explicit discounts or fee overrides; ordinary staff may not. POS and booking add-on origins retain their existing behavior.

Order references and receipt references now use the maximum valid daily suffix under an advisory transaction lock rather than row count, avoiding duplicate references after gaps/deletions.

Phone input supports Ghana local `0XXXXXXXXX`, `233XXXXXXXXX`, and `+233XXXXXXXXX` forms, while preserving valid explicitly international `+` numbers. The logistics sanitizer supports practical address, contact, landmark, recipient, delivery date/window, notes, distance, and validated GhanaPost GPS values such as `GA-123-4567`. The current checkout form does not yet expose a dedicated GhanaPost field.

The Astro storefront cart now starts from the same empty state on the server and the first browser render, restores storage after hydration, and synchronizes cart/currency changes between the independent page, header and footer islands. Explicit Vite dependency optimization prevents cold-start dependency invalidation from leaving controls rendered but non-interactive. These are reliability changes only; no storefront design or branding was changed.

## Pricing, costs and totals

The server owns product/variant price, stock availability and order totals. A line with no positive selling price now fails with `ORDER_PRICE_UNAVAILABLE`; client line prices are ignored. Public discounts/service-fee overrides are ignored and public delivery fee uses the configured delivery calculation. Staff commercial overrides require manager-level authority.

The migration adds immutable order-line fields:

- `unitCostSnapshotCents` (nullable when catalogue cost is genuinely unknown);
- `lineDiscountCents`;
- `taxCents`;
- `businessUnit = REEBS_CORE`.

It also adds Order currency (`GHS`), tax, business unit and an idempotency fingerprint. Historical cost is deliberately not backfilled from today's product record. Cost/margin fields are returned only to users with `financials:read`; ordinary Orders readers do not receive private cost data.

Tax remains zero until an approved, effective-dated REEBS Orders tax rule exists. This pass does not invent a Ghana tax rate. New constraints enforce positive new line quantities/prices/totals and non-negative commercial amounts. Amount checks are `NOT VALID` for historical rows so existing discrepancies remain visible and are not silently rewritten.

## Inventory behavior

Catalogue product and selected variants are loaded `FOR UPDATE`. A conditional decrement prevents negative stock under concurrency, and stock movement existence prevents a paid-order retry from decrementing twice. Stock is committed on successful/full POS payment or a compatible committed state. Cancellation creates a single compensating restock movement when a prior sale movement exists.

The read-only audit found zero invalid order lines and zero Water-configured products in core Order lines. Final-stock concurrency is protected by database row locks/conditional updates, but a live two-session integration test was not run because the new migration was not applied to the configured database.

## Payments and Paystack

Manual/offline payments remain the active REEBS payment implementation. Every payment POST now requires an idempotency key. The server serializes duplicate keys, rejects the same key with changed order/amount/method, returns the existing payment/receipt on an exact replay, caps payments at the authoritative balance, then creates payment, receipt, accounting journal, stock effect and event in one database transaction.

`@faako/finance/gateways` now provides a server-only, provider-neutral gateway request contract and a tested Paystack adapter for initialize, verify and exact-raw-body HMAC verification. It is a foundation, not an activated REEBS checkout integration. The repository had no existing REEBS Paystack attempt store, webhook route, customer payment token, callback reconciliation, or refund adapter to safely connect. The adapter is intentionally excluded from the browser-facing root export.

Therefore:

- no live or test Paystack charge was made;
- no Paystack secret was added or exposed;
- Storefront checkout still records a pending order and communicates the selected payment preference;
- Paystack initialize/webhook/verify and refunds are `NOT_IMPLEMENTED` at app level;
- manual partial payments are supported;
- overpayment is retained only as a legacy readable state; new manual overpayments are rejected;
- paid cancellation becomes `refund_pending`; completing a refund remains a separate missing workflow.

## Receipts, invoices, delivery and notifications

Successful manual payments create immutable OrderReceipt snapshots and accounting journal entries. The Order detail action is now labelled `Create invoice`; receipts are payment evidence and are not represented as invoices. The existing invoicing module remains a separate workflow.

Pickup is end-to-end in Orders. Delivery method/details and forward fulfillment state are end-to-end inside Orders, but the shared `delivery` table/API is booking-only (`bookingId` required), so order driver assignment/routing is not connected and is reported as debt rather than faked.

New Storefront orders send best-effort manager push, internal email and customer email after commit, using existing notification infrastructure. A notification failure is structured and does not roll back the order. Paid, ready and dispatched customer notifications are not yet wired.

## Security and audit

- Staff APIs require `orders:read` or `orders:write` and apply verified organization context.
- Public checkout uses configured organization scope and never trusts a client tenant or customer ID.
- client price/status/source/discount/service-fee tampering is blocked or ignored at the public boundary;
- Water and rental product cross-domain ordering is blocked;
- manual payment amount, balance and replay behavior are server authoritative;
- paid cancellation remains owner/admin-only;
- cost fields require `financials:read`;
- order/payment/receipt/event handlers use connection-error-safe clients and structured redacted logging;
- order mutations and payments retain audit log and order event writes.

Customer self-service order lookup is not implemented, so no customer-facing order IDOR surface was added. A future lookup must use authenticated customer ownership or a short-lived opaque token, never a raw order ID/reference alone.

## Phase 9 discrepancy analysis

`pnpm run orders:audit:dev` ran inside `BEGIN READ ONLY` and rolled back. It found exactly two subtotal discrepancies:

| Order | Source | Stored subtotal | Line sum | Delta | Classification |
|---|---|---:|---:|---:|---|
| `ORD-20260320-001` (id 5) | Legacy Import | GHS 10.00 | GHS 15.00 | -GHS 5.00 | historical import |
| `ORD-20260427-001` (id 8) | Legacy Import | GHS 135.00 | GHS 155.00 | -GHS 20.00 | historical import |

No rows were changed. The same audit found zero balance discrepancies, zero Water products in core Orders, and zero non-positive order lines. Current active catalogue-wide zero-price products remain reported by the broader release consistency check; the new Orders write path fails closed for any such selected item.

## Ghana business readiness matrix

| Area | Supported | Implementation | Remaining issue |
|---|---|---|---|
| Ghana phone numbers | Yes | shared normalization at public boundary | dedicated visual formatting remains UX debt |
| Individual customers | Yes | shared Customer + server contact resolution | none for core flow |
| Organization customers | No | shared Customer has only name/email/phone | needs approved shared CRM schema |
| Contact persons | No | not modelled | needs shared CRM schema |
| GhanaPost GPS | Partial | backend validates/persists logistics value | dedicated storefront/portal field absent |
| Ghana-friendly address | Yes | free practical address/contact/landmark support | order delivery workspace not linked |
| GHS | Yes | authoritative minor-unit totals and display helpers | organization multi-currency not connected |
| Paystack | Partial | tested shared server adapter | app attempt/webhook/verify/refund workflow absent |
| Mobile Money-ready UX | Partial | provider-neutral preference/manual MoMo capture | online Paystack MoMo not wired |
| Manual/offline payments | Yes | drafts, queue, idempotent server sync | multi-device conflict UI is basic |
| Delivery | Partial | details and lifecycle | driver/routing API is booking-only |
| Pickup | Yes | details and lifecycle | none identified |
| Mobile operations | Partial | responsive Orders/POS; mocked portal detail and mobile storefront checkout Playwright passed | authenticated staff create/payment flow remains |
| Weak-network recovery | Yes | order/payment idempotency plus offline queues | public checkout is retry-safe but not offline queued |
| Human-readable references | Yes | daily locked ORD/REC references | no customer lookup UI |
| Configurable commercial values | Partial | catalogue/delivery config; privileged overrides | approved tax/service-fee rule source required |

## Module capability matrix

| Capability | Before | After | End-to-end | Status |
|---|---|---|---|---|
| Order creation | staff path; broken public shim | narrow public + staff paths | after migration | READY_WITH_PREREQUISITE |
| Customer linkage | trusted customer ID | public server resolution | yes | SUPPORTED |
| Pricing | server item price; broad fee input | positive server price + guarded overrides | yes | SUPPORTED |
| Inventory | locks/movements | retained + Water boundary | yes | SUPPORTED |
| Payments | manual/partial | replay-safe and balance-capped | yes | SUPPORTED |
| Paystack | absent | shared adapter only | no | NOT_IMPLEMENTED_APP_LEVEL |
| Manual payment | supported | enforced idempotency | yes | SUPPORTED |
| Invoicing | separate module | correctly labelled/linked | partial | EXISTING_SEPARATE_FLOW |
| Delivery | order details only | controlled order states | partial | DRIVER_LINK_MISSING |
| Pickup | supported | controlled pickup states | yes | SUPPORTED |
| Fulfillment | arbitrary state selection | forward next actions | yes | SUPPORTED |
| Cancellation | restock/refund pending | retained dedicated path | yes | SUPPORTED |
| Refund | status only | unchanged | no | NOT_IMPLEMENTED |
| Customer self-service | absent | unchanged | no | NOT_IMPLEMENTED |
| Audit | mixed logs/events | structured handlers + events/audit retained | yes | SUPPORTED |
| Reporting | core stats | immutable cost foundation | partial | COST_HISTORY_NULL |
| Mobile | existing layouts | next-action simplification | partial | MANUAL_TEST_REQUIRED |

## Optimization matrix

| Area | Before | Change | Result |
|---|---|---|---|
| Large frontend files | OrdersList 1,560; StoreMode 1,338; Checkout 1,456 | no risky rewrite | hotspots documented |
| Large backend files | shopOrders 1,748 | policy/notification boundaries extracted | responsibility reduced; service still large |
| Dead code | public create compatibility shim | replaced with working boundary | confirmed dead shim removed |
| Duplicate logic | Ghana phone in Bookings | shared customer policy | one normalization source |
| Database queries | duplicate detail payment fetch | removed automatic second fetch | one fewer request on detail load |
| API payloads | public path exposed staff response | narrow public DTO | tenant/customer internals not returned |
| Re-renders | derivable fulfillment choice | next options derived with memo | reduced invalid local states |
| Duplicate API calls | detail + payment endpoint on load | detail is initial payment source | eliminated |
| Astro hydration | storage-backed cart differed from SSR and islands were isolated | post-hydration restore + same-page cart/currency events | no mismatch; page/header/footer state stays aligned |
| Vite dev startup | late dependency discovery could invalidate Astro island modules | explicit dependency list with discovery disabled | mocked cold-start checkout hydrates and submits |
| Lazy loading | Orders routes already lazy | retained | no new heavy critical split |
| Dependencies | no REEBS Paystack runtime | server-only subpath; no new package | browser bundle protected |
| CSS | established Faako styles | no redesign or broad CSS changes | visual system preserved |
| Logging/errors | `console.error` in order handlers | structured redacted logger | safer diagnostics |
| Tests | utility-focused | lifecycle, notification, Ghana GPS, Paystack contract | targeted coverage increased |

## Complexity and performance hotspots

| File/function | Classification | Action | Remaining concern |
|---|---|---|---|
| `_shared/shopOrders.js` | CONFIRMED complexity | extracted lifecycle and notification policy | transaction/repository/payment responsibilities still need staged extraction |
| `OrdersList.jsx` | CONFIRMED complexity | payment replay key fixed | list/board/payment/drafts remain co-located; requests up to 500 compact rows |
| `StoreMode.jsx` | CONFIRMED complexity | existing idempotent path preserved | POS customer/order/offline responsibilities remain large |
| `Checkout.jsx` | CONFIRMED complexity | removed Customers API dependency; stable mixed-cart replay keys | mixed booking/order orchestration should become a server checkout coordinator |
| independent Astro cart islands | CONFIRMED reliability | hydration-safe storage restore and in-page synchronization | provider remains repeated by Astro boundary design |
| order detail query fan-out | LIKELY performance | removed duplicate client payment request | six serialized detail queries remain; not measured under load |
| Orders list `limit=500` | LIKELY performance | compact DTO retained | true server-filtered pagination remains debt |
| storefront build size | NOT_MEASURED for this change | Astro-first build retained | no before/after JS measurement captured |

No dependency or CSS removal was performed because the import audit did not establish an Orders-only unused package or obsolete selector safely removable in this pass.

## Database and deployment

Created but not applied:

- `20260830120000_orders_commercial_snapshots`

It adds order/line commercial snapshots, REEBS-core business-unit checks, idempotency fingerprint and an Orders reporting index. It does not rewrite historical costs or discrepancy rows. The code also brings Prisma into parity with the existing Phase 5 `orderPayment.idempotencyKey` migration.

Deployment order is mandatory:

1. Back up and review migration SQL.
2. Confirm Phase 5 payment-idempotency migration is applied.
3. Apply the new Orders migration in the target environment.
4. Deploy backend code.
5. Deploy portal and website.
6. Run read-only consistency checks and smoke tests.

Required environment names remain documented only. Public checkout requires `PUBLIC_ORGANIZATION_ID` or `REEBS_PUBLIC_ORGANIZATION_ID` plus the existing allowed-origin configuration. Activating Paystack later requires a server secret and an approved attempt/webhook/callback design; a secret must never be exposed through Vite/Astro variables.

## Validation record

- Portal focused Orders/Bookings tests: 34/34 passed after changes.
- Full Portal test suite: passed.
- Finance package: 7/7 passed, including mocked Paystack initialize and signature tests.
- Website tests: 8/8 passed.
- Portal lint: 0 errors; existing warning baseline remains (one new hook warning was removed).
- Website lint: 0 errors; 8 pre-existing warnings.
- Prisma validate: passed.
- Prisma generate: passed.
- Portal production build: passed.
- Website Astro typecheck: passed with 0 errors, 0 warnings and 0 hints.
- Website production build: passed; 1,125 pages built.
- Security scan: passed (2,251 non-ignored files).
- Security gate: passed.
- Merge-conflict marker gate: passed (2,855 source/configuration files).
- Development Orders audit: passed as a read-only diagnostic and reported the two legacy discrepancies above.
- No production migration, live charge, data correction or Git command was run.
- Mocked Orders detail Playwright: 2/2 passed at desktop and 390px mobile, including next-action control and horizontal-overflow checks.
- Mocked Astro storefront Orders checkout Playwright: 1/1 passed at 390px mobile, covering real shop add-to-cart, custom pickup controls, narrow public customer payload, Ghana phone normalization, no protected Customers request and `Idempotency-Key` propagation.
- A real database-backed staff create/payment Playwright flow was not run because the unapplied migration is a required prerequisite. This is a validation gap, not a pass.

## Final handoff checklist

1. **Current Orders architecture:** Astro Storefront and React/Vite Portal call separate public/staff handlers, which converge on the transactional `shopOrders` application service and the extracted Orders policies.
2. **Existing capabilities:** catalogue pricing, row-locked stock, stock movements, order events, manual/partial payments, receipts, accounting journals, cancellation/restock, POS queues, list/board/detail and pickup/delivery details were retained.
3. **Broken/disconnected capabilities:** the public create shim, protected customer lookup from checkout, unrestricted state changes, incomplete payment idempotency, missing immutable costs and false Paystack assumptions were the main confirmed gaps.
4. **Business rules discovered:** Orders is REEBS Core retail only; rental and Water products are rejected; server price and GHS totals are authoritative; handover requires no balance; cancellation uses the dedicated operation.
5. **Order lifecycle before/after:** compatible stored states remain, while staff mutations now follow forward-only order and pickup/delivery transition graphs with server-returned next actions.
6. **Workflow simplifications:** arbitrary fulfillment selection became one clear next action, duplicate payment loading was removed and receipt/invoice wording was corrected.
7. **Ghana customer handling:** public checkout resolves an individual shared Customer by verified contact data inside the server boundary; organization/contact-person modelling remains unsupported rather than duplicated.
8. **Ghana phone handling:** one shared policy accepts local `0XXXXXXXXX`, `233XXXXXXXXX`, `+233XXXXXXXXX` and valid explicit international forms; checkout now produces `+233` without retaining the local leading zero.
9. **Address/GhanaPost GPS handling:** practical address, recipient, phone, landmark, date/window, notes, distance and validated GhanaPost GPS are supported in the backend; dedicated form fields remain partial.
10. **Order-reference implementation:** `ORD` and `REC` daily suffixes use advisory transaction locks plus maximum existing suffix, not row counts.
11. **Order-origin handling:** Storefront is fixed to `Storefront`/`Online`; staff/POS/booking add-on compatibility remains; callers cannot label public orders as another origin.
12. **Pricing source:** active server catalogue product/variant price is authoritative and client line price is ignored.
13. **Historical-price behavior:** order lines remain immutable snapshots; historical price/cost discrepancies are reported and not silently recomputed from current catalogue data.
14. **Cost-price/privacy behavior:** nullable `unitCostSnapshotCents` is stored for new lines and returned only with `financials:read`; unknown historical costs were not invented.
15. **Tax/discount/fee behavior:** tax remains zero pending an approved rule; public commercial overrides are ignored; explicit staff overrides require manager-level authority.
16. **Inventory integration:** product/variant rows are locked, stock is conditionally decremented, sale/restock movements are recorded and Water/rental items are blocked.
17. **Inventory concurrency:** `FOR UPDATE`, conditional stock updates and locked references protect simultaneous writes; a live two-session database test remains required.
18. **Inventory idempotency:** movement existence prevents replayed paid orders from decrementing twice and cancellation restocks only a prior committed sale once.
19. **Payment architecture:** the active flow remains transactional manual/offline payment plus receipt, journal, stock and event; a provider-neutral shared gateway contract was added separately.
20. **Paystack implementation:** mocked shared initialize/verify/raw-body-signature behavior exists; no REEBS app attempt/webhook/callback/refund integration was falsely claimed.
21. **Mobile Money readiness:** checkout can capture provider-neutral preference and manual MoMo; online Paystack MoMo is not yet end-to-end.
22. **Manual/offline payments:** partial/manual methods, portal retry and POS offline queues remain supported with stable client retry keys.
23. **Payment idempotency:** every payment POST requires a key; exact replays return the existing payment/receipt and changed payloads conflict.
24. **Webhook behavior:** no app webhook exists; raw-body signature verification is tested only in the shared server adapter.
25. **Partial-payment behavior:** successful payments update authoritative paid/balance status; new overpayments are rejected while legacy overpaid rows remain readable.
26. **Refund status:** paid cancellation enters `refund_pending`; settlement/approval/provider refund execution remains unimplemented.
27. **Invoicing integration:** Orders links to the separate invoicing workflow and labels invoice creation correctly; payment receipts remain evidence, not invoices.
28. **Delivery integration:** order delivery details and lifecycle work, but shared driver/route assignment is booking-only and was not duplicated.
29. **Pickup support:** pickup date/window/notes and the preparing → ready → picked-up → completed lifecycle are supported.
30. **Fulfilment workflow:** pickup and delivery use separate forward paths and paid-balance handover gates.
31. **Cancellation:** the dedicated permissioned operation preserves refund-pending and one-time stock-restoration behavior.
32. **Customer self-service:** not implemented; no unsafe raw-order-ID lookup was added.
33. **Staff UX changes:** fulfillment shows only valid next actions, retry feedback is stable, duplicate loads were removed and invoice wording was clarified without a redesign.
34. **Mobile improvements:** portal detail has no horizontal overflow at 390px and mobile Storefront checkout completes through the real custom controls.
35. **Connectivity/retry behavior:** stable order/payment idempotency keys cover retries; POS payment/offline queues remain; public checkout is retry-safe but not offline queued.
36. **Notification architecture:** Storefront creation sends best-effort manager push plus internal/customer email after commit; paid/ready/dispatched messages remain debt.
37. **Permissions:** staff read/write and organization scope remain authoritative; commercial/cost/cancellation actions have additional role/permission gates.
38. **Audit coverage:** order events and existing audit writes remain; handler failures use structured redacted logs with request context.
39. **Security findings:** public tenant/customer/price/status/source trust was removed, Water/rental crossing is blocked, payment replay/balance checks are authoritative and no secrets were added.
40. **Phase 9 discrepancy analysis:** the read-only audit confirmed two Legacy Import subtotal differences: `ORD-20260320-001` (-GHS 5) and `ORD-20260427-001` (-GHS 20).
41. **Zero-price product impact:** new Orders fail closed with `ORDER_PRICE_UNAVAILABLE`; catalogue-wide cleanup remains an Inventory concern.
42. **Reconciliation results:** zero balance discrepancies, zero invalid/non-positive lines and zero Water-configured products in REEBS Core order lines; no row was changed.
43. **Reporting/analytics:** new immutable cost/business-unit snapshots support future margin reporting; Orders analytics remains REEBS Core and must exclude Water.
44. **Ghana Business Readiness Matrix:** recorded above with supported/partial/unsupported distinctions and no inflated claims.
45. **Module Capability Matrix:** recorded above, including Paystack/refund/self-service and delivery limitations.
46. **Optimization Matrix:** recorded above with measured query, payload, hydration and module-boundary changes.
47. **Large files identified:** `shopOrders.js` (~1,748 lines), `OrdersList.jsx` (~1,560), `Checkout.jsx` (~1,456) and `StoreMode.jsx` (~1,338) remain staged-refactor hotspots.
48. **Files split:** lifecycle policy, notification policy, customer contact policy, public checkout boundary and finance gateway adapter were separated without rewriting the module.
49. **Components/services/helpers extracted:** `orderPolicy`, `orderNotifications`, `contactPolicy`, payment gateway contract and Paystack adapter are the representative boundaries.
50. **Dead code removed:** the non-working public `createOrder` compatibility re-export was replaced with the real narrow public handler.
51. **Duplicate logic removed:** Ghana phone normalization and fulfillment constants/transitions now have shared domain sources.
52. **Queries optimized:** Order detail no longer performs the automatic duplicate payment fetch; reference allocation avoids count queries and race-prone reuse.
53. **API payload reductions:** public create returns a narrow DTO and private cost/margin data is conditional on `financials:read`.
54. **Render/fetch optimizations:** server next actions remove invalid local fulfillment state, payment sources are not fetched twice, stable attempt keys survive retries and Astro cart islands synchronize without replacing hydrated markup.
55. **Dependencies removed:** none; the audit did not establish a safe Orders-only unused dependency, and the Paystack foundation uses built-in server capabilities.
56. **CSS cleanup:** none; no obsolete Orders-only CSS was proved safe to remove and the Faako design was intentionally preserved.
57. **Complexity hotspots remaining:** the transactional `shopOrders` service and large list/POS/checkout components need staged repository/coordinator extraction.
58. **Performance hotspots remaining:** list requests can fetch 500 compact rows, detail still has serialized query fan-out and no production load profile was run.
59. **Before/after measurements:** detail payment startup requests 2 → 1; portal OrdersList 30.84 kB/8.95 kB gzip and OrderDetail 35.52 kB/10.59 kB gzip; Storefront produced 1,125 static pages; focused automated tests total 34 Portal + 7 Finance + 8 Website + 3 mocked Playwright passes.
60. **Database/schema changes:** Order gained currency/tax/businessUnit/fingerprint; OrderItem gained immutable cost/discount/tax/businessUnit; OrderPayment schema now includes the existing idempotency key.
61. **Migrations created but NOT applied:** `20260830120000_orders_commercial_snapshots`; no production or development schema mutation was performed in this pass.
62. **Files changed:** grouped changes cover Orders/customer backend modules and handlers, Prisma schema/migration, maintenance audit, Portal order/payment components, Storefront Checkout/cart/Astro config, shared finance gateway files/tests, package scripts and this document.
63. **Tests added/updated:** order policy, notifications, order details/Ghana GPS, Paystack gateway, portal Orders detail and Storefront checkout/browser coverage.
64. **Commands run:** focused/full Node tests, ESLint, Prisma validate/generate, Portal/Astro builds, Astro check, Playwright, read-only Orders audit, security scan/gate and conflict-marker check.
65. **Test results:** Portal focused 34/34, full Portal suite passed, Finance 7/7 and Website 8/8.
66. **Lint/typecheck/build results:** both apps have zero lint errors; Website retains 8 existing warnings; Prisma checks, Portal build, Astro check and 1,125-page production build passed.
67. **Playwright results:** Portal Orders detail 2/2 and mobile Storefront checkout 1/1 passed; database-backed staff mutation E2E is deferred until isolated migration setup.
68. **Security scan/gate results:** scan passed 2,251 files, security gate passed and conflict-marker gate passed 2,855 files.
69. **Manual browser testing required:** authenticated staff create/payment/cancel/refund-pending, actual printer/document behavior and real delivery handoff require an isolated migrated environment.
70. **Manual Paystack test-mode validation required:** deferred until app attempt storage, webhook/callback ownership, reconciliation, refund permissions and secret/runbook design are approved.
71. **Production configuration requirements:** configure public organization and allowed origins, apply reviewed migration before code, retain rollback/backup and keep any future Paystack secret server-only.
72. **Business decisions still requiring confirmation:** tax, service fees, discount authority, preparing-before-payment, refunds, retail delivery assignment, organization customers/contact persons and self-service authentication.
73. **Remaining Orders debt:** repository/coordinator extraction, server pagination/sorting, retail delivery linkage, refunds, customer self-service, paid/ready/dispatched notifications and app-level Paystack.
74. **Inventory boundary/prerequisites:** consume only the explicit order-line/stock-movement contract after this migration; preserve row locks/idempotency; own zero-price catalogue remediation; never merge Water stock, sales, costs or metrics into REEBS Core.

## Remaining decisions and debt

Business confirmation is still required for tax policy, service fees, discount authority granularity, whether preparing may begin before full payment, refund approval/settlement, delivery assignment for retail orders, organization/contact-person customer modelling, and the desired customer self-service authentication model.

Paystack test-mode work must not begin until an app-owned payment-attempt/webhook model, callback/ownership token, secret rotation plan, reconciliation runbook and refund permission policy are approved. The shared adapter alone is not a payment integration.

The next safe Orders refactors are repository extraction from `shopOrders.js`, server-driven list pagination/sorting, a checkout coordinator for mixed carts, order delivery schema integration, and authenticated Playwright coverage after the migration is applied in an isolated environment.

Stop here for Orders. The Inventory deep dive should consume only the explicit order-line/stock-movement contract, preserve row-lock and idempotency behavior, avoid importing Orders UI/service code, and continue to keep Water stock/configuration separate from REEBS core inventory metrics.
