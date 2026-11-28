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

1. Rebase and review the Drive/R2 branch as a separate migration/provider change; do not copy its database work into this branch.
2. Define the authenticated Sanity preview/session roadmap before adding draft access or click-to-edit. The repository rules prohibit silently replacing or inventing an authentication/session model.

### P2

1. Upgrade the build runtime to Node 22.23.4+ and then move Astro to 7.4.7+ after preview testing, eliminating the two residual Astro audit entries.
2. Upgrade Sanity when its supported tree resolves the remaining Studio/editor transitive advisories.
3. Split or normalize the mechanically large shared lockfile refresh before merge if reviewers cannot confidently isolate the TTNGH dependency changes.
4. Add a current mobile performance trace and optimize the active JPG/PDF assets from their approved sources when the visual/legibility comparison is acceptable.
5. Stabilize the timing-sensitive scroll-expansion browser assertion before making the full motion suite a required CI gate.

### P3

1. Review the mobile cookie notice footprint against gallery browsing after the core launch blockers are closed.
2. Decide whether the deferred payment modules have an owner and roadmap; remove them only through that decision, with related documentation and tests.

## Evidence

- Direct dependency imports were searched across TTNGH source and configuration.
- Components and styles were cross-referenced before any removal decision.
- Runtime `TODO`, `FIXME`, `debugger` and debug-console patterns were checked; only intentional QA-script result logging was found.
- Static assets over 500 KB were inventoried rather than deleted.
- CMS access was traced through `getCmsDocuments()` and its module-level cache.
- Website, Studio, API, production-content build, built-site and focused responsive browser checks are recorded in the production-readiness audit.

