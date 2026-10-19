# TTNGH donations: architecture and implementation status

13 October 2026 architecture; status reconciled 19 October. Dedicated Railway PostgreSQL
is approved. Minimum donation **GH₵1**, with **no TTNGH fundraising maximum**.
Current Paystack/database provider configuration is UNVERIFIED (earlier client report:
account not created). Foundation implemented, checkout absent; not ready for payment
activation. This is POST-LAUNCH for the informational site. See [audit](production-status-2026-10-18.md).

## Decision

Extend the existing Railway API with a dedicated TTNGH PostgreSQL ledger. Do not use Sanity for donor records, reuse REEBS databases/credentials, replace the managed CMS authentication model or create a competing shared finance package. `packages/finance` was inspected: its generic request normalizer rounds minor-unit input and has REEBS-specific validation wording, so the donation boundary uses strict integer-pesewa validation without changing other consumers.

Use hosted Paystack checkout. No raw card, CVV, PIN, OTP or Mobile Money authorization fields exist in the donation schema. Collect email only for provider checkout and the receipt; no public donor-name feature or invented restricted funding purpose.

## Implemented foundation

- `services/ttngh-api/src/payments/rules.js`: exact decimal-string conversion, GH₵1 minimum, strict input schema, privacy consent, idempotency fingerprint, raw-body HMAC verification and transaction matching.
- `payments/paystack.js`: fixed server-only provider origin, ten-second timeout, no redirects or automatic retries, hosted checkout URL validation, minimal verified fields returned. Provider customer/instrument metadata is discarded.
- `payments/store.js`: parameterized PostgreSQL queries; unique request intent, transaction-locked reconciliation, audit transition and receipt enqueue in one transaction. Paid is not downgraded by stale pending/failure events. Duplicate verified success does not enqueue another receipt.
- `migrations/001-donations.sql`: dedicated schema for intents, transitions and receipt queue, unique submission/provider identities and integer amounts. **Not executed against a database.**

No arbitrary fundraising cap is added. The JavaScript-safe integer boundary (9,007,199,254,740,991 pesewas) is enforced to prevent precision loss; unsupported representations must be handled through contact with TTNGH, not rounded. Actual provider/channel limits still apply.

## Required integration before activation

1. Add the PostgreSQL driver/runtime connection with environment-specific transport security, connection limits and graceful shutdown. Verify the migration on an isolated database. Provisioning/production migration remains a reviewed manual action.
2. Wire initialization, verification and raw Paystack webhook routes with schema/content-type/body limits, rate limiting, fixed callback URL and exact browser origins. Never apply browser Origin requirements to authenticated provider webhooks.
3. Generate random references and a separate random return-status capability. Store only its hash. Require that capability to query a donation; the reference alone must not disclose donor details. Keep capabilities out of query strings, logs and analytics. Establish how return/retry state survives hosted checkout.
4. Only the transaction which creates an intent may initialize it. A concurrent retry must reuse that intent. If initialization times out, reconcile that reference before considering another attempt; never blindly reinitialize or create a new intent for the same request.
5. Every successful webhook must validate raw signature and allowed event, compare event facts, then obtain independent server verification and reconcile under the same row lock used by the return endpoint. Durable state provides replay protection; Paystack's signature does not provide a timestamp freshness mechanism.
6. Implement a receipt worker with durable claim/lease, stable provider idempotency key and safe retry window. Ambiguous delivery beyond the email provider's deduplication window requires review, not automatic resend. Receipt failure must not revert payment success. Do not describe queued mail as delivered.
7. Add donor/return pages and privacy disclosure, suppress analytics on payment/status paths, and verify keyboard/errors/reduced-motion behaviour. Keep the public flow disabled until its backend and provider test environment pass.
8. Add authenticated operator reconciliation tooling/runbooks; handle delayed success, refunds/disputes and outages explicitly. There is no public administrative payment endpoint.

## Database migration and rollback gate

Use a dedicated database with separate test/live credentials and an application role limited to its payment schema. Grant schema creation/migration permissions only to the migration role. Back up before migrations; validate constraints, concurrent duplicate requests and rollback semantics using real PostgreSQL. Do not run migrations during server startup and never reset a shared database.

Migration 001 is transactional and fails if already applied; a migration runner/version ledger is still required. If application activation fails, disable donations and roll back application code while retaining the ledger for reconciliation. After any real transaction, do not drop tables or restore an older backup over current payment records. No destructive down migration is provided.

## Configuration inventory (values excluded)

| Name | Use |
| --- | --- |
| TTNGH_DONATIONS_ENABLED | Defaults false; future runtime activation gate |
| PAYSTACK_MODE | Explicit test or live |
| PAYSTACK_SECRET_KEY | Server-only provider credential; must match mode |
| TTNGH_LIVE_PAYMENTS_APPROVED | Additional explicit production-only gate |
| TTNGH_DATABASE_URL | Secret dedicated TTNGH PostgreSQL connection |
| TTNGH_DONATION_RETURN_URL | Exact HTTPS callback ending in /donate/return; live requires approved production domain |

The configuration helper is not yet wired into the server; setting these variables alone does not enable a donation endpoint. No public payment key or server secret is shipped to Astro.

## Evidence and remaining launch blockers

Ten focused tests pass via `node --test services/ttngh-api/test/payments.test.js`. They exercise exact conversion/limits, schema rejection, environment gates, signatures, transaction mismatch/status handling, adapter failures/redirects, metadata minimization and store transaction-call behaviour. Store tests use a mock query client: **they are not evidence of PostgreSQL concurrency or migration correctness**.

Payment-activation blockers: endpoint/frontend/worker integration, real database
tests, provider test checkout, failure/retry matrix, receipt handling and approval.
These are not P0 blockers for an informational site with payments disabled. No live
transaction or migration was performed by the audit.

Provider references: [transactions](https://paystack.com/docs/api/transaction/), [webhooks](https://paystack.com/docs/payments/webhooks/).
