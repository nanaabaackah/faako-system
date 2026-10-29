# Travel With Ease — interactive public website demo in staging

## Scope and separation

The public Astro website provides `/demo` for approved staging review. It contains sample package selections, interactive FAQ/journal, travel footprint, and an enquiry form. The main staging homepage remains backed by the approved public content snapshot, separate from the sample journey content.

The demo is **enabled only** when:
- The **Cloudflare Pages TWE website build** has `PUBLIC_APP_ENV=staging`
- `PUBLIC_STAGING_DEMO_ENABLED=true`
- `PUBLIC_API_BASE_URL` is an **exact HTTPS origin** of the **staging Railway TWE API**; production API origin is rejected

Local development retains the existing offline/no-send demo. Production `/demo` retains the unavailable-page redirect and will not build the sample demo contents, even if a feature flag is accidentally set.

The demo page uses `noindex,nofollow`. Staging site `robots.txt` disallows all crawling. No sample content is added to the approved production publication snapshot.

## Enable on staging (no extra Railway service)

1. In the public website's Cloudflare Pages project `twe-concierge`, choose the **staging build/deployment environment**. Set `PUBLIC_APP_ENV=staging`, `PUBLIC_STAGING_DEMO_ENABLED=true`, `PUBLIC_API_BASE_URL=https://<your-staging-API-host>` and `PUBLIC_SITE_INDEXABLE=false`. Confirm the exact build environment; a Pages preview deployment is not automatically a staging environment.
2. In the **existing Railway TWE API staging service**, set `TWE_DEMO_ORIGIN=https://<your-staging-public-website-host>`. The value must be an exact origin (no path or slash), and must already be included in `ALLOWED_ORIGINS`.
3. Deploy the feature branch to a staging preview after review and green checks. **Do not automatically promote it to production**. No database migration or new database/service is required. Never point the staging website at the production API.
4. Visit `https://<your-staging-public-website-host>/demo` and select a sample package, view the map and FAQ accordion, enter test contact details, explicitly consent, then submit a test enquiry.
5. Confirm a receipt reference and find the record in the **staging CMS → Enquiries** inbox labelled `[STAGING DEMO]` with `source=staging_demo`. It is saved to `twe.enquiries` under the staging organisation; it is **not** a booking, quote or payment, and **does not** enqueue `twe.notification_outbox` or send an email.
6. Confirm missing/invalid fields show validation errors, repeat submissions are bounded by the API rate limiter, and a missing API response is reported as an error rather than a success.
7. Verify the production site does not publish the demo UI, robots/sitemap do not index it, and the production API rejects `/api/public/demo-inquiries`.

## Security and privacy

- The API accepts `POST /api/public/demo-inquiries` only in `APP_ENV=staging` with a configured `TWE_DEMO_ORIGIN`, **exact Origin matching**, the existing CORS allowlist, per-IP rate limits, validated input, honeypot and required consent.
- Record scope is server-owned (staging organisation). Request fields cannot set organisation, status, record source or privileges.
- Test data is real staging data, visible only to authorised CMS roles. Use testing identities and minimise personal details. Do not enter sensitive travel documents, credentials or payment information.
- API logging does not include submitted personal data. There is no automatic outbound notification from this demo endpoint. Approved staff can view/respond using their normal processes.
- The normal public enquiry API is unchanged, and the CMS remains on its existing Railway service behind Access.

## Verification and rollback

Build/test: `pnpm --filter @faako/travel-with-ease-web lint`, `typecheck`, `build`, `test`; `pnpm --filter @faako/travel-with-ease-api lint`, `typecheck`, `test`, and the required isolated PostgreSQL tests in CI.

Rollback: disable `PUBLIC_STAGING_DEMO_ENABLED` on the staging website and redeploy. Optionally remove `TWE_DEMO_ORIGIN` from the staging API and redeploy to disable the public test endpoint. Existing test records remain in staging pending normal controlled retention/cleanup; **do not** delete the whole database or mix them into production.
