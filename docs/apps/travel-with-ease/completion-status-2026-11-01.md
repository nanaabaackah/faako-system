# TWE implementation status and production-readiness gates

**2026-11-03 update:** the following original audit remains historical evidence.
Autosave, protected actual-Astro previews, viewport modes, independent collection
publication, Pages worker/artifact recovery and the approved Superadmin matrix
now have local implementations and focused tests. See the superseding
[CMS runtime status and acceptance gates](./cms-runtime-2026-11-03.md).
They are not yet deployed/accepted. The enquiry/hosted-demo/provider/launch gaps
are not closed by this CMS update. Older manual-save/text-preview and restricted
Platform Admin descriptions below describe the November 1 inspection only.

Reviewed 2026-11-01 (Africa/Accra). This is the current status index, not a
completion certificate. It supersedes undated/current-status claims in older
foundation documents; those records remain historical evidence.

## Baseline and scope

- Latest fetched develop baseline for this branch:
  `65bc1634fb913fbf1ba02d06a374792dd0653470` (includes unrelated, already merged
  TTNGH work; no TTNGH implementation changes are made here).
- Latest TWE integration: PR #125, merge
  `7cb2716b77f29f88dd4a3a2065dbfa5d5e383eed`; fix `ccb14a378`.
- [TWE foundation on that merge](https://github.com/nanaabaackah/faako-system/actions/runs/41240065316)
  and [affected-surface CI](https://github.com/nanaabaackah/faako-system/actions/runs/41240065279)
  passed. This is automated synthetic/isolated test evidence, not hosted UAT.
- The 2026-11-01 feature-completion brief is incremental. Preserve the approved
  homepage, map, typography, imagery, five-mockup CTA and footer transition.
- The initial audit was read-only; implementation slices below add public
  collections/content and native first-contact intake. Tests use isolated
  databases and mocked providers. No hosted deployment, shared database mutation,
  real enquiry/email, push or merge is claimed. Unrelated edits are preserved.

## Status vocabulary

**Implemented** means inspected runtime code exists. **Tested** identifies the
actual automated/manual evidence and revision. **Deployed** requires provider
deployment/artifact evidence, not a branch name or HTTP 200. **Accepted** requires
the relevant authorised user/content/operational verification. None implies the
others. A public placeholder is not a completed business workflow.

## Feature inventory

| Capability | Current implementation | Remaining completion/acceptance |
| --- | --- | --- |
| Approved homepage | Existing hero → supplied About → Services → How it works → 21-country footprint → three source-derived Tips → existing mockup CTA and shared enquiry/footer | No full package/Journal listings on home; no fabricated experiences. New hosted deployment remains unverified |
| Packages | Strict CMS collection, dedicated listing/details, destination/occasion/group filters, itinerary/galleries and structured GHS minor-unit tiers. Four November 1 PDF packages in approved snapshot | Native server-validated package/tier enquiry context, independent record publication and actual hosted verification |
| Journal | Dedicated illustrated listing and stable articles; category/author/hero/gallery/relations and filters. Two articles reuse actual supplied founder and Zanzibar copy | Structured rich article blocks, pagination and independent publication |
| Travel Tips | CMS fields and public rendering; three Tips reuse approved booking/price/room-sharing text | Independent record publication |
| General/package intake | Short native first-contact form on every public page, required classification, bounded schemas, exact-Origin/rate/honeypot checks, retry fingerprint, atomic enquiry/outbox. Client/server Turnstile integration | Configure real per-environment widget keys; complete Google Form branches, authoritative package/tier context, inbox classification filters and real receipt acceptance |
| Notifications | Transactional outbox, bounded attempts, pinned message payloads, Resend adapter; sender configuration exists | Hosted scheduling/worker activation and actual receipt evidence, dead-letter/recovery acceptance |
| Email templates | Versioned enquiry acknowledgement and staff-invitation template options, preview and activation | Invitation template availability is not proof of automatic invitation-email delivery; verify actual delivery separately |
| CMS editing | Fixed page fields, entries, Journal collection, footprint totals, image selection, explicit Save Draft | Structured package/tip/article editors and section/CTA/SEO fields required by new brief |
| Preview | Protected saved-content JSON endpoint and React text-oriented preview | Actual Astro rendering, protected draft artifact, viewport modes and preview expiration |
| Autosave | Not implemented; manual Save Draft, dirty-navigation warning and beforeunload protection exist | Debounce, saved/error states, stale-response handling, bounded explicit retry and concurrent-edit conflict tests |
| Revisions | Immutable PostgreSQL content revisions, optimistic version checks and restore-as-new-draft | User-facing diff/complete restoration acceptance; restoration is not publication |
| Publishing | Immutable tenant/environment manifest, selected-page draft plus other published pages, reviewed source SHA, claim/fail/retry/build/marker-confirm | Secure automatic hosted worker/deployment adapter; deploying/verifying states, exact artifact deployment and verified rollback; no client-operated CLI requirement |
| Media | Private R2, image validation/derivatives, rights/alt metadata, archive, approved Drive browsing/import | Verify credentials/sharing/provider permissions and immutable-media rollback on hosted staging |
| Map | Supplied 21 countries and qualified visits, four Natural Earth tiny-country points, hover/keyboard/tap/list fallback and neutral labels: Trips planned, Countries explored, Travellers. Source metadata remains distinct internally | No summed invented unique-country total or exact trip counts. Footer map remains removed |
| Public information pages | Supplied About/services, practical FAQs, contact, How it works, approved booking terms and factual privacy/cookie notices | Operational retention/processor/rights-request acceptance; no testimonials invented or GTA licensing asserted |
| Privacy/analytics | Modal preferences, consent-aware GA4, production stream isolation, privacy-publication gate, no analytics on staff/demo | Browser/provider receipt evidence and approved policy/processor/retention records; no legal-compliance certification inferred |
| Onboarding/staff | Identity-bound activation/invitations, per-user PostgreSQL tutorial progress, shared GuidedTour, role-filtered targets, restart/resume/preferences | Hosted first/returning-user and invitation delivery acceptance |
| Portal design | Dashboard, enquiries/details, Content, Media, Staff, Account, Templates, System Administration; centred larger mobile Overview | Permission-specific real-account walkthroughs and representative reversible draft operations |
| Discovery | Astro searchable HTML, canonical/OG/robots/sitemap integration and noindex environment gates | Test full new package/tip/article route set after implementation; provider Search Console verification is not proven by code |
| Operational recovery | Migration/grant/preflight and pinned publication tools | Recorded backup restore, alerts/owners, RPO/RTO, last-known-good artifacts, provider deployment SHA and staged recovery drill |

Package/Tips rendering and validation are implemented, not the entire launch
workflow. Visual preview, autosave and automatic publishing remain incomplete.
The November 1 PDF and explicit user approvals supersede older instructions to
hide the legal trading name/registration/TIDS footer. See the
[approved source and decision log](./approved-launch-content-2026-11-01.md).

## Roles and permission change required

The new brief requests exactly three display roles: **Superadmin, Owner, Editor**.
The internal identifier `platform_admin` must remain stable. Current code is an
explicit matrix, not a role hierarchy:

| Current identifier | Enforced now | Requested change still pending |
| --- | --- | --- |
| `platform_admin` | System/security reads, staff staging/revocation, session recovery, support request; private enquiry read only with independently approved 30-minute support grant | Display Superadmin; grant application content/media/enquiry/publishing/staff operations with no Owner approval, preserving environment/tenant/MFA/audit protections |
| `owner` | Content/media, publishing, enquiries, ordinary staff/support approvals, email templates | Preserve business control; cannot create platform privilege or access infrastructure secrets |
| `editor` | Content/media draft access and authorised enquiry read/write | Retain authorised enquiry access as required by the final launch brief; verify each tenant-scoped action |

Changing the matrix alone is insufficient: audit administration routes, invitation
constraints, frontend module visibility, tutorial eligibility, support workflow,
tests and recovery together. Do not expose real infrastructure credentials through
CMS. Provider account ownership and cross-client authority remain independent of
an application's Superadmin role. No auth provider/session replacement is planned.

## Architecture and commands

- `apps/travel-with-ease-web`: Astro/static, focused React islands; owns public SEO.
- `apps/travel-with-ease-portal`: React/Vite staff UI, shared Faako fields/actions,
  tutorial/feedback/loading components. Frontend permission checks are UX only.
- `apps/travel-with-ease-api`: Express, server sessions, authoritative tenant and
  permission checks, PostgreSQL via `pg`, reviewed versioned SQL migrations.
- Hosted default: one Railway TWE API process serves its built CMS on the protected
  portal hostname. The browser uses same-origin API paths; a separate portal
  service is optional legacy hosting, not required.
- Cloudflare Pages serves public Astro artifacts; Access verifies staff Google
  identity with the environment-specific issuer/audience and MFA policy.
- Private R2 originals/derivatives, approved Google Drive media imports, Resend
  outbox delivery and consent-controlled GA4 are separate integration boundaries.
- Reuse shared API contracts/client, security/logger/audit, validation/discovery
  and UI/theme packages. Do not duplicate shared analytics or introduce Next.js.

Repository-root commands:

```bash
pnpm install --frozen-lockfile
pnpm run dev:twe
pnpm --filter '@faako/travel-with-ease-*' run lint
pnpm --filter '@faako/travel-with-ease-*' run typecheck
pnpm --filter '@faako/travel-with-ease-*' run build
pnpm --filter '@faako/travel-with-ease-*' run test
pnpm --filter @faako/ui test
pnpm --filter @faako/travel-with-ease-api run test:db:isolated
pnpm run workspace:manifests
pnpm run monitoring:check
pnpm run project-registry:check
pnpm run security:all
```

`dev:twe` starts website 4328, portal 5188, API 3090. Restart once after this
change to load the new API route; API source watching is now enabled.
Website and portal demos
use `/demo` locally. The preview API launcher isolates hosted credentials and
does not enable staff login or real mail. Staging is not a development auth mode.

Focused browser scripts used by TWE CI:

```bash
node apps/travel-with-ease-portal/scripts/check-onboarding-browser.mjs
node apps/travel-with-ease-portal/scripts/check-content-demo-browser.mjs
node apps/travel-with-ease-web/scripts/check-public-followup.mjs
node apps/travel-with-ease-web/scripts/check-redesign-browser.mjs
```

The portal scripts expect their local Vite server at 127.0.0.1:5197; CI starts it
first. Website scripts start/stop owned local servers. Reuse installed Playwright
Chromium or explicitly set the documented local Chrome executable. These scripts
mock providers; they do not prove real Google MFA or Resend delivery.
`test:db` in CI uses a disposable loopback database, never application credentials.

Hosted build/pre-deployment commands (configured provider environment only):

```bash
pnpm --filter @faako/travel-with-ease-api run railway:build
pnpm --filter @faako/travel-with-ease-api run db:deploy
pnpm --filter @faako/travel-with-ease-api start
```

`db:deploy` requires runtime/migrator URLs with separate roles, matching endpoint,
database, environment identity and explicit environment approval. No database major
version is hardcoded as a runtime gate; PostgreSQL 17 is the isolated CI fixture.
See [database setup](./predeploy-migrations-2026-10-27.md) rather than using
`prisma db push` or resetting a database.

Existing operator publication commands are **not automatic deployment**:

```bash
pnpm --filter @faako/travel-with-ease-api publication build
pnpm --filter @faako/travel-with-ease-api publication confirm <job-uuid> <deployment-id>
pnpm --filter @faako/travel-with-ease-api notifications:once
```

The publication and notification executables currently use `assertLocalFoundation`
and reject staging/production. Do not remove that guard without completing the
reviewed hosted orchestration, security/failure tests and deployment acceptance.
A provider key alone does not activate these workers.
See [publication lock decision](./publication-runtime-lock-2026-10-30.md) and
[email routing](./email-test-flow.md).

## Hosted observations

Non-mutating HTTPS checks on 2026-11-01; no signed-in browser/session/provider
dashboard access was used. TLS validation was not disabled. Requests used a
12-second timeout; a timeout is an observation, not a diagnosed service crash.

| URL | Observed |
| --- | --- |
| https://staging.travelwitheasegh.com/ | HTTP 200 HTML |
| https://staging.travelwitheasegh.com/twe-publication.json | HTTP 404; deployed content/source identity not proven |
| https://portal-staging.travelwitheasegh.com/ | HTTP 302; sign-in redirect, not authenticated acceptance |
| https://staging-api.travelwitheasegh.com/healthz | HTTP 200 JSON |
| https://staging-api.travelwitheasegh.com/readyz | HTTP 200 JSON |
| https://travelwitheasegh.com/ | HTTP 200 HTML |
| https://travelwitheasegh.com/twe-publication.json | HTTP 404; deployed content/source identity not proven |
| https://portal.travelwitheasegh.com/ | HTTP 302; sign-in redirect, not authenticated acceptance |
| https://api.travelwitheasegh.com/healthz | Timed out; production API health unverified |
| https://api.travelwitheasegh.com/readyz | Timed out; production API readiness unverified |

User-confirmed Pages configuration: staging from `develop`, production from
`main`; root command `pnpm --filter @faako/travel-with-ease-web build`;
output `apps/travel-with-ease-web/dist`. Provider configuration was not changed or
independently inspected. Hosted `APP_ENV`/`PUBLIC_APP_ENV` must match staging or
production; demo is an isolated route/feature flag, not an `APP_ENV=demo` value.
Staging demos:
https://staging.travelwitheasegh.com/demo and
https://portal-staging.travelwitheasegh.com/demo (the latter remains Access protected).

## Release gates and recovery

1. Complete each missing vertical slice with source tests and no homepage redesign.
2. Require affected CI, shared UI compatibility and isolated database tests.
3. Review migration diffs/grants; back up and apply migrations before dependent code.
4. Verify provider deployment SHA, exact public artifact/content marker and
   configuration independently for staging and production.
5. Authorised staging staff verify Google/Access/MFA, first/returning-user flows,
   permissions, media, draft save/preview/restore and publication success/failure.
6. Use synthetic staging enquiries only; route every local/staging message to
   testing@travelwitheasegh.com. Production acknowledges the intended customer
   and CCs notifications@travelwitheasegh.com. Do not test real customer email
   addresses from staging or run destructive E2E against production.
7. Record actual email receipt/provider ID safely, worker retries, monitoring,
   backup restore, approved legal content, privacy/retention procedures and UAT.
8. Review the full develop → main diff and obtain a controlled production release
   instruction. Green code checks are necessary, not sufficient, for acceptance.
9. Preserve previous verified source SHA, build inputs, artifact, deployment ID
   and publication manifest before switching live traffic.
10. On failure keep/restore the last verified artifact via provider rollback;
    verify its marker/health before database publication confirmation. Do not
    rebuild an old release from unrelated current code. Database rollback/restore
    requires separate assessment/approval; prefer additive forward fixes.

Routine content publication must eventually follow immutable snapshot → pinned
source build → exact artifact deploy → verification → Live, preserving the last
verified live site on any failure. The current build/confirm tools do not yet
satisfy this end-to-end requirement.

## Completion sequence and external blockers

The [implementation plan](./implementation-plan.md#feature-completion-sequence--2026-11-01)
tracks the new brief. Outstanding external evidence includes provider configuration
and deployed SHAs, production API diagnosis, authorised staff UAT, approved
packages/articles/tips/policies, sender receipt, backup/restore and named release
approval. Request configuration identifiers and redacted diagnostics only, never
credentials/session cookies/private customer records.

Post-launch exclusions remain: Travel Readiness PDF, Travel Plans staff module,
client My Trips, customer trip management, online booking/payments, full CRM and
AI itinerary generation. Their historical architecture descriptions are not a
launch requirement.

## Exact source inspection

Documentation verification for this slice:

- `node --test apps/travel-with-ease-web/tests/documentation.test.mjs`: three
  checks passed (workspace inventory, local paths/heading anchors and executable
  PNPM script names). No network or private environment inputs are used.
- New documentation test lint, workspace manifest validation and
  `git diff --check` passed. This does not re-certify feature tests or hosted UAT.
- README links are repository-relative, not tied to the developer's filesystem.

- Root: `README.md`, `package.json`, `pnpm-workspace.yaml`, application/package
  manifests; `.github/workflows/travel-with-ease-foundation.yml`.
- API: `src/config.js`, `src/content/{schema,repository,routes,publication,artifact,publication-command}.js`,
  `src/auth/permissions.js`, `src/auth/administration.js`, `src/auth/routes.js`,
  `src/onboarding/invitations.js`, `src/portal/{inline,readiness}.js`,
  `src/db/{database,deploy-config}.js`,
  `src/enquiries/routes.js`, `src/notifications/{worker,resend}.js`,
  `scripts/dev.mjs`, `test/content.test.js`,
  `db/migrations/001_foundation.sql`, `db/migrations/010_email_templates.sql`,
  `db/migrations/011_email_template_options.sql`.
- Portal: `src/{WebsiteContent,AccountSettings,App,StaffAccess,SystemAdministration}.jsx`,
  `src/demo.js`, `src/AccountSettings.jsx`, `package.json`.
- Web: `astro.config.mjs`, `src/lib/published.js`,
  `src/pages/{destinations,[contentPage]}.astro`, `src/pages/journal/[slug].astro`,
  `src/components/{PublishedHome,PublishedContent}.astro`, `package.json`.
- Documentation: this index and linked README, architecture, environment,
  implementation plan, publication/runtime-lock, local demo, email, media,
  migration and historical roadmap references. Older dated records remain
  evidence of their original scope, not automatic current-state claims.
