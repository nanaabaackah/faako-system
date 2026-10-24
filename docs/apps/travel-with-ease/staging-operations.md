# Prompt 03 staging setup and operating gate

2026-10-24 update: [staging activation](./staging-activation-2026-10-24.md) now permits
the staging API after mandatory runtime preflight. Earlier blanket blocking claims
below remain applicable to production and background workers, not this staging path.

Current Access portal configuration: [hosting preparation](./portal-hosting-preparation-2026-10-23.md).
This supersedes the static-only portal instructions below. API activation is still gated.

Updated 2026-10-21. **Preparation only: no verified deployment URLs and no
authority to commit, push, deploy or create paid resources.** Baaba is the named
developer and technical contact. The API, notification worker and publication
CLI still reject staging/production startup; do not remove that guard merely
to make deployment succeed. Resolve the acceptance gates below first.

## Ownership

| Responsibility | Owner / operator |
| --- | --- |
| GitHub repository, CI, Railway, PostgreSQL, Resend and developer-operated technical services | Faako; Baaba configures and operates them |
| Namecheap domain and Cloudflare account/zone, including R2 resources in that account | Travel With Ease; Baaba configures via delegated access |
| Approved copy, imagery/rights, staff roster, sender/recipient business choices | Travel With Ease |
| Staging walkthrough and UAT approval | Travel With Ease |
| Technical acceptance, monitoring and recovery coordination | Baaba / Faako |

No shared passwords in GitHub, Trello, screenshots or chat. Delegate scoped
access; store service secrets in the relevant provider secret manager. Resource
separation is mandatory, not just different subdomains.

## Manual setup checklist (Baaba)

1. In Faako GitHub, review explicit TWE files and move them to an agreed TWE
   branch based on develop **only with approval**. Current work was resumed on
   `feat/ttngh-motion-polish`; do not release that mixed worktree. Require passing
   TWE CI and independent review. Create protected `twe-staging` and
   `twe-production` environments with named approvers and separate secrets.
2. In Faako Railway, create a TWE project with distinct staging and production
   environments. Use independent PostgreSQL 17 services/volumes, runtime and
   migration credentials. Never point staging to a production service reference.
   Record project/environment/service IDs privately in the deployment inventory.
   Do not create production resources under this task without separate approval.
3. For the approved empty staging DB, configure `TWE_MIGRATION_DATABASE_URL`,
   `TWE_ORGANISATION_ID`, `APP_ENV=staging`, `TWE_DATABASE_TLS=require` and the
   trusted CA when necessary. Review all numbered SQL files and run
   `pnpm --filter @faako/travel-with-ease-api db:migrate --plan`, then explicitly
   approved `db:migrate --initialise`. The historical `db/001_phase1.sql` is not
   part of this runner. Provision the organisation and approved issuer/subject
   staff identities separately; there is no default administrator.
4. Keep the migration role separate. The runtime role needs schema USAGE;
   SELECT on environment identity, organisations and migration history; scoped
   SELECT/INSERT/UPDATE for operational tables; SELECT/INSERT only on content
   revisions, content-media references and audit records; DELETE only on expired
   auth-flow rows. It must not own tables or have CREATE/TRUNCATE/schema-changing
   privileges. Review grants against every repository query before enabling it.
   Test with the actual runtime role; current local drills use a disposable owner
   and do not prove production least privilege. A separate provisioning role
   manages staff membership. Do not grant runtime DDL to resolve a permission error.
5. In TWE Cloudflare via delegated access, create separate stage draft-media and
   backup R2 buckets, names beginning `twe-staging-`, with public access disabled.
   Scope separate credentials to media versus backup duties. Production uses
   separate `twe-production-` buckets and keys. Set the four `TWE_R2_*` names in
   API/worker secrets, never frontend variables. Verify unauthenticated reads fail.
6. Create separate Cloudflare Pages projects for staging web and portal. Build
   from repository root with the corresponding pnpm workspace filter; outputs
   are `apps/travel-with-ease-web/dist` and `apps/travel-with-ease-portal/dist` for
   ordinary builds. Publication artifacts use the path printed by the build CLI.
   Disable provider auto-deployment until the protected release path is agreed.
   Do not independently rebuild a pinned publication from latest drafts.
7. Agree exact custom origins for web, portal and API. Use HTTPS and a same-site
   portal/API domain topology compatible with host-only SameSite=Lax cookies;
   unrelated pages.dev/railway.app domains are not an accepted login topology.
   Configure DNS in TWE Cloudflare using provider-issued target values, not
   guessed CNAMEs. Namecheap remains TWE-owned. Record DNS/TLS verification.
8. Configure Cloudflare Access for **all** staging web/portal aliases, including
   default provider domains and preview URLs. Protect draft previews before
   uploading any draft artifact. Noindex is not authentication. Verify signed-out
   requests are denied and invited UAT users can enter. Keep OIDC callback access
   and API routing compatible with the approved topology; test actual cookies.
9. Build web with `PUBLIC_APP_ENV=staging`, `PUBLIC_SITE_INDEXABLE=false`, exact
   `PUBLIC_SITE_URL` and `PUBLIC_API_BASE_URL`; build portal with its exact
   `VITE_API_BASE_URL`. No analytics ID in staging. Inspect HTML, robots, absent
   sitemap, headers and bundles. Rebuild production with its own values; never
   promote a bundle containing staging URLs. Portal/API remain noindex always.
10. Configure the OIDC application using `staff-authentication.md`. Configure the
    API with `NODE_ENV=production`, `APP_ENV=staging`, exact `ALLOWED_ORIGINS`,
    runtime `DATABASE_URL`, organisation UUID and all `TWE_OIDC_*`/origin names.
    Validate Railway's proxy/header behaviour and edge rate limits; do not set
    trust proxy blindly. Resolve the hosted startup gate through reviewed code
    and tests, not a development-mode override.
11. In Faako Resend, create a narrowly scoped stage sending credential. Baaba
    installs Resend's actual sender-verification DNS records in TWE Cloudflare
    after sender-domain approval. Configure `TWE_EMAIL_FROM`,
    `TWE_EMAIL_RECIPIENT`, `TWE_EMAIL_TEST_RECIPIENTS`, `TWE_RESEND_API_KEY` and
    HTTPS `TWE_PORTAL_ORIGIN`. Non-production recipients must match the exact
    allowlist. Test only an approved mailbox; no live message was sent here.
12. Only after reviewed hosted guards and deployment approval, run API using
    `pnpm --filter @faako/travel-with-ease-api start`, health path `/healthz`.
    `/readyz` verifies DB identity/organisation, not every external integration.
    Schedule `notifications:once` once per minute with non-overlapping execution;
    leases also fence overlapping workers. Schedule publication build processing
    only after the approval/deployment/confirmation sequence below is operational.

## Publication and failure handling

Set API `TWE_RELEASE_SHA` to the full reviewed Git SHA. Staff publish/unpublish
requests create immutable snapshots of selected revisions. At most one active
job per organisation/environment is allowed. Draft save/revert never changes live
content. Requesting a retry preserves the snapshot; it does not pick newer drafts.

In a clean checkout of the pinned SHA, with server-only DB/R2 configuration:

```sh
pnpm --filter @faako/travel-with-ease-api publication build
```

This claims a job and creates a private temporary Astro artifact. It **does not
deploy**. The child build receives only explicit public/build settings, not DB,
OIDC or R2 credentials. The artifact includes selected public content/images and
`twe-publication.json`, not a database snapshot or rights evidence. The current
renderer is a minimal semantic content template, not the Prompt 04 redesign.
It currently uses the 640px re-encoded derivative; broader responsive image
selection remains a public-layout/performance acceptance item.

After a separately approved deployment of that exact artifact, verify the
provider deployment ID and configured `TWE_PUBLIC_SITE_ORIGIN`, then run:

```sh
pnpm --filter @faako/travel-with-ease-api publication confirm <job-uuid> <deployment-id>
```

Confirmation checks the exact HTTPS origin without redirects and matches the
job/source/digest marker before atomically advancing published pointers and audit.
The provider ID is operator-supplied: provider API verification, Cloudflare Access
service-token integration and automated deploy/confirm orchestration are still
acceptance blockers. There is no public confirmation endpoint or deploy hook.

Failed builds retain old published pointers and can be retried at most three
times through the portal. A process crash can leave a job building: Baaba must
reconcile the actual deployed marker/provider state before repairing that job;
do not blindly retry a possibly deployed artifact. Automatic crash reconciliation
and protected layout-faithful draft preview remain unfinished. The portal's draft
preview is private content-only, not a rendered hosted Astro preview.

Unpublishing preserves the URL with a noindex unavailable page after deployment.
Rollback creates a new draft from history, then a new publication. Never mutate
historical revisions or delete referenced media. Code rollback uses the previously
verified artifact; do not assume reversing SQL is safe. Schema forward-fix or DB
restore needs a separately reviewed recovery decision.

## Notifications and operations

`notifications:once` claims one PostgreSQL job, sends a minimal staff notice and
records the provider reference. It does not send customer data, enquiry notes or
attachments. Retry payloads are pinned; configuration changes cannot silently
redirect them. Five attempts maximum with exponential backoff. Jobs beyond 23
hours since first attempt fail for operator reconciliation instead of automatic
resend beyond Resend's 24-hour idempotency retention. A provider timeout may mean
delivery succeeded; check provider evidence before any manual resend.

Sources: [Resend send API](https://resend.com/docs/api-reference/emails/send-email)
and [idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys).
Native server fetch avoids another SDK; shared `notifications` offers draft/link
helpers, not delivery. Existing pg transactions/logger are reused. This adds no
browser dependency and no automatic customer communication.

Configure Faako monitoring only with verified URLs: API liveness/readiness,
oldest pending/processing notification, failed notifications/publications, stuck
building jobs, backup age and restore-drill age. Baaba receives and acknowledges
an alert drill. No monitor or alert delivery is claimed configured.

## Backup and restore acceptance

1. Faako enables provider-supported backups for the isolated Railway environment
   and records retention/restore permissions. Confirm coverage rather than assuming
   an attached volume is backed up. TWE approves retention and privacy requirements.
2. Schedule a PostgreSQL 17 custom-format logical export using a read-only backup
   role and private temporary files. Encrypt with an approved maintained backup
   tool before upload to the dedicated private R2 backup bucket. Choose/configure
   that tool and key recovery under separate review; no custom encryption scheme
   is introduced here. Keep encryption keys separate from backup objects.
3. Verify export/encryption/upload exit status, object size and checksum. Alert on
   failure or excessive age; never record a successful backup from a started job.
   Record schema/source versions, timestamp and object identity without secrets.
4. Restore into a **new isolated** PostgreSQL 17 target, never production or an
   existing shared DB. Check every table, constraints, migrations, audit history,
   media references and application access using synthetic data. Restore media
   objects too before claiming full recovery. Record elapsed time and measured RPO/RTO.
5. Do not delete old artifacts/exports until retention is approved. A production
   restore requires an explicit data-loss/target approval and rollback plan.

The local `test:db:isolated` runner exercises a plain synthetic dump/restore and
restart fingerprint, not encrypted off-site backup scheduling or recovery of R2
objects. Those remain external/implementation acceptance requirements.

## Exit evidence required

No staging URL has been verified. Record actual web, portal, API and provider
deployment references only after authorised deployment. Required evidence:
runtime-role DB tests, live MFA/login/recovery, private R2 permissions, approved
test-mail receipt, protected draft preview, successful/failed publication and
reconciliation, protected staging aliases/noindex, alerts, encrypted off-site
backup restoration and TWE UAT approval. Until then Prompt 03 is **not complete**
and Prompt 04 must not start automatically.

## Authentication update — 2026-10-23

Use the [Cloudflare Access runbook](./access-platform-admin-2026-10-23.md) for
current onboarding/offboarding, MFA recovery and origin-security requirements.
The supplied Access AUD is production-only. Do not reuse it in staging or bypass
the hosted-startup guard. Earlier OIDC-provider instructions above are superseded.
