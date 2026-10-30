# Flyward reference correction — 30 October 2026

This supersedes the photo-collage CTA and permanently cream footer in PR #120.
The user's supplied mockups are the approved CTA artwork; Flyward is the layout
reference, not a source of TWE photography, claims, testimonials or credentials.

## Decisions

- Restore all five supplied mockups in one uncaptioned row, with the laptop
  larger and the phone immediately to its right. Preserve responsive WebP,
  lazy loading, explicit dimensions and the existing reveal/reduced-motion path.
- Centre the photographic hero, reduce the display scale, use uppercase editorial
  headings and centre the actual logo between grouped navigation and the action.
- Replace rounded demo journey cards with equal, square-edged photographic panels.
  Use a cream, staggered image-and-copy process and an aligned two-column FAQ area.
- Keep the real country choropleth, accessible country list and empty-data state.
  No reference statistics, proprietary map masks, torn-edge artwork or claims
  have been copied. Only existing permission-approved TWE photography is used.
- Use one image element behind the entire closing enquiry/footer composition.
  Other public routes use the same photographic footer treatment with their own
  decorative responsive image; homepage/demo never duplicate the shared image.
  The footer begins at 100% width. Only the last 180 CSS pixels of page scrolling
  reveal the cream side/bottom gutter, up to 8–18px depending on viewport width.
  Oversized cream brand lettering meets that gutter at the page end.
- The gutter is a hard-edged inset paint treatment, not a decorative blurred
  shadow or a width change: scrolling does not alter layout or page height.
  One passive listener schedules a single animation-frame update. No scroll
  interception, fixed background, animation dependency or network request is added.
  Reduced motion and no JavaScript retain the full-width static composition.
- The closing slot is outside main, retaining exactly one top-level contentinfo
  landmark. Demo form styles now belong to the real form component rather than
  relying on an ancestor in the former page layout.

## Content and environment boundaries

Local and staging review modes show neutral unavailable-content sections and
approved photographs. Synthetic journeys remain in the explicitly labelled demo;
production still excludes fixtures and unpublished content. The homepage and demo
share the hero, mockup CTA, enquiry and footer. Approved publication data remains
authoritative. This correction does not approve business/legal copy, add native
enquiry endpoints, change authentication or modify database migrations.

## Files inspected and changed

- Components: CinematicHero, CinematicEnquiry, ClosingCta, PublicFooter,
  PublishedHome, DemoWebsite, DemoEnquiry, EditorialMotion and SharedFaakoFooter.
- Layout/routes: BaseLayout, index.astro and demo.astro.
- Existing styles: global.css, editorial.css, cinematic-hero.css,
  cinematic-enquiry.css, closing-cta.css, public-footer.css, demo-website.css
  and travel-footprint.css.
- Content: approved-public-release.json, approved-preview-media.json,
  TravelFootprint.astro and the five public/media/Mockups/TWE_mockup\*.png files.
- Tests/checks: redesign.test.mjs, public-release.test.mjs, output.test.mjs,
  browser-refinement.mjs and check-redesign-browser.mjs.
- DemoEmailPreview and its existing pure enquiry-template renderer were inspected
  for a strict type-check failure; env.d.ts now declares that renderer's return
  contract without suppressing the check or importing server runtime types.
- Added DemoClosing.astro to move the existing real enquiry content into the
  closing layout slot, and demo-enquiry.css to preserve its presentation.

## Verification

The six-width browser run passed at 320, 375, 390, 768, 1024 and 1440px with
zero tested WCAG A/AA violations, keyboard menu/accordion/map interactions,
no-JavaScript FAQ operation, mocked failure/success and loading states, and
production fixture exclusion. It additionally asserts one closing image, one
footer outside main, five decoded mockups, zero gutter on footer entry, full gutter
at page end and reversal when scrolling back. No actual enquiry or email was sent.

See design-qa.md and audits/2026-10-30-reference-correction for the final visual
comparison and current focused captures. Hosted deployment and authenticated
portal UAT are not certified by these local visual checks.

Final web lint/typecheck/build and all 23 tests passed; typecheck has zero errors
and existing JavaScript declaration hints. Shared UI compatibility, manifest and
conflict-marker checks are separate local gates. The non-home footer also passed
fresh browser checks at 320/390/768/1440px.

Built asset totals (not a per-route transfer size): JavaScript 307,243 bytes /
93,103 gzip; CSS 140,955 / 23,853 gzip at the measured intermediate build, versus
PR #120's 307,247 / 93,105 and 135,192 / 22,897 respectively. Restoring the supplied
mockups restores 1,614,664 bytes across all generated responsive WebP variants;
the browser selects a variant and lazy-loads lower-page artwork, not every file.
Small Astro scripts may be inline and are not included in the asset-only JS sum.

## Rollback

This is a web-only correction on fix/twe-continuous-footer-and-mockup-cta, based
on develop 6417df05d6d50a270a6c1b4954f426aaafca8b36. Reverting its release commit
restores PR #120's visuals without reverting the API publication lock fix,
portal skeletons, identity configuration or database history.
