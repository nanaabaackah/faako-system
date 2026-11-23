# TWE code and CMS publication workflow

The existing Cloudflare Pages project continues to serve both branches: `main` for production and `develop` for staging previews. No dedicated staging Pages project, separate Cloudflare Worker, manual bootstrap, or duplicated publishing service is required. The CMS uses the existing Railway publication worker to build, deploy and verify its changes. A currently blocked publication still requires evidence-based recovery; do not clear it by editing database rows or blindly re-uploading.

## Sources of truth

Git owns application structure, routes, validation, security, styling and publishing code. Each environment's CMS owns its published copy, selected media, collections, footer and supported brand settings. Staging and production use separate databases and R2 resources; neither environment copies or continuously synchronizes the other's CMS.

## One release mechanism

Both CMS publications and Git-linked code releases use the existing durable publication job and worker. A job pins its environment, trigger, Git SHA, immutable CMS pages, checked-in initialization baseline and manifest digest. The worker builds Astro, archives the artifact, deploys it to the configured Cloudflare Pages target and verifies both the immutable deployment and public-domain marker before moving published pointers or reporting `live`.

When a worker starts on a new reviewed Railway Git SHA, it queues one `code_release` from the last verified content manifest. If a CMS publication was queued during the service deployment, the pending immutable content snapshot is copied into a replacement `coordinated_release` pinned to the new SHA; the obsolete pending job remains as failed history. Advisory locking and the one-active-job constraint prevent racing releases.

Version 2 manifests carry their checked-in baseline rather than reading a newer fallback during a later rebuild. Existing CMS page bodies overlay that baseline, explicit null bodies stay withdrawn, and drafts are excluded. A code release therefore cannot silently replace CMS-managed values.

## Developer workflow

1. Develop on a feature branch and pass the TWE tests and builds.
2. Merge reviewed code to `develop`; Railway supplies the exact Git SHA to the existing API and publication worker.
3. The worker coordinates the new SHA with staging's last verified content and publishes through the normal verified path.
4. Confirm the release trigger, abbreviated SHA, deployment verification and status in Publication history.
5. CMS-only changes continue through Save, Preview and Publish using the environment's reviewed SHA.
6. Promote code through `develop` to `main`. A production code release uses production's own latest published CMS manifest, never staging content.

Do not enable a competing Cloudflare Git deployment for a worker-controlled branch. Do not update routine CMS content directly in SQL. Failed or uncertain provider operations use the existing retry, reconciliation and recovery controls.


## Staging baseline validation and publication failure diagnostics

The staging publication worker must use the **last confirmed Live CMS release**
as its rollback baseline. A newer Git-triggered `develop` Pages preview is
not an accepted CMS publication and must not replace this baseline. The worker
fetches the **exact recorded deployment ID** from Cloudflare, verifies the
project, successful status, `develop` branch, preview environment, and full
source SHA, then validates `jobId`, `sourceSha`, and manifest `digest`
on both the immutable deployment URL and the current staging custom domain.
Only then does it restore the retained artifact archive and proceed with a
new release. A missing or mismatched provider record, unavailable archive,
or changed current-domain marker fails closed before another upload.

A healthy worker can still mark an individual release `failed`. The stage is
reported as `publication.release_stage_failed` using a fixed pipeline stage
(e.g. `baseline_validation`, `baseline_verification`,
`archive_restore`, `prepare_artifact`, `website_build`,
`pages_deployment`, `immutable_marker`, or `current_origin_marker`).
Raw provider exceptions, tokens, and asset keys are intentionally not logged.

At `baseline_validation`, the worker emits `publication.baseline_rejected`
with the enumerated reason `archive_unavailable` or `no_live_baseline`.
At `baseline_verification`, it refuses provider deployment or marker
mismatches without changing the published revisions, attempting a rollback,
or marking an unverified publication Live.

A `failed` release is not proof that the current website changed. Do not
reset publication jobs, manufacture an archive, or silently republish a failed
job. Use worker logs and a reviewed fix, then verify the next coordinated
release and CMS publication status.

## Staging custom-domain propagation and safe reconciliation

A successful Wrangler upload and verified immutable Pages deployment may become
visible on the staging branch alias/custom domain later. The worker performs
up to 13 read-only marker checks, five seconds apart, against the configured
staging HTTPS origin, with the same exact `jobId`, `sourceSha`, and `digest`
required at every attempt. There is no second deployment or implicit approval.

If the domain still does not match, the original publication stays `verifying`.
The worker emits `publication.release_stage_failed` at
`current_origin_marker` and `publication.current_origin_pending`; it does
**not** upload the archived baseline as a competing rollback. After ten
minutes, the existing read-only reconciliation evaluates a unique provider
deployment and both markers. Do not manually mark the job Live or publish
another release while verification is unresolved.

If the marker never converges, check that staging's DNS CNAME targets
`develop.tee-concierge.pages.dev` (the project subdomain observed in
Cloudflare), and that the DNS record is **proxied through Cloudflare**.
Cloudflare branch custom domains require a proxied record; a DNS-only
record can route to the project's production deployment instead.
Also confirm that competing automatic Git-triggered Cloudflare
Pages preview deployments are not overwriting worker-controlled content.
Railway builds the reviewed code and the publication worker deploys its
combined CMS artifact; the Cloudflare Git integration must not independently
publish a competing `develop` artifact. Confirm the existing Cloudflare
branch-deployment controls before changing settings; do not recreate
Railway/Cloudflare variables or add another worker.

## Recovery: CMS remains in Deploying after the website appears live

The public site being reachable is not sufficient proof that the CMS publication completed.
The worker marks a release Live only when its exact Pages deployment, Git SHA,
environment, immutable publication marker and current custom-domain marker agree.

The worker now rechecks abandoned `deploying` or `verifying` jobs after ten minutes,
using read-only Cloudflare Pages lookups. Because newer code deployments may push
a valid CMS publication beyond Cloudflare's first 25 results, recovery scans
successive Pages deployment pages (up to 20 pages of 25) while preserving exact
project, branch, environment, source SHA, and publication-marker checks.
The Cloudflare deployment creation timestamp may precede the CMS job timestamp;
this is retained as an `olderThanJob` diagnostic rather than rejecting an
otherwise exact publication. Temporal order is not proof of identity. Recovery
still requires an unambiguous successful deployment and matching `jobId`,
`sourceSha` and `digest` on both its immutable Pages URL and the current
custom domain; it never confirms on a matching Git SHA alone.
The read-only scan records categorical rejection counts for status,
branch, commit (including shortened commit metadata), environment, and
duplicate deployment pages. Treat `publication.reconciliation_scan` as
diagnostic evidence; no provider tokens, raw deployment records or publication
manifests are logged.

It verifies a unique successful deployment with the exact `jobId`, `sourceSha`
and `digest` on both the immutable deployment URL and the configured website
origin. Only then does it atomically confirm the original published content
revision and mark the job Live.

If provider evidence is missing, a different deployment is serving the custom
domain, or multiple candidate deployments match, the worker reports
`publication.reconciliation_required`. The continuous worker remains healthy,
leaves the original job blocked, and checks again at least 60 seconds later
without initiating a new deployment. A one-shot diagnostic still exits nonzero
for unresolved recovery. Alert operators for sustained unresolved cases;
a blocked publication is not permission to republish or redeploy. The job intentionally remains blocked:
do not reset its status, change CMS publication pointers, or queue a second release.
Investigate the existing Pages deployment and its
`/twe-publication.json` marker, the job/source SHA, the worker logs, and the
environment-scoped Railway worker deployment. Never log or share provider
credentials. If a worker is disabled or stopped, restore the **existing** worker
with its current reviewed source/configuration; do not create a duplicate worker.

The CMS shows a delayed-verification warning once a claimed deployment has been
unconfirmed for ten minutes. After the worker confirms the matching artifact,
the existing publication status polling updates the editor to Live and restores
the Publish action without resaving or republishing the draft.

A successful Git-triggered Pages deployment is **not** proof of a CMS publication
unless it carries the exact publication marker. Do not overwrite the current
website or copy staging/production databases to clear a stuck state.

## Recovery

The previous verified artifact remains archived. A replacement is marked live only after marker verification. Staging restores its accepted archived baseline after a failed post-upload verification; production uses its separately reviewed rollback path. Content rollback remains an explicit publication of a selected historic revision.
