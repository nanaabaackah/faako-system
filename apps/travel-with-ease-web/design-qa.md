# Journey Chapters and mobile closing scene QA

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
