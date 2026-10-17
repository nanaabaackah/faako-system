# TTNGH editorial design QA — 17 October 2026

final result: passed

Scope: local visual/interaction acceptance of the editorial refresh, not approval
of production integrations, publication content, or a WCAG certification.

## Visual targets and comparison

The four supplied references are in `docs/apps/ttngh/design-references/`.
`04-home-contact-cms-final-direction.png` takes priority for Home, Contact and
the minimal CMS gateway; `02-inner-pages-events-programmes-about.png` guides
inner heroes. References 01 and 03 guide editorial rhythm and secondary hierarchy.

References 02 and 04 were opened alongside new browser screenshots for comparison.
These are multi-page composite directions, not same-scale pixel specifications.
User-required differences take precedence: actual approved photography/copy,
existing pink navbar/footer, existing Scroll Expand and managed Sanity access.
No reference statistics, event dates, addresses, people or photographs were invented.

## Capture evidence

Local Chromium, device scale factor 1, 900px-high viewport; structural checks at
320, 390, 430, 768, 1024 and 1440px. Full-page desktop/mobile screenshots live in
`/private/tmp/ttngh-editorial-qa/` (temporary local evidence, not shipped assets):

- `home-{390,1440}.png`
- `about-{390,1440}.png`
- `events-{390,1440}.png`
- `contact-{390,1440}.png`
- `cms-{390,1440}.png`
- `404-{390,1440}.png`
- `viewport-about.png`, `viewport-home.png`, `viewport-404.png`
- `viewport-contact-{390,1440}.png` — final spacing adjustment
- `gallery.png` — all four original photographs loaded in reduced-motion layout
- `results.json` — responsive/interaction checks and 12 axe runs

Captures use reduced motion for stable comparisons; gallery pause and Scroll
Expand focus behaviour are also checked with motion enabled. Full-page lazy
image capture initially omitted one gallery image; a focused capture confirmed
all four are loaded, opaque and visible. This was not a missing source asset.

## Review and resolved issues

| Area | Result |
| --- | --- |
| Hierarchy | Dedicated immersive Home, image-led inner pages, task-led Contact, minimal CMS |
| Typography | Georgia editorial headings, Montserrat body, existing display accent for Peace/footer |
| Spacing | Shared 1152px content grid and responsive gutters; contact form's extra top padding removed |
| Hero alignment | Shared header flow offset removes white band above PageHero; navigation remains sticky |
| 404 | Duplicate SiteHeader removed; full-viewport error composition, home return link, noindex |
| Colour | White/black editorial structure with pink accents; footer visual identity retained |
| Accessibility | Footer small text changed to opaque dark colour; labelled social placeholders receive image role |
| Responsive | No horizontal overflow, one H1 and one header across 15 routes at six widths |
| Motion | Native FAQ keyboard interaction, reduced-motion gallery, hidden clones, pause and focus checks pass |
| Forms | Synthetic success, expiry, validation and outage checks pass without real email/provider requests |
| CMS | Long-title/multiple-entry fixture pages render; gateway stays noindex and does not recreate authentication |

No outstanding P0/P1/P2 issues were found within this local review scope.

## Intentional differences and remaining external validation

- Mobile immersive heroes show the original photograph above dark text instead
  of squeezing the group photo behind copy. This preserves faces and legibility.
- CMS has a real Studio link only when configured, not the mockup's recreated
  sign-in form. Contact clearly reports unavailable delivery when unconfigured.
- Existing joined-arrow buttons, sticky pink navbar and large pink footer are
  preserved rather than copied from the reference.
- Empty published-content states remain honest. Fixture records are isolated in
  `/private/tmp/ttngh-editorial-fixture-dist`, never in production output.
- Existing approved local imagery is used; this pass did not access newer Drive
  additions. Further image diversification is a follow-up, not a completed sync.
- Real Safari/VoiceOver, hosted response headers, provider email delivery,
  analytics consent delivery and production CMS webhook checks remain launch QA.
- No Lighthouse performance score or live payment readiness is claimed.

Build: 15-page repository-content output and 25-page isolated fixture output pass.
Website unit tests: 24 passed; Studio tests: 9 passed. SEO checker passes 15 pages.
Fixture browser QA: 18 routes × six widths, including mocked form states.
Final contact-only spacing/overflow/axe check additionally passed at six widths.

The reviewed changes were committed and pushed to the feature branch requested
by the user. No provider write or production deployment was performed. Review
the complete branch diff and resolve the documented environment/dependency
gates before promotion.
