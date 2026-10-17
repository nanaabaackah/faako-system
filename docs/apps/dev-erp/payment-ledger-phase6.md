# DEV ERP Phase 6 Payment Ledger

## Decision

Phase 6 adds an invoice-specific immutable posting ledger without replacing Invoicing, Accounting, the shared commercial pricing service, or Rent payments. Production remains **NOT READY** until the ordered migrations and concurrency harness pass against an isolated PostgreSQL database and the remaining dependency gate is resolved or formally accepted.

No production database was changed and no payment, refund, invoice, or customer notification was triggered.

## Existing behavior and compatibility assessment

Before Phase 6, `POST /api/invoices/:id/payments` incremented `Invoice.paidAmount` and overwrote one cumulative manual `AccountingEntry`. The request did not persist an individual payment, method, provider reference, verification state, idempotency key, or reversal. Invoice create/update paths could also supply `paidAmount`. The Invoicing UI was the known caller of the payment endpoint; Accounting summaries and reporting read the projected invoice/accounting values. Proposal billing generates invoice drafts but does not record payments. Public invoice views read invoice projections only.

`RentPayment` is a separate rent-domain record with offline creation, editing, deletion, notifications, and rent-balance allocation rules. Phase 6 deliberately does not migrate or redefine that workflow. It requires a separate compatibility and immutability project.

Legacy invoice `QUOTATION` records and proposal-to-invoice relationships remain unchanged.

## Architecture

- `InvoicePayment` is mutable workflow metadata for a recorded receipt. It stores the invoice/customer snapshot, amount/currency, method, provider/network, external reference, evidence URL, payment date, recorder, verification/rejection actors, correction link, and lifecycle state.
- `InvoicePaymentLedgerEntry` is the append-only financial posting record. Positive verified payments and signed reconciliation entries affect settlement. Reversals/refunds are new negative compensating entries that reference the original posting.
- PostgreSQL triggers reject `UPDATE` and `DELETE` on ledger entries. Service APIs expose no ledger mutation or deletion operation.
- `PaymentIdempotencyClaim` owns operation-scoped request keys, canonical SHA-256 payload fingerprints, result references, and immutable response snapshots. The database unique constraint is organization + operation + key.
- `Invoice.paidAmount`, `status`, and `paidAt` remain compatibility projections. Once the ledger activates, direct edits of paid amount, currency, line items, tax, and discount are rejected.
- Accounting retains its existing cumulative entry as a compatibility projection. It is synchronized transactionally from the settled invoice amount and is not the authoritative posting ledger.

## Transaction lifecycle

1. Recording creates `PENDING_VERIFICATION`. It never changes invoice settlement.
2. An authorized different administrator verifies the payment. A global administrator may override segregation of duties only with a recorded reason.
3. Verification locks the invoice row, creates exactly one `PAYMENT` posting, recalculates the invoice projection, synchronizes Accounting, completes the idempotency claim, and writes an audit event in one serializable transaction.
4. Rejection changes workflow state only and never posts money.
5. Reversal creates one full negative `REVERSAL` entry referencing the original entry. Partial reversal is intentionally unsupported in this phase.
6. A refund is an internal negative `REFUND` posting only after the caller confirms the external provider action and supplies the external refund reference. DEV ERP does not initiate provider refunds.
7. Corrections use a reversed original payment followed by a new payment linked through `correctsPaymentId`, or an explicitly reasoned `CORRECTION`/`RECONCILIATION_ADJUSTMENT` entry.

Amounts are parsed as exact two-decimal minor units. Currency must match the invoice. Transactions that would create a negative settlement or overpayment are rejected and rolled back.

## Idempotency and concurrency

Financial mutations require an `Idempotency-Key` header of at least eight characters. A canonical request fingerprint is stored with the claim.

- Identical retries return the stored original response.
- Reusing the key with another payload returns `409 IDEMPOTENCY_CONFLICT`.
- Organization/operation/key, provider-reference scope, one payment posting, and one reversal constraints are enforced by PostgreSQL.
- Financial transactions use `SERIALIZABLE`, retry Prisma serialization conflicts up to three times, and lock the invoice row with `SELECT ... FOR UPDATE` before balance decisions.
- Provider references are normalized and unique by organization + method + provider/network + reference. This avoids assuming cross-provider global uniqueness.

## API

- `GET /api/invoices/:id/payments` — payment workflow and ledger history.
- `POST /api/invoices/:id/payments` — record a pending payment.
- `POST /api/invoices/:id/payments/:paymentId/verify`
- `POST /api/invoices/:id/payments/:paymentId/reject`
- `POST /api/invoices/:id/payments/:paymentId/reverse`
- `POST /api/invoices/:id/payment-adjustments`
- `GET /api/invoice-payments/reconciliation-report` — tenant-scoped read-only legacy assessment.

All routes require authentication, administrator authorization, the Invoicing capability, CSRF protection for writes, and authoritative organization scope. Payment evidence stores only an HTTPS reference; MoMo PINs and credentials are not accepted.

## Legacy reconciliation

The migration does not rewrite historical invoices or create synthetic verified payments. `legacyPaidAmount` remains null until the first ledger posting. At activation, the transaction freezes the existing `Invoice.paidAmount` as the opening balance and adds only new posted ledger entries.

The reconciliation report flags:

- non-zero legacy payments requiring review;
- missing Accounting projections;
- multiple possible Accounting projections;
- Accounting/invoice total mismatches.

Ambiguous records require manual review. A reviewed legacy opening balance may later be corrected with an explicit reconciliation adjustment; it must never be silently converted or counted again as a payment posting.

## Migration and recovery

Migration `20261018090000_add_immutable_invoice_payment_ledger` is additive. Deploy order is:

1. `20261014090000_add_structured_proposal_foundation`
2. `20261015090000_add_proposal_client_message_kind`
3. `20261016090000_add_proposal_acceptance_billing`
4. `20261017090000_add_proposal_catalogue_tiers`
5. `20261018090000_add_immutable_invoice_payment_ledger`
6. `20261019090000_add_proposal_email_delivery`

Run `pnpm --filter @faako/dev-erp test:payments:postgres` only with `DEV_ERP_TEST_DATABASE_URL` pointing to a disposable loopback database whose name contains `test`, `tmp`, or `disposable`. The harness refuses configured production/default URLs, deploys migrations twice, records durations, verifies tables/foreign keys/indexes, proves transactional rollback, preserves a representative legacy payment, and runs real concurrent idempotency/verification/reversal checks.

If a migration fails, stop application rollout. PostgreSQL transactional DDL should leave no partial objects; verify that first. Correct the migration, and use `prisma migrate resolve --rolled-back 20261018090000_add_immutable_invoice_payment_ledger` only when Prisma recorded a failed migration and the database has been inspected. Never remove the ledger tables/triggers after real postings exist. Roll forward with a reviewed compensating migration instead.

## Security findings

Prisma still bundles `mysql2@3.15.3`. DEV ERP uses the PostgreSQL adapter, so the vulnerable MySQL path is not reachable in invoice request processing, but the bundled package remains in the production dependency graph. A direct transitive override to `3.23.1` was tested and rejected because its new Node type peer changed Prisma peer resolution across the monorepo and produced a broad, unrelated lockfile rewrite. This remains a release gate pending a compatible Prisma update or build/runtime package separation.

The high-severity `deepmerge-ts@7.1.5` advisory remains through `@prisma/config`. The patched release is `8.x`, while Prisma 7.5 pins the 7.x contract. The affected recursive-graph merge is in Prisma configuration/tooling rather than invoice request processing, and DEV ERP does not accept user-controlled Prisma configuration. A forced major transitive override was rejected because it could break migrations or generation. This remains a release exception/gate pending a Prisma-compatible update.

The current monorepo production audit still fails with 84 findings: 9 low, 51 moderate, 22 high, and 2 critical. This includes unrelated workspace findings plus the documented Prisma/deepmerge and bundled-MySQL paths.

## Rehearsal status and remaining risks

This environment has no Docker, Podman, `psql`, `createdb`, `pg_isready`, or approved disposable PostgreSQL URL. The real PostgreSQL test is therefore present but skipped; no production-like rehearsal is claimed.

Remaining gates:

- run the ordered migration and concurrency harness on isolated PostgreSQL with representative sanitized data;
- review the resulting legacy reconciliation report with Finance;
- resolve or formally accept the remaining Prisma/deepmerge risk;
- review whether organization-specific payment permissions should replace the current administrator boundary;
- remove the inactive cumulative-payment implementation from the server after the ledger migration is successfully deployed and rollback compatibility is no longer needed;
- conduct browser QA with two distinct administrator accounts for segregation of duties.
