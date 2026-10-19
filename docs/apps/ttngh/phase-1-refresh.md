# Phase 1 implementation report

> Historical record. Status reconciled 19 October 2026: use the
> [18 October production evidence](production-status-2026-10-18.md) for current
> service readiness. Branch/worktree, deployment, image-placement, typography and
> provider-status statements below describe their original milestone, not current
> operations. The later editorial refresh supersedes earlier visual treatments.

Date: 2026-10-12. Branch: `feat/ttngh-phase-1-refresh`, based on local `develop` at `5d09f1c0b`.
Isolated worktree: `/private/tmp/faako-ttngh-phase1`. No merge, deployment, CMS, payment collection or
production contact API is included. Other applications and shared packages are unchanged.

## Design and mobile standards

- White/black editorial layouts with pink emphasis; no normal full-viewport sections.
- Montserrat headings/body; local Kaftan display face reserved for selected brand expressions.
- Homepage: hero, introduction, programme rows, impact, current activity, participation CTA,
  publishing introduction, partners and existing footer. Two hero actions, no invented upcoming event.
- Inner heroes use concise copy and one contextual photo. Team and legal introductions are image-free.
- At 390px content reflows without fixed-width cards. Team portraits become compact rows;
  ordinary content remains visible immediately, without simulated loading or blur reveals.
- Main links use native anchors. Mobile navigation uses native details/summary, Escape and outside-click
  dismissal. Search remains useful for programme/support/team/legal destinations and is retained in
  the header/mobile menu and footer; it searches a local curated index, not a remote service.
- Shared Faako theme/UI boundaries and `SharedFaakoFooter` remain. Site-level card classes now use
  restrained outlines rather than large glass surfaces. Button labels/arrows retain their paired treatment.

## Footer decisions

| Classification | Decision |
| --- | --- |
| Retain as-is | Pink identity, large Get in touch, contact/search area, socials, navigation, legal links and SharedFaakoFooter attribution |
| Refine | Readable type sizes, compact mobile stacking, alignment and link grouping |
| Simplify slightly | Remove forced viewport height; allow content to determine height |
| Accessibility/performance fix | 44px navigation/legal/back-to-top targets and visible keyboard focus |

The footer has not been replaced with a black footer or a new generic layout.

## Motion and retired code

Keep ScrollExpandSection for a meaningful CTA, normally once per page. Shorter scroll track, responsive
height, off-screen observer, passive scroll, requestAnimationFrame and cleanup limit work. Reduced
motion reveals the full content; keyboard focus reveals it; a no-JavaScript fallback is readable.

Retired: GradientWaves/OGL rendering components, SectionGradientWaves and stylesheet, generic
ScrollReveal, artificial PageLoadingState, ProfileCard tilt implementation, old homepage CSS partials,
unused homepage presentation data and duplicated partner marquee. Event photos use a user-controlled,
keyboard-focusable horizontal gallery. Existing dependencies were not broadly removed from the shared
lockfile; OGL is no longer imported into this site's rendering path.

## Photography and content safety

See the [source/placement/asset inventory](./phase-1-image-inventory.md). Ten new reviewed photographs
have optimized responsive variants; founder/team/partner assets were checked against the current Drive
library before retention. School photos are not used to illustrate counselling clients or support-group
attendance. No identities, diagnoses, locations or dates were inferred from a photograph.

Existing company-profile facts and programme descriptions remain the content basis. Homepage impact
numbers explicitly cite that profile rather than claiming live totals. News remains an honest publishing
placeholder. The contact form prepares an email-app handoff only; it is not described as a secure backend
submission or a bot-proof service. Sensitive medical information is discouraged.

## SEO/AEO architecture

- Approved canonical origin: `https://thethrivingnetworkgh.org`.
- Fail-closed indexing: explicit `PUBLIC_SITE_INDEXABLE=true` plus exact production origin required.
  Preview metadata is noindex/nofollow and generated robots.txt disallows crawling.
- Unique titles/descriptions, one H1, social metadata, sitemap and preserved public page paths.
- NGO/WebSite/WebPage/BreadcrumbList and visible FAQs retained. Stable organisation description.
  Team Person schema reflects the named people displayed on the page.
- Article/Event preparation helpers emit nothing for unapproved/incomplete records. No speculative
  event dates, reviews or articles. Mental-health guidance still needs named ownership, qualified review,
  review dates, sources and service/urgent-support boundaries before publication.
- Added `pnpm --filter @faako/ttngh test:seo` after build for metadata, H1, JSON-LD and local destinations.

## Verification

Production build and five unit tests pass. Targeted ESLint checks cover changed JavaScript helpers,
data and test scripts. No standalone Astro lint command is configured; build success is not a full
TypeScript/semantic accessibility audit.

| Check | Result |
| --- | --- |
| Astro production build | Passed: 13 HTML pages plus generated robots.txt and sitemap |
| Unit tests | 5 passed: app metadata, theme mapping, calendar privacy boundary, indexing, schema gating |
| Built-site SEO assertions | Passed across all 13 HTML pages: unique titles/descriptions, one H1, canonical/OG, valid JSON-LD, local asset and link destinations |
| Responsive Chromium | All 12 content pages at 390, 430, 768, 1024 and 1440px: no document horizontal overflow or broken images in the checked build |
| Keyboard/interactions | Mobile menu, Escape, site-search filtering/dismissal, focus-triggered CTA reveal and email-app handoff passed; no page errors in this flow |
| Reduced motion | Scroll Expand opens fully with no clipping; global motion override retained |
| Visual inspection | Home desktop/mobile, About desktop, Drive contact sheets, team identity mapping and mobile CTA inspected |
| Source checks | Targeted ESLint passed; git diff whitespace check passed |

QA corrected contact-page overflow at 1024px, a duplicate 404 description, a home-impact contrast
cascade conflict, and search Escape/focus restoration. Hidden controls explicitly respect the hidden
attribute. Contact validation was exercised locally without sending an email or submitting personal
information to a server. External link availability, real-device Safari, screen-reader testing, measured
CLS/Lighthouse and full WCAG auditing remain launch checks rather than claimed completed results.

## Changed-file map

- `src/pages/`: homepage composition and contextual inner-page image selections; 404 description;
  team people metadata; new build-time robots route.
- `src/components/`: navigation/search, PageHero, EditorialImage, TeamGrid, partner row, calendar,
  gallery, Scroll Expand and small footer/FAQ refinements.
- `src/styles/`: shared semantic tokens/typography/layout, responsive page rules and footer refinements;
  obsolete animation and homepage partials removed.
- `src/lib/`, `indexability.test.js`, `scripts/check-built-site.mjs`: SEO gates, publishing seams and checks.
- `public/images/refresh/`: ten selected Drive photos in three responsive sizes each.
- `docs/apps/ttngh/`: this report, image provenance, updated README/content operations/deployment notes.

Removed source remains recoverable from Git. Existing public photography URLs were not bulk-deleted.

## Remaining launch and Phase 2 work

- Cloudflare setup remains deferred; test real response headers, CSP and 404 behavior on an isolated preview
  before production. Enable indexing only after launch approval.
- No payment provider, backend contact delivery, CRM, CMS or private Google Calendar access was added.
- Configure only an approved public event calendar; loading remains explicitly consent-gated.
- Approved article/event publishing must add editorial ownership and review workflows; current helpers
  do not replace a CMS schema or clinical review.
- Verify local display-font licensing and final copy with TTNGH. Respect photo withdrawal requests.
- Browser checks use Chromium; native Safari/iOS and assistive-technology testing remain launch checks.
- Keep consent, analytics configuration, actual hosting disclosures and legal notices aligned with the
  eventual deployed services; Phase 1 does not certify legal compliance or guaranteed WCAG conformance.
