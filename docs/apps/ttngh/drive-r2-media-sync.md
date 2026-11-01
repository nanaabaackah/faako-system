# TTNGH Drive → R2 image-copy sync

1 November 2026 · `feat/ttngh-drive-r2-media-sync` · Operator-run first release.

## Scope and approval

The user confirmed library publication consent, credential rotation, and **images
first; review website placements separately**. The approved source is
`1ifwYbrAS88Q3DrYps1xMpMbkLn3QTa51` (TTNGH Website Media). The connected Drive
metadata/listing was checked read-only. No Drive file is changed or moved.

This is a CLI job within the existing TTNGH API package, not a public API endpoint,
website build hook or new service. It does not import records into Sanity, replace
website image assignments, trigger deployments or activate a schedule. Existing
Sanity imagery remains authoritative until editorial placement review.

## Configuration and service account

Use `services/ttngh-api/.env.media-sync.example` as the template for the ignored
`services/ttngh-api/.env.media-sync`. Keep it private. Do not configure these secrets
in the Astro website or commit JSON credentials. Existing website-local R2 values
must be moved by the owner to the server/job secret store; the implementation does
not copy, print or delete those values automatically.

The service-account email alone is not an authentication credential:

1. Enable the Google Drive API in the service account's Google Cloud project.
2. Share **only the approved TTNGH media folder**, as **Viewer**, with that email.
   Do not grant editor access, domain-wide delegation or broader Drive access.
3. Obtain an organisationally approved service-account JSON credential and store its
   complete JSON privately in `GOOGLE_SERVICE_ACCOUNT_JSON`. For a local env file,
   use a single quoted JSON value with the private key's escaped `\n` preserved.
   Never paste the JSON into chat, commits, logs or the inventory report.
4. Set the approved root in `GOOGLE_DRIVE_MEDIA_FOLDER_ID`. Other roots fail closed.
5. Set `TTNGH_MEDIA_ENV=staging` initially. Configure a bucket-scoped R2 Object
   Read/Write credential, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` (dedicated `ttngh-*`),
   and `R2_PUBLIC_ORIGIN`. Hostnames are limited to `media.thethrivingnetworkgh.org`
   and `media-staging.thethrivingnetworkgh.org`; a configured hostname must actually
   serve that bucket. This code does not create buckets or change public access.
6. After source/target approval set `TTNGH_MEDIA_PUBLICATION_APPROVED=true` for apply.
   The CLI default is dry run even when this flag is set.

Staging/production keys live under distinct `ttngh/{environment}/images/` prefixes.
Separate environment buckets/credentials are preferable. Staging images may still
be publicly accessible if using a public bucket: only approved photos belong here.

## Run and review

From the monorepo root, choose a new private report path for each run:

```sh
pnpm --filter @faako/ttngh-api media:sync --report /private/tmp/ttngh-media-plan.json
# Review the plan before uploading:
pnpm --filter @faako/ttngh-api media:sync --apply --report /private/tmp/ttngh-media-result.json
```

The first command reads metadata only: no image downloads or R2 writes. Reports
use exclusive creation and mode 0600; they never overwrite prior inventories.
The apply report maps Drive ID/name/folder/checksum to generated object keys, URLs,
dimensions, byte sizes and hashes. It makes no guesses about captions, alt text,
people, diagnoses or programme context. Keep reports out of the repository/public
bucket; only optimized image bytes are uploaded. A failed run is not a complete
inventory; it can leave an empty local report and immutable orphaned image copies.
Use a new report filename for retries.

## Safety and idempotency

- Fixed Google API/token hosts, read-only OAuth scope, bounded request times,
  response sizes, recursive folder count/depth, pagination and total inventory.
- No shortcuts are followed. No Docs, video, SVG, PDF or arbitrary remote URL downloads.
- JPEG/PNG/WebP sources need a checksum and must be <=50 MiB. Download bytes must
  match the inventoried size and MD5, so concurrent Drive edits abort the run.
- Sharp enforces a 60-megapixel input limit, rejects animated/unsupported images,
  auto-orients, strips metadata, and generates WebP at 640/960/1600px without
  upscaling. Small sources use fewer distinct sizes. Originals are never uploaded.
- Object keys are immutable and based on optimized content SHA-256. Identical
  variants deduplicate even across different source filenames. HEAD verifies size,
  type and hash metadata; conditional PUT prevents overwrite, followed by HEAD
  verification. SDK mutation retries are disabled.
- No deletes, moves, ACL changes, manifest publication or automatic image placement.
  Removed/withdrawn source files are absent from later inventories, but **existing
  public R2 objects are not automatically removed**. Consent withdrawal requires
  a separate reviewed removal/cache-purge workflow; do not treat this copy job as
  an archival/deletion synchronization service.
- Transforms use the explicit `webp-v1` recipe. A changed recipe needs a new version.
  Periodic byte-level CDN checks are still needed; HEAD metadata is not a full
  end-to-end public delivery integrity test.

## Activation and acceptance gates

Local tests use synthetic service-account keys, mocked Google/R2, and generated
test images. No real uploads have occurred. At implementation time the local Drive
credential was empty; the owner has the service-account email but still needs to
configure authentication and Viewer access.

Before calling staging accepted: dry-run the real approved library; review exclusions;
apply into staging; repeat and verify reuse; open representative public URLs and
check MIME, dimensions, sharpness, metadata removal and mobile crops. Review source
context/rights again for placement. Verify the Events page and live calendar on the
actual staged commit, contact consent/Turnstile delivery, CMS publishing, noindex,
canonical metadata, security headers and rollback availability. Production promotion
is blocked until these hosted checks pass. No production/main merge is implied.

Validation: all **49 API tests passed**, including nine new media/authentication/
image/R2 checks. Focused ESLint and whitespace checks passed. Dependencies reuse
the existing pinned AWS SDK 3.1149.0 and Sharp 0.34.5; no unrelated lockfile upgrades
are part of this branch.

Tests: `pnpm --filter @faako/ttngh-api test`; focused ESLint covers the CLI/modules.
Rollback: stop the operator job; no website content changes need reversing. Preserve
the previous deployment and private inventories. Orphan cleanup is a separate
reviewed operation with exact object keys, not a bulk bucket deletion.

## Provider references

- [Drive file listing and pagination](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list)
- [Drive folder search](https://developers.google.com/workspace/drive/api/guides/search-files)
- [Cloudflare R2 uploads](https://developers.cloudflare.com/r2/objects/upload-objects/)
- [R2 conditional S3 operations](https://developers.cloudflare.com/r2/api/s3/api/)
