# Shared Payment and Receipt Architecture Plan

## Purpose

Design the safest future architecture for shared payment and receipt functionality across Faako ERP apps. This plan is documentation-only. It does not change app logic, database schema, payment recording, receipt generation, invoice behavior, routes, APIs, package exports, or live workflows.

REEBS Portal and Dev ERP are production-sensitive systems with real users or real operational data. Any future implementation must preserve existing payment records, receipt records, receipt numbers, balances, reports, permissions, and historical behavior.

## 1. Current State Summary

### REEBS Payment and Receipt Flow

- REEBS Portal records order payments through the order payment ledger and backend payment helpers.
- POS orders can record an immediate payment during order creation.
- Manual order payments can be recorded from order detail and order list flows.
- Payments support partial payment behavior and update order paid amount, balance due, and payment status.
- Order payment recording can also trigger receipt generation, stock commitment checks, accounting journal creation when available, and audit/order events.
- Order receipts use server-generated receipt numbers and receipt snapshots.
- Invoice documents can also represent invoice/receipt-style documents, but order payment receipts and invoice document receipts are separate concepts today.

### Dev ERP Payment, Receipt, and Rent Flow

- Dev ERP does not currently have a REEBS-style POS or order source of truth in the reviewed flows.
- Rent payments are the main payment-recording workflow and are tied to tenants, rent balances, reports, and operational records.
- Accounting entries can be marked paid, but that is status-based rather than a separate ledger payment record.
- Invoices can be marked paid, sent, accepted, declined, or viewed through public token links, but invoice paid state is not currently tied to a payment ledger.
- A dedicated immutable receipt generation flow was not found for Dev ERP rent payments or invoices.
- Rent payment notifications and invoice PDFs are document/communication flows, not confirmed immutable receipts.

### Differences Between Apps

- REEBS is order/POS/bookings/inventory oriented; Dev ERP is rent/accounting/invoice/report oriented.
- REEBS already has payment-triggered receipt snapshots; Dev ERP needs a future receipt source-of-truth decision.
- REEBS payment writes can affect stock and accounting side effects; Dev ERP payment writes affect rent balances, reports, and notifications.
- REEBS uses order balances in cents; Dev ERP has rent/accounting/invoice calculations with different ownership boundaries.
- REEBS uses route permissions such as order and invoice permissions; Dev ERP uses auth, capability checks, organization scoping, and public invoice tokens.

### Shared Patterns Already Visible

- Both apps need organization-safe payment records.
- Both apps need partial payment support or payment-state clarity.
- Both apps need normalized payment methods and external references.
- Both apps need auditability around money changes.
- Both apps need clear balance/status return values after payment writes.
- Both apps need receipt/document immutability rules before shared receipt extraction.
- Both apps need future gateway integration without breaking manual payment fallback.

## 2. Target Shared Architecture

The target architecture should begin with contracts and helpers, not shared write behavior.

### `packages/payments`

- Payment method constants and normalization.
- Payment status constants and transition helpers.
- Payment metadata contracts for cash, mobile money, bank transfer, card, gateway, and manual adjustments.
- Idempotency key contracts.
- App adapter interfaces for app-owned payment persistence.
- Later: shared service wrappers around app-specific payment APIs.

### `packages/receipts`

- Receipt number format contracts.
- Receipt snapshot shape contracts.
- Print-friendly receipt template primitives.
- Receipt delivery metadata contracts for print, WhatsApp, email, and download.
- Immutability rules and verification helpers.
- Later: app adapter interfaces for app-owned receipt persistence.

### `packages/finance`

- Money formatting and cents/major-unit helpers.
- Balance projection contracts.
- Payment aggregation helpers.
- Invoice/payment status mapping helpers.
- Shared calculation fixtures for regression tests.
- Later: source-specific finance adapters for orders, rent, invoices, subscriptions, and services.

### `packages/audit`

- Audit event constants for payment recorded, payment edited, payment voided, receipt generated, receipt shared, invoice paid, and gateway reconciled.
- Audit payload contracts with actor, organization, source object, before/after values, and request metadata.
- Later: app adapters to existing app-specific audit writers.

## 3. Shared Payment Service Responsibilities

A future shared payment service should support these responsibilities only after the constants/types and app adapter contracts are stable.

- Record manual payment through an app-owned persistence adapter.
- Validate amount against app-owned source totals, balances, and overpayment policy.
- Support partial payments without forcing every app into the same source model.
- Normalize payment methods such as cash, mobile money, bank transfer, card, gateway, and other.
- Store payment metadata such as provider, reference, phone number, notes, actor, source object, and external transaction id.
- Support MoMo references and provider names without assuming provider verification.
- Support gateway payment references later, including gateway, transaction id, authorization code, webhook id, and reconciliation status.
- Return updated balance and payment status from the app-owned calculation source.
- Preserve app-specific side effects through explicit adapter hooks instead of hidden shared behavior.
- Require idempotency input for write paths once shared service wrappers exist.

## 4. Shared Receipt Service Responsibilities

A future shared receipt service should preserve existing receipt behavior first and standardize carefully after app-specific receipt ownership is clear.

- Generate receipt numbers through app-owned, transaction-safe numbering adapters.
- Create immutable receipt snapshots from payment, source object, customer/tenant/client, line items, totals, and organization context.
- Support print-friendly receipt output without requiring every app to use the same UI.
- Support WhatsApp and email sharing later through delivery adapters and audit events.
- Preserve receipt immutability by preventing silent edits to generated receipt snapshots.
- Record receipt delivery attempts separately from receipt content.
- Distinguish server-confirmed receipts from local/offline pending receipts.
- Preserve historical receipt numbers and never renumber existing receipts.

## 5. App-Specific Customization Points

### REEBS Portal

- POS order payment behavior.
- Booking-linked orders and add-ons.
- Rentals and party item flows.
- Delivery/setup fees and delivery workflow touchpoints.
- Inventory/stock commitment side effects tied to payment or order status.
- Order receipt snapshots and thermal print behavior.
- Invoice document receipts that currently differ from order payment receipts.

### Dev ERP

- Rent payment records and tenant balances.
- Operational records and live reports.
- Accounting paid state.
- Invoice and quotation status behavior.
- Public invoice token behavior.
- Future rent receipt source-of-truth and historical receipt metadata strategy.

### Future Apps

- Order payments.
- Subscriptions and renewals.
- Invoices and service payments.
- Client/customer account balances.
- Refunds, credits, and adjustments.
- Gateway-backed commerce payments.

## 6. Security Requirements

- Backend permission checks must remain the source of truth. Frontend navigation or shared UI state must not grant access.
- Organization isolation must be enforced on every payment, receipt, invoice, rent, order, and audit operation.
- Audit logging must cover payment creation, edits, voids, receipt generation, receipt sharing, gateway webhook processing, reconciliation, and privileged overrides.
- Receipt spoofing prevention must rely on server-generated numbers, immutable snapshots, organization scoping, and optional verification metadata.
- Payment modification must be restricted by role/capability and should preserve before/after values.
- Idempotency must be required for client-submitted payment writes and gateway webhook processing.
- Transaction-safe writes must keep payment record, balance update, receipt generation, stock/accounting/report side effects, and audit events consistent.
- Public invoice or receipt links must use scoped tokens, expiration where appropriate, and minimal exposed data.
- Sensitive gateway secrets and webhook keys must never be exposed through browser-visible environment variables.

## 7. Data Safety Requirements

- Use additive migrations only.
- Do not make destructive schema changes to existing payment, receipt, invoice, order, rent, or accounting tables.
- Preserve existing payment and receipt records.
- Preserve existing receipt numbers and numbering semantics.
- Preserve historical balances and report outputs.
- Add shared identifiers or metadata in parallel before changing any source-of-truth behavior.
- Backfill only with reviewed, reversible scripts and dry-run output.
- Keep app-specific source tables authoritative until a migration plan is tested and approved.
- Avoid recalculating historical balances unless the recalculation is explicitly requested, audited, and reversible.

## 8. Future Gateway Integration

Gateway integration should be a later phase after manual payment and receipt contracts are stable.

### Candidate Gateways

- Paystack
- Hubtel
- Flutterwave

### Gateway Requirements

- Verify webhooks with provider signatures.
- Store gateway, transaction reference, authorization reference, webhook event id, and raw verification summary.
- Support pending, success, failed, abandoned, reversed, and refunded statuses without overwriting manual state unexpectedly.
- Preserve manual fallback for cash, bank transfer, and manually confirmed mobile money.
- Reconcile gateway transactions against app-owned source balances.
- Make webhook processing idempotent.
- Separate gateway initiation, webhook confirmation, reconciliation, and receipt generation decisions.
- Avoid generating final receipt numbers before server-side confirmation unless the app explicitly supports pending receipts.

## 9. Offline Payment Support Later

Offline payment support should be designed after online manual payment behavior is stable.

- Allow local pending receipt previews that are clearly marked as not server-confirmed.
- Store offline payment attempts in a sync queue with local idempotency keys.
- Sync queued payments through server validation before balance updates are finalized.
- Handle conflicts such as already-paid balances, changed order/rent totals, deleted source records, duplicate references, or expired sessions.
- Generate server-confirmed receipt numbers only after the server accepts the synced payment.
- Preserve conflict audit logs so operators can reconcile failed or partial sync attempts.
- Keep offline receipts visually and semantically distinct from official receipts until confirmed.

## 10. Recommended Implementation Order

1. Add shared types/constants only for payment methods, payment statuses, receipt statuses, receipt delivery channels, and audit event names.
2. Add shared formatting/helpers for money, references, receipt display values, and non-mutating balance projections.
3. Add shared receipt templates that render from passed snapshot data without persistence or numbering.
4. Add shared payment method normalization with app-level fixture tests for REEBS and Dev ERP examples.
5. Add shared service wrapper interfaces with no database writes, using app-owned adapters and test doubles.
6. Migrate app-by-app by wrapping existing app behavior without changing routes, tables, permissions, calculations, or receipt numbers.
7. Add gateway integration later after manual payment and receipt behavior is covered by regression tests.

## 11. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Duplicate payment creation | Require idempotency keys for manual writes and gateway webhooks. |
| Receipt number drift | Keep numbering app-owned and transaction-safe until shared receipt numbering is proven. |
| Historical balance changes | Start with read-only projections and fixture tests before write-path changes. |
| REEBS stock/payment mismatch | Keep stock side effects in REEBS adapters and test payment, status, and stock transitions together. |
| Dev ERP rent report drift | Keep rent balance calculations app-owned and compare reports before/after any wrapper adoption. |
| Receipt spoofing | Use server-generated receipt numbers, immutable snapshots, and audit records. |
| Permission regressions | Keep backend route/capability checks unchanged and covered by manual regression tests. |
| Gateway webhook replay | Verify signatures and use webhook event idempotency. |
| Offline sync conflicts | Treat offline payments as pending until server-confirmed and provide conflict resolution paths. |
| Shared package overreach | Begin with constants, types, formatting, and adapters before any shared persistence logic. |

## 12. Manual Testing Checklist

- Record REEBS POS paid order and verify payment, balance, receipt, stock, audit, and print behavior.
- Record REEBS pay-later order and verify no premature receipt/stock side effects.
- Record REEBS partial and full manual order payments and verify status and receipt behavior.
- Generate REEBS invoice document from an order and verify it does not overwrite order payment receipts.
- Create Dev ERP rent payment and verify tenant balance, reports, and notification behavior.
- Edit and delete Dev ERP rent payment with authorized users and verify balances and reports.
- Mark Dev ERP accounting entry paid and verify accounting/dashboard summaries.
- Create, send, accept/decline, and mark Dev ERP invoice paid while preserving public token behavior.
- Verify unauthorized users cannot record or modify payments or receipts.
- Verify organization isolation for payment, receipt, invoice, rent, and order data.
- Verify manual payment reference and MoMo reference handling.
- Verify duplicate payment submission behavior before and after idempotency work.
- Verify receipt numbers remain unchanged for historical receipts.
- Verify gateway webhook replay behavior once gateway integration exists.
- Verify offline pending receipts cannot be mistaken for server-confirmed receipts once offline support exists.

## Implementation Guardrails

- Planning only. Do not implement shared payment logic from this document directly.
- First implementation step should be shared payment/receipt constants and types only.
- Do not touch live payment, receipt, invoice, order, rent, balance, stock, report, or public-token behavior without a separate implementation task and regression plan.
