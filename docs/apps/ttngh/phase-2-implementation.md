# TTNGH Phase 2 implementation handover

13 October 2026 · `feat/ttngh-phase-1-refresh` · `/private/tmp/faako-ttngh-phase1`

## Status

The Phase 2 implementation is locally built and tested. It is **not live or operationally signed off**: the client confirmed that Sanity, Railway, Turnstile and the verified email sender have not yet been created. No merge, deployment, DNS change, real email delivery or payment activation was performed. REEBS applications and private environment files were not changed.

## Delivered

| Area | Implementation | Remaining activation |
| --- | --- | --- |
| CMS | Separate Sanity Studio with nine document types: settings, homepage, programmes, events, news, resources, team, impact statistics and partners. Editor and build validation enforce publication, source/review and consent requirements. | Create project/dataset/Studio; migrate and approve content; invite scoped editors and verify account security. |
| Public content | Astro fetches published content at build time with a private server-side token. Programme, event, news and resource detail routes, metadata, search and structured data use approved records. Partial configuration and provider failures stop the build. | Configure preview first and validate the real content migration before production. |
| Events | Upcoming/past listings, detail pages, native calendars on Home/Events, downloadable ICS and Event structured data. Google Calendar is secondary and loaded on request. No invented dates. | Publish approved event records and supply the approved public calendar if required. |
| Contact | Shared API client; explicit Turnstile activation; accessible pending/success/failure states; input retained after failure. Form remains disabled when providers are unconfigured. | Supply exact API origin and public widget key after server setup. |
| API | Separate Railway-ready Express service; strict validation, exact CORS origins, body/rate limits, server-side Turnstile checks and fixed-recipient transactional email. Shared request IDs, safe error envelopes and redacted logs. No message database. | Configure secrets privately, approve receiving inbox and retention, verify proxy topology, then test real delivery. |
| Publishing | Signed, fresh Sanity webhook triggers a private Cloudflare build hook; bounded duplicate handling and failure retry behaviour. | Configure real webhook/project/dataset and confirm publish/update/withdrawal rebuilds. |
| Editor access | Noindexed `/cms` entry provides managed Sanity sign-in, invitation/account guidance and password recovery. Creating an account does not grant project access. | Set the approved Studio URL and test invited editor access/recovery. |
| Email and privacy | Separate incoming routing and outgoing sender runbooks; provider-aware privacy notices and consent-aware analytics guidance. | Client approval of legal wording, recipient, retention, DNS and analytics settings. |

## Visual follow-up

- Restored the existing Peace display font (Kaftan Calligraphy) for H2 headings, with Thriving Pink on white and appropriate contrast on coloured panels. Montserrat body text remains.
- Reduced the sticky navigation height while preserving mobile tap targets and the homepage overlay composition.
- Rebuilt About's story into a photograph and concise narrative, with clearer founder, mission/vision and direction sections. Shared hero, section navigation, gutter and coloured-section rules improve consistency across inner pages.
- Reused Faako card treatments and retained the pink footer composition, large Get in touch treatment, search, social/navigation/legal links and shared attribution.
- Public UI icons use a static Iconsax wrapper. Button/link arrows use the official [ArrowRight4 SVG](https://github.com/lusaxweb/iconsax/blob/master/static/Iconsax/Svg/All/outline/arrow-right-4.svg), because the installed package does not export that variant. Brand logos remain brand logos.
- Centralised hover, active and keyboard-focus feedback for links, buttons, disclosure summaries and button-role controls. Transitions are deliberately gentle; disabled controls are excluded and reduced-motion preferences remove movement.
- Existing scroll reveals and slower Scroll Expand behaviour remain. Photography remains from the reviewed, consent-approved library; no new stock images or inferred captions were introduced in this follow-up. See [image inventory](phase-1-image-inventory.md) and [visual placements](visual-followup.md).

## Verification

- Clean, non-fixture Astro build: **15 pages**. Built-site checks pass for metadata, one H1, JSON-LD, local assets and destinations.
- **48 automated tests passed:** website 21, Studio 9, API 18. API tests use isolated HTTP servers and mocked providers, not live email or Turnstile.
- Separate Studio production build passed with non-secret fixture configuration.
- Synthetic CMS build: **19 pages**, exercising all content types and dynamic routes; built-site checks passed. Fixture browser QA passed across **18 routes at 320, 390, 768 and 1440px**.
- Final non-fixture browser QA passed across **14 routes at the same four widths**, including disabled inputs/submission when service configuration is absent and shared hover/focus/reduced-motion feedback.
- Browser checks cover overflow, sticky navigation, mobile menu/Escape, section links, display font, hover/focus/reduced-motion behaviour, noindexed CMS access, interaction-gated security checks and mocked contact success/failure states.
- Focused About/story desktop screenshots were visually inspected. A clean non-fixture build was restored afterwards; the fixture token, CMS endpoint and widget key are absent from its output. `/cms` is excluded from the sitemap.
- Lockfile validation confirms unrelated workspace importers and all existing dependency resolutions are unchanged. Whitespace checks pass.

Reproducible commands (from this worktree):

```sh
pnpm --filter @faako/ttngh build
pnpm --filter @faako/ttngh test:seo
pnpm --filter @faako/ttngh test
pnpm --filter @faako/ttngh-studio test
pnpm --filter @faako/ttngh-api test
node apps/ttngh/tests/browser-qa.cjs
```

Browser QA requires a running local preview and Playwright/Chromium; `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point to an existing local installation. Synthetic CMS testing is explicitly opt-in through `tests/fixture-loader.mjs`; do not deploy a fixture build.

## Remaining gates before launch

1. Create the client-owned services and configure preview using [deployment instructions](deployment.md). Keep credentials out of chat and version control.
2. Migrate approved CMS content, validate image crops and public fields, and test editor roles, invitations, recovery and MFA. A build-time withdrawal must also rebuild the public site.
3. Verify Railway's proxy configuration before enabling contact delivery. The current bounded in-memory rate limiting/deduplication is intentionally single-replica; scaling requires a shared store.
4. Approve inbox routing, sender domain, retention/access policy and legal notices; configure and verify SPF/DKIM/DMARC using actual provider instructions. Test contact delivery, outage behaviour and any approved acknowledgement with real providers.
5. Validate publish/update/delete hooks, preview indexing protection, deployed headers and rollback. Current CSP retains pre-existing inline script/style allowances; further tightening and deployed compatibility testing remain production-phase work.
6. Complete native Safari, real-device, assistive-technology and production performance checks. Local Chromium checks are not a substitute for these.
7. The final production-readiness/Paystack brief is a subsequent phase; payments and live production acceptance are not claimed here.

Supporting runbooks: [architecture](phase-2-architecture.md), [content operations](content-operations.md), [email operations](email-operations.md), [analytics](analytics-plan.md), [launch checklist](launch-checklist.md). Environment variable names and ownership are documented in the deployment runbook; secret values are intentionally absent.
