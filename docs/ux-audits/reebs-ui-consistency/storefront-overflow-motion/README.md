# REEBS storefront overflow and motion check

Date: 2026-08-12

## Scope

Shop, Rentals, a generated product page and the homepage were checked at 1440 px
desktop and 390 px mobile widths. The check focused on the framed page container,
internal horizontal scrolling and direction-aware content motion.

## Cause and correction

The outer document already clipped horizontal overflow, but the framed `.main`
scroll container explicitly used `overflow-x: visible`. That allowed wide or
transformed descendants to extend inside the frame and could feel like a second
horizontal scroll surface. The inner scroller now uses `overflow-x: clip`, while
intentional component rails keep their own local horizontal scrolling.

The storefront already had a shared front-facing reveal implementation with
scroll-direction detection, vertical motion, blur and dynamic-content support.
It was not mounted by the Astro layout. A small client island now mounts that
existing behavior on every public route. Content entering while scrolling down
rises into place; content re-entering while scrolling up moves from the opposite
direction. Exiting content uses the corresponding direction and a shorter blur.

`prefers-reduced-motion: reduce` keeps all content visible and removes the
animation. Navigation, cookie controls, loaders, search inputs and the bottom CTA
remain excluded from reveal motion.

## Flow health

1. Desktop Shop container — healthy: the framed inner scroller clips horizontal
   overflow and retains vertical scrolling.
2. Mobile Shop container — healthy: no page-level or inner-container horizontal
   scroll surface is exposed.
3. Rentals and generated product routes — healthy: the same containment rule is
   applied without changing their layout.
4. Down-scroll reveal — healthy: eligible text, blocks and media reveal with
   upward movement and blur removal.
5. Up-scroll reveal — healthy: re-entering content responds to upward direction.
6. Reduced motion — healthy: reveal targets stay visible without motion.

## Evidence and limits

Before-state screenshots are in `before/`; final captures are in `after/`.
Screenshots show the rendered layouts but cannot demonstrate motion over time.
Direction changes, internal overflow and reduced-motion behavior are therefore
covered by the browser assertions in `apps/reebs-website/tests/e2e-smoke.mjs`.

## Design constraint

This is a containment and motion enhancement only. It does not change the
approved navbar dimensions, branding, page composition, product content or CTA.
