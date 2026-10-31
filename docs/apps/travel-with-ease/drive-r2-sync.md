# Google Drive → private R2 → published website

Date: 2026-10-31. Implementation follows TTNGH's JSON-credential configuration
pattern, not a claim that its hosted worker was inspected. TTNGH's local Google
credential was empty; its Railway variables could not be inspected because the
Railway CLI is unavailable in this session. No TTNGH secrets or resources were
copied, changed or used by tests.

## Railway configuration

Set these on the **TWE API service**, independently in staging and production:

| TTNGH reference name         | TWE variable                     |
| ---------------------------- | -------------------------------- |
| GOOGLE_SERVICE_ACCOUNT_JSON  | TWE_GOOGLE_SERVICE_ACCOUNT_JSON  |
| GOOGLE_DRIVE_MEDIA_FOLDER_ID | TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID |
| R2_ACCOUNT_ID                | TWE_R2_ACCOUNT_ID                |
| R2_ACCESS_KEY_ID             | TWE_R2_ACCESS_KEY_ID             |
| R2_SECRET_ACCESS_KEY         | TWE_R2_SECRET_ACCESS_KEY         |
| R2_BUCKET_NAME               | TWE_R2_PRIVATE_BUCKET            |

Use the complete service-account JSON credential as the server-only variable
value, not a path or an API key. Keep it out of chat, Git, public-site variables,
`PUBLIC_*` and `VITE_*`. The folder variable is the folder ID, not its full URL.
R2 buckets retain the enforced `twe-staging-*` / `twe-production-*` separation.
No R2_PUBLIC_ORIGIN is required: R2 remains private and the reviewed publication
build copies only selected image derivatives into the public website artifact.

**A configuration format does not bypass Google's key-creation policy.** Prefer
a TWE-specific service account and credential. An existing Faako-wide media
reader credential may be used only if the account owner explicitly approves
TWE access and its cross-application credential scope. Never silently copy a
TTNGH-only credential or disable the organisation-wide policy. If no authorised
existing credential is available, live setup remains blocked; use an approved
keyless design or an administrator-reviewed alternative before activation.

Enable the Drive API for the credential's Google project and share only TWE's
approved image folder with its client_email as Viewer. Do not enable domain-wide
delegation. Google Drive read-only scope is account-level, not a folder-limited
OAuth scope: the server independently restricts requests to the configured folder.
Keep that reader's sharing limited to approved media, not client documents.

## Workflow

1. Put licensed JPEG/PNG/WebP images directly in the configured folder.
2. In the staff portal, open Media → Refresh Drive folder. Pagination is explicit.
3. Choose an image, supply alternative text and source/licence evidence, then
   import it. Up to 8 MiB and 24 million decoded pixels; HEIC, SVG, shortcuts,
   Google documents, inaccessible files and subfolder contents are not imported.
4. Open Content, choose a page and select the imported image. Save the draft.
5. An authorised Owner requests publication through the existing reviewed build
   workflow. Confirm its deployment marker before calling the image live.

The home page image controls the photographic hero. The published contact page
image controls the closing enquiry and shared footer; other content page images
use their respective saved image selections. The supplied five-device mockup CTA
and approved fallback photographs remain code-owned assets; this phase does not
add a picker for each mockup or every photograph in a future package collection.

Updating the existing file in Drive and refreshing/importing its new version
creates a new immutable media asset. Reimporting the same version reuses the
existing asset. Old drafts, published pages and history do not change silently.
There is no scheduler, public webhook, automatic publication or delete mirroring.
Deleting or moving a Drive file does not delete a selected image from R2/site.
This is controlled, on-demand sync, not an original-file backup service.

## Security, storage and failure handling

- Existing sessions, exact-origin mutation/CSRF checks and media.read/media.write
  permissions are authoritative. Platform Admin does not gain business-media
  access. Tenant ID and Drive folder come from server configuration, not requests.
- Existing jose signs the bounded RS256 service-account assertion. The fixed
  Google token endpoint, five-minute assertion and drive.readonly scope are
  explicit; no domain impersonation, Google SDK or new dependency was added.
  Reference: [Google service-account protocol](https://developers.google.com/identity/protocols/oauth2/service-account).
- Google requests prohibit redirects, arbitrary origins and client download URLs.
  Responses are time/byte bounded; image MIME, reported size, checksum and source
  revision are verified. Parent membership is rechecked after download.
  Reference: [Drive downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
- The existing sharp pipeline validates, strips metadata and creates WebP
  derivatives. R2 writes remain environment/tenant scoped and private.
- Migration 009 adds nullable provenance fields and a tenant/folder/file/version
  uniqueness constraint to media; no staff data is reset and no grants broaden.
  Competing replicas converge on the existing asset and clean up losing objects.
- Imports audit only actor/asset/request references, not keys, tokens or filenames.
  Credentials and Google error bodies never appear in client error messages.
- An absent or invalid optional Drive configuration disables Drive import, not
  staff login, enquiries or direct R2 uploads. Existing authentication guards stay.
- Publication uses the large derivative plus deduplicated responsive srcset
  variants, rather than the smaller authenticated staff-preview derivative.

## Deployment and rollback

Run the existing environment-scoped db:deploy pre-deploy command before the new
API release. It applies migration 009 using the migration connection and checked
target identity; do not run hand-written ALTER statements or reset a shared DB.
Review the migration and isolated PostgreSQL CI result before promotion.

Rollback application code if necessary and leave the nullable source columns in
place. Do not drop them or their constraint during an incident; preserved media
and revision history continue working. Removing the two Drive variables disables
the optional provider without changing R2/media records.

## Verification and outstanding operator checks

Mocked tests cover signing/token caching, folder boundaries, pagination, invalid
formats, oversized streams, checksum/version races, redacted failures, CSRF,
roles, tenant isolation, immutable source reuse and demo no-send behaviour.
The isolated PostgreSQL suite additionally covers runtime grants, persisted
provenance, cross-replica deduplication, audit events, archived revisions and
unchanged content references. The existing CI job runs that disposable database;
no hosted database is used by tests.

Portal browser coverage exercises refresh → select → import → choose in draft
at 320/390/768/1440 using real Faako SelectField and other real components with an
in-memory adapter. It rejects all API network requests. Demo success explicitly
says no Google/R2 request was made.

**Not yet verified live:** Railway credential validity, Viewer sharing, Drive API
enablement, R2 permissions, hosted migration 009 and a staging import/publication.
The operator must configure an authorised credential and validate staging before
production activation. No actual Google, R2, email or hosted DB writes were made.

Local results: 74 API tests, seven portal tests and 23 website tests passed.
All three lint checks, portal typecheck, website typecheck (zero errors), portal
and API embedded-CMS builds and the website build passed. Four-width browser
checks passed refresh/import/draft selection with no API network calls or
horizontal overflow. See audits/2026-10-31-drive-sync for interface captures.
The new persisted-source integration test must additionally pass the required
isolated PostgreSQL CI gate before promotion.
