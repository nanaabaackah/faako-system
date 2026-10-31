# Travel With Ease — MVP implementation plan

## 2026-10-31 — Brand typography and email template management

Self-host the requested fonts; refine full-card interactions and privacy popup;
remove the footer footprint panel; move email preview into Owner-only Templates
with audited versioned draft/activation and migration 010. Preserve email routing,
queued-payload immutability and local no-send demo behaviour. See
[implementation and deployment notes](./email-templates-and-brand-polish.md).

## 2026-10-31 — Controlled Drive/R2 media sync

Add TTNGH-style server-only JSON configuration, bounded approved-folder browsing
and on-demand immutable image imports, provenance migration 009, CMS selection,
responsive publication assets and a no-network demo. Keep live activation pending
authorised Railway credentials, folder sharing and staging verification.
See [configuration, security decisions and rollback](./drive-r2-sync.md).

## 2026-10-30 — Reference correction

Restore the user's five-mockup CTA, align the full homepage's editorial treatment
with the actual Flyward source, and share one photo through enquiry/footer.
The footer remains full-width until the page-end gutter reveal.
See [decisions and verification](./reference-correction-2026-10-30.md).
This supersedes the photo-collage/light-footer description below; it does not
complete unapproved content, hosted portal UAT or production API remediation.

## 2026-10-30 — Editorial website redesign

Shared cinematic hero, cream interactive map, original photo CTA and light footer
implemented for public/demo modes. See [implementation, tests and release gates](./editorial-redesign-2026-10-30.md).
Native general/package enquiry completion, approved collections/legal copy, hosted
staff UAT and production API health remain open; do not mark the roadmap complete.

## 2026-10-30 — Company content, acknowledgements and publication follow-up

The current branch completes the Modern Concierge acknowledgement, redirects all
development/staging mail to testing, and sends production acknowledgements to the
saved customer with notifications CC. Journal collections and verified country
totals reuse the existing immutable content revision and publication lifecycle.
No new database migration or permission inheritance is required.

About, Services, How it works, Privacy, Cookies and Terms starter copy is available
in the portal for editing. Loading it does not persist or publish it. Owner/legal
approval, actual provider/retention configuration and TIDS stamp evidence remain
content gates. See `company-content-source.md`, `content-review-drafts.json` and
`email-test-flow.md`. This follow-up does not complete the native intake rebuild,
automated invitation email, online checkout or production acceptance.

## 2026-10-29 — Account activation and Phase 11

The current implementation slice adds identity-bound initial Owner/Editor
invitations and user-specific guided onboarding. See the [architecture, setup,
reuse, versioning and acceptance runbook](./workspace-onboarding.md).
Work is isolated on `feat/twe-workspace-onboarding` for a PR into `develop`;
no automatic merge, infrastructure ownership change or production deployment.
Local tests and hosted acceptance are separate gates. No Trello completion state
is changed by this phase. Earlier planning below is historical context.

Date: 2026-10-11. Prepared under [TWE-016](https://trello.com/c/VGWgpkCy).
Status: proposed execution plan for approval; no product implementation or infrastructure provisioning performed.
Evidence: [repository audit](./repository-audit-2026-10-11.md). Rules: [design/engineering standard](./design-engineering-standard.md). Product scope: Prompt 02 and the [October roadmap](./Travel_With_Ease_Solution_Roadmap.md).

## Reading and ownership

**2026-10-21 scope/ownership update:** the continuation request moves structured
CMS, media administration and publication into Prompt 03. Older A/B allocation
below is historical planning, not permission to defer those foundations. Baaba
is developer/technical contact; Faako owns developer services including GitHub,
Railway, PostgreSQL and Resend. TWE owns Namecheap/Cloudflare and delegates
configuration to Baaba, supplies approved content and approves staging/UAT.
See [current operations and gates](./staging-operations.md).

There are exactly two implementation groups below. `A1`–`A5` and `B1`–`B9` are local slice references under verified existing Trello cards, **not new Trello task IDs**. A large card such as TWE-017 spans several testable slices; completion of one slice does not complete that card. Links were checked through read-only Trello search on 2026-10-11. No Trello changes are authorized by this plan.

W/P/A file prefixes mean `apps/travel-with-ease-web/`, `apps/travel-with-ease-portal/`, `apps/travel-with-ease-api/`. Paths marked **new** are proposed, not existing functionality. File placement may be adjusted after inspection without expanding scope. Each task must document the standard's seven-question justification before adding dependencies, components or integrations.

Estimates are focused engineering person-days including slice tests/docs, not calendar commitments, quotes or parallel staffing assumptions. They exclude waiting for client content/access/legal review and uncertain provider setup. Use Trello for dependencies/review/testing/blockers, GitHub for code/PR/releases and Dev ERP for client milestones/commercials/deliverables/support. No tracking UI inside TWE.

## Verified prerequisite cards

These existing workstreams supply decisions/content rather than additional implementation phases:

| Existing card | Required evidence / dependency |
| --- | --- |
| [TWE-001 — requirements and MVP scope](https://trello.com/c/zVEUcgvo) / [TWE-002 — commercial scope](https://trello.com/c/DRLW9Iyv) | Written scope, exclusions and commercials; this plan is not evidence of client acceptance |
| [TWE-003 — onboarding and access](https://trello.com/c/MP8KGnxI) | Client account owners, delegated technical access, approvers and support boundaries; never credentials in Trello |
| [TWE-004 — domain/Cloudflare/DNS](https://trello.com/c/ztBlKfdl) / [TWE-005 — Railway/database](https://trello.com/c/4kzTJk7h) | Existing domain ownership verified; approved staging/production resource and billing plan |
| [TWE-006 — transactional email](https://trello.com/c/dOcxFAZx) | Sender/recipient approval and domain access; separate stage test delivery |
| [TWE-007 — Search Console/Analytics](https://trello.com/c/ECaEgMnW) / [TWE-008 — WhatsApp/Business Profile](https://trello.com/c/TIG0qrJJ) | Client-controlled accounts and approved contact values; do not claim Google Business eligibility/approval without verification |
| [TWE-009 — brand/images/copy](https://trello.com/c/AqnnDthN) / [TWE-010 — packages](https://trello.com/c/jAJQhqGT) | Approved licensed assets and actual offers, including the card's requested Zanzibar 2027 content; no invented offer/price |
| [TWE-011 — footprint data](https://trello.com/c/RAufH0lZ) / [TWE-012 — journal/testimonials/legal](https://trello.com/c/krOwZDP2) | Verified country counts/provenance, owned stories, testimonial permissions and approved policies |
| [TWE-013 — standards/audit](https://trello.com/c/sw1U86n8) / [TWE-016 — repository audit/plan](https://trello.com/c/VGWgpkCy) | Existing standard and this evidence-backed plan reviewed; no assumption of external card completion |

## A. Prompt 03 — Foundation, Infrastructure and Staging

### A1 — Safe environment composition and API/client contracts

- **Task IDs/name:** foundation portion of [TWE-022 — Deployment, monitoring and data protection](https://trello.com/c/7fgo0FnF) and [TWE-017 — Secure CMS, staff authentication and publishing](https://trello.com/c/fHKPyUV1).
- **Objective/business requirement:** make local/deployed modes explicit and prevent false successful UI states before collecting customer data. Address S01, S04–S06, S09–S10.
- **Existing code/files:** A `src/server.js`, `src/app.js`, `src/validation.js`, `src/security/securityHeaders.js`, `.env.example`, `package.json`; W `src/components/Estimator.jsx`, P `src/App.jsx`; **new** app-local configuration and API-client adapters/tests. Preserve shared defaults.
- **Dependencies:** approve deployed environment contract and estimator compatibility treatment; authentication/persistence remain disabled until A2/A3.
- **Steps:** (1) validate known APP_ENV values, URLs/origins/ports and required adapters; reject unknown modes; prevent development overrides of deployed NODE_ENV. (2) Add safe terminal errors and shared redacted logger/request-ID propagation. (3) Use explicit normalized browser response mode; add failure containment and clear loading/empty/error distinctions. (4) Document local env loading and usable `dev:twe` pairing, not example production URLs. (5) Separate deferred estimator/currency composition from MVP dependencies, preserving code/tests and agreed legacy contracts. (6) Bound limiter storage and define exact proxy/CORS method policy.
- **Acceptance:** missing deployed controls fail closed; malformed JSON/oversize errors are safe JSON; valid request IDs persist; canonical lead response is not silently empty; deferred failure cannot remove MVP enquiry UI. No shared consumer breakage.
- **Automated tests:** environment matrix/unknown values, startup guards, 400/413/404/500 envelopes, redaction, CORS preflights, limiter bounds/proxy assumptions, client normalization and render failure regressions. Calendar validation tests for new inputs.
- **Manual tests:** clean documented local startup, invalid-config diagnostics without secrets, keyboard error recovery, expired/failed request display.
- **Security:** no real data, production bypass, credential printing or broad shared changes; keep safe errors independent of NODE_ENV.
- **Docs/effort/risks:** update env, security, implementation notes and progress log; **2–3 days**. Main risks: accidentally broadening legacy API compatibility or treating staging as development.

### A2 — PostgreSQL persistence and reviewed migration lifecycle

- **Task IDs/name:** [TWE-005 — Railway and database setup](https://trello.com/c/4kzTJk7h); persistence portion of TWE-017.
- **Objective/business requirement:** durable, scoped data and recoverable schema changes; no local JSON for deployed enquiries/content.
- **Existing code/files:** A `db/001_phase1.sql`, `src/crm/repository.js`, `src/server.js`, `package.json`, `.env.example`; **new** `db/migrations/`, `src/db/`, focused repository/integration tests and migration/seed commands.
- **Dependencies:** A1; owner approval of minimal model, driver/migration runner and target DB identities; inspect whether any legacy schema is actually applied.
- **Steps:** (1) Inventory targets/history without importing customer data. (2) Keep historical migration immutable if applied; choose documented clean/new-schema versus additive upgrade path. (3) Add versioned SQL runner, locking/history and separate runtime/migrator roles. (4) Implement parameterised scoped repositories, transactions and optimistic-version primitives; create only tables required by enabled slices. (5) Add explicit local/stage synthetic seed and dependency readiness check. (6) Verify migration failure/retry and rollback/forward-fix against disposable DB.
- **Acceptance:** successful synthetic write/read survives restart; duplicate/concurrent transaction rules enforced; wrong organisation cannot read/write; deployed file fallback impossible; migration version verifiable.
- **Automated tests:** real isolated PostgreSQL transaction rollback, unique/FK/check constraints, organisation isolation, SQL-injection payload treated as data, concurrent updates, migration rerun/failed migration and connection outage.
- **Manual tests:** inspect roles/grants, synthetic restart/readiness, target confirmation, migration dry-run/review and failure recovery.
- **Security:** no production seed/reset/import; no credentials in commands/logs/docs. RLS may supplement but cannot replace scoped queries; composite references must preserve organisation boundaries.
- **Docs/effort/risks:** architecture/data dictionary, env, migration/rollback runbook and log; **3–5 days**. Risks: unknown deployed history, legacy full-CRM schema drift and introducing unnecessary tables.

### A3 — Staff identity, sessions and protected portal shell

- **Task IDs/name:** authentication portion of [TWE-017](https://trello.com/c/fHKPyUV1).
- **Objective/business requirement:** only authorised agency staff can access personal enquiries and editing controls; simple single-agency administration, not customer accounts.
- **Existing code/files:** A `src/app.js`, `src/server.js`, `appSystem.js`, security adapter; P `src/App.jsx`, `src/main.jsx`, `src/styles.css`, `appSystem.js`, `vite.config.js`; **new** `src/auth/`, staff/session repository/migrations, portal session adapter/route guards and tests.
- **Dependencies:** A1/A2; separately reviewed auth roadmap, provider/application access and approved domain/cookie topology.
- **Steps:** (1) Compare managed MFA-capable OIDC versus maintained local auth; obtain approval before installing adapter. (2) Bind verified issuer/subject to explicit active staff, no self-enrolment. (3) Create hashed opaque DB sessions with expiry/revocation, secure HttpOnly cookies on TLS, CSRF and login/callback/logout protections. (4) Enforce staff role/action/organisation at routes and queries. (5) Replace development token UI/storage; implement `/login` and protected route shell with accessible mobile navigation. (6) Add login/logout/security audit and recovery/deactivation procedure.
- **Acceptance:** anonymous/expired/revoked/disabled users denied server-side; staff login/logout/restore works; editor cannot perform owner-only settings; no token in Web Storage. Only working modules exposed until subsequent slices land.
- **Automated tests:** mocked identity callback validation/state/nonce/PKCE as applicable, session fixation/expiry/revocation, CSRF and cross-origin denials, role/tenant isolation, logout, route reload and safe return URL.
- **Manual tests:** stage MFA/login/recovery, cookie flags over TLS, sign-out in another tab, denied deep links, keyboard/touch menu.
- **Security:** use vetted auth libraries, not custom OAuth/crypto; do not import another app's session or replace its provider. Rate-limit login and record safe audit references.
- **Docs/effort/risks:** focused auth decision/roadmap, security/env, staff-access runbook/log; **3–5 days**. Risks: provider access, cross-site cookies, MFA/recovery ownership and unsafe retry of mutations.

### A4 — Isolated media and background-delivery primitives

- **Task IDs/name:** media foundation of TWE-017, [TWE-004](https://trello.com/c/ztBlKfdl), [TWE-006](https://trello.com/c/dOcxFAZx).
- **Objective/business requirement:** prove safe stage media upload and durable background work before building final editors/enquiry notifications.
- **Existing code/files:** A app/server/package/env and A2 transactions; **new** `src/media/`, `src/jobs/`, `src/notifications/`, media/outbox migrations, worker command/tests; P temporary functional protected media test route if required, not final library redesign.
- **Dependencies:** A2/A3; approved stage R2 access, sender/sink, file policy and dependency review. May build local mock adapters while resources await approval, but cannot mark stage integration complete.
- **Steps:** (1) Implement scoped R2 adapter with private draft/original and public derivative boundaries. (2) Accept bounded raster types, inspect/re-encode, strip metadata, randomize keys and persist rights/alt/dimension metadata. (3) Add PostgreSQL job claiming/leases, bounded retries, idempotency keys and failure visibility. (4) Reuse email-kit/notification primitives only where fitting; implement an actual Resend sender adapter, not a false assumption that shared helpers deliver mail. (5) Run synthetic upload/read/delete and test-message success/failure with enforced recipient allowlist.
- **Acceptance:** unauthorized/wrong-org/invalid upload rejected; no private object publicly readable; retry survives worker restart without duplicating DB jobs; stage cannot deliver customer mail.
- **Automated tests:** content/size/extension mismatch, malicious SVG/HTML refusal, object-key traversal, cross-org access, object/DB partial failures, lease expiry, retry exhaustion, duplicate claim/idempotency and safe-recipient enforcement.
- **Manual tests:** stage R2 policy and public/private URLs, licensed synthetic fixture upload, sink receipt, failure/retry observability.
- **Security:** never allow arbitrary remote URL imports; no passport/doc intake; secrets and hook URLs server-only; audit without raw files/PII.
- **Docs/effort/risks:** env/storage/job/notification contract and log; **3–4 days**. Risks: object-orphan cleanup, active file content, provider retry semantics and unapproved sender domain.

### A5 — Verifiable isolated staging, monitoring and recovery

- **Task IDs/name:** stage portion of [TWE-022](https://trello.com/c/7fgo0FnF), TWE-004/005. This is foundation staging, **not** TWE-023's complete MVP delivery.
- **Objective/business requirement:** a safe client-review environment independently testable from production, with controlled release and recovery.
- **Existing code/files:** W/P configs, `.env.example`, `_headers`/`_redirects`, robots/layout; A start/readiness/worker commands; `.github/workflows/monorepo-ci.yml`; TWE entries only in shared registries; **new** TWE-specific deploy/migration/backup checks/workflow and deployment runbook as needed.
- **Dependencies:** A1–A4; approved resource ownership, branch mappings, domains/certificates, hosting costs and restore targets.
- **Steps:** (1) Verify existing provider resources first, provision only expressly authorized stage resources. (2) Pair independent web/portal/API/DB/R2/auth/email; protect all stage aliases and enforce noindex. (3) Add TWE affected browser and isolated PostgreSQL CI coverage using frozen lockfile/builds. (4) Configure develop-stage candidates and protected main release approval, disabling competing provider auto-promotions. (5) Add health/readiness, redacted logs, job/backup alerts. (6) Produce encrypted export, restore to isolated DB, exercise code rollback and record SHA/schema/content versions.
- **Acceptance:** stage URLs/TLS and resource IDs verified; synthetic protected workflows survive restart; production credentials/data inaccessible; no unsafe email/indexing; restore and rollback measured; alert reaches an owner. If account access is blocked, state it explicitly—local passes are not staging completion.
- **Automated tests:** env pairing, deployed guard failures, allowed/denied origins, stage noindex/robots, secret-free bundles, auth smoke, migration compatibility, readiness outage, backup failure/verification and restore integrity checks.
- **Manual tests:** review-domain access, TLS/cookie topology, provider role isolation, recipient allowlist, alert drill and rollback/restore observation.
- **Security:** no production deployment or destructive production checks. Record migration-forward-fix limits; a database restore needs separate approval.
- **Docs/effort/risks:** stage/production inventory, release/backup/incident runbooks, env/architecture/log; **3–5 days**. Risks: provider access/billing, DNS propagation, deployment races and inadequate recovery permissions.

### Prompt 03 exit gate

A1–A5 accepted with evidence: explicit environment configuration, PostgreSQL/migration tests, secure staff session, protected responsive shell, safe stage media/mail/job primitives, isolated staging origins and resources, noindex, CI, monitoring, restore and rollback. Complete any required auth/hosting approvals first. Do **not** redesign the site, build full CMS/package/journal/map/enquiry screens, provision production or release live code merely to finish Prompt 03.

## B. Prompt 04 — Complete MVP and Release Readiness

### B1 — Approved visual/content contracts

- **Task IDs/name:** [TWE-014 — Homepage, destination and CMS mockups](https://trello.com/c/S7gBy8ej), [TWE-015 — Approve final design system and screens](https://trello.com/c/1vjXgJaw); inputs TWE-009–012.
- **Objective/business requirement:** resolve the exact editorial/mobile designs and truthfully publishable content before dependent UI work.
- **Existing code/files:** W pages/layout/CSS and P shell as references; existing standard/audit; **new** approved mock/asset-rights references in TWE docs, no separate design-system package.
- **Dependencies:** TWE-013/016 reviewed; client brand/content owner. Can run alongside A work; blocks B3's final visual acceptance, not backend development.
- **Steps:** inventory licensed assets and claims; agree typography/crops/layout/mobile menu/forms/editor states; review home/packages/map/journal at mobile/desktop; capture explicit acceptance and unresolved content; document token/asset specifications. Apply seven-question test; no new React Bits effect required.
- **Acceptance:** approved screens, content inventory/rights and responsive/error states; no fabricated testimonials/destinations/prices; business claims match MVP exclusions.
- **Automated tests:** define visual baselines and measurable route budgets; no claim of passing rendered tests for mocks.
- **Manual tests:** client review, contrast/type/target-size review, intended keyboard/focus order and reduced-motion/static alternative.
- **Security:** no personal trip data in mocks or asset metadata; check photo permissions.
- **Docs/effort/risks:** existing standard approval record, rights/content inventory/log; **2–3 days** excluding client turnaround. Risks: late content, commercial scope changes and treating visual approval as release approval.

### B2 — CMS, packages, media library, settings and publication

- **Task IDs/name:** CMS portion of [TWE-017](https://trello.com/c/fHKPyUV1); package management supports TWE-018.
- **Objective/business requirement:** staff can safely edit approved website fields and packages, preview, publish/unpublish and revert without changing code/layout.
- **Existing code/files:** A DB/auth/jobs/media/app; P App/routes/shared fields; W BaseLayout and pages; **new** A `src/content/`, revision/publication migrations/routes, P `src/pages/{WebsiteContent,Packages,MediaLibrary,Settings}.jsx`, W content loader/snapshot/preview adapter and tests.
- **Dependencies:** A2–A5; approved fixed content model and publication/preview policy; B1 for final editor design, TWE-010 actual package data.
- **Steps:** implement typed page/settings/package schemas, revision history and concurrency; build accessible field-driven editors/media picker/rights; restrict settings to public content/contact values; implement protected preview from same Astro templates; enqueue pinned publication manifest, trigger build server-side, confirm actual deployment; show pending/live/failed state and retry; implement revert/unpublish with new auditable revision/job. Public routes filter to confirmed approved content.
- **Acceptance:** draft invisible to unauthenticated users; one staff package/page edit reaches deployed HTML only after success; failed builds leave last known-good site and visible failure; revisions/media/SEO consistent; editor cannot alter credentials or layouts.
- **Automated tests:** schema/URL/rich-text injection, org/role access, optimistic 409, revision immutability, media reference validity, job retry/order/stale acknowledgement, draft leakage, unpublish/revert, static-output snapshot.
- **Manual tests:** client edits actual fields, previews narrow/wide layouts, failed-build recovery, old/deleted slug behaviour, audit view and keyboard editor use.
- **Security:** safe structured content or vetted sanitizer, protected build token and preview access, no public draft/signed private media URLs; audit mutation transaction.
- **Docs/effort/risks:** CMS schema/API/publishing runbook, editor guide/log; **5–8 days**. Risks: stale builds, overlapping publish requests, preview fidelity and media deletion breaking history.

### B3 — Complete public pages, navigation and contact paths

- **Task IDs/name:** [TWE-018 — Public site and package pages](https://trello.com/c/DrxLK7ms); TWE-008 contact input.
- **Objective/business requirement:** visitors understand the agency, explore real offers and reach the right enquiry without unavailable booking/account features.
- **Existing code/files:** W all existing pages, `BaseLayout.astro`, `global.css`, robots/headers; **new** package slug, FAQs, Contact and legal page routes and focused Astro components/assets; P package content from B2.
- **Dependencies:** B1/B2, approved TWE-009/010/012 content; enquiry links integrate B4 before acceptance.
- **Steps:** retain Astro route/layout foundation; replace decorative hero and repetitive grids with approved composition; implement keyboard mobile navigation, consistent focus/tokens/type; render licensed responsive images/fonts; add package detail/CTA, FAQs/contact/legal routes; use approved WhatsApp click-to-chat; remove unsupported portal/offline/payment-site claims and preserve existing public URLs/redirects.
- **Acceptance:** all required non-journal/map public pages are useful/crawlable and link correctly; approved package disclosures and contact values; mobile navigation parity; no estimator requirement or placeholder offers. No invented legal terms.
- **Automated tests:** built HTML route/content/link/metadata checks, dynamic slug and 404, screenshot regressions, accessible names, nav keyboard/escape/focus, image dimensions, no secret leakage.
- **Manual tests:** mobile touch/keyboard, 320px reflow/zoom, real-device images/fonts, licensed crops, long content, WhatsApp destination verification without sending messages.
- **Security:** allowlisted external URLs, safe structured content, CSP compatibility, approved public data only.
- **Docs/effort/risks:** route/content inventory, visual acceptance, asset records/log; **4–6 days**. Risks: missing imagery/copy, untested redirects or trading performance for visual effects.

### B4 — Two enquiry flows, staff inbox/dashboard and notifications

- **Task IDs/name:** [TWE-019 — Personalised and package enquiry workflows](https://trello.com/c/EZECH2EV), delivery portion TWE-006.
- **Objective/business requirement:** an enquiry is saved and acknowledged even when email or deferred currency services fail; staff can review and mark New/Contacted/Closed.
- **Existing code/files:** A `src/app.js`, `src/validation.js`, repository boundary; W `index.astro`/Estimator integration; P App/leadView; **new** enquiry repository/routes/migration, two form variants/shared field logic, inbox list/detail/status and outbox worker integration/tests.
- **Dependencies:** A2–A5/B2 package model, approved notice/contact/Turnstile configuration and legacy API policy; B3 entry paths.
- **Steps:** add discriminated schema independent of estimates; verify package published ID/revision and bot token server-side; atomically create enquiry/outbox with idempotency; return reference after commit; render accessible errors/preserved values/status; deliver minimal staff notification with protected portal link and bounded retries; build scoped paginated inbox/detail/status and dashboard counts; replace legacy enquiry-source/full-CRM presentation. Preserve dormant estimator code rather than extend it.
- **Acceptance:** both forms succeed, duplicate retry returns same reference, email outage cannot lose enquiry; unknown/unpublished package rejected; staff can contact/close with audit; no public read of enquiries; loading/error never claims empty inbox incorrectly.
- **Automated tests:** field/date boundaries, Turnstile failure/replay, honeypot contract, duplicate/conflicting idempotency keys, transaction rollback, provider outage/restart/dead-letter, authorization/list DTO minimisation, 409 concurrent status change, canonical browser success/error E2E.
- **Manual tests:** real stage test mailbox only, keyboard errors and confirmation, offline retry/double click, owner/editor inbox, contact follow-up without an automated WhatsApp integration.
- **Security:** no passport/payment data; bounded notes and safe display; notice versus marketing consent separate; abuse quotas, no sensitive notification subjects/logs; deterministic public organisation assignment.
- **Docs/effort/risks:** API/enquiry/outbox contract, privacy/retention and operator retry guide/log; **4–6 days**. Risks: silent duplicates, bots, lost submissions on provider failure, incompatible legacy consumers.

### B5 — Travel Journal and curated social links

- **Task IDs/name:** [TWE-020 — Travel Journal and social links](https://trello.com/c/6gjawuhW).
- **Objective/business requirement:** staff publish original, searchable travel stories with related package paths, without automated social synchronisation.
- **Existing code/files:** B2 revision/media/publishing infrastructure, W layout, P router; **new** article schema/routes/editor, W journal index/slug pages and tests.
- **Dependencies:** B2/B3, TWE-012 approved stories/rights, relevant published packages.
- **Steps:** add title/slug/excerpt/body/image/tags/source URL/related package and SEO fields to fixed model; reuse draft/preview/publish/revert; render Astro article/index, approved social links and package CTA; handle missing/unpublished relations and old slugs.
- **Acceptance:** approved article is crawlable, editable and reversibly published; private drafts never indexed; related links valid; no Meta account connection/import is required.
- **Automated tests:** article schema, dangerous links/rich text, draft filtering, relationships, slug conflict/redirect, structured metadata/output and editor errors.
- **Manual tests:** long articles/images at mobile/zoom, keyboard editor and links, source permission/credit verification.
- **Security:** sanitization/render allowlist, rights provenance, no arbitrary embeds/scripts or URL-fetch endpoint.
- **Docs/effort/risks:** article fields/editor guide, content/rights record/log; **2–3 days**. Risks: pasted unsafe HTML and publishing third-party content without rights.

### B6 — Unified world footprint and activity editor

- **Task IDs/name:** [TWE-021 — Unified interactive world map](https://trello.com/c/tOrDSlol), data dependency TWE-011.
- **Objective/business requirement:** truthfully show combined completed + confirmed-upcoming country activity, with accessible interaction and no traveller data.
- **Existing code/files:** A auth/repository/audit/content publication, P router, W homepage; **new** activity migration/schema/repository/routes/editor, approved boundary dataset, small map island and Astro country table/tests.
- **Dependencies:** A2/A3/B2/B3, verified historical counts, approved deduplication/count rules, geographic dataset licence and bundle decision.
- **Steps:** validate ISO codes/count/status/period/source key and editor publication control; unique source-country prevents re-import; update an existing activity when upcoming becomes completed; aggregate only published completed/confirmed activity, exclude cancelled/tentative/enquiries; render one documented intensity scale/legend with keyboard/tap details and equivalent static table. Record data revisions and publish them coherently.
- **Acceptance:** known synthetic totals exact across status transitions, no double count or public modes switch; no PII/source evidence published; zero/missing data truthful; small/mobile map remains usable without hover/animation.
- **Automated tests:** invalid country/count, duplicate/import conflict, completion transition, cancellation/unpublish, org isolation, aggregate projection, scale zero/outliers, map/table agreement, keyboard/touch controls and lazy island loading.
- **Manual tests:** client approves evidence and multi-country counting, boundary labels, contrast, tap/keyboard details and no-JS fallback.
- **Security:** audit changes, no traveller names, structured metadata only; dataset is a reviewed static asset, not arbitrary SVG upload.
- **Docs/effort/risks:** country-count data dictionary, provenance/legend rules and dataset licence/log; **3–4 days**. Risks: inaccurate history, duplicate aggregate batches, inaccessible colour-only encoding or excessive geometry size.

### B7 — Discovery, consent-aware analytics and legal readiness

- **Task IDs/name:** TWE-007/TWE-008/TWE-012; discovery portion of [TWE-025](https://trello.com/c/Fzkxsm4J).
- **Objective/business requirement:** correct public search presence and useful privacy-conscious measurement, supported by approved business policies.
- **Existing code/files:** W layout/Astro config/robots/headers/output tests and new legal/contact pages; P settings; **new** minimal consent/event adapter and tests, privacy/incident/retention procedures.
- **Dependencies:** B3–B6 routes/content, client Google access/contact, qualified legal review/current registration evidence and approved processor/retention policy.
- **Steps:** validate real origins/canonical/OG/structured data and only published sitemap URLs; noindex stage/portal/error/draft; implement approved minimal GA4 events only under agreed consent policy, persist/revoke preferences; prevent enquiry PII/references from events/URLs; verify Search Console ownership with delegated access; publish client-approved privacy/site/booking/cancellation/cookie/contact policies; define rights requests, retention deletion and incident ownership.
- **Acceptance:** indexable production candidates have accurate metadata, stage is protected/noindex; consent denied/revoked prevents nonessential tracking; package-view/enquiry-completion events do not contain personal data; legal review and registration status documented rather than inferred.
- **Automated tests:** canonical/sitemap/schema/OG checks, noindex per environment, consent gating/revocation, event allowlist/PII exclusions and deletion/retention fixtures including outbox/audit relationships.
- **Manual tests:** analytics debug with synthetic events, network inspection before/after consent, preference keyboard access, legal sign-off and subject-request tabletop.
- **Security:** least-privilege tags/accounts, no arbitrary tag editor in CMS, approved cross-border processors; no claim that a checkbox or this audit certifies compliance.
- **Docs/effort/risks:** SEO/events register, legal approval links, security/retention/processor records/log; **2–3 days** excluding legal wait. Risks: indexing wrong origin, PII telemetry or unapproved policies.

### B8 — Complete staging walkthrough, review and release verification

- **Task IDs/name:** [TWE-023 — Deliver staging MVP for client walkthrough](https://trello.com/c/F5kUgauc), [TWE-024 — Client review and revisions](https://trello.com/c/kmaLApE3), [TWE-025 — UAT, security, SEO and backup verification](https://trello.com/c/Fzkxsm4J), remaining readiness TWE-022.
- **Objective/business requirement:** prove the full approved MVP and its recovery/security, not merely green builds or screenshots.
- **Existing code/files:** tests for W/P/A, TWE CI/deploy/readiness scripts, header/CSP configuration and completed slice code; **new** risk-based E2E/accessibility/visual fixtures and acceptance/release evidence in TWE docs.
- **Dependencies:** A5 and B1–B7 accepted; legal/content/design approvals; all high launch risks resolved or explicitly escalated to qualified owner without violating mandatory access/isolation controls.
- **Steps:** assemble staging walkthrough for every page/module; run positive/negative end-to-end flows; inject DB/email/build/storage failures; verify mobile/a11y/performance budgets; exercise backup restore and code/content rollback; check secrets/dependencies and permission matrix; log client issues in existing Trello cards, distinguish scope changes; rerun affected regressions and collect named approval.
- **Acceptance:** evidence links commit/environment/test data/results; both enquiry workflows, CMS/revert/media, journal/map and staff sessions pass; no unresolved data-loss/access blockers; measured restore/RPO/RTO, alert response and rollback documented; client UAT signed. Production remains unmodified.
- **Automated tests:** full focused lint/typecheck/build/tests, consumer contracts, isolated DB integration, browser E2E/visual/a11y, authorization/CSRF/XSS/upload matrices, noindex, retention, dependency/secret scans and applicable monorepo gates.
- **Manual tests:** screen reader, keyboard, reduced motion, 320px/zoom/touch and representative mobile performance; restore/rollback drill, identity recovery, content accuracy and client training rehearsal.
- **Security:** never use production for destructive tests; sanitise screenshots/logs and assign findings owners; risk acceptance is not authorization to bypass tenant/auth controls.
- **Docs/effort/risks:** dated UAT/security/performance/recovery evidence, release checklist/log; **3–5 days** plus unestimated remediation from testing. Risks: late scope changes, false confidence from mock-only checks, unresolved legal or restore issues.

### B9 — Explicitly approved production release and handover

- **Task IDs/name:** [TWE-026 — Production launch and handover](https://trello.com/c/v7WTlxlj), production completion TWE-022.
- **Objective/business requirement:** release the accepted build safely and transfer operating ownership. Planning this slice is **not permission to execute it**.
- **Existing code/files:** accepted deployment/migration/backup scripts and manifests, environment examples/registry TWE entries; documentation and release records. No feature additions during release.
- **Dependencies:** B8 acceptance, production resource/cost/access approval, client/legal approval and an explicit production deployment instruction. Confirm real resource IDs, active backups, release approver and rollback operator immediately before execution.
- **Steps:** review exact SHA/diff/artifacts and production env; back up and apply reviewed compatible migrations before dependent code; deploy through approved controls; verify DNS/TLS/headers, login denials, public output and an expressly authorised synthetic enquiry if required; monitor jobs/errors and execute rollback criteria if necessary; train staff and hand over CMS, recovery, privacy/support and account ownership records.
- **Acceptance:** approved release and safe smoke evidence, correct live origins/no stage settings, working alerts/backups and nominated owner; client handover and support terms recorded in Dev ERP; Trello/GitHub references link the actual release only.
- **Automated tests:** predeploy checks, migration/version guard and non-destructive health/public/denial smoke; staged regression evidence bound to deployed SHA.
- **Manual tests:** DNS/TLS, approved real sender configuration, staff training and rollback readiness; no unapproved customer messaging or destructive production E2E.
- **Security:** never log secrets, expose backups or broaden access to fix a release; database restore separately approved due to data-loss risk.
- **Docs/effort/risks:** release notes, deployment/ownership/support runbooks and progress log; **1–2 days** plus monitoring window. Risks: environment mix-up, external service configuration or schema rollback incompatibility.

## Sequence, critical path and effort

| Order | Deliverable / dependency gate |
| --- | --- |
| 1 | Verify TWE-001/002/003 decisions and auth/data/hosting approvals; review current dirty branch before any future commit |
| 2 | A1 → A2 → A3; no deployed real data while token/file fallback exists |
| 3 | A4 → A5; stage acceptance requires real isolated integration evidence, not mocked services alone |
| 4 | B1 content/design can proceed alongside A work; B2 depends on A foundations; B3 depends on approved B1/B2 |
| 5 | B4 enquiries/outbox/inbox; B5 journal and B6 footprint can be scheduled independently after B2/shared public structure |
| 6 | B7 discovery/privacy, B8 complete-stage/UAT/restore evidence; all required MVP capabilities converge here |
| 7 | B9 only after separate explicit production approval |

Estimated engineering effort: **A 14–22 days; B 26–40 days; total 40–62 person-days**, excluding approval waits, procurement and additional remediation found in UAT. The roadmap's four-week target is not validated by this audit; achieving it would require explicit capacity/scope/commercial discussion, not omitted security/testing. Do not infer permission for delegation or extra staffing from this estimate.

Critical blockers: approved staff identity and access; separate provider resources/credentials; migration history and model decision; publication/preview consistency; approved package/photography/legal/footprint evidence; tested backup recovery and client release acceptance. Technical choices and alternatives are in [audit section 10](./repository-audit-2026-10-11.md#10-decisions-requiring-approval).

## Prompt 03 handoff scope

Implement **A1–A5**, following inspected existing code and the seven-question rule. Preserve deferred code, public URLs and other apps. Start from a reviewed TWE branch based on develop without discarding existing work. Deliver tests and documentation for explicit environment safety, canonical contracts/errors/logging, PostgreSQL/migrations, approved staff authentication, protected portal shell, media/mail/job primitives and isolated staging with monitoring/restore/rollback evidence. Name unapproved providers/resources as blockers. Do not complete Prompt 04 features, commit/push without permission, or deploy to production.
