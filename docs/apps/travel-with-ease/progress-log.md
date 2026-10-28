# Travel With Ease progress log

## 2026-10-27 — Actionable pre-deploy configuration diagnostics

- Replaced misleading generic configuration failures with allowlisted reason codes
  and corrective messages naming settings, never their values.
- Added subprocess coverage for deployment log output and credential redaction,
  including malformed URLs, approval, endpoint, role and TLS configuration.
- Preserved migration, tenant, role and TLS guards. No hosted database changed.

## 2026-10-27 — Controlled API pre-deploy database setup

- Added a hosted-only pre-deploy command with explicit environment approval,
  distinct runtime/migration users and first-time initialisation consent.
- Reused transactional SQL migration history; added idempotent organisation
  provisioning with audit and explicit grants to an existing restricted runtime role.
- Runtime readiness is checked after migration. No hosted database or Railway
  setting changed during implementation; see the [setup runbook](./predeploy-migrations-2026-10-27.md).

## 2026-10-26 — Approved initial public content and database compatibility

- Recorded approval of existing copy/photography; hosted builds can use the reviewed
  bundled homepage snapshot. Missing business/legal pages stay unpublished and hidden
  from navigation; explicit CMS snapshots retain precedence and fail closed.
- Removed exact PostgreSQL 17 startup pin; report actual server major and retain
  identity, runtime-role and migration verification. Add safe failure code to messages.
- See [release scope and remaining limitations](./public-release-2026-10-26.md).

## 2026-10-25 — Hosted API startup guard correction

- Removed the unconditional production API block; both hosted environments
  require a database-verified receipt bound to their exact environment and adapters.
- Removed release SHA from general startup requirements. Publishing still requires
  the reviewed SHA; database, Access, role and tenant protections remain enforced.
- API lint and 44 unit tests pass. No live MFA, database or release acceptance is
  implied. Background workers remain separately gated.
- See [startup and TLS handoff](./hosted-startup-2026-10-25.md).

## 2026-10-24 — Verified staging API startup

- Implemented staging-only startup after mandatory PostgreSQL/Access configuration
  preflight. A process-local receipt binds verified persistence to the actual
  repository/session adapters and exact scope/configuration at application creation.
- Production and background-worker guards remain intact. No environment bypass,
  bearer fallback, automatic migration or staff provisioning added.
- API lint and all 43 tests passed; see [activation handoff](./staging-activation-2026-10-24.md).
- No deployment or live configuration changes. Railway 502 cause is not confirmed
  without startup logs; production login is user-reported, not verified by this change.

## 2026-10-23 — PostgreSQL 17 and staging DNS verification

- PostgreSQL 17.11 installation completed; isolated migration/auth/tenant tests,
  restart persistence and logical restore passed (16 tables, 63 synthetic rows).
  Temporary cluster stopped; existing databases and PostgreSQL 16 linking preserved.
- Public portal DNS and unauthenticated Cloudflare Access login redirect verified.
  Both authoritative nameservers returned NXDOMAIN for the supplied staging API host.
  No authenticated login or MFA-policy verification is claimed.
- Updated the hosting handoff with evidence. API hosted activation remains gated;
  no deployment, live configuration change or staff bootstrap performed.

## 2026-10-23 — Hosted staff portal preparation

- Added a separate Access-protected portal server using existing API dependencies,
  a fixed-upstream same-origin proxy and explicit staff route/method allowlist.
  Preserved scoped cookies, CSRF, request IDs and authoritative API permissions;
  blocked redirects, arbitrary destinations, oversized bodies and caching.
- Added Railway wrapper scripts, empty same-origin frontend configuration and a
  hosted build guard against cross-origin API URLs. Public Astro hosting unchanged.
- Added a read-only hosted preflight for environment/tenant identity, PostgreSQL 17,
  runtime role flags and exact migration inventory. It is not an activation bypass.
- Final API suite passed 42/42, including proxy and preflight tests. Portal
  staging-configured build, lint, typecheck and existing test pass. A hosted build
  with a cross-origin API URL correctly fails closed. PostgreSQL 17
  installation/verification is recorded separately.
- Follow [hosting preparation](./portal-hosting-preparation-2026-10-23.md) for setup.
  API hosted-startup guard remains active. No deploy, commit/push, real bootstrap,
  hosted settings, private environment file or Trello state changes.

## 2026-10-23 — User-supplied Google tag configuration verified

- The requested stream was already configured in the local web environment. Kept the existing shared consent-controlled loader; no duplicate inline tag or private-portal tracking added, and no private environment values committed.
- Local development-mode static build passes and contains the requested measurement ID in exactly one analytics configuration element, without an eagerly loaded external Google script.
- Shared analytics tests pass 7/7 (consent, withdrawal, Do Not Track, sanitized page views and deduplication). Web tests pass 4/5; the unrelated homepage assertion still expects `/brand/primary.png`, which the current layout does not render. No branding changes made for this task.
- Updated setup status and build-time configuration instructions. No deployment or live Google receipt verification performed; hosting configuration and post-deployment verification remain required.

## 2026-10-23 — Cloudflare Access and separate platform authority

- User requested Access/independent MFA and `platform_admin`; supplied Access AUD
  was explicitly confirmed as production, not staging. No private `.env` edits.
- Added RS256/JWKS verification, audience-bound PostgreSQL sessions, replayed
  exchange rejection, central permissions and additive migration 006. Preserved
  CSRF, short cookies, revocation, shared audit/security contracts and startup guard.
- Added reviewed bootstrap command (not run for a real identity), staged Editor
  provisioning, Owner activation, audited read-only support grants (max 30 minutes),
  scoped diagnostics/security events and controlled session revocation.
- Added protected System Administration and staff-access UI; business publishing
  now explicitly requires Owner permission. Platform authority does not imply
  business access or any provider/account ownership.
- API tests 38/38, API/portal lint and portal build pass. PostgreSQL 16 disposable
  compatibility/restart/restore check passed (16 tables, 63 rows). PostgreSQL 17
  release verification remains pending; the unchanged runner rejects version 16.
- Full acceptance remains blocked on distinct staging Access configuration,
  reviewed hosted proxy, real MFA/recovery/logout checks and target-version database
  tests. No staging-login screenshots or production readiness claimed.
- See [Access decision and runbook](./access-platform-admin-2026-10-23.md).
  No commit, push, deployment, real bootstrap or Trello state change.

## 2026-10-23 — Approved media, branding and discovery follow-up

- Processed 48 supplied photos into 44 unique image sets (four exact duplicates),
  preserving originals privately. Recorded hashes, proposed alt text, people/
  consent review and metadata removal in `media-source-inventory.json`.
- Added two approved photographs to the local editorial homepage via four static
  responsive WebPs; no Drive hotlinks or new hydration. Published CMS selections
  remain authoritative. Other business content remains labelled as a preview.
- Imported official primary logo, symbol favicons and three 1200×630 sharing
  cards; added page-specific metadata and selected-CMS-image sharing crops.
- Web build, five web tests, Astro check, web/API lint and 33 API tests pass.
  Chrome checks at 320/768/1440px pass for reflow, photos, mobile navigation,
  favicon and mocked analytics consent/DNT/withdrawal/deduplication.
- Updated existing TWE-009/TWE-007 with evidence comments only; checklist/list
  states preserved. See the follow-up document for external verification gaps.
- No commit, push, deployment, live collection or production DNS change.

## 2026-10-22 — Prompt 04 local placeholder review shell

- User confirmed approved business assets/copy are unavailable and requested
  placeholders. Replaced the local homepage's abstract globe, unsupported portal/
  offline claims and exposed estimator with an editorial review composition.
  Estimator source is preserved, not extended. No fabricated offers or images.
- Added labelled image spaces, honest unpublished-content routes, mobile navigation
  with Escape/focus return and no-JS links, the official shared Faako attribution,
  a privacy link in the consent notice and focus return to cookie settings.
- Reused `@faako/ui` via a workspace dependency; no new external library. Its
  AppBottomBar renders statically using its existing context default and explicit
  business name. It is not hydrated and no duplicate logo/attribution is created.
- Hosted builds without a publication snapshot now fail closed. Local review
  content is noindex and is not approved legal copy, an offer or a working enquiry.
- Component decision (seven-question standard): the image placeholder supports
  explicit review without false photography; there is no equivalent app component;
  native figure/caption suffices; text labels supply the fallback; it adds no
  hydration or image bytes; no licence/dependency burden; visible content gaps
  make review more truthful. The footer wrapper reuses existing shared behaviour,
  is necessary for Astro's React integration, uses server rendering, adds no
  interaction burden and avoids duplicated branding. CSS and native menu events
  avoid an animation/menu library. Existing typography is retained pending approval.
- Build, Astro checks and static route tests verified in this slice; browser results
  and remaining MVP work must be distinguished from full release acceptance.
- Actual Chrome/Playwright checks passed at 320/768/1440px: no horizontal overflow,
  menu open/Escape/focus return, consent persistence and withdrawal, a single shared
  attribution link, no-JS mobile navigation and no page-script errors. Mobile and
  desktop screenshots were inspected; local evidence is `/private/tmp/twe-review-320.png`,
  `twe-review-768.png` and `twe-review-1440.png` (same directory). These dev-server
  screenshots include Astro's developer toolbar, which is not in the production build.
  This is not screen-reader, performance, live analytics or full-MVP acceptance.
- Install initially rewrote unrelated lock resolutions; those generated changes
  and tracked dependency-link changes were reverted. The retained lockfile change
  is only the TWE web workspace's shared UI link. No unrelated app source changed.

## 2026-10-22 — Prompt 04 prerequisite verification

- Accepted the supplied MVP implementation scope, preserving Astro/React/Express/
  PostgreSQL boundaries and the prohibition on unapproved commits/pushes/deploys.
- Began from clean `feat/twe-foundation-login-flows` at `ae5ccbff3`; TTNGH untouched.
- Ran real PostgreSQL integration and corrected a restart harness output-pipe hang.
  The final drill verified five migrations, one-use Remember me flow persistence,
  CMS/media/auth/job constraints and restart/restore integrity for 15 tables and
  49 synthetic rows. Full evidence and remaining gates are in the foundation record.
- API lint and whitespace checks pass. No hosted resources, email deliveries,
  browser verification, staging URLs or MVP completion claimed in this checkpoint.
- Reviewed the public layout, consent notice and existing shared footer, fields
  and loading exports for subsequent UI reuse. Requested approved imagery,
  package/contact/WhatsApp and legal content; do not invent missing business data.
- No Trello card was marked complete: local database evidence does not complete
  TWE-005/017/022 or the dependent MVP delivery cards.

## 2026-10-21 — Prompt 03 private-media API integration

- Connected the existing media routes/service to API startup behind staff
  sessions and CSRF-protected mutations. Missing storage remains unavailable;
  partial configuration and storage without PostgreSQL fail startup.
- Added TWE-only media preflight headers and server-only R2 variable names to
  the example environment file. No shared package or unrelated application changed.
- Fixed replacement-upload concurrency accounting before asynchronous lookup.
- Added synthetic image, configuration, cleanup, concurrency and HTTP access
  tests. No live bucket, provider or shared database was used.
- Verification: API tests 26/26 pass with permitted local loopback access;
  API lint, typecheck, build (syntax checks) and whitespace checks pass.
  Real PostgreSQL/R2 integration and browser acceptance are not verified here.
- Prompt 03 is still in progress; media UI, publishing and hosted acceptance
  remain outstanding. No deployment or external task-status update performed.

## 2026-10-11 — Prompt 02 repository audit and implementation plan

- Completed a source-backed public/API/portal and relevant shared-package review
  under verified Trello task TWE-016. Read-only Trello discovery verified the
  TWE-001–026 task identities; no cards were modified or marked complete.
- Added `repository-audit-2026-10-11.md`: current/target architecture, complete MVP
  gap matrix, public/portal assessment, API changes, minimal data model, numbered
  security risks, staging requirements, external-resource verification limits,
  technical options and approvals. Referenced official Ghana Act 843/DPC guidance
  while distinguishing engineering measures from legal/client sign-off.
- Added `implementation-plan.md`: detailed independently testable slices in only
  Prompt 03 (foundation/infrastructure/staging) and Prompt 04 (complete MVP/release
  readiness), with existing Trello IDs, affected files, dependencies, steps,
  acceptance, tests, security/docs, effort and risk. Estimate: 40–62 engineering
  person-days, excluding approval waits and additional UAT remediation.
- Added the project documentation index `README.md`; linked the plan from the
  existing architecture, roadmap and security documentation without replacing
  prior decisions or audit evidence.
- Captured and inspected nine fresh local screenshots under
  `audits/2026-10-11/screenshots/`. Browser API calls were intercepted with synthetic
  canonical responses. Reproduced estimator render failure and false empty portal
  inbox; no customer records or real access credentials used.
- Isolated memory/API probes verified HTML malformed-JSON errors, replacement of
  incoming request IDs, impossible-date acceptance and enquiry failure when the
  currency service fails. Normal production startup still refuses deployment;
  the lower-level app factory's weaker guard is separately recorded.
- Build, lint and typecheck passed for all three TWE workspaces. Web and portal
  tests each passed 1/1. API initially passed 4/6 under sandbox restrictions, then
  passed 6/6 after permitted loopback rerun. These limited tests do not establish
  MVP readiness or comprehensive type/accessibility/security coverage.
- App registry and workspace-manifest checks passed. Project-registry check
  exited successfully with its existing unrelated REEBS Water metadata warning;
  no unrelated metadata was changed. No fresh full-monorepo or advisory scan was
  claimed. Documentation links and whitespace were checked before handoff.
- Branch remained `feat/reebs-water-modules-stabilization`; scoped TWE source
  comparison with local develop was empty. Existing dirty documentation was
  preserved. No product changes, dependency install, database migration, external
  write, commit, push or deploy. Existing local servers were left untouched.

## 2026-10-11 — Standards alignment, documentation only

- Extended the existing standard to govern Astro public content, React staff
  administration and Express backend work, including the seven-question
  component/dependency rule, testing, release acceptance and Trello/GitHub/Dev ERP
  responsibilities. No new implementation backlog was created.
- Added local/staging/production isolation requirements and a recommended
  feature branch → develop/staging → reviewed main/production mapping. CI branch
  triggers were inspected; external hosting hooks and branch protection were not
  verified. Deployment mapping requires confirmation, not automatic adoption.
- Resolved scope ambiguity between historical architecture and October launch
  baseline, the roadmap's illustrative glow/background effects and visual rules,
  an overly narrow React Bits allowlist, misleading generated imagery exceptions,
  and a blanket approval gate. Corrected the reflow/zoom test wording.
- Recorded that `APP_ENV=staging` currently bypasses the production-only startup
  guard and retains file persistence/development-token authentication. Staging
  and production remain blocked pending reviewed deployed adapters/configuration;
  staging no-index handling is not implemented.
- Retained the prior screenshot audit. Existing concerns remain: decorative hero,
  repeated kickers/cards, mobile navigation, contrast and unsupported deferred
  claims; raw API-envelope consumption affects estimator and portal lead loading.
- Updated `design-engineering-standard.md`, `env.md`, `security.md`,
  `architecture.md` and the audit's historical-status note alongside this log.
- Approval items: typography/imagery/content, dependent visual proposals,
  estimator scope, staff authentication, hosting/environment costs and mappings,
  backup/rollback ownership, client scope/legal acceptance and production releases.
- Preserved existing work on `feat/reebs-water-modules-stabilization`; no branch
  switch, application/shared-package changes, installation, commit, push or deploy.

### Inspection and verification

Inspected the existing standard, `architecture.md`, `roadmap.md`, `env.md`,
`security.md`, `implementation-notes.md`, this log, the October solution roadmap
and `audits/2026-10-10/visual-audit.md`; repository `AGENTS.md`,
`.github/workflows/monorepo-ci.yml` and `docs/platform/pre-deploy-checklist.md`;
web `src/pages/index.astro`, `src/layouts/BaseLayout.astro` and
`src/components/Estimator.jsx`; portal `src/App.jsx`; API `src/server.js` and
`src/app.js`; and `packages/api-client/src/request.ts` response handling.
Web/portal/API paths are relative to their respective `apps/travel-with-ease-*`
workspaces. Branch/status checks established the pre-existing dirty worktree.
Validation: documentation relative-link checks and `git diff --check`; no fresh
browser audit or application tests were required or claimed for this docs-only
alignment. Prior test results below remain dated historical results.

## 2026-10-10 — Design and engineering standards audit

- Audited the rendered public website at desktop and mobile sizes against the
  October 2026 solution roadmap; evidence is stored under
  `audits/2026-10-10/screenshots/`.
- Added the proposed public-site design and frontend engineering standard,
  covering typography, colour, spacing, editorial layout, licensed imagery,
  navigation, buttons, forms, responsive behaviour, motion, React Bits limits,
  accessibility and performance gates.
- Recorded a prioritised visual change plan, trade-offs and approval decisions
  in `audits/2026-10-10/visual-audit.md`.
- Confirmed a P0 estimator failure: the API success response is consumed in raw
  envelope mode, so the component formats an undefined value as `BigInt` and
  unmounts after the estimate action. This was documented but not repaired.
- Recorded the scope conflict between the visible estimator/client-portal
  claims and the October baseline, which defers those capabilities.
- No website, portal, API or shared-package implementation was changed.

## 2026-09-27 — Phase 0 and Phase 1 foundation

- Audited monorepo application boundaries, shared packages, API conventions, security, finance, offline and documentation standards.
- Recorded architecture, ERD, module map, data classification, threats, integrations, offline policy, environment contract, decisions and roadmap.
- Added Astro public storefront, React/Vite agent lead dashboard and Express API workspaces.
- Added precise currency conversion/provider/cache foundations and Phase 1 inquiry persistence boundary.
- Added the initial PostgreSQL migration and local-development repository adapter.
- Added unit, API and static-output checks.

### Verification

- Travel With Ease web, portal and API focused lint, typecheck, test and build checks pass.
- Root `pnpm lint` passes (31/31 tasks; existing warnings remain in other applications).
- Root `pnpm typecheck` passes (18/18 tasks).
- Root `pnpm build` passes (14/14 tasks).
- Root `pnpm test` completes 22 of 24 tasks before the existing REEBS Portal TCP test fails; the REEBS suite reports 493/494 passing and `versioned auth preflight reaches the compatibility handler` fails because its test server does not expose a TCP address. The failure reproduces when that unchanged workspace is run alone with loopback access and is outside this change set.
- Registry integrity, workspace-manifest validation and `git diff --check` pass.
## 2026-10-22 — Staff login assistance

- Added opt-in Remember me with the existing one-hour server expiry, persisted through the one-use OIDC flow (migration 005).
- Added password recovery and account-creation panels with optional validated provider links and explicit unconfigured guidance.
- Preserved provisioned-staff-only access: provider account creation does not grant a role. No local password authentication or public staff registration was introduced.
- Added tests for invalid/duplicate preferences, session versus persistent cookie attributes, and invalid provider links. Live provider configuration and end-to-end recovery/enrollment remain blocked on provider selection.

## 27 October 2026 — roadmap-aligned visual refinement

Implemented the TWE-only toast variant, explicit Iconsax content-link arrows,
roadmap-ordered home/demo, native restrained reveals, travel-photo closing CTA,
and shared homepage/footer footprint view. See
[implementation and verification notes](./visual-refinement-2026-10-27.md).
No Sileo or animation runtime was installed. Public activity remains empty until
verified data exists; synthetic totals are local-demo-only. This does not complete
the footprint editor/backend, content approvals, draft synchronisation or rollout.

### Portal detail and remaining screen styling — 2026-10-27

- Added a responsive individual enquiry view with trip details, private contact
  summary and explicit status controls.
- Aligned content editing, publication/history, media, technical diagnostics and
  application sign-in states with the existing dashboard/staff design.
- Reused Faako fields and Iconsax action buttons; kept permission boundaries and
  unavailable operations explicit. No backend features or deployment implied.
- Portal lint/typecheck/build passed. See visual-refinement-2026-10-27.md for
  scope, bundle impact and browser verification.
### 2026-10-28 — Accessible visual release preparation

Consolidated TWE-only visual/demo work on current develop, preserving newer
production content and database safeguards. Added native FAQ disclosures and
production-content regression checks. Local checks passed; CI and hosted
acceptance are separate gates. Production API TLS hostname validation currently
fails. See accessible-release-2026-10-28.md. No production-completion claim.
