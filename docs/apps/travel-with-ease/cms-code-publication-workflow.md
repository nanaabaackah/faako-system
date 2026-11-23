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

## Recovery

The previous verified artifact remains archived. A replacement is marked live only after marker verification. Staging restores its accepted archived baseline after a failed post-upload verification; production uses its separately reviewed rollback path. Content rollback remains an explicit publication of a selected historic revision.
