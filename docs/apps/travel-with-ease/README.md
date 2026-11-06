# Travel With Ease documentation

Latest CMS extension: [roles, imagery, activity and responsive navigation](./cms-access-imagery-activity-2026-11-04.md).
Migration 013, real handover and authenticated staging acceptance are explicit
rollout steps, not implied by local tests.

## Current status — 2026-11-01

Start with the [implementation status and hosted evidence](./completion-status-2026-11-01.md),
[release readiness gates](./readiness-check.md) and
[incremental completion sequence](./implementation-plan.md#feature-completion-sequence--2026-11-01).
The [root monorepo README](../../../README.md#travel-with-ease) now describes the
actual workspace inventory, TWE architecture, commands, environments and gaps.

The broader completion brief is not finished. Packages/detail pages, Travel Tips,
advanced Journal, autosave, actual Astro draft previews and automatic deployment
remain implementation work. Current manual CMS/revisions/media/onboarding and
publication preparation are not evidence of those missing features. The new
Superadmin policy also differs from the current restricted platform_admin matrix.

Staging website/API health was observed over HTTPS; portal roots redirect to
sign-in. Production API health timed out and deployed website SHAs could not be
verified from publication markers. See the dated evidence rather than inferring
authenticated acceptance, email receipt or production readiness.

The links below retain the historical decisions and operating detail; date-specific
claims are superseded by this status review where they conflict.

Media configuration and image changes: [Drive → private R2 → publication](./drive-r2-sync.md).

Latest visual work: [Flyward reference correction — 2026-10-30](./reference-correction-2026-10-30.md).
Earlier implementation/release gates: [editorial redesign](./editorial-redesign-2026-10-30.md).

Current cleanup: [demo retirement and repository hygiene](./repository-cleanup-2026-11-06.md).
Historical content/email decisions: [follow-up record](./content-and-email-followup.md).
Company source: [public facts and outstanding approvals](./company-content-source.md).
Email configuration: [final test/production routing](./email-test-flow.md).

Database deployment: [pre-deploy migrations and first-time setup](./predeploy-migrations-2026-10-27.md).

Initial public release: [approved initial release and PostgreSQL compatibility](./public-release-2026-10-26.md).

Current release source of truth: [readiness check — reviewed 2026-11-01](./readiness-check.md).
Historical startup decision: [hosted API startup — 2026-10-25](./hosted-startup-2026-10-25.md).

Staff login deployment: [portal hosting preparation](./portal-hosting-preparation-2026-10-23.md).

## Start here

1. [Product baseline](./Travel_With_Ease_Solution_Roadmap.md) — October scope; Prompt 02 confirms MVP requirements, while client legal/commercial approvals remain separate.
2. [Design and engineering standard](./design-engineering-standard.md) — governing public, portal, backend, environment and delivery rules.
3. [Repository audit — 2026-10-11](./repository-audit-2026-10-11.md) — current/target architecture, code-backed gap matrix, fresh screenshots, API/data model, security register, infrastructure status and approval decisions.
4. [Implementation plan](./implementation-plan.md) — verified Trello task mappings, detailed Prompt 03/04 slices, acceptance/tests, effort and critical path. Planning does not authorize implementation or production release.

## Supporting references

- [Cloudflare Access and Platform Admin](./access-platform-admin-2026-10-23.md) — authentication ADR, role matrix, bootstrap, MFA checklist and release blockers.
- [Media, branding and discovery follow-up](./media-sharing-followup-2026-10-23.md) — approved photo inventory, local QA and outstanding live-service checks.
- [Staging operations and ownership](./staging-operations.md) — responsibilities, current Access/Express portal staging setup, publishing, mail and recovery gates; hosted acceptance is not claimed.

- [Prompt 03 implementation record](./foundation-implementation.md) — current changes, migration commands, dependency decision and outstanding gates; not a completion report.
- [Architecture](./architecture.md) — preserved historical foundation and current-scope precedence.
- [Environment contract](./env.md) — local/staging/production isolation and current deployed-mode gaps.
- [Security architecture](./security.md) — classifications and target controls; see the newer audit for implemented versus missing controls.
- [Implementation notes](./implementation-notes.md) — existing scaffold behaviour.
- [Historical roadmap and decisions](./roadmap.md) — earlier phases are not current launch requirements; its decision IDs are not Trello card IDs.
- [Visual audit — 2026-10-10](./audits/2026-10-10/visual-audit.md) — original screenshot-supported design audit, preserved as dated evidence.
- [Progress/change log](./progress-log.md) — dated work and actual verification results.

Current verified status: both hosted API environments support validated startup;
publication/notification worker executables remain separately gated. Staging
health and public HTTPS are observed, not full authenticated acceptance or
production certification. Do not confuse readiness preflight, DNS/Access redirects
or synthetic tests with observed MFA/UAT/email/backup verification. Use
[the readiness check](./readiness-check.md) for active gates.

The public website uses the shared consent-controlled GA4 integration. Production
defaults to the user-approved stream `G-GVJ2HGT6YN`; `PUBLIC_GA_MEASUREMENT_ID` is
an optional public build override. Set `PUBLIC_APP_ENV=production` on the production
public website. The production stream is blocked in local/staging builds even if
copied into their environment; a separate test stream can be configured explicitly.
Do not add a second inline Google tag. The existing loader initializes once after
analytics consent, respects Do Not Track and sends sanitized page views. A published
privacy notice remains required; the bundled release currently has no published
privacy page, so live analytics stays off until the Owner publishes that notice.
Rebuild/deploy after configuration/publication, then follow
`docs/architecture/google-analytics-architecture.md`'s hosted verification checklist.
Local browser checks intercept Google requests; production receipt in GA4 is not
verified by those checks. Staff portals do not load analytics. Synthetic demo routes have been retired.
