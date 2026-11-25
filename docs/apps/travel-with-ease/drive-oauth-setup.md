# TWE Drive media connection — OAuth alternative

The CMS uses Google Drive as a read-only source; imported images are validated,
converted to WebP derivatives, stored in the environment's private R2 bucket and
recorded with immutable source file/version/checksum identifiers in PostgreSQL.
This change enables an alternative authentication method, not background sync.

## Configure staging first

1. Use a dedicated TWE media-only Google identity with Viewer access to the approved
   folder and no unrelated files. The Google Drive read-only OAuth scope can read
   all files accessible to that identity; the application also enforces the configured
   folder tree. Do not use a personal or general administrator account. Browse
   subfolders in the picker; shortcuts are not followed. Ancestry is verified
   server-side on listing and download (maximum 12 parent levels).
2. In a TWE-owned Google Cloud project enable Drive API, configure the consent
   screen and create an OAuth client approved under the organisation's policy.
   Request only https://www.googleapis.com/auth/drive.readonly with offline access.
   Follow https://developers.google.com/identity/protocols/oauth2/web-server for
   authorization and code exchange. Use a secure operator-controlled consent flow;
   never place the client secret or token in URLs, Git, screenshots, logs, or chat.
   External Testing consent grants expire after seven days; use an approved durable
   internal/production consent configuration before production.
3. Set the following on the staging TWE_API service only, using Railway secrets:
   TWE_GOOGLE_OAUTH_CLIENT_ID, TWE_GOOGLE_OAUTH_CLIENT_SECRET,
   TWE_GOOGLE_OAUTH_REFRESH_TOKEN, TWE_GOOGLE_DRIVE_MEDIA_FOLDER_ID.
   Remove any service-account JSON variable if using OAuth. Keep the existing
   R2 configuration; do not copy staging R2 keys into production.
4. Deploy staging and sign into CMS. List the configured folder and import a
   reviewed test JPEG/PNG/WebP. Verify thumbnail and saved preview, R2 derivatives,
   duplicate import returns the same asset, unsupported or outside-folder files
   are denied, and revoked credentials fail without exposing secrets.
5. Verify staging publication renders the asset. Validate the promotion bundle
   and production bucket access separately before production import. Provision
   independent production OAuth credentials, if required, after staging acceptance.

No automatic sync or deletion is enabled. Imported revisions remain stable even
if a Drive source changes or is deleted; a newer revision is a separate asset.
A subsequent bounded synchronisation workflow needs explicit review, durable
status, idempotency, a safe alt-text policy and retry limits. Do not republish or
replace existing content automatically. Roll back by removing the OAuth
configuration or reverting the branch; existing imported images are retained.
