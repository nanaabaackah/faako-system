# TWE code and CMS publication workflow

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


## Recovery: CMS remains in Deploying after the website appears live

The public site being reachable is not sufficient proof that the CMS publication completed.
The worker marks a release Live only when its exact Pages deployment, Git SHA,
environment, immutable publication marker and current custom-domain marker agree.

The worker now rechecks abandoned `deploying` or `verifying` jobs after ten minutes,
using read-only Cloudflare Pages lookups. Because newer code deployments may push
a valid CMS publication beyond Cloudflare's first 25 results, recovery scans
successive Pages deployment pages (up to 20 pages of 25) while preserving exact
project, branch, environment, source SHA, time, and publication-marker checks.
The read-only scan now records categorical rejection counts for status,
branch, commit (including shortened commit metadata), environment, timestamp
and duplicate deployment pages. A matching public marker alone cannot override
the provider's identity checks. Treat `publication.reconciliation_scan` as
diagnostic evidence before choosing a focused fix; no provider tokens, raw
deployment records or publication manifests are logged.

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
