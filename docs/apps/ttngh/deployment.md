# TTNGH deployment and activation

Updated 18 October 2026. TTNGH implementation is in the main `faako-system`
checkout, under `apps/ttngh` and `services/ttngh-api`; do not use the old temporary
worktree. The client supplied Sanity project `d5k303l7`, dataset `production`.
The website, Railway health endpoint and Studio are live; the dataset is PUBLIC.
The [dated audit](production-status-2026-10-18.md) separates verified behavior from
unverified roles, secrets, contact delivery and publishing hooks. Exact deployed
commit metadata is still required. Updating this runbook does not authorise deployment.

See [staging/production variables](environment-staging-production.md) for the
complete configuration matrix and disabled-feature prerequisites.

## Application boundary

- `apps/ttngh`: Astro static public site, no visitor authentication.
- `apps/ttngh/studio`: separate Sanity Studio; managed editor authentication.
- `services/ttngh-api`: Express on Railway; enquiry delivery and signed publish hook. No contact-message database.
- Existing Faako theme/UI, API client, validation, security headers, request IDs and logging are reused.
- Architecture: [Phase 2 decision](phase-2-architecture.md). Evidence and remaining dependencies: [implementation report](phase-2-implementation.md).

## Local commands

From the `faako-system` repository root (commands target TTNGH, not REEBS):

```sh
pnpm --filter @faako/ttngh dev
pnpm --filter @faako/ttngh test
pnpm --filter @faako/ttngh build
pnpm --filter @faako/ttngh test:seo
pnpm --filter @faako/ttngh-api test
pnpm --filter @faako/ttngh-studio test
pnpm --filter @faako/ttngh-studio build
```

Studio requires its public project/dataset identifiers. API integration tests use local sockets and mocked providers, not real mail. Website development uses port 5177; preview uses 4177. Do not run two TTNGH servers on the same port. Confirm the server's working directory before diagnosing stale local content.

## Cloudflare static site

Use repository root as build root; build `pnpm --filter @faako/ttngh build`; output `apps/ttngh/dist`. Keep preview separate from production. Canonical origin is `https://thethrivingnetworkgh.org`. Both the exact production origin and `PUBLIC_SITE_INDEXABLE=true` are required for indexing. Leave false until launch approval. `/cms` is always noindex and excluded from the sitemap.

Static `_headers` and `_redirects` ship with the build. There is a real 404 fallback, not an SPA rewrite. The build adds only the configured exact HTTPS Railway origin to CSP connect-src. Verify actual deployed response headers: local Astro preview does not emulate Cloudflare headers.

The existing `scripts/hosting-policy.mjs` TTNGH deferral now has a stale rationale:
Cloudflare is live. Review and remove that exemption with its regression test in
a separate code change; no CI policy is changed by this documentation update.
Production currently allows indexing; the pages.dev alias also does. Verify
host-specific alias/preview controls, not only build-time environment defaults.

## Sanity and editor activation

1. Confirm organisation ownership and named owners for the existing project. The production dataset is PUBLIC; explicitly approve that policy and public-safe published fields. Do not assume a private dataset or change visibility without a reviewed decision.
2. Configure Studio identifiers and deploy the Studio separately using the approved Sanity account. Add only exact approved Studio/local development origins in Sanity CORS; do not permit wildcard credentialed origins.
3. Invite named editors with least privilege supported by the selected plan. Verify authentication-provider MFA, account recovery and a second organisational administrator. No shared passwords.
4. Set public Studio URL on the website. `/cms` is a minimal gateway linking to Studio. Sanity handles sign-in, account creation and recovery; signing up does not grant project membership.
5. Import and review the approved source content before activation. Do not point production at an empty dataset: CMS mode intentionally does not fall back to removed team members, partners or statistics.
6. Use a read-only server-side build token if the chosen dataset access policy requires authentication; the audited public dataset supports unauthenticated reads. Never put a token in browser variables. Set `TTNGH_CMS_REQUIRED=true`; its actual production setting remains unverified. Missing configuration, invalid publication data or provider failures stop the build.
7. Configure the signed publish hook below and prove publish/update/unpublish on staging.

## Signed publish hook

Flow: Sanity → Railway `POST /api/webhooks/sanity` → private Cloudflare Pages deploy hook → Astro rebuild → reviewed deployment.

Enable create/update/delete, with drafts and versions disabled. Use the nine types listed in the schema as the filter, excluding draft/version IDs. Do not filter only on the new publishState: withdrawals must rebuild too. Use this projection:

```groq
{
  "id": coalesce(after()._id, before()._id),
  "type": coalesce(after()._type, before()._type),
  "revision": coalesce(after()._rev, before()._rev),
  "projectId": sanity::projectId(),
  "dataset": sanity::dataset()
}
```

Set the same strong secret in Sanity and Railway. The API verifies the signature over the raw JSON, five-minute timestamp window, project/dataset/type and non-draft ID. It deduplicates body hashes for ten minutes in a bounded store and retries safely after a failed upstream hook request. A successful response means the build was requested, not that deployment succeeded. Monitor Cloudflare build completion separately.

Keep **one Railway replica**: rate limiting and webhook deduplication are process-local. A restart can request the same harmless rebuild again. A distributed store is required before scaling. Arrange an owner-controlled daily rebuild as well because upcoming/past labels are static at build time; no public unauthenticated cron endpoint is provided.

Source: [Sanity webhook configuration](https://www.sanity.io/docs/content-lake/webhooks).

## Railway enquiry activation

Use the monorepo root and `services/ttngh-api/railway.json`, not a standalone service-folder checkout. Node 22.12+; health path `/health`. Configure the listed secrets server-side. Never enable Node inspector.

1. Verify a Turnstile widget for exact TTNGH hostnames; its action is `ttngh_enquiry`. Production rejects test secret-key patterns.
2. Configure Resend and the approved receiving inbox, following [email operations](email-operations.md).
3. Set exact browser origins; HTTPS only in production. No credentials/cookie authentication is used.
4. Verify Railway's actual proxy chain and forwarded-header overwrite behaviour. Only then set explicit trusted proxy CIDRs. Default no trust is conservative but can rate-limit all users sharing a proxy; this must be tested before enablement. Add edge limits as defence in depth.
5. Keep one replica, turn on the service, then configure the public API origin and Turnstile site key in the Astro build. Missing either leaves the form disabled with direct contact alternatives.
6. Complete real staging submission, spam/expired-token, outage and delivery tests using non-sensitive test text. Approve retention and acknowledgement policy before enabling acknowledgement.

## Environment inventory (names only)

| Build/service | Names | Classification |
| --- | --- | --- |
| Public site | PUBLIC_SITE_URL, PUBLIC_SITE_INDEXABLE, PUBLIC_GA_MEASUREMENT_ID, PUBLIC_TTNGH_GOOGLE_CALENDAR_ID | Public, optional/configuration |
| Public site | PUBLIC_TTNGH_API_ORIGIN, PUBLIC_TURNSTILE_SITE_KEY, PUBLIC_TTNGH_STUDIO_URL | Public identifiers, never secrets |
| Astro build only | SANITY_PROJECT_ID, SANITY_DATASET, TTNGH_CMS_REQUIRED | Build configuration |
| Astro build only | SANITY_READ_TOKEN | Secret, read-only |
| Studio | SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET | Public identifiers |
| Railway | NODE_ENV, PORT, TTNGH_ALLOWED_ORIGINS, TTNGH_CONTACT_ENABLED, TURNSTILE_HOSTNAMES, TTNGH_TRUSTED_PROXY_CIDRS | Runtime configuration |
| Railway | TURNSTILE_SECRET_KEY, RESEND_API_KEY, SANITY_WEBHOOK_SECRET, CLOUDFLARE_BUILD_HOOK_URL | Secrets |
| Railway | TTNGH_MAIL_FROM, TTNGH_ENQUIRY_TO, TTNGH_ACKNOWLEDGEMENT_APPROVED, SANITY_PROJECT_ID, SANITY_DATASET | Approved operational configuration |

GA4 uses the shared lifecycle documented in `docs/architecture/google-analytics-architecture.md`. The local mocked browser check does not replace a post-deployment Tag Assistant and GA4 Realtime/DebugView receipt check.

## Rollback

Retain the last verified Cloudflare deployment. A failed build must not replace it. Roll back the site deployment and Railway service revision independently. Disable the enquiry flag during delivery incidents, rebuild without form configuration if necessary, and keep verified direct contact details visible. For incorrect/withdrawn content, unpublish and rebuild; a code rollback alone does not retract CMS content. Do not restore withdrawn consent by reimporting old data.

Export the Sanity dataset/assets to approved encrypted storage before migrations; restrict export access and rehearse restore into a separate dataset. Public dataset visibility is not a substitute for backup access controls. Named owner, schedule and retention require client approval. Rotate provider tokens and publish secrets through their provider consoles and secret stores; never put them in this document.
