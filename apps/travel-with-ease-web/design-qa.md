# Journey Chapters and mobile closing scene QA

> Historical test, retired 2026-11-25; use check-redesign-browser.mjs, check-collections-browser.mjs and check-public-followup.mjs for current coverage.

Date: 2026-11-02. Result: **passed for the local public-site refinement**.
This is not a production release or completion of the CMS work.

## Reference and intentional changes

Compared selected concept 3 (`exec-3d2fe333-3f0f-42d2-9d64-63f299527378.png`)
and rendered `chapters-1440.png` together. Retained its editorial introduction,
paired photographic service links and image/numbered-process composition.
Later client instructions intentionally replace the navy introduction with the
page background, reduce service panel size, add 14px corners/soft shadows and
remove repetitive dividers. Approved business wording replaces mockup copy.
The existing hero and supplied five-device CTA remain unchanged.

## Evidence

Local static-build Chrome captures:
`/var/folders/b_/tqnndpmj7wn35nfm_6mg02vr0000gn/T/twe-journey-chapters-IAaV5U/`.
Inspected desktop chapters and mobile `closing-390.png`: one portrait image
continues from enquiry behind footer links/legal content without a seam or
uncovered middle area. Desktop keeps its previous background. The 1920px
mobile source is chosen explicitly so viewport-width responsive selection does
not magnify a 640px thumbnail over a tall scene. Decorative image has empty alt;
content photography keeps meaningful alternatives and no captions.

## Automated results

- `pnpm --filter @faako/travel-with-ease-web test`: 39 passed, zero failed.
- Website lint and build: passed. Default non-indexable local build reports no
  sitemap entries; production output is covered separately by the test suite.
- Astro check: 89 files, zero errors/warnings/hints.
- `scripts/check-journey-chapters-browser.mjs`: passed on built preview port 4340,
  widths 320/390/768/1440, eight routes, no page errors or horizontal overflow.
- Verified one shared closing image spans its wrapper; correct mobile source,
  loaded images, native card activation, FAQ keyboard expansion, mobile menu
  Escape, solid cream select panels, wider desktop search and 25px scroll nav.
- Reduced-motion browser context and no-JavaScript process/cards/FAQ checks pass.
- Scoped whitespace check passed.

The initial development-server run stalled while hydrating Vite dependencies;
its screenshot retained the loading placeholder. It is not counted as a pass.
The completed static build hydrates correctly and passes the same checks.
No live enquiries, publication mutations or hosted authentication checks ran.

## Outstanding scope

CMS autosave, actual website-layout draft previews and automated publishing
are not completed or validated by these public-site checks. No merge, staging
deployment or production deployment is implied. Provider acceptance and the
remaining launch gates must still be verified before release.

---

# Card visibility design QA

## Evidence

- Source visual truth:
  - `/Users/Nana/Desktop/Screenshot 2026-11-28 at 08.00.05.png` (featured story, 1598 × 1342 px)
  - `/Users/Nana/Desktop/Screenshot 2026-11-28 at 07.59.47.png` (journal planning card, 1048 × 886 px)
- Browser-rendered implementation:
  - `/private/tmp/twe-card-qa/journal-feature-desktop.png` (730 × 591 px)
  - `/private/tmp/twe-card-qa/journal-feature-mobile.png` (352 × 441 px)
  - `/private/tmp/twe-card-qa/journal-planning-desktop.png` (364 × 236 px)
  - `/private/tmp/twe-card-qa/journal-planning-mobile.png` (352 × 172 px)
  - `/private/tmp/twe-card-qa/package-ticket-desktop.png` (588 × 391 px)
  - `/private/tmp/twe-card-qa/package-ticket-mobile.png` (352 × 356 px)
- Combined comparison: `/private/tmp/twe-card-qa/combined-comparison.png` (2048 × 1845 px).
- Browser viewports: 1440 × 1200 CSS px and 390 × 844 CSS px, device scale factor 1, reduced motion enabled.
- State: journal featured card; journal planning card; package ticket flipped to its reverse side.

## Full-view comparison evidence

The supplied screenshots are component-focused page captures. The combined comparison preserves each complete supplied capture beside the corresponding corrected browser-rendered component. The featured-story composition, image crop, overlay, tag, heading, excerpt and CTA retain the established layout. The planning card retains its navy surface, cream CTA, radius and spacing while restoring its heading.

## Focused region comparison evidence

- Featured story computed colors are `rgb(255, 255, 255)` for the heading and `rgb(245, 241, 232)` for the excerpt at both viewports.
- Planning-card heading is `rgb(244, 237, 227)` at both viewports.
- The flipped package CTA exposes the visible text `View package` at both viewports, alongside the existing arrow icon.
- Fonts and typography: the existing Poiret One display treatment and Quicksand/impact UI treatment are preserved; wrapping remains contained.
- Spacing and layout rhythm: existing card dimensions, padding, radii and image crop remain unchanged. The package action gains only the width needed for its visible label and a mobile safe area.
- Colors and visual tokens: the intended cream-on-navy inverse palette is restored using existing brand tokens.
- Image quality and asset fidelity: existing approved imagery, crop and overlay are unchanged; no replacement or generated assets were introduced.
- Copy and content: published story and package content is unchanged. Only the explicit package action label was added.

## Comparison history

1. Initial implementation fixed the two P1 contrast failures and added the requested visible package label.
2. First browser capture found a P2 mobile collision between the package action arrow and the persistent WhatsApp control.
3. Added a mobile inline-end safe area to the package action row and recaptured. The label and arrow are now fully visible without changing desktop alignment.

## Interaction and console checks

- Tested navigation to the journal listing, the affected journal article and packages listing.
- Tested flipping the first package ticket and locating its package link by accessible name.
- No component runtime errors were observed. Local preview logs contain expected CORS failures from the production enquiry-form endpoint because `127.0.0.1:4321` is not an allowed production origin; that unrelated request does not affect these cards.

## Findings

No actionable P0, P1 or P2 visual differences remain in the requested card states.

## Follow-up polish

None required for this correction.

final result: passed
