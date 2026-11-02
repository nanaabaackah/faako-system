# TWE reference correction — visual QA

final result: passed

The refreshed six-width run and post-fix visual comparison passed. This report
supersedes PR #120's visual report; it is not client design approval or deployment
certification.

## Source and state

- User instruction: keep the supplied five mockups; match Flyward's full-bleed
  closing photograph and footer; reveal the page gutter only at the page end.
- Live source: https://www.flyward.com/ captured with user-approved Chrome.
- Source evidence: docs/apps/travel-with-ease/audits/2026-10-30-reference-correction/source-flyward-footer.png
  and source-flyward-hero.png.
- Implementation: http://localhost:4328/demo and /, actual Astro components.
- Matching footer viewport: source and implementation both 1440×900 CSS pixels,
  deviceScaleFactor 1. Combined comparison fits each into a 720×450 region without
  cropping; mobile captures use 390×900. The source is live business content,
  while TWE's demo is explicitly labelled synthetic. No source assets are deployed.
- Focused evidence: hero, journeys, process, journal, FAQs, restored CTA,
  footer-entry and footer-end captures in the same evidence directory.

## Comparison history and fixes

1. User identified P1 mismatches in PR #120: replacement travel-photo CTA,
   separate cream footer and wrong full-page composition. Restored the original
   five mockups, centred the hero/navigation, used large square photographic
   journey panels, cream staggered process content, and one shared closing photo.
2. User clarified P1 footer timing: no inset on entry. Replaced the permanent
   border with a hard-edged gutter reveal only in the final 180px of scrolling.
   Reversal, reduced-motion static state and unchanged layout dimensions are tested.
3. Focused captures exposed a P2 hover contrast conflict in the demo hero action,
   insufficient footer wordmark width, and aligned last process items rather
   than a sequential stagger. Fixed explicit hover/focus colours, enlarged the
   wordmark and assigned the third process item its own staggered row.
4. The closing layout was moved outside main to preserve a top-level contentinfo
   landmark. Component-owned form CSS preserves the real enquiry presentation.
   Refreshed focused process/footer captures and combined comparisons were opened
   after step 3. Sequential staggering and the larger wordmark are now visible.
   No actionable P0/P1/P2 issue remains within this TWE adaptation's scope.

## Required fidelity surfaces

- Typography: centred uppercase Georgia editorial display, smaller than the
  earlier oversized left-aligned headline; actual TWE logo, not a text stand-in.
  Flyward's proprietary wordmark is intentionally not copied. The longer TWE
  name uses a responsive single-line signature with an accessible name.
- Layout: grouped navigation / centred brand / outlined action; full-width photo
  hero, equal image panels, cream choropleth, asymmetric journal and aligned FAQ
  rows. The supplied CTA remains a separate centred composition and mockup row.
- Colours: actual TWE navy/cream/gold, readable solid scrims and visible focus.
  No gradients, glass or copied Flyward brown palette.
- Assets: existing approved Kenya/Zanzibar photographs and exact five user
  mockups, responsive formats, explicit dimensions and lazy lower-page loading.
  Flyward's proprietary clipped-map transition and torn-edge art are not recreated
  with fake shapes or copied assets. More varied licensed photography remains
  a content-dependent future improvement, not invented material.
- Copy: real approved homepage copy; synthetic journeys only in labelled demos.
  No fabricated metrics, testimonials, package prices or business guarantees.
  Production does not render unpublished modules to fill the reference layout.
- Interactions: native FAQ keyboard/no-JS expansion, map country keyboard/tap
  selection, mobile navigation, no-send local form, mocked staging failure,
  loading and success, preserved inline validation and feedback dismissal.
- Motion: one shared image and one passive animation-frame gutter update; no
  scroll interception, layout reflow loop or dependency. Reduced motion/no-JS
  leaves the full-width composition usable.

## Verification boundaries

Final six-width run passed 320/375/390/768/1024/1440, no horizontal overflow,
zero tested WCAG A/AA violations, mocked form states and no-JS FAQs. Focused
390/1440 local captures confirmed footer progress 0 on entry and 1 at the end,
one footer outside main and no browser page errors. Web lint, typecheck (zero
errors), build and all 23 tests passed on the final source. Conflict-marker and
workspace-manifest checks passed. A separate fresh server also verified the
non-home public footer at 320/390/768/1440, including its end-of-page reveal.
Final browser evidence is in the local twe-redesign-qenA5r capture directory;
durable focused evidence and the combined hero/footer comparisons are in the
documented audit folder. No browser page errors were observed.

Hosted staging remains subject to its queued deployment; no production merge or
authenticated staff UAT is certified. API readiness and content approvals remain
separate release gates. This is a TWE adaptation, not a pixel-identical clone
of Flyward or an assertion that its business functionality has been implemented.

## Follow-up

Review the local full-page composition against the supplied direction before
promoting this corrective branch to develop/main.
