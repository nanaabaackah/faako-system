# TWE redesign visual QA — 2026-10-30

final result: passed

Scope: visual fidelity and interactions of the implemented approved/empty and
isolated demo states. This is **not** hosted production certification, native
enquiry completion or approval of unpublished business/legal content.

## Sources, normalisation and evidence

- Primary truth: `docs/design-references/twe-redesign/02-twe-flyward-inspired-hero-direction.png`;
  cream/map direction: `01-twe-latest-cream-map-footer-direction.png`; earlier
  structure `03-twe-earlier-homepage-structure.png`. All opened and inspected.
- Live Flyward and Flighty gallery captured with user-approved local Chrome;
  desktop Flighty source 1208×550, mobile 600×879 inspected. References guide
  composition, not literal colours, assets, copy, fictional offers or controls.
- Hero comparison: 887×556 source crop normalised to 720×450 beside 1440×900
  implementation normalised to 720×450. Both in one combined image:
  [hero comparison](docs/apps/travel-with-ease/audits/2026-10-30/hero-comparison.png).
- CTA comparison: source and implementation fitted into equal 720×450 regions:
  [CTA comparison](docs/apps/travel-with-ease/audits/2026-10-30/cta-comparison.png).
  Different image aspect ratios are expected: original TWE photographs replace
  Flighty's proprietary devices. This is not a pixel-exact cloning exercise.
- Implementation CSS viewport/density: 1440×900 and 390×900, deviceScaleFactor 1;
  also tested 320/375/768/1024. Screenshot dimensions correspond to CSS pixels,
  with taller element/full-page captures where required.
- Current screenshots: [desktop hero](docs/apps/travel-with-ease/audits/2026-10-30/hero-desktop.png),
  [mobile hero](docs/apps/travel-with-ease/audits/2026-10-30/hero-mobile.png),
  [cream map](docs/apps/travel-with-ease/audits/2026-10-30/map-desktop.png),
  [CTA](docs/apps/travel-with-ease/audits/2026-10-30/cta-desktop.png),
  [enquiry/footer transition](docs/apps/travel-with-ease/audits/2026-10-30/enquiry-footer-transition.png),
  [mobile footer](docs/apps/travel-with-ease/audits/2026-10-30/footer-mobile.png).
  Detailed browser evidence: local `twe-redesign-p8NHT0` screenshot directory;
  CI retains all six-width screenshots as artifacts, not public site assets.

## Comparison history

1. First rendered comparison found P1 invisible footer CTA text (scoped colour
   conflict); P2 demo selectors overriding rounded/gold primary actions; P2 narrow
   footer email column; P2 scroll cue overlapping the floating WhatsApp control;
   P2 sans-serif section headings inconsistent with editorial direction.
2. Fixed specificity/contrast, rounded CTA overrides, full-width contact group,
   raised scroll cue and Georgia section headings. Captured the corrected six-width
   state again. Full-page and focused hero/CTA/map/footer captures show these issues
   resolved. No remaining actionable P0/P1/P2 visual mismatch in the tested states.
3. Follow-up adds the existing Faako skeleton only during asynchronous work.
   Real component tests wait for hydration and hold mocked form responses to verify
   the skeleton appears during submission, then disappears after success/error.

## Mandatory fidelity surfaces

- Typography: established Georgia editorial display, familiar sans-serif controls;
  intentional approved-copy wrapping rather than the mockup's fictional headline.
  Responsive hierarchy, readable body measure, no text truncation.
- Layout: full viewport photo hero, deliberate gutters, staggered editorial photos,
  cream functional map, separate centred CTA and cinematic enquiry/footer sequence.
  No horizontal overflow at six widths. Mobile retains large tap controls.
- Colours: actual navy/cream/gold; no reference teal palette, gradients, glow or
  glass. Solid scrims protect image/text contrast. Zero automated WCAG violations
  in tested states; not a substitute for comprehensive assistive-technology testing.
- Images: existing permission-approved TWE Kenya/Zanzibar photographs, responsive
  WebP sources, prioritised hero and lazy below-fold imagery. No stock reference
  assets, fake map screenshot, div art or invented destinations. Kenya is repeated
  deliberately because only two approved photos exist; additional approved wide
  photographs would improve variety (P3).
- Copy: approved CMS content or clearly-labelled demo/empty states. No invented
  package prices, testimonials, trust metrics or business claims. Online forms
  unavailable on the published page are identified honestly; WhatsApp remains useful.
- Icons: genuine existing Iconsax through ContentLink/shared UI; arrows only inside
  actionable content links/buttons, not ordinary navigation/legal links.

## Interaction and accessibility evidence

Chrome automated checks: desktop/mobile/touch emulation, keyboard menu/Escape/focus,
native FAQ Enter toggles, map keyboard details/equivalent list, consent isolation,
mocked staging submission failure/manual retry/success, reduced motion, no-JS
content/disclosures and normal-motion footer scrolling. Browser console/page errors
checked. Existing onboarding and CMS demo browser suites also passed before the
skeleton follow-up; required CI reruns cover current source.

## Remaining gates and follow-up

Actual Safari/iPhone and screen-reader manual QA, signed-in hosted staff UAT,
restricted-role publication CI, staging deployment/source verification and production
health/release remain separate pending gates. See the release record; no live
deployment or native general/package form completion is claimed by this visual pass.

P3: provide additional approved landscape photography and more approved content
to fill the editorial journey/journal modules without repetitive imagery.
