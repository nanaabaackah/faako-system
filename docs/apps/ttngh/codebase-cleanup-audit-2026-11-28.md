# TTNGH codebase cleanup audit — 28 November 2026

## Scope

This audit covers `apps/ttngh`, `apps/ttngh/studio`, `services/ttngh-api`, TTNGH-specific workflows, direct dependencies, content/data access, tests, static assets and current operational documentation. It distinguishes safe cleanup completed here from architecture or provider work that needs separate approval.

## Completed cleanup

| Area | Finding | Change |
| --- | --- | --- |
| Homepage content | Milestones were absent from the homepage, while news and resources were visually collapsed into one mixed updates feed. | Integrated a four-item milestone block into the existing impact section and added separate CMS-backed news and reviewed-resource sections with clear archive links and empty fallbacks. |
| Contact verification | A manual “Load security check” control added friction and contradicted the intended near-viewport loading behaviour. | Added guarded IntersectionObserver loading, one online retry, failure messaging, updated privacy disclosure and regression/browser checks. |
| CI | Website and Studio changes had no path-scoped workflow. | Added deterministic CMS-fixture tests/build, built-page validation, Studio build and 390/768/1440 homepage browser QA. |
| Dependencies | `@faako/core` was declared but not imported. | Removed it from TTNGH's direct dependencies. |
| Test dependencies | Browser scripts imported Playwright without declaring it in the TTNGH package. | Added an exact TTNGH development dependency and a focused homepage QA command. |
| Browser scripts | Calendar routing aborted its own mocked endpoint; motion route discovery treated `events/stories` as an index page. | Corrected route fallback/discovery and added regression assertions. |
| Studio schema | Important review/default fields were presented as a flat technical form. | Added author-friendly groups, help text, safe initial states and collapsible advanced SEO while retaining publish validation. |
| Copy | Several fallback headings and CTAs were generic or repeated. | Replaced them with specific Tema/Ghana, milestone, news and event language without inventing claims. |
| Operational docs | The TTNGH README still presented October status and obsolete calendar/contact statements as current. | Replaced the current-milestone section with links to the 28 November readiness, security and cleanup evidence while preserving dated historical reports. |
| Media assets | Three oversized legacy JPGs included one unused image and two active images that already had or could safely use approved derivatives. | Replaced active references with responsive WebP derivatives and removed the three unreferenced JPGs, reducing public assets without altering source composition. |
| Studio dependencies | The Studio remained on Sanity 6.18.0 while a supported update was available. | Upgraded Sanity to 6.25.0 and current direct React/styled-components releases; schema tests and the production build pass. |

## Reviewed and retained

| Candidate | Decision |
| --- | --- |
| Repeated CMS reads | Retain. `getCmsDocuments()` is module-cached; `contentOfType()` filters the cached result, so these calls do not create repeated network requests during a build. |
| `news-cards.css` | Retain. It is imported by `PressCoverage.astro` and used on the news route. |
| Iconsax and `react-icons` | Retain. Both are used by the shared TTNGH icon components. |
| Large company-profile PDF | Retain as an intentional downloadable document; optimize only from the approved source file. |
| Existing editorial JPGs over 500 KB | Retain for now. They are active content assets; conversion/replacement needs visual comparison and source-quality review rather than blind deletion. |
| Historical implementation documents | Retain as dated records. Current readiness, security and cleanup reports supersede their status claims without rewriting history. |
| Payment modules under `services/ttngh-api/src/payments` | Not mounted by the current API. Retain pending an explicit product/architecture decision; removing a deferred payment capability is outside a cleanup-only change. |

## Remaining cleanup work

### P1

1. Deploy the integrated Drive/R2 workflow to isolated staging and run its separate migration/provider proof with explicit approval before any production use.
2. Approve the separate SSR Sanity preview deployment roadmap before adding draft access or click-to-edit. The repository rules prohibit silently replacing or inventing an authentication/session model.

### P2

1. Upgrade the build runtime to Node 22.23.4+ and then move Astro to 7.4.7+ after preview testing, eliminating the two residual Astro audit entries.
2. Continue monitoring the upgraded Sanity 6.25.0 dependency tree and apply only supported, TTNGH-scoped updates.
3. Review the shared lockfile refresh as its own large generated portion of this release.
4. Add a current mobile performance trace and optimize the remaining approved-source PDF/active imagery when the visual/legibility comparison is acceptable.
5. Confirm the stabilized scroll-expansion assertion in the first GitHub workflow run before making the full motion suite a required gate.

### P3

1. Recheck the reduced mobile cookie notice footprint on physical iOS and Android devices after preview deployment.
2. Decide whether the deferred payment modules have an owner and roadmap; remove them only through that decision, with related documentation and tests.

## Evidence

- Direct dependency imports were searched across TTNGH source and configuration.
- Components and styles were cross-referenced before any removal decision.
- Runtime `TODO`, `FIXME`, `debugger` and debug-console patterns were checked; only intentional QA-script result logging was found.
- Static assets over 500 KB were inventoried rather than deleted.
- CMS access was traced through `getCmsDocuments()` and its module-level cache.
- Website, Studio, API, production-content build, built-site and focused responsive browser checks are recorded in the production-readiness audit.

