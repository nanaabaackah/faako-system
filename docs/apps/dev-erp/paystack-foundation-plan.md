# Dev ERP Paystack Foundation Plan

## Purpose

Plan the safe Paystack integration path for Dev ERP invoice and payment workflows before any live payment-link generation, webhook handling, receipt generation, or persistence changes are implemented.

## Current State

- Dev ERP is fully live with real operational data.
- No Dev ERP Paystack runtime integration is currently wired.
- Invoices are created and edited through `apps/dev-erp/src/pages/Invoicing/Invoicing.jsx` and backend `/api/invoices` routes.
- Accounting entries can prepare invoice numbers/PDFs through `/api/accounting/entries/:id/invoice` and `apps/dev-erp/src/utils/invoicePdf.js`.
- Public invoice token views use `/api/invoices/view/:token`, `/accept`, and `/decline`.
- Rent payments are manually recorded through `apps/dev-erp/src/pages/Rent/Rent.jsx` and backend `/api/rent/payments` routes.
- Dev ERP has no dedicated immutable receipt source of truth yet.

## Non-Goals For This Phase

- Do not generate live Paystack payment links.
- Do not add Paystack webhook routes.
- Do not update invoice, rent payment, receipt, accounting, or report persistence.
- Do not alter existing manual payment recording.
- Do not change database schema.
- Do not implement Proposal Generator.

## Environment Variables

Expected server-side values:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `PAYSTACK_CALLBACK_URL`
- `PAYSTACK_CURRENCY`

Notes:

- Keep keys in server-side env only. Do not expose secret keys or webhook secrets through `VITE_*`.
- `PAYSTACK_CURRENCY` should start with `GHS` unless a specific invoice requires a supported different currency later.
- `PAYSTACK_CALLBACK_URL` should point to a future server-owned callback/confirmation flow, not a client-only success screen.

## Planned Connection Points

### Invoice Creation

- Keep current invoice creation through `/api/invoices`.
- Future Paystack support should attach a provider reference after an invoice exists and has a stable invoice id/number.
- Do not create payment references before invoice totals, currency, client email, and status are server-validated.

### Payment Link Generation

- Future endpoint should be server-only and permission-gated.
- It should call Paystack with the invoice id/number, amount, currency, customer email, callback URL, and metadata.
- It should return only safe link/reference data to the frontend.
- It should preserve manual payment fallback.

### Payment Status Tracking

- Paystack status should not be trusted from a client redirect alone.
- Store Paystack reference/status only after backend verification.
- Invoice status should remain unchanged until verified settlement rules are implemented.
- Any status mapping must preserve existing `DRAFT`, `QUOTATION`, `SENT`, `ACCEPTED`, `DECLINED`, `PAID`, `OVERDUE`, and `VOID` behavior.

### Webhook Confirmation

- Future webhook route should verify Paystack signatures before reading event payloads.
- The webhook must be idempotent and transaction-safe.
- Duplicate webhook events should not duplicate payment records or receipts.
- Webhook failures should be auditable and reviewable.

### Receipt Generation

- Dev ERP should not issue final receipts from client redirects.
- Future receipts should be generated after server-confirmed payment success.
- Receipt numbers/snapshots require a separate receipt source-of-truth plan and likely additive schema work.

## Security Requirements

- Keep `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` server-side only.
- Verify webhook signatures before processing events.
- Do not store card numbers, CVVs, full MoMo account details, or other sensitive payment instrument data.
- Store the Paystack reference and safe provider metadata only.
- Require backend permission checks for payment-link generation and manual payment reconciliation.
- Preserve organization scoping and invoice ownership checks.
- Preserve manual payment fallback for bank transfer, cash, and offline-confirmed payments.
- Add audit logging before enabling live payment status mutations.

## Data Safety Requirements

- Use additive migrations only when persistence is implemented later.
- Preserve existing invoice numbers, rent payment records, accounting entries, reports, and public invoice token behavior.
- Do not mark invoices paid from frontend callbacks.
- Keep current manual rent payment behavior unchanged.
- Treat Paystack references as external identifiers that require uniqueness/idempotency review.

## International Payments Later

Potential future options:

- Manual bank transfer
- Wise
- PayPal
- Stripe

These should be evaluated after Dev ERP has a stable provider-neutral payment reference model, receipt source of truth, and reconciliation workflow.

## Recommended Implementation Order

1. Keep current planning/config foundation only.
2. Define provider-neutral payment reference and status contracts.
3. Add backend-only Paystack config validation and health reporting without secrets.
4. Add a server-only payment-link creation endpoint for invoices.
5. Add webhook verification and idempotent event handling.
6. Add safe payment-reference persistence through additive migrations.
7. Add receipt source-of-truth planning and implementation.
8. Add invoice status reconciliation.
9. Add manual fallback reconciliation UI.
10. Review international provider support.

## Manual Testing Checklist For Future Implementation

- Verify invoice creation/edit/send/quotation flows remain unchanged.
- Verify public invoice view, accept, and decline remain unchanged.
- Verify manual rent payment create/edit/delete flows remain unchanged.
- Verify Paystack link creation requires authenticated, authorized users.
- Verify webhook signature rejection for invalid signatures.
- Verify duplicate webhook events do not duplicate payments.
- Verify invoice status updates only after server-confirmed success.
- Verify manual payment fallback remains available.
- Verify reports and accounting summaries do not change until payment reconciliation rules are explicitly implemented.

## Rollback Notes

For this phase, rollback is documentation/config-only: remove the Paystack env placeholders, the non-runtime Paystack config descriptor, the registry check script, and the related documentation updates. No data rollback is required.

## Next Step

Proposal Generator foundation can proceed after Dev ERP monitoring checks and Paystack safety boundaries are accepted.
