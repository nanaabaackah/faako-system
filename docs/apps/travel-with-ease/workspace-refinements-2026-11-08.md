# TWE workspace preview, structure and delivery — 8 November 2026

## Source layout and approved boundaries

The staff portal is React/Vite, not Astro. Its application entrypoints remain
`src/App.jsx` and `src/main.jsx`; feature UI lives in `src/components/`,
CSS in `src/styles/` and state/transport helpers in `src/lib/`.
The public website retains Astro routes, components and external styles.
TWE-owned CSS was mechanically formatted without reordering declarations or
changing selector specificity; functional design changes are a separate commit.
Historical file inventories retain their original paths and are not current maps.

No provider, real session model, permission matrix, migration or tenant boundary
has been replaced. No new dependencies. The developer remains an Owner until
the reviewed real staging handover is actually executed.

## See the portal locally

From the regular repository root:

```sh
pnpm run dev:twe:workspace
```

Open the portal at http://127.0.0.1:5188 and the approved public website at
http://127.0.0.1:4328. The isolated fixture API listens only on 127.0.0.1:3090.
Stop an existing `dev:twe` stack first: the two modes intentionally use the same
ports. The launcher stops its owned child process groups on exit.

The preview opens as Owner without Google or Cloudflare login. The persistent
**Local workspace preview** toolbar offers Owner, Editor and Superadmin,
plus Reset preview. Changing role resets the synthetic workspace after
confirmation. Reloading retains in-memory edits until reset/server restart.
This is not the old `/demo` route or `?demo=1` flag.

Actual portal components and the shared API client talk to a loopback-only
development server reusing test fixtures. It supports draft editing/autosave,
saved-content previews, revision restoration, synthetic enquiry changes, media
practice and tutorial progress. Owner/Editor/Superadmin permissions are filtered
and checked at this isolated HTTP boundary. Unsupported operations fail visibly;
publishing and real staff invitations never report completion.

The website displays approved content, not these synthetic CMS drafts. This
preview does not synchronise draft changes into the public site. Use the
authenticated real Astro preview for that acceptance.

No database, real Drive/R2 connection, mail transport or publishing provider
exists in this fixture process. Local preview rejects hosted environments,
deployment-provider markers, database URLs and Resend credentials. The launcher
forwards only a small environment allowlist, never hosted .env files. Foreign
Host/Origin, forwarded hosting headers and cross-site requests are rejected;
mutations require JSON and explicit local-only headers. Fixture code stays
outside application source, and hosted bundles exclude it and the controls.

`pnpm run dev:twe` remains the credential-isolated public/API development mode;
it does not enable staff login. Use staging for real MFA, activation and
persistence acceptance. Never enter actual customer data in the fixture workspace.

## Enquiry email diagnosis and Railway worker

Repository evidence: PostgreSQL enquiry creation queues an outbox record
transactionally. The API does not drain it. The existing `notifications:once`
process claims at most one job and exits. A Resend key does not schedule it.
This explains a possible queued-but-unsent path; it does not prove the cause
of the reported staging submission without inspecting its outbox/provider evidence.

The new `notifications:worker` command validates its environment/database,
then processes one leased job at a time. It waits 600ms between attempted
deliveries and five seconds when idle. SIGTERM stops further claims, allows
the current bounded operation to finish and closes the pool. Existing
idempotency, pinned payloads, retry backoff and 23-hour safety window remain.
Templates are read at each claim. Configuration/provider failures use only
allowlisted diagnostic reasons; raw provider response bodies are never logged.

Create a **separate staging Railway worker service** from this repository.
Keep the monorepo root as its root directory, with these service settings:

| Setting | Value |
| --- | --- |
| Source branch | develop, after the checked PR merges |
| Build command | `pnpm --filter @faako/travel-with-ease-api typecheck` |
| Start command | `pnpm --filter @faako/travel-with-ease-api notifications:worker` |
| Replicas | 1 |
| HTTP healthcheck / public domain | None: this is not an HTTP service |
| Cron / serverless sleeping | Disabled; keep the worker running |
| Restart | On failure, up to 10 retries |
| Pre-deploy migrations | None on worker; API migrations must already be verified |

Set these through Railway's service settings. Current
[Railway configuration guidance](https://docs.railway.com/config-as-code)
says new services cannot opt into legacy Config as Code. This change therefore
does not introduce another legacy railway.worker.json or alter the existing API
service's deployment configuration. A platform-wide IaC migration is separate work.

Use same-environment reference variables rather than copying credentials:

| Variable | Requirement |
| --- | --- |
| `APP_ENV` | staging |
| `NODE_ENV` | production |
| `DATABASE_URL` | The staging runtime-role connection, not migration credentials |
| `TWE_ORGANISATION_ID` | The same verified staging organisation as the API |
| `TWE_DATABASE_TLS`, `TWE_DATABASE_CA` | Existing verified database TLS settings |
| `TWE_NOTIFICATION_WORKER_ENABLED` | true |
| `TWE_RESEND_API_KEY` | Secret, configured directly in Railway |
| `TWE_EMAIL_FROM` | Resend-verified sender |

Do not give this worker Access assertions, migration credentials, R2/Drive
credentials or production database access. Staging sends only to
testing@travelwitheasegh.com, regardless of the submitted address. Production
routing remains customer To plus notifications@travelwitheasegh.com CC.

Read a redacted queue summary in the configured staging backend terminal:

```sh
pnpm --filter @faako/travel-with-ease-api notifications:status
```

It verifies database identity and reports counts, oldest timestamps and safe
error groups, not email addresses/bodies. `workerEnabledHere` describes the
current terminal's service configuration, not a remote worker heartbeat.
Check Railway worker start logs for
`notification.worker_ready`, distinguish pending/processing/failed/sent, and
review Resend acceptance separately from inbox receipt. Do not blindly retry
expired jobs, clear leases or change pinned payloads to force a delivery.

Staging acceptance: submit one explicitly labelled synthetic enquiry using a
controlled .invalid customer address; check saved enquiry/outbox, worker claim,
provider ID/status and receipt at the testing mailbox. Do not perform this
against production. These hosted actions remain pending verified operator access.

## Approved staging developer handover

The user confirmed that the client's separate account is activated and approved
the staging-only handover. First verify the deployed staging SHA, migrations and
database identity; both users need fresh Access assertions from the staging
application after MFA. Review the current staff ledger for an existing Superadmin.
Do not infer issuer/subject from email or change roles with direct SQL.

In a private interactive staging backend administration terminal, with the
reviewed migration connection and staging Access configuration already injected:

```sh
pnpm --filter @faako/travel-with-ease-api staff:handover:prompt TWE-STAGING-HANDOVER-2026-11-08
```

The helper refuses non-staging/non-TTY use. Type the displayed confirmation, then
enter the developer and client assertions into hidden prompts. Never put them
in arguments, chat, shell history, screenshots or committed files. It delegates
to the existing cryptographically verified handover command through protected
stdin; it does not introduce a new promotion path.

The transaction establishes client Owner, converts the verified developer to
Superadmin, preserves IDs/content/tutorials, invalidates affected access and
records immutable history. An existing Superadmin blocks this bootstrap.
Both users sign in again; verify Owner cannot self-promote and Superadmin can
access the authorised technical/staff controls. If the result is uncertain,
inspect the ledger before retrying. Production is unchanged.

Only synthetic PostgreSQL handover tests have run here. Real handover remains
pending protected identity input and verified staging administration access.

## Website and release checks

Homepage services now use one approved, responsive photograph beside four
compact rows. Each row has approved title, fee and concise source-derived
description, linking to its service detail page. Existing image placements and
currency display are preserved. Mobile stacks the photograph above the list;
service rows have no card shadow/blue background. Package shadows, hero, CTA
mockups and continuous enquiry/footer remain unchanged.

Package, service, Journal and Tips details share semantic Astro breadcrumbs:
Home, collection and non-linked current title. Genuine decorative Iconsax
ArrowRight4 separators have no separate focus target. Links wrap, retain touch
targets and show keyboard focus without JavaScript.

Automated verification and live verification are distinct. See the progress log
and PR for final results. No production deployment, real email receipt or actual
staging role change is implied by passing CI. Roll back code by reverting the
focused functional/structure commits; stop the worker before reverting its
runtime. No schema migration or shared data reset is required. Role handover is
not undone by a code rollback: any subsequent role recovery requires separate,
audited approval.

Local evidence: portal tests 18/18, website tests 56/56, API regression suite
119/119, shared UI tests 8/8 and
isolated PostgreSQL tests 10/10 passed. All TWE lint/type checks passed; Astro
checked 91 files with no diagnostics and built 29 routes. Portal and embedded
API CMS builds passed; the deployed bundle contains no preview controls,
synthetic identity token or fixture adapter. Chrome acceptance passed all four
widths and public no-JavaScript navigation. Browser evidence is retained outside
source control; CI uploads its own screenshot artifacts.

The regular workspace contains additional user CTA/imagery/copy edits, preserved
but excluded from this focused branch. Focused-branch results do not claim those
separate edits pass every existing source assertion. CSS/folder changes and new
features are mirrored into the regular workspace without resetting its history.
