# TTNGH production-readiness audit — 28 November 2026

## Decision

**Overall readiness after the implementation follow-up: 82/100. Launch decision for the complete requested scope: NO-GO.**

The public visitor site and API are operational: production returned successful site and API health responses, the live calendar returned the expected 25 November board meeting, all local frontend/Studio/API tests passed, and a live-content build produced 22 valid pages. The reviewed Drive-to-R2 workflow is now integrated and its isolation, migration and approval gates pass locally; staging already has the required variable names configured. The complete requested scope is still blocked by authenticated Sanity draft preview/click-to-edit and by real staging execution of the media plan/migration/provider handoff. The patched Astro dependency is also not deployed from this audit branch.

No production mutation, form submission, migration or deployment was performed. The implementation is under review in PR #268; its TTNGH website and Studio workflow completed successfully at commit `de0210f12`.

## Scorecard

| Area | Score | Evidence summary |
| --- | ---: | --- |
| UI/UX and content | 14/15 | Milestones now extend the existing impact section, while dedicated news and resource sections give the homepage a clearer evidence and content hierarchy. |
| Responsive behaviour and accessibility | 9/10 | Calendar and gallery/news browser QA passed from 320/375 through 1440 px; keyboard/error/empty/XSS states covered; mobile cookie notice reduced; no current Safari or screen-reader session. |
| Sanity, preview and publishing | 8/15 | Publication safeguards and signed rebuild webhook exist; Studio authoring UX improved and upgraded to 6.25.0; no secure draft preview or click-to-edit. |
| Events and calendar | 9/10 | Live API data and local responsive/keyboard states verified; no provider-side edit was made. |
| Drive/R2 media | 6/10 | The gated workflow is integrated and 65 API/media tests pass; staging variables exist, but the isolated migration and real provider plan/sync/handoff have not run. |
| API, enquiries and integrations | 9/10 | Health reports enquiries ready; 57 API tests passed; origin, Turnstile, persistence and outbox controls verified without a real submission. |
| Security and privacy | 13/15 | Strong API controls and deployed headers; critical Astro advisory fixed locally; Studio upgraded; CSP still permits inline code. |
| Performance, SEO and analytics | 4/5 | 22-page metadata/link/JSON-LD check passed; active impact imagery now uses responsive WebP assets; build assets remain about 15 MB and no current field-CWV run was available. |
| Deployment, CI and monitoring | 5/5 | The path-scoped website/Studio workflow passed on GitHub, including frozen install, deterministic build validation, Studio build and 390/768/1440 px browser QA. |
| Cleanup and maintainability | 5/5 | A dedicated cleanup audit records removed, retained and deferred candidates; provider and payment ownership decisions remain explicit follow-up work. |

## Findings by priority

### P0 — resolved locally

1. **Astro build/runtime advisories.** `pnpm audit --prod` identified critical AVIF optimization and later rendering advisories in 7.1.3. `apps/ttngh` now pins 7.3.8, the newest release compatible with the repository's Node 22.18 runtime. The remaining Astro findings are a low-severity dynamic-tag issue (no untrusted dynamic tag names were found) and an image-endpoint issue in `@astrojs/node` (TTNGH is a static build and does not use that adapter). Moving to 7.4.7+ requires upgrading the build runtime to Node 22.23.4+. This fix is not in production until reviewed, merged and deployed.

### P1 — launch blockers

1. **Secure preview is absent.** The current architecture intentionally exposes only published content and states that draft-preview sessions do not exist. There is no Sanity Presentation tool, authenticated preview session, draft-mode route or click-to-edit integration. A preview host's DNS/authentication could not be verified from repository access. Implement this as an explicit architecture/security change; do not expose draft queries to public clients.
2. **Drive-to-R2 workflow is integrated but not provider-verified.** The 28-commit implementation is merged into this audit branch, including nested traversal, immutable provenance, dry runs, approval gates and operator documentation. All 65 API/media tests pass, and Railway staging exposes the required variable names with values redacted. Deploy to isolated staging, run the separately approved media migration, then prove read-only Drive discovery, private R2 staging, idempotent reruns, approval and Sanity handoff before production use.
3. **Frontend/Studio CI was missing; resolved.** `.github/workflows/ttngh-site.yml` now adds frozen install, website/Studio tests, a deterministic CMS-fixture build, built-page validation, Studio build and homepage browser checks at 390/768/1440 px. GitHub Actions run `46158120012` passed at commit `de0210f12` after updating the declared Playwright runner for GitHub's Ubuntu 26 image.

### P2 — next release

1. **Turnstile still requires a manual button in production; fixed locally.** The audit branch removes the button, loads verification once the form approaches the viewport, retries once when connectivity returns, preserves server-side verification and updates the privacy disclosure. Unit and mocked browser checks pass. Preview verification and deployment remain required.
2. **CSP retains `'unsafe-inline'`.** This is a defence-in-depth gap, not evidence of an active exploit. Remove only after Astro/analytics/Turnstile compatibility is proven with hashes or nonces on preview.
3. **Studio dependency-tree follow-up.** Sanity Studio was upgraded from 6.18.0 to the current supported 6.25.0 with current direct React/styled-components releases; schema tests and the production Studio build pass. Continue monitoring transitive editor/build advisories rather than imposing unverified monorepo-wide overrides.
4. **Provider/dashboard evidence is incomplete.** Railway health and Cloudflare response headers were verified from production, but dashboard configuration, rollback controls, Cloudflare preview indexing and GitHub PR/check state require authenticated owner access.
5. **Motion assertion stabilized and independently verified.** The signature check now waits for the frame style to initialize and allows the animation frame to settle before measuring. The targeted 768 px normal/reduced-motion run passes locally, and the complete responsive browser job passed on GitHub.

### P3 — backlog

1. Measure current Core Web Vitals on representative mobile hardware and reduce oversized editorial photography where the quality trade-off is acceptable.
2. Decide whether dormant payment modules remain a tracked future capability or should be removed in a separate change. They are not mounted by the current API and were not deleted during this audit.
3. Recheck the reduced mobile cookie notice on physical iOS and Android devices; browser QA confirms the compact treatment does not create overflow.

## Implemented in this audit branch

- Replaced generic fallback homepage/mission language with Ghana- and service-specific copy.
- Expanded the homepage impact section with milestone highlights, and added dedicated latest-news and reviewed-resource sections. News falls back to verified local press-coverage records when no CMS news article is published; resources retain an honest archive/empty state rather than invented content.
- Consolidated the featured-event heading, description and CTA; changed the impact heading to a dated factual framing.
- Added Studio document groups, clearer field labels/help, advanced-SEO collapsing and safe defaults for review/consent/registration/verification states while preserving publication safeguards.
- Fixed calendar browser interception so the synthetic calendar route is tested rather than aborted.
- Fixed motion route discovery so the `events/stories` directory is not treated as a page, added targeted rerun controls and improved assertion evidence.
- Added regression tests for the copy, Studio defaults/groups and motion script behaviour.
- Pinned Astro 7.3.8 to remediate the critical and applicable higher-severity advisories while retaining Node 22.18 compatibility.
- Added automatic near-viewport Turnstile loading with updated privacy copy and browser assertions.
- Added TTNGH website/Studio CI, declared Playwright as TTNGH's QA dependency and removed unused `@faako/core`.
- Integrated the separately gated Drive-to-R2 media workflow and verified all 65 API/media tests without applying a database migration.
- Upgraded Sanity Studio to 6.25.0, stabilized scroll-expansion QA, reduced the mobile cookie notice and replaced three oversized/unused JPGs with responsive approved WebP assets.
- Added the separate [codebase cleanup audit](codebase-cleanup-audit-2026-11-28.md).

## Content inventory

| Location | Previous issue | Decision/status |
| --- | --- | --- |
| Home fallback hero | Broad “empowering” language | Rewritten to name mental-health education, counselling, advocacy, Tema and Ghana. |
| Homepage milestones | Only impact numbers and a deep-page milestone list | Integrated a four-item milestone block into the existing homepage impact section and linked it to the complete impact story. |
| Homepage news | Mixed with resources and disappeared when CMS news was empty | Added a dedicated latest-news section using published CMS articles or verified local press coverage. |
| Homepage resources | Mixed with news | Added a separate reviewed-resource section with explicit archive/empty handling. |
| About mission | Generic empowerment phrase | Tightened without inventing a programme claim. |
| Impact heading | Undated “Our impact” framing | Changed to “Milestones since July 2023”. |
| Featured event | Repeated/weak “what's happening” language | Consolidated as previous-event evidence with one “View event stories” CTA. |
| Contact verification | Manual load button | Removed locally; verification now lazy-loads near the form with guarded retry/failure states. |
| Contact privacy wording | Described user-triggered loading | Updated to describe near-viewport Cloudflare loading and direct-contact alternatives. |
| Calendar instructions and legal/CMS notices | Specific, useful operational copy | Retained. |
| Eyebrow labels / decorative emoji | No verified repetitive eyebrow or inappropriate UI emoji issue | No speculative deletion. |

## Branch and deployment evidence

- Audit base: `origin/develop` at the start of the audit; working branch `audit/ttngh-production-readiness-20261128`.
- Previously accepted work from PR commits `bd8b5a607` and `a80951ca9` is already ancestral to both `origin/develop` and `origin/main`; it was not reopened without contrary evidence.
- Turnstile branch: seven unique commits and five commits behind current develop at inspection time.
- Media branch: 28 unique commits and five commits behind current develop at inspection time.
- PR #268 targets `develop`. Its TTNGH website and Studio workflow passed at commit `de0210f12`; repository-wide checks remain release gates before merge and promotion.
- No merge or deployment was performed.

## Verification record

| Check | Result |
| --- | --- |
| Website unit/integration tests | 62/62 passed |
| Studio schema tests | 10/10 passed |
| API tests | 65/65 passed using local isolated sockets/providers, including media migration/isolation/approval gates |
| TTNGH production-content build | 22 pages built |
| Built-site validation | Unique metadata, one H1, JSON-LD, local assets and destinations verified on all 22 pages |
| Studio production build | Passed |
| Calendar browser QA | Passed at 320, 375, 390, 430, 768, 1024 and 1440 px; no overflow; 48/52 px controls; keyboard, error, empty and XSS-safe states covered |
| Homepage browser QA | Passed at 390, 768 and 1440 px against live published content and the deterministic CMS fixture; milestones, news/resources, destinations, local images and overflow verified |
| Gallery/news/event-detail browser QA | Passed at 375, 768 and 1440 px |
| Production site/API | Site 200; API `/health` 200 with enquiries ready; calendar returned three events in the inspected range |
| Production response headers | CSP, frame denial, nosniff, referrer and permissions policies present |
| Dependency audit | No TTNGH-scoped critical finding after the Astro pin; Studio/editor transitive findings and two non-applicable/low Astro findings remain |
| Repository diff | `git diff --check` passed |

Fresh visual evidence was captured during the audit under `/private/tmp/ttngh-audit-motion/`, `/private/tmp/ttngh-audit-gallery/`, `/private/tmp/ttngh-home-implementation/` and `/tmp/ttngh-calendar-agenda-*.png`. These are local audit artefacts, not production assets.

## Required path to GO

1. Review this branch's Turnstile implementation independently from the media migration/provider work.
2. Approve and implement a separate SSR preview deployment using Sanity-managed authentication, server-only read tokens, signed draft-mode enablement, noindex and click-to-edit. The static production site must remain unchanged.
3. Deploy the integrated media workflow to staging, run the separate media migration with explicit approval, then execute plan/status/sync/approval/Sanity handoff and record rollback evidence.
4. Obtain green GitHub API and website/Studio checks on the final branch set.
5. Deploy the Astro fix to preview, rerun built-site/browser/security checks, then deploy production and verify headers, health, calendar, contact behaviour, webhook rebuild and rollback.

