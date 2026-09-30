# REEBS Payments deep-dive handoff

Date: 4 September 2026

## Outcome and release position

REEBS now has one provider-agnostic Payments service, one Paystack adapter, trusted payable resolution, persistent attempt/payment/application/event models, protected initialize/verify/webhook routes, an upgraded Core staff register, and read-only reconciliation. Existing Core order payment behavior remains authoritative for order balance, receipts, stock commitment, accounting journals and order events.

This is **not yet cleared for live collection**. Migration `20260903120000_payments_foundation` was created and validated but deliberately not applied. Paystack was exercised only with mocks: no merchant test-mode flow and no live charge was attempted. Online actions are not exposed to customers or general staff.

Water remains a standalone business domain. A Water payment stays `WATER`, updates only its Water sale/application, never creates a Core `orderPayment` or Core accounting journal, and never appears in the Core Payments register or Core metrics.

## Architecture: before and after

Before:

```text
Core Order handlers/UI -> orderPayment helper -> balance + receipt + stock + accounting + event
Bookings              -> commercial/deposit fields without a shared payment application
Invoice documents      -> document-level status/deposit fields
Water                  -> Water-owned sale fields and notification webhook
Storefront              -> pending record + manual payment instructions
```

After:

```text
Authorized caller / signed webhook
            |
            v
       Payment Service
       |     |       |
       |     |       +--> persistence: attempt -> payment -> application -> provider event
       |     +----------> provider registry -> Paystack adapter
       +----------------> trusted payable resolver
                              | ORDER        -> existing transactional order settlement
                              | BOOKING      -> generic Core application only
                              | INVOICE      -> generic Core application + document payment status
                              + WATER_ORDER  -> Water-only application + Water sale

Core staff register -> universal Core records + unlinked legacy order payments
Water records       -> Water-owned views only
```

No business module calls Paystack directly. Provider attempts are not revenue; only a verified or explicitly authorized manual collection becomes a payment record.

## Capability matrix

| Capability | Before | After | Release classification |
|---|---|---|---|
| Provider abstraction | None | Registry plus one Paystack adapter | BACKEND_ONLY |
| Persistent attempts | None | Additive model/migration | SCHEMA_ONLY until migration |
| Server-authoritative initialization | None | Trusted amount, currency, customer and scope | BACKEND_ONLY |
| Provider verification | None | Exact status/reference/amount/currency checks | BACKEND_ONLY |
| Signed webhook | None | Raw-body HMAC, scoped reference, event idempotency | BACKEND_ONLY |
| Core manual Order payment | Connected in Orders | Routed through shared service; behavior preserved | IMPLEMENTED_AND_CONNECTED |
| Core provider Order application | None | Reuses existing transactional settlement | IMPLEMENTED_BUT_DISCONNECTED |
| Booking application | Deposit fields only | Trusted deposit/balance plus generic application | IMPLEMENTED_BUT_DISCONNECTED |
| Invoice application | Mutable document status | Trusted total/application and derived status | IMPLEMENTED_BUT_DISCONNECTED |
| Water provider application | Separate legacy flow | Universal Water-only path, still isolated | IMPLEMENTED_BUT_DISCONNECTED |
| Customer self-service payment/history | No secure customer identity | Not exposed | NOT_IMPLEMENTED |
| Refunds | No immutable refund workflow | Not fabricated | NOT_IMPLEMENTED |
| Core payment register | Legacy order payments | Universal Core + unlinked legacy fallback | IMPLEMENTED_AND_CONNECTED |
| Reconciliation | Narrow legacy checks | Legacy plus conditional foundation checks | IMPLEMENTED_AND_CONNECTED |

## Ghana-readiness matrix

| Area | State | Evidence / limit |
|---|---|---|
| GHS | Ready in supported paths | Currency comes from the trusted payable and provider must match exactly |
| Paystack Mobile Money | Backend-ready | Adapter initializes `mobile_money`; merchant test-mode validation remains required |
| Manual Mobile Money | Connected for Core Orders | External reference required; aliases normalized; duplicate references blocked |
| Paystack card | Backend-ready | Included in trusted initialization; no staff/customer launch UI |
| Cash | Connected for Core Orders | Authorized manual ledger path |
| Bank transfer | Connected for Core Orders | External reference required; no bank-feed verification |
| Deposits | Trusted for Bookings | `AUTO` collects remaining configured deposit first; no customer UI |
| Partial payments | Connected for Core Orders | Successful ledger total drives paid/balance state |
| Balance collection | Trusted | Resolver reloads the locked current balance |
| Overpayment | Blocked | Application greater than current balance is rejected for reconciliation |
| Weak-network retries | Protected | Initialization/request keys, one active attempt, event fingerprints and row locks |
| Human references | Ready | `REEBS-PAY-O…` and visibly distinct `REEBS-WATER-O…` references |
| Staff mobile register | Ready | Responsive cards/table, detail dialog and touch-sized controls |
| Customer mobile payment | Not connected | Authenticated customer ownership is a prerequisite |

## Reconciliation matrix

The development command ran read-only and made no repairs. The new foundation tables were not present because the migration was not applied, so conditional foundation checks correctly reported unavailable.

| Check | Result | Action |
|---|---:|---|
| Orphan legacy Core payments | 0 | Preserve |
| Duplicate legacy Core external references | 0 | Preserve |
| Legacy payment/customer mismatch | 0 | Preserve |
| Legacy paid/balance/status mismatch | 6 | Human evidence review; controlled backfill only if approved |
| Legacy Core scope mismatch | 0 | Preserve Water boundary |
| Successful legacy payment missing receipt | 0 | Preserve |
| Manual electronic payment missing reference | 0 | Preserve |
| Duplicate Water provider references | 0 | Keep Water-owned monitoring |
| Water sale missing Water reference | 0 | Preserve |
| Paid attempt without payment | Not measured until migration | Run after controlled deploy |
| Payment without application | Not measured until migration | Run after controlled deploy |
| Payment/application integrity mismatch | Not measured until migration | Run after controlled deploy |
| Universal Water/Core scope mismatch | Not measured until migration | Run after controlled deploy |

The six unchanged legacy rows are `ORD-20260314-002` (GHS 4,000), `ORD-20260314-003` (GHS 7,000), `ORD-20260320-001` (GHS 1,000), `ORD-20260325-001` (GHS 4,500), `ORD-20260325-002` (GHS 7,000), and `ORD-20260427-001` (GHS 13,500). Each is stored as fully paid but has a successful-payment ledger total of zero. No method, reference or historical payment was invented.

## Optimization matrix

| Concern | Before | After / measured result |
|---|---|---|
| Provider duplication | No approved boundary | One registry and one Paystack adapter |
| Balance logic | Spread across owning modules | One trusted payable resolver; existing Order settlement reused |
| API payload | Legacy database-shaped rows | Staff-safe summary DTO without secrets/raw events |
| Payment register queries | Legacy-only | Bounded pagination and filters; universal/legacy deduplication |
| Frontend loading | No dedicated page | Lazy-loaded `AdminPayments` chunk, 9.13 kB / 3.08 kB gzip |
| Dependencies | Potential SDK pressure | Platform `fetch` and `node:crypto`; zero packages added |
| Provider latency safety | No adapter | 12-second configurable abort timeout |
| Polling | None | None added; stale list requests are aborted |
| Service size | Settlement concerns together | Application logic extracted; orchestrator 403 lines, application service 143 lines |
| CSS | Per-page admin import pattern | Functionally preserved; Payments CSS is 274.09 kB / 43.31 kB gzip and remains portal-wide debt |
| Heavy chunks | Existing | icons 351.70/58.00, PDF-JSPDF 371.91/121.19, vendor 440.81/144.52 kB raw/gzip; unchanged by Payments |

No runtime latency benchmark or before/after production telemetry was available, so none is claimed.

## Security and integrity controls

- Initialization accepts payable type, ID and purpose; browser amount, currency, customer and business unit are ignored.
- `payments:verify` is required for initialize/verify; `payments:record_manual` is separate; operational-only and Water roles are excluded.
- A dedicated database client receives an organization tenant context; new payment tables also force organization RLS.
- Provider secrets remain server-only. Raw webhook bodies, signatures, request fingerprints and failure detail are not returned to browsers.
- Paystack raw-body HMAC-SHA512 is timing-safe. Unsupported events are acknowledged without mutation.
- Signed success events still require a trusted organization-scoped internal reference.
- Browser verification and webhook processing lock the same attempt. Unique attempt/payment and provider-event constraints converge retries and races.
- Finalization reloads the trusted payable under lock and rechecks relationship, scope, currency and remaining balance.
- Manual electronic payments require references and reject obvious same-method/reference duplicates.
- Refund, reassignment, correction and export mutation endpoints do not exist.
- The existing cookie/origin same-site guard applies to staff routes. The portal does not yet implement a synchronizer CSRF token contract; that cross-portal improvement is not falsely claimed here.

## UX, Faako theme and accessibility

`/admin/payments` follows the existing Faako portal hierarchy: breadcrumb, page header, compact results summary, filters/search, register, pagination and contextual detail dialog. It uses existing cards, buttons and icon wrappers, adds no coloured section borders or decorative eyebrow labels, and states that Water belongs in Water Business.

The register becomes labelled payment cards at mobile widths. Search, filters, refresh and row actions retain minimum touch heights. Loading, empty and error states are explicit. Dialog open/close, Escape and focus return are covered.

The page consumes the shared `data-admin-theme` contract. A browser test loads a persisted dark preference, verifies dark `color-scheme`, page ink and field surfaces, switches through the real Light mode control, then verifies those computed styles change and runs axe. Both themes retain the existing Faako styling; no branding redesign was introduced.

## Schema and migration

Migration `20260903120000_payments_foundation` adds:

- `paymentAttempt`: provider work, status and trusted requested amount—not revenue.
- `paymentRecord`: immutable successful verified/manual collection.
- `paymentApplication`: payment-to-payable link and applied amount.
- `paymentProviderEvent`: redacted webhook idempotency/audit state.

It adds organization/customer relations, checks, unique constraints, indexes, a one-live-attempt partial index and forced organization RLS. It is additive and performs no legacy backfill. It was validated and Prisma Client was generated, but it was **not applied**.

## Files created or materially adapted

Created:

- `backend/modules/payments/`: domain, policy, manual service, payable repository, invoice amount calculator, persistence, orchestration service, application service, register repository, provider registry, Paystack adapter and focused tests.
- `backend/functions/paymentInitialize.js`, `paymentVerify.js`, `paystack-webhook.js` and webhook tests.
- `src/pages/AdminPayments/AdminPayments.jsx` and `AdminPayments.css`, using the shared Faako search field, table shell and top/bottom pagination patterns.
- `prisma/migrations/20260903120000_payments_foundation/migration.sql`.
- `scripts/maintenance/reconcilePayments.mjs`.
- `tests/payments-responsive.spec.ts`.
- `docs/PAYMENTS.md` and this report.

Adapted:

- `prisma/schema.prisma`.
- Core order payment API/shared settlement integration and its tests.
- Core payment register API, navigation, route/access configuration and tests.
- Water notification webhook integrity tests while retaining Water ownership.
- `.env.example` and the existing Payments reconciliation package commands.

No dependency was added or removed. No website component, checkout behavior or branding was changed in this pass.

## Validation record

- Focused Payments tests: 34/34 passed.
- Full portal test suite: 193/193 passed.
- Portal lint: 0 errors; 82 existing warnings.
- Prisma development schema validation: passed.
- Prisma Client generation: passed.
- Environment contract: passed with 55 documented keys.
- Portal production build: passed; 1,571 modules transformed.
- Payments responsive/theme/accessibility suite: 9/9 passed at 320, 375, 390, 430, 768 and 1440 px, including top/bottom pagination, compact mobile header geometry, keyboard dialog behavior, persisted dark-to-light theme checks and axe.
- Fresh light, dark and 390 px rendered-page captures were inspected; the temporary capture hooks were removed afterward.
- Website regression record for the phase: 8/8 unit tests, lint 0 errors/8 warnings, Astro check clean, 1,125-page build and route audit passed; no website source changed afterward.
- Security scan passed across 2,323 non-ignored workspace files; security gate passed its app configuration, header, environment exposure, authentication storage and CORS checks.
- Read-only development reconciliation: completed with the six legacy findings above; no repair made.

## Required 77-point handoff

1. **Current architecture:** owning modules supply trusted payable data to one Payment Service; one registry selects one provider adapter; persistence separates attempts, payments, applications and events.
2. **Existing capabilities:** Core Order manual payments, partial balances, receipts, accounting, staff register and Water-owned payment notification were preserved.
3. **Broken/disconnected findings:** online provider flows, customer payment identity, Booking/Invoice staff workflows and refunds were absent or disconnected; none is presented as live.
4. **Provider abstraction before/after:** before there was no approved abstraction; now all provider work has one registry/interface boundary.
5. **Paystack adapter:** server-only initialize, verify/status, normalized responses, timeout and signed webhook parsing are implemented.
6. **Duplicate Paystack implementations:** none were found across Bookings, Orders, Invoicing, Water or the storefront.
7. **Duplicate logic removed:** provider-specific work has one home; Order settlement and balance calculations are reused rather than cloned.
8. **Lifecycle:** `PENDING` attempt -> provider confirmation -> locked validation -> `PAID` record/application; failed/expired attempts never count as revenue.
9. **Payment Attempt:** persists trusted payable, amount, currency, scope, provider reference, idempotency and verification state.
10. **Trusted amount:** calculated server-side from the locked payable; request amounts are ignored.
11. **Trusted currency:** derived from the payable; provider currency must match exactly.
12. **Initialization:** protected, rate-limited, idempotent and restricted to one active attempt per payable.
13. **Verification:** exact success/reference/amount/currency plus current relationship/scope/balance validation.
14. **Webhook authentication:** HMAC-SHA512 over the exact raw body using the server secret and timing-safe comparison.
15. **Webhook handling:** only `charge.success` can apply; unsupported signed events are acknowledged and ignored.
16. **Idempotency:** request fingerprints, unique attempt keys, unique payment-attempt relation, event fingerprints and existing Order request keys.
17. **Race safety:** verify and webhook paths lock the same attempt; database uniqueness prevents double settlement.
18. **Transaction safety:** application, existing Order side effects, universal record/application, attempt state and audit commit together.
19. **Payment application architecture:** one immutable application records payable type/ID, business unit, customer, currency and amount.
20. **Booking connection:** trusted total/deposit/balance and generic application exist; Booking status transitions remain Booking-owned and UI is deferred.
21. **Order connection:** both manual and provider paths reuse the established Order settlement transaction.
22. **Invoicing readiness:** stored items/tax/discount are recalculated and applications drive document payment status; full Invoicing design remains deferred.
23. **Customer connection:** customer ownership is persisted, but no customer endpoint exists because storefront customer authentication is not ownership-grade.
24. **Water connection:** Water applications remain `WATER`, update only `waterSale`, and never enter Core ledger/accounting/register metrics.
25. **Manual payments:** Core Orders support authorized cash, Mobile Money, bank transfer and card-terminal records; other contexts fail closed.
26. **Paystack Mobile Money:** adapter channel is supported backend-only and requires Ghana merchant test-mode validation.
27. **Manual Mobile Money:** connected for Core Orders with provider/network and required reference.
28. **Card:** adapter supports Paystack card backend-only; manual card-terminal reference recording remains available for Orders.
29. **Cash/bank:** connected manual Order paths; electronic bank transfer requires a reference.
30. **Partial payments:** multiple successful Order ledger rows reduce the trusted balance.
31. **Deposits:** Booking `AUTO` first charges the remaining configured deposit; no inferred deposit is taken from ambiguous Invoice data.
32. **Balance payments:** `BALANCE` and `FULL` use the current server-calculated outstanding amount.
33. **Overpayment:** rejected after reloading the locked payable; no silent customer credit behavior is invented.
34. **Status behavior:** only verified/manual paid records affect payable state; attempts remain distinct.
35. **Refunds:** not implemented because no confirmed safe business workflow or immutable refund ledger exists.
36. **Refund idempotency:** not applicable until the refund workflow is approved; future refunds must be append-only and idempotent.
37. **Receipts:** preserved for Core Order settlement; no fake generic receipt is generated for disconnected contexts.
38. **Accounting:** existing Core Order journal behavior is preserved; Water never posts to Core accounting.
39. **Reconciliation:** read-only script covers legacy Core/Water and conditionally the new payment foundation.
40. **Reconciliation matrix:** included above with measured, unavailable and action states.
41. **Phase 9 integration:** existing readiness/environment/security conventions and read-only production guard are retained.
42. **Permissions:** read, manual-record, verify, reconcile, refund and export capabilities are explicit; only implemented routes are exposed.
43. **Audit:** manual and verified applications write safe audit events; provider event data is redacted.
44. **Security:** tenant context/RLS, allowlists, rate limits, HMAC, exact comparisons, locks and safe DTOs are in place.
45. **Ghana-readiness matrix:** included above.
46. **Capability matrix:** included above with connected/backend-only/schema-only/not-implemented classifications.
47. **Optimization:** provider duplication, queries, payloads, timeouts, lazy loading and service boundaries were addressed without dependency growth.
48. **Large files:** application concerns were extracted from Payment Service; remaining 403-line orchestration is a monitored hotspot.
49. **Files split:** provider, persistence, payable, application, manual, register, policy and domain responsibilities are separate files.
50. **Components/services/helpers:** one staff page, focused API handlers, shared Payment Service and small domain helpers now form the boundary.
51. **Dead code:** no confirmed payment code was removed merely because it looked unused; compatibility paths were preserved.
52. **Duplicate balance logic:** Order balance uses existing successful ledger aggregation; Booking/Invoice/Water each expose trusted source rules once.
53. **Query improvements:** lists are paginated and filtered in SQL; detail data is joined without row-by-row N+1 work.
54. **Payload improvements:** public/staff DTOs omit secrets, raw provider bodies, signatures, hashes and internal failure messages.
55. **Polling:** no new polling loop was added; register fetches abort stale requests.
56. **Dependencies:** zero additions/removals; native fetch/crypto implement provider transport and signatures.
57. **Logging:** audit records carry safe scope/amount/reference metadata; secrets and raw payloads are excluded.
58. **Complexity hotspots:** Payment Service orchestration, legacy Water webhook and global admin CSS imports remain the main hotspots.
59. **Performance hotspots:** duplicated per-page admin CSS and existing icons/PDF/vendor chunks remain; Payments JS itself is small/lazy.
60. **Before/after bundle result:** new Payments JS is 9.13 kB raw/3.08 kB gzip; CSS is 274.09/43.31 kB due to the pre-existing import pattern.
61. **Schema changes:** four additive models, relations, constraints, indexes and forced tenant RLS.
62. **Migration status:** created and validated only; not applied anywhere by this pass.
63. **Files changed:** categorized in the file section above.
64. **Tests added:** provider, signatures, domain, payable calculations, persistence/idempotency, permissions, register and responsive/theme tests.
65. **Commands run:** focused/full tests, lint, Prisma generate/validate, env contract, builds, Playwright, read-only reconciliation and security checks; no Git commands.
66. **Test results:** focused 34/34 and full portal 193/193 passed.
67. **Lint/type/build:** lint has 0 errors/82 existing warnings; Prisma validation and production build passed; portal has no separate TypeScript typecheck script.
68. **Playwright:** all six viewport cases, shared top/bottom table pagination, mobile header spacing, detail keyboard behavior, persisted light/dark theme behavior and accessibility passed in one 9/9 suite.
69. **Accessibility:** semantic table/card labels, focus entry/return, Escape, touch heights, colour-independent text labels and axe checks passed.
70. **Security validation:** scan passed across 2,323 files and the security gate passed configuration, headers, environment exposure, auth storage and CORS checks.
71. **Manual browser work:** authorized staff should still verify the real Order payment/receipt path and all role combinations before release.
72. **Manual Paystack work:** configure only test keys, test webhook/callback, then prove Mobile Money/card success, failure, abandonment, retry and verify/webhook race.
73. **Production configuration:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL` and optional `PAYSTACK_TIMEOUT_MS`; never use a `VITE_` secret.
74. **Reconciliation findings:** six legacy paid orders lack successful ledger rows; evidence-led review is required and no repair was made.
75. **Business decisions needed:** whether online Paystack is required now, enabled Ghana channels, deposit policy, staff owner and whether refunds/chargebacks/export are real requirements.
76. **Remaining debt:** customer authentication/ownership, Booking and Invoicing workflows, refund ledger, provider scheduled reconciliation, Water webhook extraction and portal CSS deduplication.
77. **Invoicing prerequisites:** consume immutable Payment Applications and trusted totals; do not call Paystack directly or infer legacy deposits before the Invoicing deep dive.

## Safe next sequence

1. Review the six legacy inconsistencies and approve any narrowly evidenced backfill separately.
2. Review and deploy the additive migration through the existing controlled migration workflow.
3. Re-run payment reconciliation after migration and confirm every foundation check is zero.
4. Configure a Paystack test merchant only; validate callback/webhook and race/idempotency scenarios.
5. Add customer collection only after authenticated customer ownership and IDOR tests exist.
6. Define Booking and Invoicing application UX before connecting those entry points.
7. Add refunds only if the business confirms the workflow and an immutable, idempotent ledger is designed.
