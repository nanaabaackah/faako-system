# Media foundation — implementation in progress

Current follow-up: [controlled Drive → R2 sync and Railway setup](drive-r2-sync.md)
(2026-10-31). Historical pending items below describe the original foundation,
not the current portal/publication implementation.

Date: 2026-10-12. TWE-017/TWE-004. No R2 bucket has been provisioned or verified.

Accept JPEG, PNG and WebP only, at most 8 MiB and 24 million decoded pixels.
Reject active formats, type/content mismatches and animated inputs. Re-encode
to WebP without original metadata; never serve original uploaded bytes. Private
storage holds draft assets and responsive derivatives. Public delivery is a
separate publication concern. Image replacement creates a new asset ID so old
revisions cannot silently change. Archive must not break referenced revisions.
Keep alt text and rights/source evidence; the agency owns content verification.

## API integration — 2026-10-21

The server now mounts the private media service when PostgreSQL is configured.
All `/api/agent/media` routes require staff sessions; upload, replacement and
archive additionally require the existing exact-origin/CSRF checks. The app
factory rejects a media service without session protection. Upload preflight
allows `X-Media-Alt` and `X-Media-Rights` only on media paths while retaining the
shared origin allowlist. These metadata headers contain URI-encoded text.

Configure all four server-only names together: `TWE_R2_ACCOUNT_ID`,
`TWE_R2_ACCESS_KEY_ID`, `TWE_R2_SECRET_ACCESS_KEY`, `TWE_R2_PRIVATE_BUCKET`.
The bucket must start with `twe-<APP_ENV>-`; configuration without PostgreSQL
fails startup. With no R2 configuration, the media list reports
`configured: false` and uploads/previews return unavailable. Never put these
credentials in `PUBLIC_` or `VITE_` variables.

Endpoints: `GET /api/agent/media`, `GET /api/agent/media/:id/preview`,
`POST /api/agent/media/upload`, `POST /api/agent/media/:id/replace`, and
`POST /api/agent/media/:id/archive`. Upload bodies are raw image bytes, not
multipart. Replacement creates a new asset; it does not rewrite existing content
references. Historical references prevent archive. Processing capacity is reserved
before asynchronous replacement lookup; failed uploads attempt object cleanup.

Local tests cover re-encoding, MIME mismatch, corrupt/oversized inputs, optional
and environment-scoped R2 configuration, cleanup on storage failure, concurrent
replacement limits, unauthenticated access and CORS. Storage is mocked: these
checks do **not** verify live R2 permissions or PostgreSQL persistence.

Still pending: portal media controls/image selection, real isolated PostgreSQL
integration tests, live private-bucket verification, public asset publication and
end-to-end acceptance. Staging/production startup remains intentionally blocked.

## Dependency decision

`sharp` 0.34.5 (already present in the monorepo) is server-only image decoding,
metadata stripping and resizing. `@aws-sdk/client-s3` 3.1149.0 (version checked
against npm) provides Cloudflare's documented S3-compatible R2 transport.

1. Required for validated image management and approved R2 storage.
2. Shared packages do not provide an image decoder or R2 client; reuse existing
   sharp version rather than adding a competing transformation stack.
3. Browser MIME checks are insufficient; custom image parsers/request signing
   would add security-sensitive code. Native fetch alone does not sign S3.
4. Alt text and accessible image-selection controls remain mandatory; no visual
   effect or frontend dependency is introduced.
5. Both dependencies are backend-only, with no browser bundle/hydration impact.
   Decoding is bounded by input bytes/pixels and should be concurrency-limited;
   the SDK adds server transitive packages, accepted for supported signing.
6. Sharp and AWS SDK use Apache-2.0 licensing; native sharp binaries need the
   deployment platform's supported architecture. Provider credentials, orphan
   cleanup and dependency patching remain operational responsibilities.
7. Safe decoding and maintained signed transport justify their costs.

References: [Cloudflare R2 SDK guidance](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/),
[sharp input options](https://sharp.pixelplumbing.com/api-constructor/),
[sharp output options](https://sharp.pixelplumbing.com/api-output/).
