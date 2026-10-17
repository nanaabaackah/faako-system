# TTNGH staging and production configuration

Updated 17 October 2026. These are configuration names and non-secret examples,
not credentials. No provider settings were changed in this pass.

Set website variables in the hosting project's **build environment**, with
separate preview/staging and production values. Rebuild after changing them.
Set API variables privately in the dedicated TTNGH Railway service. Never copy
API secrets into the website or Studio environment. Do not reuse REEBS values.

## Website — `apps/ttngh/.env.example`

| Variable | Staging | Production |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Actual approved HTTPS staging origin | `https://thethrivingnetworkgh.org` |
| `PUBLIC_SITE_INDEXABLE` | `false` | `true` only for the approved public launch |
| `SANITY_PROJECT_ID` | `d5k303l7` | `d5k303l7` |
| `SANITY_DATASET` | Separately provisioned staging dataset; do not assume one exists | `production` |
| `SANITY_READ_TOKEN` | Secret read-only token scoped to staging content | Secret read-only production build token |
| `TTNGH_CMS_REQUIRED` | `true` when testing CMS-backed builds | `true` once approved CMS content is ready |
| `PUBLIC_TTNGH_STUDIO_URL` | Approved HTTPS staging Studio URL | Approved HTTPS production Studio URL |
| `PUBLIC_TTNGH_API_ORIGIN` | Exact staging API HTTPS origin | Exact production API HTTPS origin |
| `PUBLIC_TURNSTILE_SITE_KEY` | Public widget key allowing staging hostname | Public widget key allowing production hostname |
| `PUBLIC_GA_MEASUREMENT_ID` | Blank, or a separate test GA4 property | `G-L1DK9DHYT8`; visitor consent still required |
| `PUBLIC_TTNGH_GOOGLE_CALENDAR_ID` | Blank or approved public test calendar ID | Optional approved public organisation calendar ID |

The staging hostname, API origins, Studio URLs, widget keys and inbox still need
to be supplied/verified. Do not paste the literal examples as active values.

For a deliberate repository-content-only build, leave **both** Sanity identifiers
and the token blank and set `TTNGH_CMS_REQUIRED=false`. Setting that flag false
does **not** disable an otherwise configured CMS. An empty/unavailable/malformed
CMS must not silently replace approved content. Leave API origin and widget key
blank until contact delivery is verified; the form then clearly stays disabled.

## Sanity Studio — `apps/ttngh/studio/.env.example`

| Variable | Staging | Production |
| --- | --- | --- |
| `SANITY_STUDIO_PROJECT_ID` | `d5k303l7` | `d5k303l7` |
| `SANITY_STUDIO_DATASET` | Provisioned staging dataset | `production` |

Studio uses managed Sanity sign-in and project invitations. No passwords or write
tokens belong in these public variables. Confirm allowed Studio origins in Sanity.

## Railway API — `services/ttngh-api/.env.example`

Use environment-specific values, secrets, allowed hosts and build hooks.

| Variable | Value/purpose |
| --- | --- |
| `NODE_ENV` | `production` on hosted staging and production |
| `PORT` | Railway-provided port; `5180` for local use |
| `RAILWAY_REPLICA_COUNT` | `1` while request limits are in-memory |
| `TTNGH_ALLOWED_ORIGINS` | Exact comma-separated website HTTPS origins; no paths, trailing slash or wildcard |
| `TTNGH_CONTACT_ENABLED` | `false` until the environment's contact end-to-end checks pass |
| `TURNSTILE_SECRET_KEY` | **Secret** matching the public widget key |
| `TURNSTILE_HOSTNAMES` | Allowed website hostnames only, without `https://` |
| `RESEND_API_KEY` | **Secret** transactional email send key |
| `TTNGH_MAIL_FROM` | Verified plain sender email address |
| `TTNGH_ENQUIRY_TO` | Approved receiving inbox; use an isolated test inbox in staging |
| `TTNGH_ACKNOWLEDGEMENT_APPROVED` | `false` until acknowledgement wording/policy approval |
| `TTNGH_TRUSTED_PROXY_CIDRS` | Verified Railway ingress/proxy ranges, never `*` |
| `SANITY_PROJECT_ID` | `d5k303l7` |
| `SANITY_DATASET` | Dataset corresponding to this environment |
| `SANITY_WEBHOOK_SECRET` | **Secret** matching that dataset's signed webhook |
| `CLOUDFLARE_BUILD_HOOK_URL` | **Secret** complete deploy-hook URL for the matching site environment |

### Payments: foundation only, not ready for activation

| Variable | Current safe configuration |
| --- | --- |
| `TTNGH_DONATIONS_ENABLED` | `false` |
| `TTNGH_LIVE_PAYMENTS_APPROVED` | `false` |
| `PAYSTACK_MODE` | `test` |
| `PAYSTACK_SECRET_KEY` | Blank until an account exists; then an environment-matched **secret** |
| `TTNGH_DATABASE_URL` | **Secret** connection URL for dedicated TTNGH PostgreSQL; isolated staging database |
| `TTNGH_DONATION_RETURN_URL` | Approved website origin plus `/donate/return`; not a functioning checkout guarantee |

Donation routes/worker activation and payment validation remain outstanding.
Setting these variables does not complete the integration. Keep both payment
flags false. The approved GH₵1 minimum/no organisation-defined maximum is code
configuration, not an additional environment variable.

## Provider setup, not additional website variables

### GA4 verification

The approved TTNGH measurement ID is `G-L1DK9DHYT8`. It is already present in
the local website `.env`. Set `PUBLIC_GA_MEASUREMENT_ID=G-L1DK9DHYT8` in the
production website host's build settings and rebuild; a local `.env` does not
configure the hosted site. Do not additionally paste the standalone Google tag
snippet into the layout: `AnalyticsConsent.astro` uses the shared Faako tag loader.

The tag is blocked until analytics opt-in; advertising remains denied. Repeated
consent events do not duplicate the current page view. URL queries/fragments are
removed from the explicit page-view payload. Do Not Track is respected.

Run `TTNGH_QA_URL=http://127.0.0.1:4189 node apps/ttngh/tests/analytics-browser-qa.cjs`
against a local build configured with the ID to check the integration with all
Google requests mocked. This does not verify receipt in Google's property.
After deployment, allow analytics in a fresh browser session without a blocker
or Do Not Track and check GA4 Realtime/Tag Assistant. Confirm the web stream's
URL matches the production domain. Keep staging analytics blank to avoid
polluting the production property. Hosted receipt remains a separate check.

DNS, Search Console verification, SPF/DKIM/DMARC, email routing, Sanity invitations,
Turnstile hostname allowlists, hosting branch configuration and WAF settings live
in their provider consoles. No public Paystack key is required for the planned
hosted checkout. Do not add secrets to `PUBLIC_` or `SANITY_STUDIO_` variables.

Before promotion, verify the staging build, contact delivery with synthetic data,
consent-gated analytics, CMS rebuild hook, production hostname/indexability and a
rollback deployment. No production push is authorised at present: the user's
latest instruction is to finish local checks only.
