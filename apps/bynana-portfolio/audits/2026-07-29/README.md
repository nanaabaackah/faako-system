# byNana portfolio browser audit — 2026-07-29

## Scope

Current Astro production output was checked in headless Chrome at 1440 × 1000 and 390 × 844 with reduced motion enabled. The flow covered home/consent, keyboard entry, theme switching, projects, a direct project-detail URL, blog, contact validation, and mobile layouts.

## Results

1. Home, about, projects, project detail, blog, and contact returned 200 in the local preview.
2. All nine checked desktop/mobile route states had one H1, one main landmark, no broken rendered images, and no horizontal overflow.
3. Axe reported zero violations for the selected WCAG A/AA and 2.2 AA rule tags. This is automated evidence, not a conformance certification.
4. The first keyboard target was the visible “Skip to main content” link.
5. Theme switching changed the document theme from light to dark without page errors.
6. Empty contact submission identified four invalid fields and moved focus to the name field.
7. Mobile fixed social/resume controls remained within the viewport.
8. The mobile projects screenshot exposed a heading/card overlap. The mobile grid spacing was corrected, remeasured, and recaptured: the heading ends at 119.4 px and the first card begins at 135.4 px with no horizontal overflow.

## Trust-stat verification

The static production preview runs on a local origin that is intentionally not in the production API CORS allow-list, so the browser report records nine failed trust-stat requests and displays the non-fabricated unavailable state (`—`). The endpoint was checked separately on 2026-07-30 UTC:

- the public endpoint returned HTTP 200 and an `ok` payload;
- a request with the production portfolio origin received the matching `Access-Control-Allow-Origin` header;
- no numeric fallback is present in the portfolio source.

Local development uses Astro’s same-origin proxy. The local preview CORS result is therefore recorded as an environment limitation, not a production endpoint failure.

## Evidence limits

- Screenshots and axe do not replace physical-device, keyboard, zoom, colour-contrast, or screen-reader testing.
- Chrome mobile emulation is not physical iOS or Android hardware.
- A real contact message was not sent. Validation/focus recovery and the configured endpoint/mail-fallback code paths were reviewed.
- Production deployment was not performed in this task.

The machine-readable report is `browser-audit.json`; accepted screenshots are in `screenshots/`.
