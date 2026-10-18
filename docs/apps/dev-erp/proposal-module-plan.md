# Dev ERP Proposal Module Plan

## 2026-10-17 Production readiness re-audit

Decision: **NOT READY for production enablement.** The proposal implementation and its mocked browser workflows pass, but the database and dependency release gates remain open.

- Full DEV ERP Node suite: 325 tests, 324 passed, one guarded disposable-PostgreSQL test skipped.
- Focused HTTP security suite: 4/4 passed.
- Clean Playwright pass: 18/18 passed in 5.4 minutes, including all three proposal desktop/mobile scenarios. An earlier run under concurrent lint/build load timed out once in Faako Onboarding; the isolated rerun and clean full rerun both passed.
- ESLint, TypeScript, Prisma validation/generation, repository security scan, production build, and whitespace checks passed. The production build retains the existing 514.93 kB vendor-chunk warning.
- `DEV_ERP_TEST_DATABASE_URL` is unset. The guarded migration/payment concurrency test therefore skipped, so migration duration, database constraints, serializable concurrency, and rollback/recovery are not proven on PostgreSQL.
- The workspace production audit reports 85 findings: 9 low, 51 moderate, 23 high, and 2 critical. The critical Astro paths affect other monorepo applications, while DEV ERP still carries unresolved production-tree findings through Prisma tooling, Express dependencies, Google APIs, and jsPDF. These require compatible upgrades, deployment-package separation, or explicit reviewed acceptance before release.
- No migration was applied, no live email or AI request was sent, and no deployment was performed.

Before staging, configure the server-only production database, trusted application origin, authentication/CORS/cookie settings, verified Resend sender, administrative BCC address, Faako form-submission database access, and OpenAI key if AI assistance is enabled. Rehearse all six additive migrations in order against a disposable production-compatible PostgreSQL database before changing the release decision.

## 2026-10-18 Phase 6 payment integrity update

The invoice-payment production blocker now has an additive implementation: pending payment workflow records, immutable verified ledger postings, database-backed idempotency, verification/rejection, full compensating reversals, externally confirmed refund postings, reconciliation adjustments, derived invoice/Accounting projections, and a tenant-scoped legacy reconciliation report. See `payment-ledger-phase6.md` for the complete architecture, migration order, API contract, recovery procedure, and security assessment.

Production remains **NOT READY**. The disposable PostgreSQL migration/concurrency harness is authored but was skipped because this environment has no isolated PostgreSQL runtime or approved test URL. The Prisma/deepmerge and Prisma-bundled MySQL advisories remain explicit release gates.

Proposal delivery now has an additive email layer: published versions can be sent from the builder with a polished “Proposals By Nana” template, an idempotent one-time token, safe delivery metadata, and audited success/failure. A successful resend revokes older links only after the provider accepts the new message; a failed attempt revokes only its new link. Human-facing DEV ERP production mail privately BCCs `DEFAULT_ADMIN_EMAIL`, while machine-directed Trello email-to-board is excluded. Migration `20261019090000_add_proposal_email_delivery` has not been applied.

## Purpose

Document the Dev ERP Proposal Generator foundation, including secure sharing and approved-proposal invoice draft handoff, before server PDF rendering, digital signatures, Paystack payment links, or AI-assisted proposal generation are implemented.

## 2026-10-14 Interactive Proposals Architecture Audit

This audit was completed before introducing catalogue, proposal-version, acceptance, or billing-schedule tables. The recommendation is to extend the existing `Proposal` aggregate and converge its pricing with Invoicing, not create a second proposal/quotation subsystem.

### Existing commercial architecture

- `Proposal` is the existing organization-scoped commercial draft and client-review record. It stores title/client/type/status, a mutable version counter, JSON content, metadata, a revocable expiring share token, actor references, and archive/share timestamps.
- Proposal JSON currently contains document blocks. Pricing is stored as display-oriented `pricingItems` with labels and string amounts; timeline, terms, notes, workflow readiness, status history, and the lightweight client response are also embedded in JSON.
- Proposal APIs already support organization-scoped list/read/create/update, PDF upload/read, secure-link preparation, client-safe token reads, client approve/request-changes, and approved-proposal invoice-draft creation.
- `Invoice` and `InvoiceLineItem` are the issued-finance records. Invoice line items snapshot description, quantity, unit price, amount, and order. Invoice headers snapshot subtotal, tax rate/amount, fixed discount, total, paid amount, dates, status, client details, and public response-token data.
- Invoicing already supports draft creation/editing, invoice numbering, quotation send/accept/decline states, normal invoice sending, partial payment recording, balance derivation, archive/delete controls, public token views, and accounting-entry creation when payments are recorded.
- Accounting can independently hand a manual revenue entry into an invoice draft. Projects are organization-scoped but currently have no proposal or invoice relation. There is no Dev ERP customer table: commercial client identity is currently snapshotted as name/email/address, while `Organization` supplies tenant ownership rather than acting as a customer master.
- Manual payment recording is implemented. Paystack remains configuration/planning only, and there is no general Dev ERP `Payment` record; cumulative invoice payment state is stored on `Invoice.paidAmount`, with accounting entries used as the payment ledger effect.
- Notifications are email-provider and audit-event based rather than a proposal notification model. Proposal PDFs can be uploaded and safely served, while browser print remains the generated-export fallback.
- Existing server-side AI infrastructure is authenticated, rate-limited, key-protected, and confirmation-oriented for Productivity/System Health. It can provide a future proposal-assistance extension point, but no proposal AI route exists.

### Current creation, approval, conversion, and linkage flow

1. Staff creates a proposal from a frontend template. The browser builds document blocks and saves them through `POST /api/proposals`.
2. Staff edits and saves through `PATCH /api/proposals/:id`; each save increments `Proposal.version`, but previous content is overwritten and cannot be reconstructed.
3. Staff prepares/publishes a secure token through `POST /api/proposals/:id/share-token`. The public client route reads a sanitized proposal payload.
4. A client can approve or request changes only while the record is `shared`. The response and approval timestamp are written into proposal JSON and an audit event is recorded.
5. An approved proposal can create one draft invoice through `POST /api/proposals/:id/create-invoice`. The operation copies enabled pricing-block rows into immutable invoice line items inside a database transaction and writes the resulting invoice id/number back to proposal metadata.
6. Repeating the handoff returns the linked invoice when it still exists. The invoice can then be edited, sent, paid in parts, and reflected in Accounting.
7. Client and project links are not relational. Client details are copied strings, and no accepted-proposal-to-project handoff currently exists.

### Reusable implementation

- Reuse `Proposal`, its organization/user ownership, secure-link generation, client-safe serializer, PDF storage boundary, audit logging, existing routes, and `/proposal/view/:token` rather than adding a second quotation aggregate or public app.
- Reuse `Invoice`, `InvoiceLineItem`, invoice numbering, email/public-token delivery, payment summary, payment recording, accounting handoff, and invoice UI. Issued invoice values must continue to be snapshots that do not follow later catalogue/proposal changes.
- Reuse the existing Project/ProjectTask services and organization capability middleware for later accepted-proposal handoff.
- Reuse the existing API client, request IDs, CSRF/auth middleware, organization-scope helpers, audit service, design system, PDF upload protections, and server-side AI adapter pattern.
- The invoice arithmetic previously embedded in `backend/server.js` is now extracted to `backend/commercial/pricing.js`. It calculates in integer minor units and remains wrapped by the existing invoice API so response/error compatibility is preserved. Proposal pricing, accepted snapshots, billing schedules, and invoice generation should call this same service.

### Functional gaps and overlap

- Proposal pricing is text-oriented, accepts ambiguous values such as `TBD`, has no structured quantity/discount/billing frequency/cost-owner fields, and cannot distinguish one-time, recurring, usage, included, client-direct, or pass-through charges.
- `Proposal.version` is an edit counter, not an immutable published-version record. Published content can still be changed in place, and approval points to the mutable proposal instead of a durable version snapshot.
- Approval is a JSON field rather than a server-owned idempotent acceptance record. It does not snapshot accepted item selections, totals, terms, version, link identity, or evidence.
- The current proposal-to-invoice handoff is transactional but uses metadata as its idempotency link. It does not support deposits, milestones, recurring schedules, or multiple invoices and does not have a database uniqueness constraint tying an invoice to a proposal version/schedule item.
- Invoicing has its own `QUOTATION` status and public acceptance path. That predates Interactive Proposals and overlaps with proposal review/approval. Existing quotation invoices must remain readable and actionable for backward compatibility, but new interactive quotations should originate in Proposals and become invoices only after acceptance.
- There is no service/integration catalogue, package model, proposal line-item model, client selection store, revision-request model, access-event model, billing schedule, proposal-project relation, or dedicated customer relation.
- Invoice mutation currently allows financial fields to be edited after non-draft states. Immutable issued-invoice enforcement needs a focused finance review and migration plan; it should not be changed incidentally during proposal UI work.
- Currency is limited to the existing `CAD`/`GHS` enum. There is no organization-specific tax-rule catalogue or percentage/line-level discount model.

### Recommended target and compatibility strategy

- Keep `Proposal` as the stable aggregate id and compatibility shell. Add `ProposalVersion` for immutable published snapshots and structured calculated totals. Draft edits may continue on `Proposal.content` during transition.
- Add organization-scoped `CommercialCatalogueItem` and `CommercialPackage` records rather than separate service and integration engines. A typed `kind` field distinguishes service/integration entries; package contents are templates copied into proposal versions so later catalogue edits cannot alter accepted terms.
- Add structured proposal version items, client selections/revision requests, approval, access-link/access-event, and billing-schedule records. Store money as `Decimal` consistent with Invoice while performing application calculations in integer minor units through the shared pricing service.
- Link each generated invoice to the approved proposal version and optional billing-schedule item with explicit relations and idempotency keys. Keep invoice numbers in the existing sequence; do not add proposal invoice numbering.
- Preserve all existing `Proposal` rows and JSON. A compatibility adapter should read legacy pricing blocks until a proposal is explicitly upgraded; no bulk conversion is required to deploy the additive schema.
- Preserve existing invoice quotations and `/api/invoices/*quotation*` endpoints for historical records. Hide that creation path from the redesigned proposal workflow rather than deleting statuses or routes.
- Treat `ProposalVersion` publication as immutable. A change after publication creates a new draft version and a new client link (or rotates the link to the selected published version); an acceptance always references exactly one published version.
- Generate invoices only from a validated accepted snapshot. The transaction must claim an idempotency key, create invoice header/line snapshots, link the schedule/version, and record audit history together.

### Proposed database changes (Phase 2 migration authored, not applied)

- Extend `Proposal` with nullable project linkage and a pointer to its current draft/published version only after version rows exist.
- Add `CommercialCatalogueItem`, `CommercialPackage`, and package-item tables with organization-scoped normalized-name uniqueness and archive flags.
- Add `ProposalVersion`, `ProposalVersionItem`, `ProposalRevisionRequest`, `ProposalApproval`, `ProposalAccessLink`, `ProposalAccessEvent`, and `ProposalBillingScheduleItem`.
- Extend `Invoice` with nullable `proposalVersionId`, `billingScheduleItemId`, and `generationKey`; add unique constraints for generation/idempotency without touching existing invoice numbers.
- Prefer a future customer-master integration only after Dev ERP defines its authoritative customer owner. For this phase, keep version and invoice client snapshots and do not misuse `Organization` as a customer record.

The Phase 2 migration implements the catalogue, package, version/item, selection, revision, approval-snapshot, access-link, billing-schedule, and nullable proposal-project structures. Invoice linkage/idempotency columns and a customer master remain deferred until the approval-to-invoice phase, where their exact transaction and uniqueness rules can be tested together.

### Proposed API and file-level changes

- `apps/dev-erp/backend/commercial/pricing.js`: authoritative parse/round/tax/discount calculation shared by proposals and invoices (implemented in the first non-migrating slice).
- `apps/dev-erp/backend/commercial/*.test.js`: deterministic pricing, billing, and compatibility tests.
- `apps/dev-erp/backend/proposals/`: progressively move proposal validation, transitions, version publication, acceptance, catalogue, selection, revision, and invoice-generation services out of the monolithic server.
- `apps/dev-erp/prisma/schema.prisma` plus one reviewed additive migration: add version/catalogue/approval/billing relations after service contracts and tests are ready.
- `apps/dev-erp/src/pages/Proposals/`: replace document-first editing with the six-step builder while retaining the existing preview/export adapter for legacy proposals.
- `apps/dev-erp/src/api/` or `packages/api-client`: expose typed proposal/catalogue/version actions through the existing client conventions; do not add ad-hoc browser fetch logic for authenticated actions.
- Existing Invoicing files: consume linked schedule/version metadata and continue owning invoice send, payment, balance, and accounting workflows.
- Existing Projects files: add idempotent link/create actions only after accepted-version relations exist.
- Existing documentation and focused tests: update this plan, implementation notes, progress log, API/security/migration notes, and client/invoice E2E coverage with each phase.

### Migration, rollback, and risk notes

- Use an additive migration with nullable foreign keys. Do not rewrite existing proposal JSON or invoice rows during deploy. Backfill/version-upgrade should be an explicit, repeatable command with dry-run output if later required.
- Old proposals remain editable/viewable through the compatibility adapter. Old invoice quotations remain in the invoice lifecycle. Old proposal metadata invoice links remain readable even after relational links are introduced.
- Highest risks are duplicate invoices during concurrent acceptance, mutable accepted terms, tenant-scope leaks on public tokens, divergent frontend/backend totals, and changing invoice/payment semantics. Database uniqueness, transactions, server recalculation, version-bound tokens, capability checks, and focused regression tests are required before enabling the new client actions.
- Do not auto-generate or send invoices during the initial migration. Keep staff review as the default until deposit/milestone schedules and rollback behavior are proven.
- Paystack stays optional and manual MoMo stays supported through the existing manual payment workflow. No provider integration is required for proposal approval.

## 2026-10-14 Phase 2 Structured Proposal Foundation

Phase 2 extends the existing `Proposal` aggregate without replacing it. The additive migration is authored at `apps/dev-erp/prisma/migrations/20261014090000_add_structured_proposal_foundation/migration.sql` but was not applied to development, preview, or production databases by this implementation.

### Implemented contract and persistence

- `Proposal.content.commercial` is the versioned structured compatibility contract. It supports customer/project snapshots, services and integrations, required/optional/custom items, descriptions and deliverables, quantity/unit price, one-time/recurring/usage/included billing, cost ownership, discounts, taxes, deposits, milestones, validity, scope, exclusions, and terms.
- Legacy proposal block documents remain readable through `adaptLegacyProposal`. No existing proposal or invoice row is converted or rewritten. Legacy ambiguous amounts remain zero-value compatibility rows for staff review.
- `ProposalVersion` and `ProposalVersionItem` persist server-calculated snapshots. Draft versions may be edited; publication changes the lifecycle state and published definitions are not editable. A later revision is a new draft/version rather than a mutation of published terms.
- `ProposalClientSelection` stores version/item-scoped client choices separately from the published definition. Required or non-selectable rows cannot be changed by clients.
- `ProposalApprovalSnapshot` supports immutable `PREPARED` captures of selections, recalculated pricing, billing schedule, and terms. This phase exposes no accept/sign endpoint and never sets `ACCEPTED`.
- `ProposalBillingScheduleItem` stores deposit, milestone, balance, full, and recurring schedule snapshots. `ProposalAccessLink` stores only SHA-256 token hashes with expiry/revocation timestamps.
- `CommercialCatalogueItem`, dependency rows, packages, and package items provide organization-scoped reusable service/integration templates. Normalized names prevent duplicates within an organization/kind. Catalogue edits do not update proposal-version item snapshots.

### Phase 2 API additions

Authenticated proposal administrators:

- `GET/POST /api/proposals/catalogue`
- `PATCH /api/proposals/catalogue/:catalogueItemId`
- `GET/POST /api/proposals/packages`
- `GET/POST /api/proposals/:proposalId/versions`
- `PATCH /api/proposals/:proposalId/versions/:versionId` for drafts only
- `POST /api/proposals/:proposalId/versions/:versionId/publish`
- `POST /api/proposals/:proposalId/versions/:versionId/access-links`
- `PATCH /api/proposals/:proposalId/versions/:versionId/access-links/:linkId/revoke`
- `POST /api/proposals/:proposalId/versions/:versionId/approval-snapshot` (`PREPARED` only)

Token-scoped client foundation:

- `GET /api/proposals/interactive/:token`
- `PUT /api/proposals/interactive/:token/selections`
- `POST /api/proposals/interactive/:token/revision-requests`

All authenticated reads/writes use the existing Proposals capability and backend tenant scope. Public actions require a valid unrevoked, unexpired token bound to one published version. Totals submitted by clients are ignored; the server recalculates through `backend/commercial/pricing.js`.

### Compatibility and remaining boundaries

- Existing proposal CRUD, `/api/proposals/view/:token`, lightweight legacy approval/request-changes, and approved-proposal invoice-draft handoff remain intact for existing consumers.
- Existing invoice `QUOTATION`, invoice numbering, public invoice flows, payment recording, balance calculations, and accounting handoff are unchanged.
- Phase 2 does not accept structured proposals, create invoices/payments, send notifications, modify issued invoices, backfill legacy records, or expose a replacement frontend builder.
- Before enabling structured acceptance, add audited acceptance evidence, selection/snapshot freshness validation, transactional idempotent schedule-to-invoice linkage, explicit invoice foreign keys/uniqueness, and end-to-end permission/public-token tests.

## 2026-10-16 Phase 3 Interactive Builder and Client Experience

Phase 3 connects the Phase 2 contract to a replacement structured workflow while retaining the legacy document preview/editor at `/proposals/:proposalId/preview` and the legacy client URL at `/proposal/view/:token`. It does not enable structured acceptance, invoice generation, or payment creation.

### Admin workflow and UI routes

- `/proposals` is now the structured management workspace with search, current-version status filters, customer/project, owner, value, expiry, open client requests, legacy invoice metadata when present, duplication, and legacy-editor access.
- `/proposals/new` and `/proposals/:proposalId/edit` host a responsive six-step builder: Client & Project, Services, Integrations, Pricing & Billing, Scope & Delivery, and Review & Publish.
- Catalogue selection supports common built-in suggestions, tenant catalogue rows, category/search filters, explicit custom-catalogue saves, duplicate prevention, dependencies, required/optional/client-selectable configuration, one-time/recurring/included/usage billing, ownership, notes, delivery estimates, and item discounts.
- Reusable packages copy catalogue-backed items and their proposal defaults into the draft. Later proposal edits do not mutate the package or catalogue record.
- The persistent pricing summary is reconciled through `POST /api/proposals/pricing-preview`; browser-submitted totals are never persisted as authority. Publication first saves/reconciles the draft and then freezes the published version.
- Review exposes version activity, client questions/revisions/declines, request resolution/rejection, access-link creation/copy/revocation, and an explicit notice that acceptance and invoicing remain unavailable.

### Client workflow and public security

- `/proposal/interactive/:token` is the branded account-free review route. It shows the version snapshot, customer/project context, included and optional items, deliverables, scope, exclusions, terms, validity, billing schedule, and separated one-time/recurring totals.
- Clients can change only explicitly selectable items/quantities. The backend rejects required, fixed, unknown, duplicated, or non-published selection changes and recalculates estimates from stored version prices.
- Questions, revision requests, and declines use one endpoint and an additive `ProposalClientMessageKind`. Client request keys are hashed with the access-link identity before persistence, preventing cross-link idempotency collisions and avoiding storage of the caller's raw key.
- Public endpoints have a dedicated configurable rate limit. Tokens remain SHA-256 hashes at rest, and revoked, expired, withdrawn, or superseded links cannot load the proposal. Public serializers omit source snapshots, catalogue identifiers, and internal notes.

### Phase 3 API additions

Authenticated proposal administrators:

- `GET /api/proposals/structured`
- `POST /api/proposals/pricing-preview`
- `GET /api/proposals/:proposalId/versions/:versionId/revision-requests`
- `PATCH /api/proposals/:proposalId/versions/:versionId/revision-requests/:requestId`

Token-scoped clients:

- `GET /api/proposals/interactive/:token/versions`
- `POST /api/proposals/interactive/:token/messages`

The Phase 2 `revision-requests` endpoint remains as a backward-compatible adapter to the new message handler.

### Migration and operational boundaries

`apps/dev-erp/prisma/migrations/20261015090000_add_proposal_client_message_kind/migration.sql` adds the message-kind enum, a defaulted `kind`, and a nullable unique `requestKey`. It is additive, does not rewrite existing revisions, and has not been applied to any database. The Phase 2 migration must be deployed before this migration and before application code that relies on structured proposal tables.

Dev ERP has no customer master: the builder therefore uses customer snapshots and project-derived customer suggestions, and does not misuse tenant `Organization` records. The existing notification store is monitoring-incident-specific and cannot safely represent proposal activity. Phase 3 surfaces requests in the proposal workspace and writes audit events; the later delivery layer adds explicit proposal Send/Resend and acceptance confirmation email, while staff alerts, revision-request notifications, automatic reminders, and a durable delivery outbox remain deferred. The legacy PDF/document workflow remains available rather than being silently converted.

## 2026-10-16 Phase 4 Acceptance, Billing, and Invoice Integration

Phase 4 completes the guarded handoff from the structured proposal experience into existing Dev ERP invoicing and projects. It does not replace invoice `QUOTATION` compatibility, issue invoices automatically, record payments, or create accounting entries.

### Acceptance lifecycle and evidence

- `POST /api/proposals/interactive/:token/accept` accepts only an unexpired, unrevoked link bound to the exact `PUBLISHED` version supplied as `expectedVersionNumber`.
- The server reloads stored client selections and recalculates the commercial result through `backend/commercial/pricing.js`; browser totals are ignored.
- A serializable transaction changes the version to `ACCEPTED` exactly once and creates or completes its unique `ProposalApprovalSnapshot`. Evidence includes the access link, hashed idempotency key, accepted selections/configuration, authoritative pricing and billing schedule, scope/deliverables, exclusions/terms, terms version, client identity, explicit consent, and server timestamp.
- Accepted, declined, expired, superseded, and withdrawn versions are terminal and remain immutable. The admin's post-acceptance action is explicitly labelled `Create amendment draft`, preserving the accepted version.
- `SENT`, `VIEWED`, and `CHANGES_REQUESTED` are derived lifecycle states from active access links/view timestamps/open requests. They do not add redundant database statuses. Withdrawal is a transactional `PUBLISHED -> WITHDRAWN` transition that revokes active links.
- Acceptance confirmation email reuses the existing server-side Resend delivery function when configured. Delivery failure does not roll back acceptance; it is returned as a separate notification state and written as an audit failure. No real notification is sent by tests.

### Billing and invoice rules

- Acceptance activates full/deposit events with `ON_ACCEPTANCE`, leaves milestone/balance events `MANUAL`, and activates recurring events as `SCHEDULED` with a next date. Acceptance itself creates no invoice.
- Authorized staff explicitly generate a currently due draft with `POST /api/proposals/:proposalId/versions/:versionId/billing/:billingItemId/invoice`. Manual milestones require `triggerConfirmed`; recurring events cannot run before `nextBillingDate`.
- Each invoice stores nullable `proposalVersionId`, `billingScheduleItemId`, and unique `generationKey`. The invoice and schedule advancement occur in one serializable transaction. Repeated requests return the existing invoice; failures preserve acceptance and mark the billing event `ERROR` for recovery.
- Generated invoices remain `DRAFT` for internal review and use the existing `INV-YYYYMM-ORG-####` convention. The billing event amount is already the final accepted, shared-pricing result, so generated invoice tax and discount fields are zero to prevent applying accepted tax/discount twice.
- Recurring generation advances monthly, quarterly, or annually and supports active, paused, cancelled, completed, and error states. It generates invoices only; it never charges a payment method. No scheduler is introduced in this phase.
- Invoice `paidAmount`, status, balance helpers, and accounting entry behavior remain authoritative. The proposal dashboard reads linked invoice totals and paid amounts; it does not keep a second balance or payment ledger. Manual MoMo, bank, cash, and other reconciliation continue through existing Invoicing. Paystack remains planning/config only.

### Project handoff and dashboard

- Accepted versions can link an existing tenant project or create one external project, optionally importing accepted deliverables as tasks and validating the internal owner against the tenant.
- `Project.acceptedProposalVersionId` is unique, preventing duplicate projects for one accepted version and providing direct delivery traceability alongside `Proposal.projectId`.
- The internal review displays accepted value, per-event billed/paid progress, outstanding linked-invoice balances, next recurring dates, schedule controls, linked delivery project, and existing version/request activity. Individual payment-method history is unavailable because the current invoice model stores cumulative `paidAmount`, not payment rows.

### Phase 4 API additions

Token-scoped client:

- `POST /api/proposals/interactive/:token/accept`

Authenticated proposal administrators:

- `POST /api/proposals/:proposalId/versions/:versionId/withdraw`
- `POST /api/proposals/:proposalId/versions/:versionId/billing/:billingItemId/invoice`
- `PATCH /api/proposals/:proposalId/versions/:versionId/billing/:billingItemId`
- `POST /api/proposals/:proposalId/versions/:versionId/project`

### Migration and deployment order

`20261016090000_add_proposal_acceptance_billing` is additive. It adds terminal version enum values; acceptance evidence fields; billing state/generation/date fields; nullable invoice traceability columns and unique generation key; and the unique accepted-version project link. It neither rewrites legacy proposals/quotations nor changes issued invoice values. It has not been applied.

Deploy in this order: Phase 2 migration, Phase 3 migration, Phase 4 migration, Prisma client/application code, then explicitly verify structured proposal creation and invoice draft generation in an isolated environment. Do not deploy application code that queries these fields before the migrations. Production migration and deployment remain outside this implementation.

### Operational limitations and next work

- There is no customer master; accepted customer identity remains an immutable proposal snapshot.
- There is no general notification/outbox model. Acceptance email is best-effort through existing Resend and records failure in audit, but automated retries, staff alerts, expiry reminders, and delivery receipts need a reviewed general notification foundation.
- There is no dedicated invoice payment transaction table, so proposal views can show authoritative cumulative paid amount/status/balance but not method-level payment history.
- Recurring invoices require an authorized manual call today. A future single-run scheduler may call the idempotent endpoint/service, but must add persistent leasing and retry operations first.
- Digital signatures, change orders beyond explicit amendment drafts, automated milestone approval, Paystack collection, receipts, and automatic invoice sending remain out of scope.

## 2026-10-16 Phase 5 QA and Production Readiness Review

Decision: **NOT READY for production enablement.** The structured proposal workflow is internally coherent and its automated checks pass, but production release is blocked by the existing invoice-payment write path and by the absence of an isolated database migration/concurrency rehearsal. No production migration, deployment, real notification, invoice send, or payment was performed.

### Requirements traceability

| Capability | Status | Evidence / gap |
| --- | --- | --- |
| Service and integration catalogue, packages, custom rows, dependencies | Verified | Organization-scoped catalogue/package APIs and focused duplicate/dependency tests. |
| Required, optional, included, recurring, client-direct, and pass-through rows | Verified | Structured contract and shared-pricing tests. Hourly work is represented as quantity × price; a named hourly unit type remains a presentation gap. |
| Percentage and fixed deposits | Verified | Fixed-deposit precedence and schedule reconciliation were added to `commercial/pricing.js`; percentage behavior remains covered. |
| Discounts, tax, one-time and recurring totals | Verified | Server-authoritative minor-unit pricing; client totals are discarded. |
| Draft edit and immutable publication | Verified | Draft-only mutation guards and terminal accepted/published version behavior are tested. |
| Token review, selections, questions, revisions, decline, exact-version acceptance | Verified | Hashed token storage, scoped public handlers, idempotent request keys, and browser interaction coverage. |
| Acceptance-to-billing-to-draft-invoice traceability | Verified in service tests | Serializable transaction, unique generation key, version/schedule foreign keys, and existing invoice numbering. Not exercised against a real isolated PostgreSQL database. |
| Recurring schedule advancement | Verified in service tests | Due-date enforcement, pause/resume/cancel, and deterministic generation keys. There is no scheduler, lease, or automatic retry worker. |
| Project handoff | Verified in service tests | One accepted version can link/create one tenant-scoped project and optionally create deliverable tasks. |
| Legacy proposals and invoice `QUOTATION` | Verified | Compatibility adapter and additive migration tests; no backfill or silent conversion. |
| Manual MoMo/payment evidence and safe correction | Not implemented | Existing invoices store only cumulative `paidAmount`; method/reference/payment rows, reversals, and retry idempotency are absent. |
| Real database migration, rollback, and concurrent acceptance/invoice proof | Blocked | No isolated PostgreSQL URL or local PostgreSQL/container tooling was available. Static Prisma validation and migration-source tests passed only. |
| Durable notifications and retries | Partial | Acceptance email is best-effort and audited; no general outbox, delivery receipt, or retry queue exists. |

### QA execution report

- `pnpm --filter @faako/dev-erp test`: 294/294 passing. The sandbox-only run could not bind `127.0.0.1`; the authorized localhost run passed all HTTP security tests.
- Focused proposal/security suite: 50/50 passing.
- Playwright `tests/e2e/proposals-interactive.spec.js`: 2/2 passing against the real React UI with mocked network boundaries. It covers required Website Development and CMS rows, optional SEO selection, recalculated GHS 7,000 → GHS 8,000 one-time totals, 50% deposit, recurring maintenance, revision messaging, explicit acceptance, exact version submission, accepted-state locking, and a 390×844 overflow check.
- ESLint, TypeScript, Prisma validation, Prisma client generation, production Vite build, and `git diff --check`: passing. Build retains the existing vendor chunk warning above 500 kB.
- Full schema generation via `prisma migrate diff --from-empty --to-schema ... --script`: passing.
- Not run: destructive or production E2E, real email, invoice send, payment recording, production migrations, or deployment.

The browser run found and fixed a real client loading race: `InteractiveProposalClient` could leave its loading state before the proposal payload rendered and dereference `null`. The page now keeps a safe loading/unavailable boundary until a version exists. It also hides mutable response controls after acceptance, exposes adjacent action errors, labels the message field, marks token pages `noindex`, and reports the current version accurately.

### Security review

1. Resolved critical dependency finding: the installed Express chain used vulnerable `proxy-addr@2.0.7`. A narrow workspace override and lockfile update pin `express>proxy-addr` to `2.0.8`. The jsPDF optional sanitizer is also pinned to `dompurify@3.4.17`. No application packages were broadly upgraded.
2. Public structured links store SHA-256 hashes rather than raw tokens (`backend/proposals/structuredProposal.routes.js:974`, `:1403`) and public writes are guarded by token validity, expiry/revocation, and feature rate limiting (`:1849`). Public responses exclude internal notes, source snapshots, and catalogue identifiers.
3. Token-authorized proposal writes are intentionally CSRF-exempt (`backend/security/csrf.js:2-14`) because they do not authorize with the session cookie. This also fixes signed-in staff reviewing a client link. The regression is covered by `backend/security/csrf.test.js`.
4. Public token pages emit `noindex,nofollow,noarchive` in the response/page (`structuredProposal.routes.js:1849`; `InteractiveProposalClient.jsx:138-140`). The global API retains a no-referrer policy, bounded body parser, CORS allow-list, disabled `x-powered-by`, and bounded trust-proxy configuration.
5. Authenticated management actions retain admin/capability checks and organization-scoped parent lookups. React text rendering is used; the new proposal UI introduces no raw HTML/eval sink.
6. Remaining high dependency advisories are in Prisma's bundled tooling (`deepmerge-ts` and unused MySQL support). There is no compatible upstream Prisma release in the current dependency range that removes them; forcing a major transitive override was rejected as unsafe. They remain a release gate pending an upstream-compatible Prisma update or documented build/runtime package separation.
7. Legacy proposal share tokens remain plaintext in the pre-existing `Proposal` compatibility columns. New structured links are hashed, but legacy token rotation/removal needs its own backward-compatible migration before claiming uniform at-rest token protection.

### Defect and risk register

| Severity | Finding | Disposition |
| --- | --- | --- |
| Critical | Invoice payment POST reads the previous cumulative amount before its transaction, then writes an absolute total (`backend/server.js:10364-10447`). Concurrent/retried requests can lose or duplicate the intended business event. There is no payment idempotency key. | Open release blocker. Introduce a tenant-scoped immutable payment record with unique request/reference key, transactionally derive the invoice balance, and add concurrent/retry integration tests. |
| High | No method/reference/verification/reversal ledger exists for manual MoMo or other invoice payments; one aggregate Accounting entry is overwritten (`backend/server.js:10454-10496`). | Open release blocker for the requested payment workflow. Do not treat proposal acceptance as payment readiness. |
| High | Phase 2–4 migrations and serializable transactions have not been applied to an isolated PostgreSQL database. | Open release blocker. Run forward migration, fixture workflow, concurrent calls, rollback/recovery rehearsal, and schema status checks before deployment. |
| High | Prisma production dependency graph retains two high advisories in bundled tooling. | Open release gate; monitor/update Prisma or split deploy-time tooling after compatibility testing. |
| Medium | Acceptance email has no durable outbox/retry and staff/revision/expiry notifications are absent. | Documented limitation; acceptance remains authoritative even when delivery fails. |
| Medium | Recurring invoice creation has no scheduler lease, automatic retry, or dead-letter operation. | Keep manual and administrator-triggered only. |
| Medium | Structured proposal list currently loads full nested records without pagination (`structuredProposal.routes.js:459`). | Add bounded pagination/summary projection before broad tenant usage. |
| Medium | No customer master; identity is snapshotted from proposal/project inputs. | Preserve snapshots until an authoritative customer domain is approved. |
| Low | Production build reports an existing vendor chunk over 500 kB. | Track bundle splitting; not proposal-specific. |

### Migration, deployment, and rollback checklist

Pre-deployment requirements:

1. Resolve the payment ledger/idempotency blockers and add route-level database integration tests.
2. Resolve or formally accept the remaining high Prisma supply-chain findings with an approved security exception; no release recommendation is made while they remain open.
3. Provision a disposable PostgreSQL environment with production-compatible version/extensions and no real customer data.
4. Back up the target database and record current migration status. Confirm environment isolation and rollback owner.
5. Apply, in order: `20261014090000_add_structured_proposal_foundation`, `20261015090000_add_proposal_client_message_kind`, `20261016090000_add_proposal_acceptance_billing`, `20261017090000_add_proposal_catalogue_tiers`, `20261018090000_add_immutable_invoice_payment_ledger`, and `20261019090000_add_proposal_email_delivery`.
6. Validate legacy proposal reads, legacy `QUOTATION` invoices, structured draft/publish/link/select/accept, one due draft invoice, retry idempotency, recurring advancement, and project handoff in the disposable environment.
7. Deploy migrations before application code. Initially restrict structured publishing/acceptance to an internal tenant and keep invoice generation manual.
8. Monitor proposal acceptance failures, billing `ERROR` rows, duplicate-key conflicts, notification failures, invoice generation latency, and tenant-scope audit events.

Rollback/recovery:

- Before any accepted or invoice-linked structured record exists, application rollback can restore the prior build while leaving additive nullable tables/columns dormant.
- After accepted records or generated invoices exist, do not drop proposal tables or traceability columns. Roll back application code only, disable new structured entry points, preserve snapshots/invoices, and repair forward.
- Never delete or renumber generated invoices during rollback. A failed billing event stays recoverable; acceptance is not reversed by an email or invoice-generation failure.
- Database down-migrations that drop accepted evidence are destructive and are not approved. Restore from a verified backup only under the database recovery runbook.

### Operations and support

- Support should use proposal/version/schedule/invoice ids and request ids when investigating; raw access tokens must not be logged or requested from clients.
- A client unable to load a link should have staff verify expiry/revocation/version state and issue a new link; accepted versions must not be reopened.
- Billing `ERROR` rows require staff review and an idempotent retry. Do not manually create a disconnected invoice to bypass the schedule link.
- Recurring billing is manual until a leased worker exists. Paused/cancelled schedules must not be invoked.
- Payment disputes/corrections cannot be safely represented by the current cumulative model; handle outside production enablement until the payment ledger work is complete.

## 2026-10-16 Proposal Builder Enhancement

This additive enhancement keeps the Phase 5 release decision at **NOT READY** and does not apply a migration or deploy code.

- `GET /api/proposals/client-options` reads active Faako `SignupRequest` rows through the existing server-only `FAAKO_DATABASE_URL`, returns a minimal proposal-safe projection, excludes archived rows, and deduplicates newest-first by normalized email then company. Manual values remain proposal snapshots rather than customer-master records.
- `/proposals/catalogue` manages organization-scoped service/integration availability, official source URLs, verification dates, provider-native terms, and proposal-currency Faako fees. Curated third-party entries default to explicit Custom quote tiers where a safe fixed amount is not owned by Faako; no scraping, live synchronization, or exchange conversion occurs.
- The curated service suggestions follow the repository's discovery vocabulary rather than treating every search concern as one SEO bundle. New proposals can configure SEO, AEO, GEO, geographic search targeting, Search Console/analytics setup, accessibility remediation, and agentic-AI readiness separately. Each starts as a configurable custom quote with bounded, client-visible descriptions and deliverables. Existing organization catalogue rows and historical proposal snapshots named `SEO & AEO` remain readable and are not migrated or rewritten.
- `CommercialCatalogueTier`, catalogue `systemKey`/`sourceUrl`, and nullable version-item tier/source/provider snapshots are introduced by `20261017090000_add_proposal_catalogue_tiers`. Existing catalogue prices and historical proposal/invoice rows are not backfilled or rewritten.
- Proposal access-link delivery metadata and send idempotency are introduced by `20261019090000_add_proposal_email_delivery`. Existing links are not backfilled, revoked, or rewritten.
- Selecting Website Development is normalized server-side during preview/save/package/publication/API submission. It adds exactly one rule-owned, required, selected, non-client-selectable, zero-priced CMS Setup row and includes UI/UX in the website deliverables. Removing the website removes only the rule-owned CMS row. Legacy UI/UX records remain readable but UI/UX is absent from new suggestions.
- `POST /api/proposals/ai/generate` supports `REFINE_SUMMARY` and `GENERATE_SCOPE_DELIVERY`. It requires auth, admin and Proposals capability, CSRF, the existing short-window AI limiter, and server-only OpenAI credentials. Structured prompts/output exclude commercial amounts and unsupported facts; input, item counts, strings, and output tokens are bounded.
- AI quota claims use unique hashed request keys in the existing audit store inside a serializable transaction. A user receives ten claims per UTC day; duplicate request keys do not consume another claim, and provider/validation failure conservatively consumes the original claim.
- Summary refinement is preview-and-accept. Scope generation runs only on first valid entry with blank fields, never overwrites manual content continuously, marks changed source inputs stale, and confirms before replacing manually edited generated fields.

Compatibility remains unchanged: the shared commercial pricing engine is authoritative; browser totals and AI monetary content are not trusted; published versions remain immutable; Invoice owns issued records/payments/accounting; legacy proposals and invoice `QUOTATION` remain supported.

## Current Foundation

- Structured management route: `/proposals`
- Structured create/edit routes: `/proposals/new`, `/proposals/:proposalId/edit`
- Structured workspace: `apps/dev-erp/src/pages/Proposals/StructuredProposalWorkspace.jsx`
- Interactive client route: `/proposal/interactive/:token`
- Interactive client page: `apps/dev-erp/src/pages/Proposals/InteractiveProposalClient.jsx`
- Legacy internal preview/editor route: `/proposals/:proposalId/preview`
- Legacy frontend page: `apps/dev-erp/src/pages/Proposals/Proposals.jsx`
- Export-aware preview component: `apps/dev-erp/src/pages/Proposals/ProposalPreview.jsx`
- Legacy client proposal view: `apps/dev-erp/src/pages/Proposals/ProposalClientView.jsx`
- Local schema helpers: `apps/dev-erp/src/pages/Proposals/proposalSchema.js`
- Template management helpers: `apps/dev-erp/src/pages/Proposals/proposalTemplates.js`
- Export metadata helpers: `apps/dev-erp/src/pages/Proposals/proposalExportConfig.js`
- Styles: `apps/dev-erp/src/pages/Proposals/Proposals.css`
- Authenticated API routes: `/api/proposals`, `/api/proposals/:id`, `/api/proposals/:id/share-token`, `/api/proposals/:id/create-invoice`
- Client-safe public API routes: `/api/proposals/view/:token`, `/api/proposals/view/:token/approve`, `/api/proposals/view/:token/request-changes`
- Legacy client-facing route: `/proposal/view/:token`
- Additive schema: `Proposal`
- Migration: `apps/dev-erp/prisma/migrations/20260518000000_add_proposal_foundation/migration.sql`
- Registry entry: `apps/dev-erp/src/config/adminModules.js`
- Navigation adapter: `apps/dev-erp/src/app/navigation.js`

The current implementation supports the structured Phase 4 workflow and the preserved legacy document workflow. Structured client acceptance is exact-version/token scoped and cannot issue an invoice or record payment; authorized staff can create only a linked draft from an accepted due billing event. Legacy client actions remain available only while a legacy proposal is `shared`; approved and changes-requested legacy proposals remain viewable for confirmation, and the existing approved-proposal invoice-draft handoff remains unchanged. All invoice drafts remain editable in authenticated Invoicing before sending, payment reconciliation, or accounting; Paystack collection remains disabled.

## Persistence Foundation

Saved proposals include:

- Organization scope
- Creator/last editor references
- Proposal title
- Client name
- Proposal type
- Proposal status
- Lightweight version number
- Metadata
- JSON proposal content
- Created/updated timestamps
- Optional secure token timestamps for future sharing

Statuses currently supported:

- `draft`
- `internal_review`
- `shared`
- `changes_requested`
- `approved`
- `archived`

The version number increments when a proposal record is saved through the authenticated update API. Full revision history is not implemented yet.

## Approval And Request Changes MVP

- Proposal status can be updated internally through the authenticated editor.
- Lightweight workflow metadata lives inside the proposal content JSON and is saved with the proposal record.
- Workflow metadata includes:
  - Internal review notes
  - Internal comments
  - Client change-request notes
  - Readiness checks for scope, pricing, timeline, terms, and approval copy
  - Server-owned status update metadata and status history
  - Lightweight client response metadata from secure proposal links
- Status history is generated server-side when the status changes and records status, timestamp, and the authenticated actor label where available.
- Shared proposal links expose Approve proposal and Request changes actions only when the proposal status is `shared`.
- Approving through the secure link updates the proposal status to `approved` and stores client name/contact plus an approved timestamp inside `content.workflow.clientResponse`.
- Requesting changes through the secure link requires feedback text, updates the proposal status to `changes_requested`, stores client name/contact/message plus requested-changes timestamp inside `content.workflow.clientResponse`, and mirrors the message into `clientChangeRequestNotes` for internal review.
- The internal Dev ERP proposal workflow panel shows the current status and any client response/feedback.
- Client approvals and change requests write audit log events for operational visibility.
- This is not a full collaboration, notification, digital signature, payment, or immutable approval-record system.

## Invoice Draft Handoff

- Approved proposals expose a Create invoice draft action in the authenticated proposal setup rail.
- The backend endpoint is `/api/proposals/:id/create-invoice`.
- Only authenticated admins can create invoice drafts, and the proposal must be in `approved` status.
- Pricing rows from enabled proposal pricing sections become editable invoice line items.
- Unresolved proposal amounts such as `TBD` become zero-value invoice rows and are noted on the invoice for manual review.
- The created invoice is linked back to proposal metadata with `invoiceId`, `invoiceNumber`, `invoiceStatus`, and creator/timestamp fields.
- Re-running the handoff for a linked proposal returns the existing invoice instead of creating duplicates.
- The handoff writes proposal and invoice audit events.
- No invoice is sent automatically. Public invoice links, quotation sends, paid status, receipts, and Paystack payment links remain owned by the Invoicing/payment workflows.

## Proposal Types

The schema prepares reusable proposal support for:

- ERP proposals
- Website proposals
- Onboarding proposals
- Future travel proposals

## Template Management Foundation

- Proposal templates now live in `proposalTemplates.js` instead of being hardcoded directly inside the base block schema.
- Each template includes:
  - Template key and id alias
  - Template name
  - Template description
  - Proposal type
  - Default section order
  - Enabled and disabled section metadata
  - Theme/style reference
  - Default content placeholders for branding, personal notes, and proposal blocks
- Current starter templates:
  - Start from scratch / blank proposal
  - ERP system
  - Business website
  - Client portal
  - Inventory/POS
  - Operational workflow
  - Business automation
  - Onboarding/implementation
  - Service proposal
  - Maintenance and support
  - Future travel itinerary
- Template selection creates a new local draft using the selected template defaults and stores template metadata on the draft.
- The blank proposal starter keeps the schema/block system, turns optional sections off by default, and lets admins manually enable and edit the sections they need.
- The template metadata is informational and draft-oriented. It does not change proposal APIs, invoice/payment behavior, PDF export, public sharing, or approval workflows.
- Full template marketplace/editor behavior is not implemented.

## Proposal Block Structure

Reusable blocks currently support:

- Cover section
- Personal note
- About/business section
- Project background
- Goals/objectives
- Proposed solution
- Deliverables
- Pricing summary
- Timeline/phases
- Terms/support
- Approval section

Blocks are ordered in the draft and can be moved up/down in the editable document. Optional blocks can be hidden from the generated proposal without deleting the schema entry. Pricing and timeline rows can be added or removed directly from their sections.

## Preview Behavior

- The proposal landing area uses a clean hero, document builder, search/action area, category filter chips, thumbnail-first visual template gallery, and compact recent proposal list.
- The main working surface is document-first: admins edit client details, personal messaging, headings, copy, bullets, pricing, and timeline rows directly on the proposal-like canvas.
- The right setup rail owns template selection, save/version actions, browser print/save-as-PDF export, secure-link preparation/copy, metadata, theme controls, and internal workflow review.
- Template cards keep text minimal, avoid heavy metadata, and apply the selected template directly when clicked.
- Template switching preserves entered compatible fields and manually changed section visibility while applying untouched defaults and the selected template's section order.
- Recent proposal cards open the selected saved proposal directly without extra card action strips.
- Desktop editing uses a two-column layout: editable proposal document on the left and compact controls on the right.
- Tablet/mobile layout stacks without a side-by-side preview dependency.
- Preview supports simple theme variants using Dev ERP variables and shared tokens.
- Print media hides the hero, gallery, recent list, editable document, and setup rail, then prints a clean export-safe preview only.
- `/proposals/:proposalId/preview` is an authenticated internal preview route. It does not expose proposal content publicly.

## PDF/Export Architecture Foundation

- The online proposal preview remains the source of truth for future PDF export.
- `ProposalPreview.jsx` owns the export-safe preview markup separately from editor/save behavior.
- `proposalExportConfig.js` defines export targets, section roles, page modes, print-break hints, and section metadata.
- Preview sections include `data-export-*` attributes for future renderer selection without changing saved proposal content.
- Export section roles currently cover cover, note, narrative, pricing, timeline, terms, and approval.
- The dedicated editable personal note renders once in the export preview; the older generic `personal_note` block is not duplicated in export output.
- Print CSS defines A4 page setup, hides app/editor chrome, preserves theme colors, avoids section breaks, and prepares cover/approval sections for page-aware rendering.
- The client proposal view includes a Download PDF button that uses the current print/save-as-PDF path.
- No server PDF renderer, generated PDF storage, or public export file endpoint is active yet.

## Secure Share-Link And Client View MVP

- Admin users can prepare a random secure share token for a saved proposal.
- Tokens are generated server-side with `crypto.randomBytes(32)`.
- Token expiry defaults to 14 days and is bounded by `PROPOSAL_SHARE_TOKEN_TTL_MS`.
- Prepared token metadata is stored on the proposal record.
- Client view route: `/proposal/view/:token`.
- Client-safe API route: `/api/proposals/view/:token`.
- Client view access is allowed when the proposal status is `shared`, `approved`, or `changes_requested`, the token exists, and the token has not expired.
- Client approval/request-changes actions are allowed only while the proposal status is `shared`.
- Client view responses strip runtime fields, metadata, internal workflow state, review notes, internal comments, staff/editor details, audit metadata, and the token itself. They may include the client response summary so clients can see confirmation after approval or change request.
- Client pages set `noindex,nofollow,noarchive` metadata and the API returns `X-Robots-Tag` with the same intent.
- Graceful client states exist for invalid links, unavailable proposals, expired tokens, and proposals that are not shared yet.

## Personal Note Support

The draft shape includes:

- Introduction note
- Founder/consultant message
- Optional closing note

These are editable in local state directly on the document and visible in the generated preview.

## Styling Approach

- Uses Dev ERP app variables such as `--accent`, `--surface`, `--card`, `--border`, `--ink`, and `--muted`.
- Uses existing shared UI wrappers from `@faako/ui`.
- Does not introduce a new hardcoded visual system.
- The current UI direction is document-first: simple hero, editable proposal canvas, setup rail, search/filter controls, thumbnail-led template cards, and compact recent work.
- `bubble-card` is applied only where intended for template/search/recent proposal cards; the editable document and export preview remain proposal-document oriented rather than dashboard-card heavy.
- Does not attempt to fully match the uploaded Stroane proposal PDF yet. PDF-specific styling belongs to a later PDF phase.

## Security And Data Boundaries

- Additive database schema only: new `Proposal` table.
- Authenticated proposal API routes require admin access.
- Proposal records are organization scoped.
- Drafts remain private.
- Public proposal content is limited to secure non-guessable token routes for `shared`, `approved`, or `changes_requested` proposals.
- Share tokens are random, server-generated, and not predictable.
- Share tokens are never returned by the client-safe proposal payload.
- Proposal metadata sanitization drops sensitive key names such as secrets, API keys, tokens, cookies, credentials, and webhook values.
- No server PDF generation.
- Legacy lightweight client approval/request-changes actions are token-scoped and stored in proposal content JSON. That legacy path creates no digital signature, server-owned approval record table, email notification, automatic invoice send, or payment link.
- Approved proposals can create editable invoice drafts from authenticated admin routes.
- No Paystack payment links.
- The legacy document editor has no AI generation; the structured builder now provides bounded, server-mediated summary and scope assistance.
- No payment, rent, accounting, report, receipt, auth, permission, or existing production workflow behavior changed.

## Future Work

- Add access logging, expiry controls/renewal UX, and view tracking for the client-view route.
- Replace lightweight client response JSON with server-owned approval records and optional digital signatures after requirements are designed.
- Add staff and revision-request notifications plus a durable delivery outbox/retry policy after consent and operational ownership are reviewed. Structured acceptance already sends a best-effort branded confirmation.
- Add proposal version lock after client approval.
- Add full proposal revision history and audit events.
- Add PDF generation following the approved presentation-style/Stroane proposal direction.
- Replace the approval foundation with server-owned approval records and digital signature support.
- Add proposal comments/feedback after notification and access-control rules are designed.
- Expand invoice handoff only after finance workflow review covers quotation sends, accepted quotations, payment states, receipts, and rollback rules.
- Add Paystack payment links only after webhook verification, idempotency, and payment-reference persistence exist.
- Add onboarding conversion after approved-proposal handoff rules are mapped.
- Add proposal analytics after privacy and retention rules are defined.
- Keep AI assistance constrained to the reviewed structured-builder contract; do not add unbounded generation to the legacy editor.
- Reuse proposal blocks for travel proposals and itinerary approval flows after travel-specific data needs are mapped.
- Add drag-and-drop template editing after permissions and audit boundaries are reviewed.
- Add custom branding/themes and reusable cover designs after PDF/export styling decisions are approved.
- Add reusable pricing blocks after invoice handoff rules are proven against live invoice workflows.

## Recommended Implementation Order

1. Server-owned approval records, proposal version locks, and optional digital signature planning.
2. Server PDF renderer proof of concept using the online preview/export metadata as the source of truth.
3. Access logging, expiry controls, and view tracking for client proposal links.
4. Full revision history and immutable approval records.
5. Paystack payment-link integration after invoice/payment safety review.
6. Onboarding conversion planning.
7. Travel itinerary proposal rendering and approval flow planning.
8. Extend the bounded AI wording workflow only after monitoring quota use and reviewing prompt/customer-data handling.

## Rollback Notes

Remove the `/proposals` and `/proposals/:proposalId/preview` routes, proposal API routes, registry/nav entry, `src/pages/Proposals`, the additive Proposal migration/schema changes, and this documentation. If the migration has already been applied, archive/export any saved proposal drafts before dropping the `Proposal` table.

## Manual Testing Checklist

- `/proposals` loads for authenticated admin users.
- Proposal list loads saved proposals scoped to the authenticated organization.
- Rent-only users remain scoped to rent/dashboard/profile behavior.
- Template switching remains local until saved.
- Template switching applies the selected template's section order, disabled-section defaults, style reference, and untouched placeholder content while preserving edited compatible values and explicit section visibility choices.
- Template search and category filters narrow the visible gallery without changing saved proposal data.
- Clicking a template card applies that template without erasing compatible entered fields.
- New draft requires confirmation before discarding unsaved local changes.
- Saving a new draft creates a proposal record and navigates to `/proposals/:proposalId/preview`.
- Saving an existing proposal increments the version number.
- Proposal details edit directly on the proposal-like document before save.
- Workflow status supports draft, internal_review, shared, changes_requested, approved, and archived.
- Review notes, internal comments, change-request notes, and readiness checks persist after save.
- Shared client links show Approve proposal and Request changes actions.
- Approved client links show the approval confirmation and do not offer another response.
- Changes-requested client links show the requested-changes confirmation and do not offer another response.
- Personal notes edit the preview.
- Blocks can be moved up/down.
- Optional blocks can be hidden from preview.
- Pricing and timeline rows render in preview.
- Pricing and timeline rows can be added and removed from the editable document.
- Secure token preparation is disabled for unsaved or dirty drafts.
- Secure token preparation stores token metadata and exposes client-safe proposal content only for shared/approved/changes-requested proposals.
- Share proposal publishes a saved clean draft to `shared` status and opens the secure client view.
- Legacy client approval updates status to approved without sending invoices, payments, Paystack links, email notifications, or digital signatures. Structured acceptance sends only its branded confirmation and still creates no payment or issued invoice.
- Legacy client request changes updates status to changes_requested and preserves the message without creating comments, notifications, invoices, payments, or Paystack links. Structured revision requests likewise do not yet trigger notification email.
- Approved proposals can create an editable invoice draft in Invoicing.
- Re-running invoice handoff on a linked proposal returns the existing invoice instead of duplicating it.
- Mobile layout stacks without horizontal overflow.
- Print preview shows only the proposal preview area.
- Print preview preserves cover/personal note/pricing/timeline/terms/approval section ordering.
- Existing invoice send, quotation, rent payment, accounting, report, and Paystack planning behavior remains unchanged.
