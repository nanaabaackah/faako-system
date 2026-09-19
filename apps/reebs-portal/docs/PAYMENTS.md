# REEBS Payments architecture

## Boundary

Payments owns attempts, immutable payment records, payment applications, provider events, provider references, verification, idempotency, manual recording, receipts/history contracts and reconciliation. Bookings, Orders, Invoicing and Water continue to own their totals, prices, discounts, taxes and commercial rules.

```text
Order / Booking / Invoice / Water sale
        -> trusted payable resolver
        -> Payment Service
        -> provider registry
        -> Paystack adapter
```

No page or business module should call Paystack directly. Cash, staff-recorded Mobile Money and bank transfers use the same Payment Service but remain `MANUAL`, never `VERIFIED`.

## Persisted lifecycle

Migration `20260903120000_payments_foundation` adds four additive tables:

- `paymentAttempt`: initialized provider work that is not revenue.
- `paymentRecord`: a successful verified or explicitly manual collection.
- `paymentApplication`: the immutable link from one payment to its trusted payable.
- `paymentProviderEvent`: a redacted idempotency/audit record for signed provider deliveries.

The migration does not backfill or rewrite `orderPayment` or `waterSale`. Core order settlement still uses the established `orderPayment` transaction so receipt, balance, stock, order-event and accounting behavior remains intact; its universal `paymentRecord` and `paymentApplication` are written in the same transaction.

Payment attempt states are `PENDING`, `PAID`, `FAILED`, and `CANCELLED`. A pending/failed/abandoned attempt never changes a payable, revenue, a receipt, stock, or accounting. Payment records currently support only `PAID`; there is intentionally no refund mutation or pretend refund status until REEBS confirms and tests a real refund workflow.

## Authoritative amount and scope

`payableRepository.js` resolves only `ORDER`, `BOOKING`, `INVOICE`, and `WATER_ORDER`. The request supplies a type, ID and optional purpose—not an amount, currency, customer or business unit.

- Orders: total/currency/customer and paid balance come from the locked Core order and successful `orderPayment` rows.
- Bookings: total, configured deposit requirement and currency come from the locked Booking; applications provide paid totals.
- Invoices: total is recalculated from the stored line/additional items, tax and discount; linked Order/Booking supplies currency where available. Invoice deposits are not inferred from the legacy ambiguous `depositAmount` snapshot.
- Water orders: amount/customer come from the locked `waterSale`, currency is GHS, and scope is always `WATER`.

`AUTO` charges the remaining Booking deposit first, then the current balance. `BALANCE` and `FULL` reload the current balance. Over-application is rejected and sent for reconciliation; no customer credit behavior is invented.

## Paystack flow

Authorized internal callers use:

- `POST /api/paymentInitialize` with `Idempotency-Key` and `{ payableType, payableId, purpose? }`.
- `POST /api/paymentVerify` with `{ reference }`.
- Paystack sends signed events to `POST /api/paystack-webhook`.

The server creates/reuses an attempt, derives the charge, and sends only trusted values to Paystack. The adapter uses server-only `PAYSTACK_SECRET_KEY`, has a bounded timeout, normalizes responses and owns raw-body HMAC-SHA512 validation. Only `charge.success` can be applied.

Verification checks provider/internal reference, exact amount, exact currency, success state, current payable relationship, current scope and current balance. Browser verification and webhook finalization lock the same attempt row; the unique attempt-to-payment relation makes them converge on one payment. Webhook event fingerprints make exact retries no-ops.

Internal references contain an opaque tenant marker, for example `REEBS-PAY-O1-...` or `REEBS-WATER-O1-...`. A webhook derives this marker only after the provider signature passes, sets the database tenant context, and never trusts a body/header organization ID.

## Water isolation

Water remains a standalone domain. A trusted `WATER_ORDER` creates only a `WATER` payment/application and updates the corresponding Water sale. It never writes `orderPayment`, never invokes the Core accounting journal, and never enters the Core Payments register or dashboard KPIs.

The older Water MoMo notification endpoint remains Water-owned and separate from the Paystack webhook. It still authenticates its own provider secret, verifies exact amount/reference, persists Water-specific event idempotency, and does not affect Core.

## Manual payments

The connected manual workflow is currently Core Orders only. `payments:record_manual`, a request idempotency key, locked current balance and explicit field allowlist are required. Mobile Money, card-terminal and bank-transfer records require an external reference and obvious same-method/reference duplicates are rejected. The service writes the existing order ledger/receipt/accounting effects plus the universal record/application atomically.

Booking, Invoice and Water manual-payment mutation remains with each owning workflow until those modules define how staff select the payable and how partial state is shown. The shared service rejects unsupported manual contexts instead of silently editing a status.

## Staff and customer access

`/admin/payments` remains the responsive Core register with the shared Faako search field, method/status filters, standard table shell, pagination above and below the register, and a safe detail dialog. Water is deliberately excluded. The existing Order detail is the manual-recording and receipt surface.

There is no authenticated customer-account identity in the storefront; the current customer-login page only prefills booking details. For that reason, no customer Payment/Receipt endpoint was exposed. A future customer endpoint must bind payment ownership to an authenticated customer server-side and prove Customer A cannot read Customer B.

## Security and data protection

- Provider secrets, webhook signatures, raw payloads, fingerprints and failure detail are not returned to browsers.
- Initialization and verification require `payments:verify`, are organization-scoped, use the existing same-site cookie/origin guard and are rate-limited per staff member/IP.
- Webhooks rely on provider HMAC authenticity, not browser CSRF, and do not apply unsupported events.
- Four payment tables use forced organization RLS and foreign/check/unique constraints.
- Refund, reassignment, correction and export endpoints do not exist; status/parent IDs cannot be casually edited.
- The current API layer has a same-site/cross-site request guard but no synchronizer-token validation. Adding a token contract safely across the portal is security debt; the Payments pass does not falsely claim otherwise.

## Configuration and deployment

Required server settings:

```text
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_CALLBACK_URL=https://portal.example.com/admin/payments
PAYSTACK_TIMEOUT_MS=12000
```

Never use a `VITE_` Paystack secret. Configure the Paystack test webhook as `/api/paystack-webhook` and validate test-mode Mobile Money/card flows before any live key.

The migration is created but was not applied by this implementation pass. Deployment order is:

1. Back up and confirm the target environment.
2. Run the existing controlled Prisma migration job for `20260903120000_payments_foundation`.
3. Run Prisma status and `payments:reconcile:prod` with the explicit read-only readiness flag.
4. Configure test keys/callback/webhook and complete manual test-mode validation.
5. Enable any staff UI action only after the above checks pass.

## Reconciliation

```sh
pnpm --filter @faako/reebs-portal run payments:reconcile:dev
REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true pnpm --filter @faako/reebs-portal run payments:reconcile:prod
```

The command is read-only. It reports legacy Core/Water checks separately and, once the new tables exist, also checks paid attempts without payments, paid payments without applications, application/customer/currency/amount mismatches and Water/Core scope mismatches. It performs no automatic correction and makes no Paystack network request.

## Capability status

| Capability | Classification | Notes |
|---|---|---|
| Core manual Order payment | IMPLEMENTED_AND_CONNECTED | Shared service plus existing ledger, receipt, accounting and audit |
| Payment attempt/application/provider event schema | SCHEMA_ONLY | Additive migration created, not applied |
| Server-authoritative Paystack initialize/verify | BACKEND_ONLY | Routed for authorized staff; no customer-facing action enabled |
| Signed Paystack webhook | BACKEND_ONLY | Routed and tested with mocks; test merchant validation required |
| Order provider application | IMPLEMENTED_BUT_DISCONNECTED | Transactional implementation exists; UI/test-mode merchant flow not enabled |
| Booking provider application | IMPLEMENTED_BUT_DISCONNECTED | Trusted total/deposit and generic application; booking status remains Booking-owned |
| Invoice provider application | IMPLEMENTED_BUT_DISCONNECTED | Trusted recalculation/application; full Invoicing contract remains deferred |
| Water provider application | IMPLEMENTED_BUT_DISCONNECTED | Water-only settlement path; Water UI/test-mode flow not enabled |
| Refunds | NOT_IMPLEMENTED | No verified business workflow; original payments stay immutable |
| Customer self-service payments/history | NOT_IMPLEMENTED | Authenticated customer ownership prerequisite is absent |
| Core staff register | IMPLEMENTED_AND_CONNECTED | Existing Core Order ledger behavior preserved; Water excluded |
| Reconciliation | IMPLEMENTED_AND_CONNECTED | Read-only legacy checks; foundation checks activate after migration |
