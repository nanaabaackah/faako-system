# TWE CMS publishing and production promotion — 20 November 2026

## Implemented operating model

The existing React/Vite portal, Express API, PostgreSQL revision store, Astro
website, Cloudflare Pages/R2 and Cloudflare Access boundaries remain unchanged.
No second editorial approval workflow is introduced.

The portal retains the 1.2-second autosave debounce, immutable revisions,
optimistic version checks, stale-response suppression, lost-acknowledgement
reconciliation, explicit Save draft fallback, unsaved-navigation warning and
Saved/Saving/Unsaved/Error states. Autosave never creates publication jobs.
Travel Tips is now a selectable CMS collection instead of being redirected to
Journal. Testimonials remain the homepage review editor because that is the
source consumed by the public site.

Visual preview continues to build the actual Astro site from the selected
persisted draft plus currently published sections. It is actor/tenant-bound,
expires after ten minutes, strips scripts, forbids form actions and network
connections, sends private/no-store/noindex headers and cannot publish.

Publish inserts one durable PostgreSQL job. A supervised
`publication:worker` polls every 15 seconds and performs the existing pinned
source build, private asset materialisation, Cloudflare upload, immutable and
custom-domain marker checks, database confirmation, audit and rollback. An
uncertain upload/confirmation stops the worker for reconciliation. It never
starts a competing deployment.

## Staging activation checklist

This checklist is operator-executed; the implementation does not change hosted
configuration automatically.

1. Confirm the staging API, portal and website are on the same reviewed
   `develop` commit and migrations are current.
2. Inspect the historical 31 October job and current Pages deployment. Do not
   cancel or replace either until its stored status, marker and archive are
   reconciled.
3. Confirm `twe-concierge`, branch `develop`,
   `https://staging.travelwitheasegh.com`, the staging API origin, non-indexing,
   Turnstile and staging-only R2/DB credentials.
4. Accept the current staging baseline through the existing reviewed baseline
   command only if its deployment and retained artifact match.
5. Start exactly one `publication:worker` process with
   `TWE_PUBLICATION_WORKER_ENABLED=true`; do not enable it on the API process.
6. Save a labelled draft, refresh, preview at desktop/tablet/mobile, publish,
   and confirm the job moves pending → building → deploying → verifying → live.
7. Confirm the public marker, custom domain, content and media; then verify a
   failed test deployment retains or restores the preceding accepted artifact.

## Initial staging-to-production content promotion

Promotion is a one-time technical transfer, not a second content approval. The
export command reads only the latest verified live staging publication and the
approved version-controlled baseline. It excludes other drafts, staff,
sessions, enquiries, notifications and audit history. It embeds every CMS
section, referenced media bytes and SHA-256 hashes in an immutable bundle with
a content fingerprint.

```bash
pnpm --filter @faako/travel-with-ease-api promotion:export -- /secure/path/twe-launch.json
```

The reviewed bundle is transferred through an approved secure channel. The
production import requires an independently configured production database,
R2 bucket, migration connection, organisation identity and an existing active
Owner/Superadmin. It refuses to overwrite any initialised production content,
verifies the bundle and every media object, creates independent production
revisions, and records an audit event. Do not run it during this implementation
task.

```bash
pnpm --filter @faako/travel-with-ease-api promotion:import -- \
  /secure/path/twe-launch.json --confirm-initial-production-content
```

After import, build and verify production from the production content store
using production canonical/API origins, indexability, analytics, Turnstile and
security configuration. Compare the recorded content fingerprint. The source
SHA also pins bundled fonts, logos, favicons and non-CMS assets. Remove the
holding page only in the separately approved launch deployment.

After launch, staging and production diverge normally. Owner and Superadmin may
publish directly from production; Editor may save and preview but cannot
publish. No staging request or approval queue is involved.

## Production API diagnosis

Read-only GitHub deployment evidence identifies the latest failed TWE
production deployment as commit `f1bd33c8b6ce86a1a595a5cb0658b9e10082868f`
on 19 November 2026. The GitHub record exposes only a Railway failure status,
not Railway pre-deploy logs. The Railway CLI is unavailable in this workspace,
so the exact provider-side error remains unverified and must not be represented
as a proven TLS or role failure.

The pre-deploy script now separates configuration, migration connection,
migration role, migrations, runtime connection and runtime readiness phases.
Safe classification distinguishes DNS, connection, authentication, TLS trust,
TLS hostname, permissions, identity, unsafe role and migration inventory
failures without logging raw exceptions or connection details.

Recommended Railway variables:

- `DATABASE_URL`: production runtime-role Railway internal URL.
- `TWE_MIGRATION_DATABASE_URL`: same internal host/port/database, distinct
  migration role.
- `TWE_MIGRATION_APPROVED_ENV=production`.
- `TWE_ORGANISATION_ID`: existing production identity.
- Omit `TWE_DB_INITIALISE` unless an inspected empty database is separately
  approved for first-time initialisation.
- Omit `TWE_DATABASE_TLS`; strict verified TLS is already the default.
- Omit `TWE_DATABASE_CA` when Node trusts Railway's chain. Add one complete
  public CA PEM only if the new `migration_connection` diagnostic and provider
  certificate evidence prove it is required.

Provider verification still required: inspect the failed deployment's redacted
phase/reason, internal DNS reachability, certificate SAN/chain, both role
logins, role/schema grants, environment identity and migration ledger. Do not
retry production, change variables, initialise, migrate or deploy until that
evidence is reviewed.
