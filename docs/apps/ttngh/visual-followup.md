# Visual follow-up before operational Phase 2

> Historical record. Status reconciled 19 October 2026: use the
> [18 October production evidence](production-status-2026-10-18.md) for current
> service readiness. Branch/worktree, deployment, image-placement, typography and
> provider-status statements below describe their original milestone, not current
> operations. The later editorial refresh supersedes earlier visual treatments.

Historical visual-pass notes follow. For current activation evidence, see the
[production status](production-status-2026-10-18.md); the Phase 2 handover is also historical.

This user-directed visual pass supersedes the Phase 1 decision to remove all reveal motion and flatten Faako cards. The operational CMS/forms/email brief remains separate and is next.

- Homepage now has a photographic landing hero, centred headline/actions and an inset rounded pink navigation bar. Desktop links: About, Events, News, Contact; centred logo; search and Collaborate action. Mobile uses a solid pink expandable menu, with no separate Collaborate button.
- Restored shared Faako glass/bubble geometry by removing the local flat-card override. Homepage programmes use linked bubble cards; organisation introduction uses a glass card over a contextual photo. Footer composition and Faako attribution are unchanged.
- Restored subtle 1–1.1 second blur/translate reveals on section entry, in both scroll directions. Inspired by [React Bits Scroll Reveal](https://reactbits.dev/text-animations/scroll-reveal); implemented with IntersectionObserver/CSS for Astro, not copied as a React dependency. First-view content, keyboard focus and reduced-motion preferences remain readable.
- Scroll Expand now completes over 1.1 stage-heights rather than 0.5 (approximately 2.2× the scroll distance). Track increased proportionally; reduced-motion behaviour remains static and fully open.
- Removed decorative eyebrow markup and unused eyebrow props; retained the founder's meaningful job title. Shortened inner-page headlines without removing the underlying programme facts.
- Added a native month-view calendar to Home and Events when no public Google Calendar ID is configured. It deliberately contains no guessed event dates. Previous/next month buttons work locally. The real Google iframe remains opt-in when configured. CMS-backed dates come in Phase 2.

## Updated image placements

All assets remain from the reviewed, consent-approved library documented in phase-1-image-inventory.md. No stock photography or invented event captions were added.

- `vision-community-*` (Drive IMG_4298): homepage hero; replaces the earlier small IMG_3938 hero presentation.
- `tema-school-conversation-*` (Drive IMG_7665): homepage organisation introduction, with verified school-outreach caption.
- `vision-conversation-*` (Drive IMG_3919): current-activity feature retained.
- `vision-facilitator-*` (Drive IMG_4031): homepage Scroll Expand background; avoids repeating the hero photograph immediately below it.

The homepage image inventory rows in the earlier report are historical; the placements above are current.

## Scope and next step

Validation: Astro build, five unit tests and 13-page built SEO checks pass. Chromium checked all 12 content pages at 390/430/768/1024/1440px without horizontal overflow or broken images. Menu/search/Escape, reduced motion, keyboard CTA reveal and local contact handoff checks pass. Inspected the photographic hero directly; corrected the logo to white on pink. Native Safari/device and assistive-technology checks remain outstanding.

Work remains on `feat/ttngh-phase-1-refresh` in `/private/tmp/faako-ttngh-phase1`. No merge or deployment. No changes to REEBS or shared UI package source.

Next: implement the supplied Phase 2 Sanity, event publishing, Railway contact API, Turnstile and transactional-email brief. This visual pass does not claim those integrations are implemented or configured.

## Icons and sticky navigation follow-up — 12 October 2026

- Public-site interface icons now use a shared Iconsax Linear wrapper, rendered as static SVG without client hydration. Official social-network and WhatsApp brand marks remain unchanged; shared Faako attribution is untouched.
- Navigation is sticky at a 1rem viewport inset, 72px high on desktop and 64px on smaller screens. It is a body-level sibling rather than a child constrained to the homepage hero. The homepage retains the visual hero overlay.
- Production build passes. Chromium checks on Home, About and Events at 390, 768 and 1440px verify sticky placement at scroll positions 0, 1200 and 2400px, rendered icons and no horizontal overflow. Mobile menu opening and Escape dismissal pass.
- These checks do not complete the remaining visual refresh, CMS activation or production-readiness brief. No merge or deployment was performed.

## Unified styling and interactions — 13 October 2026

Restored the Peace display family for H2 headings, strengthened Thriving Pink section treatments, rebuilt the About story layout, and unified inner-page heroes and section navigation. ArrowRight4 now uses the official Iconsax asset. Shared interaction styles cover hover, active and keyboard focus for clickable controls, with reduced-motion support. The existing footer composition and attribution remain intact. Current verification results and outstanding live-service gates are recorded in the Phase 2 handover above.
