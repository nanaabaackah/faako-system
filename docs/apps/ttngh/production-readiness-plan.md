# Final production-readiness phase

Started 13 October 2026. Status: **in progress; not approved for launch or merge**.

The user supplied the final production-readiness brief and reported completing the Sanity setup step. Project ID, dataset, deployed Studio URL and actual permissions are still unverified. This supersedes the earlier assumption that no Sanity project exists; it does not imply that CMS publishing is connected.

## Confirmed decisions and remaining setup

- Dedicated TTNGH PostgreSQL on Railway is approved; it is not provisioned or connected by this work. Do not use Sanity, process memory or an ephemeral filesystem for the payment ledger.
- The user approved GH₵1 minimum and no TTNGH-imposed maximum. Provider and safe numeric representation limits still apply. Preset suggestions must not imply a restricted funding purpose or invented impact claim.
- Paystack account is not yet created; configure test credentials privately when available. No live transaction or production activation is authorised by this implementation brief alone.
- Sanity project ID is `d5k303l7`, dataset `production`. Deployed Studio URL, read token, permissions and content migration remain unverified. The website has not been switched to this dataset automatically.

The payment foundation is implemented with ten passing focused tests; see [payment architecture and remaining integration](payments-architecture.md). There is still no enabled donation endpoint or public payment form.

## Proposed payment boundary — pending database decision

Retain Astro, the separate Railway API and managed Sanity authentication. Add a TTNGH-scoped durable donation ledger, unique provider reference/idempotency constraints, auditable state transitions and a receipt outbox. Record an intent before contacting Paystack. Store integer pesewas, GHS and minimal receipt contact data; never store raw payment credentials or full provider authorization payloads.

Initialization, return-page verification and webhook processing must share the same reconciliation rules. Compare server-verified reference, amount, currency and provider environment with the stored intent. A redirect is never success evidence. A late valid success may resolve a pending/abandoned intent; duplicate callbacks must not send duplicate receipts. Receipt failure must not reverse a verified payment. Handle ambiguous provider timeouts through verification/reconciliation rather than automatically creating another charge attempt.

Use Paystack hosted checkout only. Validate the hosted redirect destination and fixed callback URL. Public verification responses must not expose donor email/name or arbitrary donation records. Define access protection for the return page before implementing the endpoint. Keep test/live credentials and ledgers separated, with live operations disabled by default.

Sources reviewed: [Paystack hosted payments](https://paystack.com/docs/payments/accept-payments/), [server verification](https://paystack.com/docs/payments/verify-payments/), [webhook signatures](https://paystack.com/docs/payments/webhooks/). Paystack uses HMAC-SHA512 over the webhook payload. Its webhook signature is not a freshness timestamp; replay protection must rely on durable event/reference processing, not an invented timestamp scheme.

## Implementation and verification order

1. Approve storage/amount rules; document the payment architecture and environment-scoped migration/rollback plan.
2. Implement ledger, Paystack adapter, initialization/verification/webhook routes, receipt outbox and mocked failure/replay/concurrency tests.
3. Add donation and return pages using existing TTNGH styles, accessible errors/status and no analytics containing payment references or donor identity.
4. Review the actual built site's CSP, privacy, indexing, redirects, caching, accessibility and performance. Preserve Scroll Expand and reduced-motion paths.
5. Configure and validate isolated provider test environments. Reconcile provider test transactions with the ledger and receipt delivery.
6. Complete manual infrastructure/ownership approvals and publish an evidence-backed final report grouped by P0/P1/P2. Do not merge with any P0 unresolved.

## Initial launch blockers (P0)

These are incomplete launch requirements, not a claim that an active production payment system is vulnerable.

- Payment implementation, durable storage and required payment test matrix are not yet complete.
- CMS connection, project ownership, roles, MFA/recovery and real publish/update/withdrawal rebuilds are not yet verified.
- Railway, Turnstile, verified sender, approved receiving inbox and live provider configuration remain unverified.
- Domain/Cloudflare DNS, HTTPS, canonical redirects, WAF, API non-caching and actual deployed security headers require evidence.
- Content/privacy/launch approval and production crawl checks are outstanding. Keep production indexing disabled until approval.

## Outstanding review items (P1)

- `apps/ttngh/public/_headers:2` retains inline script/style allowances. Audit emitted scripts and runtime styles before tightening; do not add unsafe-eval or broad origins. Cloudflare permits 100 header rules and 2,000 characters per line, so a hash policy must account for real build size. [Cloudflare header limits](https://developers.cloudflare.com/pages/configuration/headers/).
- Actual production-build accessibility, 200%/400% zoom, screen-reader, Safari and performance checks remain necessary; previous Chromium layout checks are not equivalent evidence.
- Review deployed proxy trust, operational rate limits, dependencies, consent-controlled analytics and email DNS/routing. Repository configuration alone cannot prove infrastructure settings.
- Name operational owners and establish backup/restore, reconciliation, alerts, receipt retries, rollback and credential-rotation procedures.

## P2

Record non-blocking visual or maintainability refinements only after the production review. No speculative findings are classified as passed.

## Work completed in this initiation pass

Read the complete final brief, inspected the existing API/configuration/shared payment utilities and build headers, and checked current Paystack/Cloudflare documentation. Security-best-practices guidance informs the payment boundaries and the distinction between local controls and unverified infrastructure. No payment endpoints, database, credentials, DNS, deployment or live transactions were created in this pass. Phase 2 test results remain historical evidence; this is not the final production-readiness report.
