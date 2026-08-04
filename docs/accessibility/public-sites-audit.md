# Final public-site accessibility audit

Audit date: 2026-08-04. Review methods: generated-output tests, semantic source scan, local Playwright smoke tests where available, existing axe suites, and comparison with `public-site-standards.md`. This is not a substitute for assistive-technology user testing.

| Site | Keyboard/focus/navigation | Headings/forms/images | Announcements/motion | Result |
| --- | --- | --- | --- | --- |
| byNana Portfolio | Skip/focus-visible patterns and keyboard controls exist; static routes defer interaction | Output tests verify route documents; no source image lacks `alt` | Error/status boundary present; reduced-motion rules occur across 14 source style/component files | Meets baseline; one lightbox button received explicit `type=button` |
| Faako Website | Local mobile nav opens, reports `aria-expanded`, closes with Escape, and exposes skip link/no-JS content | One visible h1 per tested route; contact form exposes validation/status states | Focus-visible, live-region and reduced-motion coverage present | Meets baseline; local browser smoke passed |
| REEBS Website | Skip link and focus-visible patterns; local mobile shop/cart smoke has no horizontal overflow | Output tests enforce one initial h1; no source image lacks `alt` | Multiple live/status regions and reduced-motion rules | Meets baseline; cart/announcement buttons received explicit semantics/name |
| Stroane public | Shared focus/semantic states and route-level code splitting; source has no image without `alt` | Storefront route-shell tests verify content/indexing boundary | Reduced-motion and status/alert patterns exist | Baseline met by static/source review; dedicated Playwright accessibility suite remains a gap |
| TTNGH | No tracked package or source exists | Not auditable | Not auditable | Blocked/deferred |

## Clear fixes completed

- Added `type="button"` to byNana lightbox close and REEBS cart-clear controls to prevent accidental form submission.
- Added an accessible name and explicit button type to the REEBS announcement close control.

## Remaining manual checks before each public release

- Test keyboard-only navigation at 320, 390, 768 and desktop widths.
- Test VoiceOver/TalkBack navigation, form error announcement and modal focus return.
- Recheck brand-token contrast for text, controls and focus rings after any visual change.
- Verify zoom/reflow at 200% and 400%, and Windows high-contrast mode where relevant.
- TTNGH must satisfy the full standard when its Astro scaffold is created; earlier requirements documents are not implementation evidence.

