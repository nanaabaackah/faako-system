# TWE release hardening — P0-01 database predeployment

Audit baseline: 2026-11-24. Staging release candidate `613e0bf65f3c2c6b3aeefb5ee47e789ad108ceb7`. Work remains on the readiness branch; no live changes or release approval.

## Observed evidence

- Railway production deployment `d2482a3a-cc3e-46c3-ad4e-0a5c1fa2ba8d` built its image but failed `db:deploy` during phase `migrations`, reporting `database_unavailable`. The hook advances to this phase only after SELECT 1 and migration-login validation, so an initial TLS/network/login failure is not established by this record.
- The production and staging API services have the same predeploy and start commands. Both define DATABASE_URL, TWE_MIGRATION_DATABASE_URL, TWE_DATABASE_CA, TWE_DATABASE_TLS and migration approval/identity settings. Values were not read; presence is not correctness.
- Production build override is install-only (`pnpm --filter @faako/travel-with-ease-api... install --frozen-lockfile`), whereas staging uses `pnpm --filter @faako/travel-with-ease-api railway:build`. The latter embeds the CMS. Correct the production build override during the approved infrastructure release; do not create duplicate provider settings.
- Production has API and PostgreSQL services; staging also has notification and publication workers. Production API variable names do not include TWE_PAGES_ACCOUNT_ID, TWE_PAGES_API_TOKEN, TWE_PAGES_BRANCH, TWE_PAGES_PROJECT or TWE_TURNSTILE_SECRET_KEY; verify the effective environment and worker requirements before provisioning anything. No secrets or values are included here.

## Branch work

The predeploy classifier now recognizes the exact existing runtime-role guard messages, plus PostgreSQL cancellation/lock/deadlock SQLSTATEs, using fixed guidance only. Regression cases cover these classifications. This is diagnostic hardening, not proof of the original root cause or a change to the migration policy.

## Controlled release checklist (not executed)

1. Confirm backup/restore evidence and intended environment/database identity.
2. Check existing private reference endpoints and effective runtime/migrator roles in the Railway environment; preserve distinct least-privilege credentials. Check runtime role attributes, membership, ownership and CREATE privilege before adjusting anything. Do not use an admin or migration role as the runtime role.
3. Inspect migration ledger checksums, migration order and any lock contention. Do not edit applied migrations or reset the database.
4. Keep verified TLS enabled; reuse the existing trusted CA or Node trust where valid. Do not create or duplicate Railway-provided URL variables merely to change their names.
5. Align the production build command to the existing staging railway:build command. Retain db:deploy and the start command.
6. After explicit release authorization, rerun a controlled predeploy and verify runtime readiness and the embedded CMS. Record the exact safe diagnostic if it fails; no automatic reset or blind retries.

## Gate

P0-01 is open until a production predeploy and runtime readiness check succeed. Branch CI and isolated database tests do not close the live gate. P0-02 through P0-05 remain open. Trello: https://trello.com/c/Hri5RyJ4 and https://trello.com/c/uMtsq7vq.

## P0-02 — Worker parity and public build prerequisites

Staging uses two independent processes with one replica each:
- Notification worker: `pnpm --filter @faako/travel-with-ease-api notifications:worker`.
- Publication worker: `pnpm --filter @faako/travel-with-ease-api publication:worker`.

Production currently lacks both worker services. Keep the tested separation initially: publication builds are CPU-intensive and must not delay enquiry acknowledgement or staff API traffic. Do not introduce a new queue, database, duplicate storage or extra replica just for this release. Reuse the existing environment's runtime DB references and provider-managed Git SHA. Review actual resource usage before any consolidation.

The staging publication worker's listed variables omit TWE_PUBLIC_TURNSTILE_SITE_KEY. The production API's listed variables omit TWE_TURNSTILE_SECRET_KEY. These are distinct public/secret values, not interchangeable. Confirm the effective environment, configure the existing environment-specific references where missing and verify both the widget and API verification. Publication worker now validates TWE_PUBLIC_API_ORIGIN (exact HTTPS origin) and a real public site key before claiming jobs, so a missing key cannot silently publish a disabled form. Verify TWE_PUBLIC_GOOGLE_SITE_VERIFICATION where production indexing requires it. Never copy API secrets into the public build.

Production worker checklist: use the appropriate existing environment database reference, organisation ID, TLS trust, enablement flags and production-only provider settings. Publication requires the correct Pages project, main branch, R2 bucket, public API origin, site key and Git-linked source identity; notification requires Resend, continuation secret, public origin and verified sender. No provider settings were changed.

## P0-03 — Approved content promotion

The existing export/import commands are reused rather than duplicated. Export uses the latest verified staging publication manifest and its pinned baseline when available, not a later checkout baseline. Legacy manifests without a baseline retain the prior fallback; verify provenance before using those bundles. The importer recognizes platform_admin (the displayed Superadmin role). New exports include both active email template copies, excluding drafts, delivery payloads and recipient configuration. Media derivatives and website sections continue to be validated against their hashes and references.

Run offline validation on the private reviewed export:
```
pnpm --filter @faako/travel-with-ease-api promotion:import <private-bundle.json> --dry-run
```
Use the actual package script name from package.json if it differs. This mode checks integrity, counts and fingerprint without connecting to PostgreSQL or R2; it does not verify target state. Do not commit bundles or put them into public storage. The import continues to require explicit initial-production confirmation and refuses to overwrite initialized content or existing email template rows. Repeated import currently rejects rather than duplicates; a verified no-op replay, live target preflight, asset completeness and full production rollback/reconciliation remain acceptance work.

P0-02 and P0-03 branch changes are subject to CI. Live production workers, production database and Cloudflare/Turnstile acceptance remain open; no production or staging changes were executed.

## Follow-up — read-only migration preflight and verified replay

The existing deployment hook now checks migration identity, schema inventory and role privileges in a repeatable-read, read-only transaction before any migration writes, and checks both runtime and migration database connections. For a controlled diagnostic from the correctly configured Railway environment using the reviewed release checkout:

```bash
pnpm --filter @faako/travel-with-ease-api db:deploy --check-only
```

This does not create schemas, execute migration files, grant privileges or reset anything. It does not establish full runtime readiness; the actual deployment still performs migrations and the existing post-migration checks. A preflight failure is reported with a fixed diagnostic code. The production root cause has not been independently reproduced.

The importer now returns `already_imported` only if the source publication's recorded receipt exists and the current published and draft content, active and draft templates, and referenced media metadata and byte hashes match the bundle. Otherwise it refuses to overwrite initialized production content. This is a no-write replay check, not a forced synchronization. Target dry-run, rollback and live verification remain open.

Production configuration observed at 16:20 GMT: API build override corrected; preview, public origin and Turnstile secret names present; both workers staged with the required configuration names, including all three Pages credentials. No workers deployed. Earlier PR head c97bc782a8aca27c97cf38521b0866762d2f00be passed all three workflows; follow-up changes require new CI evidence.

## P0-04 — Publication source and first production deployment

- The production promotion command requires Railway's reviewed Git-linked source SHA and a matching staging baseline fingerprint. Import and the initial pending publication job are committed atomically; a repeat verified import creates no extra job. Public deployment is not confirmed by the seed operation: verify the publication history and public marker.
- Hosted workers compare their source and environment with the active API's read-only /api/public/release endpoint before coordinating or claiming a job, and again before uploading. The claim itself filters by exact source SHA. Mismatched or unavailable API identity leaves the worker waiting; a source change during build fails safely before upload. Ensure API and publication worker redeploy on the same affected TWE/shared paths; do not leave them on different commits. Stop/replace old worker instances before relying on this guard.
- A Cloudflare Git-triggered main/develop full-site build now refuses to publish repository defaults. Holding-page builds remain an explicit exception until release.
- Required Cloudflare setup before merging/releasing: in the existing TWE Pages project, Build > Branch control, turn off automatic production branch deployments and disable automatic preview deployments (or exclude develop if other previews are necessary). Do not disconnect Git, change the project or delete existing deployments. The Railway worker continues to deploy through Wrangler and verifies both immutable deployment and public domain. Retain the existing holding page until authorized production cutover; disable its build flag at cutover so future manual Git builds cannot restore it accidentally.
- Verify initial publish, API/worker rollout overlap, autosave vs publish snapshot, rollback and source coordination in final staging/production acceptance. No Cloudflare settings or live service changes were made by this PR.

References: https://developers.cloudflare.com/pages/configuration/git-integration/ and https://developers.cloudflare.com/pages/configuration/branch-build-controls/.
