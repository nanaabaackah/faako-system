# TTNGH media: Google Drive → private R2 → Sanity

## Status and boundaries
The TTNGH API now has a dedicated **operator-only** media pipeline. It does not provide an unauthenticated HTTP sync or proxy, and no imported image automatically becomes a public site asset. Sanity remains authoritative for published pages and image references.

The prior “zero images imported” issue is addressed by recursively listing folders under the configured Drive media root, following each page token, and accepting eligible JPEG, PNG and WebP files even when the Google Drive description is blank. Images remain private in R2 until explicitly reviewed. HEIC, Google-native files, shortcuts, documents, images above 8 MiB, and files that cannot be downloaded are intentionally not imported. Never attempt automatic cross-application fallbacks.

### Secrets and separation
- TTNGH's Railway service, not the website, holds `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_MEDIA_FOLDER_ID` (fallback `GOOGLE_DRIVE_ROOT_FOLDER_ID`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` and `DATABASE_URL`.
- Ensure the Google Drive API is enabled for the service account and the *media root folder* is shared with its client email as **Viewer**. Do not enable domain-wide delegation.
- Set `TTNGH_MEDIA_ENV=staging` in staging, `TTNGH_MEDIA_ENV=production` in production. Objects are written only under `ttngh/<environment>/media/drive/<file-id>/<version>-<sha256>/`.
- The R2 bucket must remain private. Never put these credentials in `PUBLIC_*`, `VITE_*`, source code or logs.
- Google Drive credentials must have read-only access. The application independently enforces ancestry on every nested-folder listing and file download.
- Existing R2 public-origin variables are *not* used for private media access.

### Staging-first procedure
1. Confirm code checks and review PR. Merging does **not** by itself execute a media sync.
2. Approve the separate media schema: set `TTNGH_MEDIA_MIGRATION_APPROVED=true` only for the operator migration, then run:
   `pnpm --filter @faako/ttngh-api db:media:deploy`
   Verify it reports applied/current and turn the flag off. Railway's existing pre-deploy `db:deploy` is unchanged, and contact migration is not modified.
3. Set the Drive/R2 credentials on the **staging TTNGH API** only. Verify both the root folder and its subfolders are accessible to the configured service account.
4. Inspect the read-only plan:
   `pnpm --filter @faako/ttngh-api media:plan --max-files=1000`
   The result distinguishes discovered, alreadyImported and pending. A zero count is **not** proof of successful sync.
5. To import privately, set `TTNGH_MEDIA_SYNC_ENABLED=true` and run:
   `pnpm --filter @faako/ttngh-api media:sync --apply --max-files=1000`
   No deletion or automatic publication occurs. Run `media:status` to see inventory counts. When complete, disable the apply flag.
6. To review source names and paths in a **private operator terminal**, set `TTNGH_MEDIA_APPROVAL_ENABLED=true` then run:
   `pnpm --filter @faako/ttngh-api media:list --status=imported --limit=50`
   Choose an image with appropriate permission and supply accurate alt text and usage evidence:
   `pnpm --filter @faako/ttngh-api media:approve --id=<uuid> --alt="..." --rights="..."`
   Avoid sensitive descriptions in shell history. Do not approve without verified rights and photographic consent.
7. To transfer an approved derivative into the Sanity asset library, separately configure a restricted **server-only** `SANITY_ASSET_WRITE_TOKEN` and `TTNGH_MEDIA_SANITY_EXPORT_ENABLED=true` and run:
   `pnpm --filter @faako/ttngh-api media:to-sanity --id=<uuid>`
   Returns an asset ID, **not** a published event or page. Remove/disable the write token when no longer required.
8. Editors can select the uploaded asset in Sanity Studio, supply the CMS image-field alt text, review the content and publish using TTNGH's existing approval, webhook and Cloudflare build flow. Record rights and approvals outside public documents.
9. Re-run the dry-run plan to verify unchanged revisions are skipped. Uploading an updated Drive revision creates a **new** R2 asset; it never alters previously published pages automatically.
10. Only after staging acceptance, repeat the verified configuration and a small sample in production. Do not copy staging media IDs or credentials into production.

### Troubleshooting “no images imported”
- **No files discovered:** Confirm the correct folder ID, Google Drive API activation, Viewer sharing, nested folders and whether the folder contains supported images.
- **Files discovered but none pending:** The same Drive revision/checksum was already imported; inspect `media:status`.
- **Files pending but not imported:** Confirm `--apply`, `TTNGH_MEDIA_SYNC_ENABLED=true`, R2 settings, private bucket access, the media registry migration and permissions.
- **Some failures:** Check supported formats, 8-MiB maximum, 24-million-pixel image limit, source file changes during download and R2 connectivity. Retry after reviewing; successful revisions are idempotent.
- **Drive source moved:** Folder ancestry is reverified; files moved outside the approved media tree are denied rather than silently imported.
- **No images on the website:** R2 imports remain private until an image is deliberately exported to Sanity and selected in a published CMS document.

### Intentional limitations
This is a controlled manual sync, **not** an automatic scheduled two-way backup. It does not mirror Drive deletion to R2, publish uploaded assets automatically, expose private media publicly, synchronise editor consent records, or auto-attach imagery to CMS records. Adding a scheduled importer or a Sanity UI picker should occur only after live staging verification, permission review and a resource/cost assessment. 
