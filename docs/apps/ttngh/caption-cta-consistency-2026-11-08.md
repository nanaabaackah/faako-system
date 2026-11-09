# Photo captions and CTA consistency

## Changes

- Removed rendered photo captions from homepage, shared heroes, About story,
  programme introduction, event ribbon, gallery and news detail pages.
- Removed unused caption props and CSS. Retained alt text, structured image
  descriptions, news publisher attribution and accessible calendar table caption.
- Moved the founder name/role into the About text column rather than removing
  useful identity information with the portrait caption.
- Added approved Tema school team photography to the donation closing CTA and
  Vision with Clarity conversation photography to the news closing CTA.
- Retained the shared ScrollExpandSection layout, dark scrim, white text,
  primary Donate button, responsive behaviour and reduced-motion fallback.
- Donation CTA still points to the donation enquiry form; no payment capability
  has been enabled or represented as live.

## Review steps

1. Donation CTA: missing photograph confirmed in desktop and mobile screenshots;
   now uses the same photo-backed treatment as the other closing CTAs.
2. News CTA: missing image supplied without changing its layout or copy.
3. Site-wide consistency: automated built-page checks cover captions, horizontal
   overflow, loaded CTA media and primary Donate labels at 390 and 1440px.
   Existing page-specific composition, navbar and pink footer are preserved.

Evidence: /private/tmp/ttngh-consistency-before and
/private/tmp/ttngh-consistency contain the donation/news screenshots.
The reusable check is apps/ttngh/scripts/check-page-consistency.mjs.
The design-audit workflow prompted screenshot inspection rather than relying
only on the presence of image paths in source.

52 website tests and the 22-page build/SEO checks passed. QA builds use preview
noindex settings and a fixture API origin: rebuild with deployment settings
before publishing. No deployment performed.

Limits: visual inspection focused on the changed closing CTAs; automated checks
cover all built pages, not every possible Sanity record or live form/payment
flow. Reduced-motion captures do not prove animation or full WCAG compliance.
