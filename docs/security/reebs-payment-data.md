# REEBS Payment Data Boundaries

## Scope

This document records the existing REEBS Portal payment boundary. Batch 1 does not modify payment, receipt, order, stock, invoice, or provider behavior. Finance modernization remains Batch 3.

## Current payment model

- Store Mode, order detail, and order-list workflows capture manual payment information.
- Backend payment writes are owned by `backend/functions/orderPayments.js` and `recordOrderPayment` in `backend/functions/_shared/shopOrders.js`.
- Order/payment APIs enforce authenticated `orders:read` or `orders:write` access.
- Payment records may contain method, provider, transaction reference, phone number, amount, status, and operator notes.
- Amount and balance calculations for orders use integer cents.
- Payment aggregation can change order status, commit stock, create receipts, write accounting entries, and emit audit events. It is not a presentation-only operation.
- Payment posting requires a persistent `Idempotency-Key`. The key is unique per
  organisation; replay returns the original payment/receipt, while reuse for a
  different order or amount is rejected.
- MoMo metadata is not proof of provider settlement. The reviewed general payment workflow is manual; it must not be described as provider-verified.
- Water MoMo notifications use a separate webhook boundary and `WATER_MOMO_WEBHOOK_SECRET`. The webhook requires the secret in `X-Water-Webhook-Secret`, uses timing-safe comparison, rejects legacy query/body secrets, and is rate limited.
- Water webhook delivery fingerprints are persisted in the same transaction as
  the Water sale update. Paid status cannot be downgraded by a later notification.
- Paystack credentials or an active Paystack verification flow were not found in the current REEBS Portal configuration reviewed for this programme.

## Data classification

| Data | Browser use | Persistence/logging rule |
| --- | --- | --- |
| Payment method/status | Required for workflow display and submission | May be persisted and audit summarized. |
| Amount/currency | Required | Persist in canonical units; use integer cents for order payment calculations. |
| Provider/reference | Required when supplied | Persist only as operational reference; redact from broad diagnostic logs. |
| Customer phone | Required only for relevant contact/MoMo flows | Treat as personal data; never place in generic logs or telemetry payloads. |
| Access/session tokens | Never payment data | Never log or store in payment/offline payloads. |
| Provider credentials and webhook secrets | Server only | Never expose through `VITE_*`, responses, browser storage, audit metadata, or logs. |
| Card or wallet credentials/PINs | Not accepted by current forms | Must never be collected or persisted by REEBS Portal. |

## Offline queue boundary

The offline manual-payment queue stores a user/organisation-scoped pending command for later submission to the existing authenticated endpoint. It is not settlement, does not bypass backend validation, and must not contain secrets. Review tools show summary metadata and last errors rather than raw queue payloads. Server-side idempotency and reconciliation are prerequisites before expanding offline finance behavior.

## Security rules for Batch 3

1. Keep payment writes and provider verification server-side.
2. Preserve backend permission checks as the source of truth.
3. Validate amount, currency, status transition, reference length, and organisation scope at the API boundary.
4. Use an idempotency key for any retryable payment command.
5. Do not automatically retry unsafe mutations.
6. Keep audit events distinct from diagnostics and exclude sensitive payloads.
7. Return user-safe errors with request IDs; never return provider secrets, stack traces, SQL details, or full third-party payloads.
8. Test partial, full, duplicate, overpayment, refund-pending, and stock-commit transitions before changing production behavior.

## Environment variable names

- `WATER_MOMO_WEBHOOK_SECRET`
- `EMAIL_PAYMENT_MOMO_ACCOUNT_NAME`
- `EMAIL_PAYMENT_MOMO_MTN_NUMBER`
- `EMAIL_PAYMENT_MOMO_TELECEL_NUMBER`
- `EMAIL_PAYMENT_MOMO_AIRTELTIGO_NUMBER`
- `EMAIL_PAYMENT_MOMO_GMONEY_NUMBER`
- `EMAIL_PAYMENT_MOMO_DETAILS`
- `EMAIL_PAYMENT_BANK_DETAILS`

Values are intentionally excluded.
