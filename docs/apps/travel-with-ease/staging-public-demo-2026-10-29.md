# Travel With Ease — interactive public website demo in staging

## Scope and separation

The public Astro website provides `/demo` for approved staging review. It contains sample package selections, interactive FAQ/journal, travel footprint, and an enquiry form. The main staging homepage remains backed by the approved public content snapshot, separate from the sample journey content.

The demo is **enabled only** when:
- The **Cloudflare Pages TWE website build** has `PUBLIC_APP_ENV=staging`
- `PUBLIC_STAGING_DEMO_ENABLED=true`
- `PUBLIC_API_BASE_URL` is an **exact HTTPS origin** of the **staging Railway TWE API**; production API origin is rejected

Local development retains the existing offline/no-send demo. Production `/demo` retains the unavailable-page redirect and will not build the sample demo contents, even if a feature flag is accidentally set.

The demo page uses `noindex,nofollow`. Staging site `robots.txt` disallows all crawling. No sample content is added to the approved production publication snapshot.

## Protected staging staff portal demo

The existing React/Vite CMS has a synthetic local demo adapter. This change permits the **same demo** at
`https://portal-staging.travelwitheasegh.com/demo`, without creating real staff accounts.

- Set `TWE_STAGING_PORTAL_DEMO_ENABLED=true` **only** in the existing **staging Railway TWE API** environment.
- The existing API's `build-cms.mjs` bundles the portal with `APP_ENV=staging`; both the bundled Vite feature permission and the Express route are independently gated by the staging flag.
- **Cloudflare Access still verifies the assertion** before the portal HTML, CSS or JS is served. Its approved Google/MFA policy remains in force. The synthetic demo session does **not** establish a backend staff session.
- Only `GET/HEAD /demo` and `/demo/` serve the portal demo shell. All other CMS API access continues through the regular session and permission checks.
- Demo enquiry-status updates and content-draft edits are simulated in memory and reset on reload. Publishing, uploading real media and granting staff privileges remain unavailable; no network API requests are made for demo actions.
- Visitors can leave demo mode for `/` to use the real staff login.
- There is **no** additional Railway service, custom domain or Cloudflare Pages project.

The two demos serve distinct purposes: public-website demo enquiries are **real, marked test rows in staging PostgreSQL**, visible in the **real, provisioned** staging CMS. The portal `/demo` is a **synthetic UI simulator**, and does not read those real records. Do not mistake an in-memory demo status update for a changed client record.

## Enable on staging (no extra Railway service)

1. In the public website's Cloudflare Pages project `twe-concierge`, choose the **staging build/deployment environment**. Set `PUBLIC_APP_ENV=staging`, `PUBLIC_STAGING_DEMO_ENABLED=true`, `PUBLIC_API_BASE_URL=https://<your-staging-API-host>` and `PUBLIC_SITE_INDEXABLE=false`. Confirm the exact build environment; a Pages preview deployment is not automatically a staging environment.
2. In the **existing Railway TWE API staging service**, set `TWE_DEMO_ORIGIN=https://staging.travelwitheasegh.com` and `TWE_STAGING_PORTAL_DEMO_ENABLED=true`. The demo origin must already be included in `ALLOWED_ORIGINS`. Keep existing Access configuration pointing to `https://portal-staging.travelwitheasegh.com`.
3. Deploy the feature branch to a staging preview after review and green checks. **Do not automatically promote it to production**. No database migration or new database/service is required. Never point the staging website at the production API. For this Railway API configuration, staging must **rebuild the portal assets** (not merely restart the old image) so the Vite flag is enabled.
4. Visit `https://<your-staging-public-website-host>/demo` and select a sample package, view the map and FAQ accordion, enter test contact details, explicitly consent, then submit a test enquiry.
5. Confirm a receipt reference and find the record in the **staging CMS → Enquiries** inbox labelled `[STAGING DEMO]` with `source=staging_demo`. It is saved to `twe.enquiries` under the staging organisation; it is **not** a booking, quote or payment, and **does not** enqueue `twe.notification_outbox` or send an email.
6. Confirm missing/invalid fields show validation errors, repeat submissions are bounded by the API rate limiter, and a missing API response is reported as an error rather than a success.
7. Open `https://portal-staging.travelwitheasegh.com/demo` after Cloudflare Access login. Confirm synthetic dashboard, enquiry updates, content edits and navigation work without an application staff account; test records reset after reload. Check `https://portal-staging.travelwitheasegh.com/` still uses the real staff login and that `/demo` remains inaccessible without verified Cloudflare Access.\n8. Verify the production site does not publish the demo UI, robots/sitemap do not index it, and the production API rejects `/api/public/demo-inquiries`.

## Security and privacy

- The API accepts `POST /api/public/demo-inquiries` only in `APP_ENV=staging` with a configured `TWE_DEMO_ORIGIN`, **exact Origin matching**, the existing CORS allowlist, per-IP rate limits, validated input, honeypot and required consent.
- Record scope is server-owned (staging organisation). Request fields cannot set organisation, status, record source or privileges.
- Test data is real staging data, visible only to authorised CMS roles. Use testing identities and minimise personal details. Do not enter sensitive travel documents, credentials or payment information.
- API logging does not include submitted personal data. There is no automatic outbound notification from this demo endpoint. Approved staff can view/respond using their normal processes.
- The normal public enquiry API is unchanged, and the CMS remains on its existing Railway service behind Access.

## Verification and rollback

Build/test: `pnpm --filter @faako/travel-with-ease-web lint`, `typecheck`, `build`, `test`; `pnpm --filter @faako/travel-with-ease-api lint`, `typecheck`, `test`, and the required isolated PostgreSQL tests in CI.

Rollback: disable `PUBLIC_STAGING_DEMO_ENABLED` on the staging website and redeploy. Optionally remove `TWE_DEMO_ORIGIN` and set `TWE_STAGING_PORTAL_DEMO_ENABLED=false` on the staging API and **rebuild/redeploy** to disable both demo endpoints. Existing test records remain in staging pending normal controlled retention/cleanup; **do not** delete the whole database or mix them into production.
