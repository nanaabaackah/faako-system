# TTNGH search, quick actions, and button-system QA

- Source visual truth: `/private/tmp/ttngh-sections-final.png`, the previously approved TTNGH homepage render, plus the user's explicit requirements for fixed WhatsApp and scroll-to-top controls, navbar/footer search, and primary/secondary buttons with a separate circular arrow.
- Implementation screenshot: `/private/tmp/ttngh-search-actions-final.png`.
- Focused implementation screenshots: `/private/tmp/ttngh-search-actions-mobile.png`, `/private/tmp/ttngh-site-search.png`, and `/private/tmp/ttngh-footer-mobile-passed.png`.
- Combined comparison: `/private/tmp/ttngh-search-actions-final-comparison.png`.
- Viewport: desktop 1440 × 1000 CSS px; mobile 390 × 844 CSS px.
- Source pixels: 1440 × 9666. Implementation pixels: 1440 × 9666. Mobile pixels: 390 × 844. Device scale factor: 1. The side-by-side comparison scales both desktop captures equally to 712px-wide columns; no density normalization was required.
- State: homepage with the cookie notice dismissed, every lazy-loaded section image loaded, the Scroll Expand section opened by scrolling, and the viewport at the page bottom so both fixed quick actions are visible.

## Full-view comparison evidence

The normalized side-by-side image confirms that the approved homepage structure, imagery, section rhythm, typography, pink/black/white palette, rounded section frames, partner band, and shared Faako footer remain intact. The implementation adds only the requested persistent utilities and interaction styling: WhatsApp at the lower left, scroll-to-top at the lower right after scrolling, a navbar search control, a two-part footer action row, and medium-radius navigation buttons with inset circular arrows.

## Focused-region evidence

- Fonts and typography: the established Kaftan Calligraphy display type and Montserrat body/UI type are unchanged. Button labels use the existing body family and remain readable at desktop and mobile sizes.
- Spacing and layout rhythm: navigation buttons use a 16px outer radius with a visually separate 999px circular arrow. The hero action group contains one solid primary action and two translucent secondary actions, with responsive wrapping and practical tap targets. The mobile page has zero horizontal overflow.
- Colors and tokens: button, footer, search, and translucent-menu surfaces use the existing brand and blur tokens. WhatsApp alone uses its recognizable green service colour; all other new surfaces stay within TTNGH's pink, berry, black, and white palette.
- Image quality and asset fidelity: no image asset was replaced or altered. All lazy-loaded homepage images report non-zero natural dimensions, and the Gradient Waves layer still renders one hydrated canvas over the hero image.
- Copy and content: search descriptions are derived from existing page and organisation copy. The WhatsApp destination is derived from the published TTNGH phone value and resolves to `https://wa.me/233209570047`; no contact detail was invented.
- Icons: search, close, WhatsApp, and scroll-to-top use the existing React Icons library. They remain optically centred and use at least 48px mobile controls where persistent.
- Interaction states: Chrome checks confirm navbar search, compact-menu search, and footer search all open the same accessible dialog. Typing `team` returns the single Our Team page result. The scroll-to-top control appears after 900px of scrolling and returns the page to `scrollY = 0`. The compact navbar state remains active after scrolling.
- Accessibility and responsiveness: search uses a native labelled dialog and search form, both floating actions have explicit labels, reduced-motion users receive instant scroll behavior, and desktop/mobile renders show no horizontal overflow. A separate focused comparison was required because search content and mobile tap-target sizing are not legible in the scaled full-page view.

## Comparison history

1. P2: the first mobile footer check found a fixed 844px footer box containing 1252px of content, allowing content to overflow its section. Replaced the fixed height with `min-height: 100dvh`. Post-fix Chrome evidence measures the footer at 1262px with a matching 1262px scroll height, zero horizontal overflow, and no console errors.
2. P2: the first implementation capture showed blank lazy-loaded images and a partially opened Scroll Expand section because it did not match the source scroll state. Scrolled every homepage section into view, verified all lazy images loaded, left the interaction at the page bottom, and recaptured. The final comparison contains all images and the same expanded CTA state as the source.

## Findings

No actionable P0, P1, or P2 findings remain. The production build completes all 13 routes, the new search and fixed controls work on desktop and mobile, and Chrome reports no page or console errors.

## Follow-up polish

No blocking polish items remain. Button proportions can be tuned later if stakeholder feedback calls for a denser or more expressive control style.

final result: passed
