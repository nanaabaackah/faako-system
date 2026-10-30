# TWE editorial redesign — 2026-10-30

Implemented and locally verified; hosted release pending. This is not completion
of the broader website/CMS roadmap.

## Inspection and plan

Isolated branch `feat/twe-editorial-redesign`, baseline `origin/develop`
`d0ad7641b` (Google tag PR #119 merged). Main worktree's dirty TWE, Dev ERP,
TTNGH and shared-package edits were preserved and not copied into this release.

Inspected: product roadmap, design standard, implementation plan, env/staging
runbooks; web layout/routes/styles/components; approved release/media inventory;
shared ContentLink/Iconsax/footer/feedback; map geometry/aggregation; API enquiry
schemas/routes; CMS content schema/publication pipeline; portal hosting runbook;
Railway configuration and foundation workflow. References are stored outside
public assets in `docs/design-references/twe-redesign/`.

Plan: shared cinematic hero → editorial body/cream map → photo CTA → cinematic
enquiry/light footer → local browser/accessibility/regression checks → PR/CI →
staging UAT → production only after release gates.

## Changed files/components

- `CinematicHero.astro` and CSS: full viewport, CMS heading/body/image, responsive
  reviewed image sources, prioritised loading, actual logo/overlay navigation,
  text-then-Iconsax action. One solid navy scrim protects arbitrary photo contrast.
- `PublishedHome.astro`, `DemoWebsite.astro`, index/demo routes: same shared hero,
  map, CTA, enquiry/footer implementation. Local index now uses the reviewed release
  rather than a competing homepage. Explicitly unpublished hosted content stays closed.
- `ClosingCta.astro` and CSS: centred heading/copy, one rounded action and substantial
  three-photo composition. Only two approved photographs are available, so Kenya is
  deliberately reused with a different crop. No proprietary device art or captions.
  Existing supplied mockup assets remain on disk; none were deleted.
- `CinematicEnquiry.astro` and CSS: separate cinematic image scene, bounded desktop
  sticky copy, normal document scrolling and static mobile/reduced-motion fallback.
  Demo retains its working React/Faako test form below. A published Contact image
  controls the scene when supplied; otherwise reviewed TWE photography is used.
- `PublicFooter.astro` and CSS: light grouped navigation/contact/socials, actual
  logo, compact functional map, legal/preferences/Faako attribution, spacious
  clearing and oversized wordmark. Native desktop scroll animation progressively
  enhances opacity/translation; unsupported browsers show the static footer.
- `BaseLayout.astro`: opt-in overlaid header, closes menu after choosing a link;
  real homepage map/enquiry anchors work even while other pages remain unpublished.
- `TravelFootprint.astro`, editorial CSS: cream surface and grey neutral countries;
  original geometry, gold logarithmic bins, keyboard/tap details and equivalent
  server-rendered list preserved. Zanzibar is still part of Tanzania.
- Demo headings and published/journal typography align with the editorial system.
  Source is vertically formatted, with styling in dedicated CSS files.
- Browser/unit/output tests and foundation workflow cover the new design.

No new app dependency, auth/session/permission change, API contract, migration,
shared UI implementation, email routing or hosted data mutation. Follow-up requested
by the user adds the existing Faako `AnimatedLoadingState` skeleton to real portal
session/dashboard/content/media/enquiry/staff/system waits and website enquiry
hydration/submission/estimator waits. Static Astro content remains immediately
available; no artificial whole-page delay is introduced.

Also fixes the matching staging publishing privilege bug with a tenant/environment
transaction advisory lock, not broader database grants; see
[runtime lock investigation](./publication-runtime-lock-2026-10-30.md).

## Functional/content boundaries

The existing map is a Natural Earth SVG choropleth, not a static screenshot or a
tiled map. Roadmap §7 explicitly uses one combined total. There are no existing
route lines, status filters or destination popover cards to restyle. Adding those
would require a separately reviewed product/data-model change.

The published Contact page's native general/package forms are **still not
implemented**. The API has the legacy estimator and isolated staging demo endpoints.
This redesign does not fabricate estimator inputs or claim nonexistent submissions.
When Contact is unpublished, production actions lead to the verified WhatsApp contact
with an honest form-unavailable message. Completing native personalised/package forms
remains a launch blocker, not a passed redesign check.

No approved package collection is connected to the homepage. The bundled snapshot
only publishes Home; journal, policies and other business copy await Owner review.
Samples stay in `/demo`, which redirects in production. The CMS snapshot still
controls publication. No policy/draft was silently approved to fill a section.
GA retains privacy-publication, consent, DNT and environment restrictions.

## Local verification

- All TWE lint/type checks passed; Astro zero errors/warnings/hints.
- Web build + 22 tests passed: approved-only production, demo exclusion, staging
  configuration failures, consent, explicit arrows, map and redesign contracts.
- API 64 tests, portal 6 tests, shared UI 8 tests passed; portal build passed.
  Sandbox-blocked HTTP tests were rerun with local socket permission, not weakened.
- Fresh isolated PostgreSQL integration passed: migrations, tenant scope,
  enquiry/outbox atomicity, publication, activation/tutorial persistence, restart
  and logical restore. Neither hosted database was read or modified.
- Existing public browser suite passed at 320/390/768/1440: consent/single GA
  load/revoke/DNT, journal, no-JS and separate demo cookie preferences.
- New `scripts/check-redesign-browser.mjs` passed at 320/375/390/768/1024/1440:
  zero axe WCAG A/AA violations, no overflow, keyboard menu/Escape/focus, FAQ
  toggle, map details, mocked staging form failure/manual retry/success, no unsafe
  automatic retries, no provider traffic, no-JS disclosures/content. Included in CI.
- Visual evidence/remaining test gaps are recorded in root `design-qa.md`.
  Chrome touch emulation is not real-device Safari certification.

Baseline production asset comparison (same dependency checkout): before redesign
`_astro` JS 295,105 bytes / gzip 91,825; CSS 127,639 / gzip 21,008. Initial redesign
JS unchanged; CSS 135,070 / gzip 22,864. Removing unused device derivatives removes
1,614,664 generated WebP bytes; original supplied files remain preserved. The
subsequent shared skeleton usage tree-shakes in its existing renderer, so final
bundle figures must be recorded after that follow-up build, not assumed unchanged.

Normal local ports now run from the isolated branch, not the dirty main checkout:
website `http://localhost:4328/`, demo `/demo`, portal demo
`http://127.0.0.1:5188/?demo=1`. Restart from this branch's worktree with
`pnpm run dev:twe`. The local API launcher deliberately does not load hosted `.env`
credentials and binds loopback; hosted staff authentication is not simulated.

## Hosted observations — before deployment

Read-only HTTPS observations on 2026-10-30:

| URL | Observed | New design deployed? |
| --- | --- | --- |
| https://staging.travelwitheasegh.com/ | 200; previous design captured | No |
| https://portal-staging.travelwitheasegh.com/ | 302 to Cloudflare Access | No portal changes |
| https://staging-api.travelwitheasegh.com/readyz | 200 | No API changes |
| https://travelwitheasegh.com/ | 200 | No |
| https://api.travelwitheasegh.com/readyz | Railway 502 | Blocked |

Hosted authenticated enquiries/draft UAT is pending user verification: no signed-in
identity was available, and Access was not bypassed. No real enquiry, customer email,
publishing operation or database write was attempted. Foundation CI explicitly has
no deployment job; no Cloudflare Pages deploy binding or Railway CLI was available.
Actual provider branch/build settings and deployed SHAs still require verification.
A merge does not prove deployment.

## Configuration, release and rollback

No new variables. Preserve environment-isolated settings:

Cloudflare Pages develop→staging and main→production build/output settings were
confirmed by the user in this session. `twe-release` HTML metadata exposes only a
validated Git SHA from existing provider/build identifiers for deployed-source checks.

- Staging: `PUBLIC_APP_ENV=staging`, `PUBLIC_SITE_URL` staging public origin,
  `PUBLIC_SITE_INDEXABLE=false`, `PUBLIC_STAGING_DEMO_ENABLED=true`,
  `PUBLIC_API_BASE_URL` staging API origin (never production for demo).
- Production: `PUBLIC_APP_ENV=production`, `PUBLIC_SITE_URL` approved canonical
  origin, `PUBLIC_SITE_INDEXABLE` per approval, `PUBLIC_STAGING_DEMO_ENABLED=false`.
- Preserve configured `TWE_CONTENT_SNAPSHOT`, GA privacy/consent gates and secrets.

1. Merge scoped PR into develop only after required checks pass.
2. In the existing Cloudflare Pages project, confirm develop staging branch,
   monorepo root, build `pnpm --filter @faako/travel-with-ease-web build`, output
   `apps/travel-with-ease-web/dist`, and approved CMS snapshot settings. Trigger
   the existing deployment for the reviewed SHA; record provider ID/SHA.
3. Verify staging `/`, `/demo`, published routes/assets/headers, map/menu/FAQ,
   labelled test enquiries and authenticated portal UAT before promotion.
4. Resolve production API 502 with Railway deployment/health logs. Complete native
   enquiry scope and Owner publication reviews before claiming launch acceptance.
5. Review the full develop→main diff; obtain approval for unrelated changes.
   After staging and required checks pass, merge promotion PR and let the existing
   production Pages pipeline deploy; record ID/SHA. Read-only production smoke only.

Rollback: retain preceding successful provider artifact and approved snapshot before
promotion. Use the existing Pages deployment rollback control (staging first), or
revert the scoped commit through a reviewed PR/rebuild. Verify source SHA, asset
URLs, publication snapshot/marker, HTTPS and environment afterwards. No DB reversal
is needed; never reset data or roll back authentication/migration history.
