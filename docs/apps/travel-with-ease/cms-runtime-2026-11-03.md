# CMS runtime — 2026-11-03

Implemented locally; **not deployed or accepted on staging/production**. The
complete launch brief remains incomplete. November 1 approved company copy is
unchanged; no prices, testimonials or travel claims were invented in this slice.
The public-site design is preserved.

## Implementation

- Draft autosave after 1.2 seconds inactivity, explicit Save Draft, durable
  Unsaved/Saving/Saved/Error feedback. One writer serializes expected-version
  requests. Inputs remain enabled while saving. Autosave cannot publish.
- Newer typing survives late acknowledgements. Page changes/unmount ignore stale
  responses. Conflicts/network errors retain input and pause writes. Explicit
  Save Draft reads the server before retrying a possibly committed mutation.
- Load approved copy projects the November 1 public snapshot into strict editor
  fields. Public photo URLs are not fabricated as R2 UUIDs: select managed images
  explicitly. Packages, Journal, Tips and Footprint stay inside Content
  Management, using its Section selector on desktop and mobile as requested.
- Actual Astro saved-draft builds, not a React approximation. Desktop/tablet/
  mobile controls; side-by-side editing on desktop, editor/preview switch on
  mobile. Only the selected draft joins other published revisions and the pinned
  approved baseline. No rebuilding on keystrokes.
- CSRF-protected preview creation. Every status/file read requires staff session,
  content permission, creating user and tenant. UUID is not authorization.
  Ten-minute expiry; private/no-store/noindex. Scripts, forms, analytics and
  mutation networking blocked. Native disclosures still work; interactive public
  flows are verified separately, not claimed as working in the read-only iframe.
- Individual package/article/tip publication merges only the selected record into
  published siblings. Whole-collection publication is explicit. Exact live bodies
  persist separately from current drafts and immutable source revisions.
  Publish/verify the approved whole collection once before its first individual
  publication. Never-published sibling drafts preserve the approved bundled page;
  only an explicit unpublish withdraws it. This avoids removing existing approved
  public content during initial CMS adoption.
- Pending/building/deploying/verifying/live/failed publication lifecycle, target
  version/environment/deployment history and non-mutating status polling.
- Clean reviewed-source build → exact artifact upload with pinned official
  Wrangler → immutable deployment/custom-domain marker verification → Live.
  Provider/DB/Access secrets never enter the public build process.
- Private hash-verified R2 artifact retention. Staging recovery redeploys the
  exact preceding artifact onto develop, never production rollback. Production
  uses provider rollback. Ambiguous uploads/confirmation stay active for operator
  reconciliation, never unsafe automatic retries or false Live/rollback claims.
- Hosted enquiry-mail worker has explicit activation plus full database preflight
  and existing lease/idempotency/recipient protections. No real email was sent.

## Approved permission decision

The final launch brief supersedes the former restricted technical-only policy.
`platform_admin` remains the internal identifier and is displayed **Superadmin**.
Its explicit TWE application matrix now includes content/media/enquiries,
publishing, templates and staff operations. Owner retains business control;
Editor cannot publish/manage staff. Neither gains Superadmin system permissions.
Ordinary management cannot assign Owner/Superadmin roles. Issuer/stable subject,
MFA, sessions, CSRF, audit and tenant checks remain mandatory. Historical support
grants remain compatible but are not required for approved Superadmin TWE access.
No Cloudflare ownership, billing, DB secrets or other-client access is granted.

## Provider configuration — not yet applied

User-confirmed: website project **twe-concierge**, `develop` preview branch for
staging, `main` for production. **twe-portal** is separate and is never targeted
by content publication. Existing Access-aware same-origin portal hosting remains.

Apply additive migration `012_cms_publication_runtime.sql` with the existing
reviewed `db:deploy` process before dependent API code. No reset, staff/data loss
or historic migration rewrite. Downgrade needs separate assessment.

| Variable | Placement/purpose |
| --- | --- |
| `TWE_CMS_PREVIEW_ENABLED` | API; enable after resource/build acceptance |
| `TWE_PUBLICATION_WORKER_ENABLED` | Publishing worker activation |
| `TWE_NOTIFICATION_WORKER_ENABLED` | Notification worker activation |
| `TWE_RELEASE_SHA` | Full reviewed SHA equal to clean worker checkout |
| `TWE_PAGES_PROJECT` | Publishing worker: twe-concierge |
| `TWE_PAGES_BRANCH` | develop staging, main production |
| `TWE_PAGES_ACCOUNT_ID` | Account identifier |
| `TWE_PAGES_API_TOKEN` | Worker-only least-privilege Pages secret |
| `TWE_PUBLIC_SITE_ORIGIN` | Exact environment custom domain |
| `TWE_PUBLIC_API_ORIGIN` | Environment public enquiry API |
| `TWE_PUBLIC_TURNSTILE_SITE_KEY` | Public widget key, never secret |
| `TWE_PUBLIC_SITE_INDEXABLE` | False staging; approved production setting |
| `TWE_PUBLIC_GOOGLE_SITE_VERIFICATION` | Existing public Search Console value |

Reuse environment-specific runtime DB/tenant/TLS/R2/Resend settings. Set secrets
directly with providers, not in chat/Git. The background worker is not another
portal service. Its checkout must retain Git provenance and pinned dependencies;
missing identity fails closed. API health is not proof of worker acceptance.

After acceptance, configure short non-overlapping provider schedules:

```bash
pnpm --filter @faako/travel-with-ease-api publication:once
pnpm --filter @faako/travel-with-ease-api notifications:once
```

Each invocation processes one eligible job; PostgreSQL claims atomically. Keep
the regular publisher stopped until the initial baseline is accepted.

## One-time technical acceptance and rollback

Routine staff publishing requires no terminal. Initial technical acceptance does:

1. Confirm reviewed source, migrations, environment, current known-good provider
   deployment, credentials and DB backup. Keep publication schedule stopped.
2. An authorised user queues the intended initial content. Developer runs
   `publication:baseline prepare` in the configured worker checkout. It claims,
   builds and privately archives exact bytes; prints directory/job ID, not Live.
3. Deploy that exact directory through the reviewed Pages procedure, project
   twe-concierge, appropriate branch and reviewed commit hash. Record deployment
   UUID. Never rebuild from another source/artifact.
4. Run `publication:baseline confirm <job-uuid> <deployment-uuid>`. It verifies
   provider branch/environment/source, private archive and both actual marker
   endpoints before recording Live. Failure leaves acceptance incomplete.
5. Verify staging functionality/recovery, then activate its regular schedule.

Subsequent staging recovery references are recorded without changing original
source/manifests. Missing/corrupt archive or unexpected external branch deployment
blocks publication. Unknown upload completion requires reconciliation before a
retry. A failed recovery leaves the job active and alerts the operator.
Code releases can supersede content deployments: reconcile the new accepted
baseline before normal publication; do not race Pages Git builds with content
publishing. These remain P1 provider acceptance gates, not verified deployment.

## Preview limits

Jobs/artifacts are process-local. Keep one API replica until shared preview
storage/sticky routing is implemented/tested. Restart invalidates previews, not
durable drafts; generate another. One build at a time, twelve retained jobs,
three-minute build timeout; expired jobs are cleaned on later preview creation.
Publishing state is PostgreSQL-backed, not process-local.

## Evidence and remaining scope

- Autosave unit tests: debounce, deduplication, in-flight edits, lost replies,
  conflicts, page changes and disposal.
- Actual protected Astro browser build passed at 320/390/768/1440, no anonymous
  access, broken images or overflow:
  `/var/folders/b_/tqnndpmj7wn35nfm_6mg02vr0000gn/T/twe-private-preview-browser-MShejP`.
- Isolated migrations/runtime-grant tests and logical restore passed, including
  per-record publication and recreation persistence:
  `/var/folders/b_/tqnndpmj7wn35nfm_6mg02vr0000gn/T/twe-isolated-pg17-bDmeet`.
- Final suite/build/browser results go in the progress log. Provider mocks are
  not actual Pages or Resend acceptance.

Remaining launch work: full Google Form branches and authoritative package/tier
enquiry context; rich Journal blocks; hosted demo retirement while preserving
isolated local testing requested by the client; real invitation/email receipt;
provider setup, signed-in staging UAT/deployment SHAs; monitoring/backup/rollback
acceptance and controlled production release. Do not mark the whole brief done.
