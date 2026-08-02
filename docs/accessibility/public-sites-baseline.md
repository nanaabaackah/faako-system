# Public-sites accessibility baseline

Audit date: 2026-07-29
Method: repository inspection, production output inspection, keyboard-oriented component review, and local rendered checks. This is not a WCAG certification or an assistive-technology conformance statement.

## Summary

| Site | Landmarks/headings | Keyboard/focus | Forms/status | Images/motion/mobile | Baseline |
| --- | --- | --- | --- | --- | --- |
| byNana Portfolio | Static route content, skip link, one primary heading per tested page | Visible focus patterns and functional navigation; interactive route remains immediate | Labels, inline errors, invalid focus, status region, unsaved-work warning | Alt text checks, responsive layouts, reduced-motion styles | Strong reference |
| Faako Website | Skip link and main target; pages generally expose a primary heading | React navigation and controls are keyboard operable in source | Contact/auth forms use labelled controls and shared notices | Global reduced-motion handling exists; image quality varies | Partial |
| REEBS Website | Semantic page mains/headings are widespread | Mobile navigation and dialogs include ARIA/state handling | Labels, live regions, and validation are present in core flows | Many images are lazy/labelled; asset volume raises mobile cost | Partial-to-strong, needs route testing |
| Stroane public routes | Shared main landmark; skip link added in this task | Focusable shared navigation; focused audit still required for shop/checkout | Contact and account flows include validation/state patterns | Global reduced-motion fallback added; responsive CSS exists | Partial |
| TTNGH | Artifact has basic headings and landmarks | Static links only | No production forms | Reduced-motion rules and responsive scaffold styles exist | Scaffold only |

## byNana findings

- Generated route tests enforce one H1, valid local targets, and no duplicate IDs.
- Global navigation, footer, page content, and contact form are present in server HTML.
- The contact form supplies labels, required text, `aria-invalid`, field-specific descriptions, an error notice, focus on the first invalid input, and a polite success region.
- Unsaved form changes trigger the browser’s leave-page protection.
- A nested contact hero was incorrectly marked as another banner landmark. The redundant `role="banner"` was removed in this task.
- The rendered mobile project audit found the first card overlapping its page heading. Mobile showcase spacing now keeps the heading and card grid separate.
- Static pages now defer React hydration until idle. Their links remain real anchors before hydration. The contact route continues to hydrate immediately because form interaction is a primary task.
- Visual checks are still required after material CSS/content changes. Automated source/output tests do not prove colour contrast, screen-reader quality, or sensible focus order.

## Faako findings

- The application shell includes a skip link targeting `#main-content`.
- Public pages generally contain one visible H1 and semantic sections.
- The design has extensive motion and visual decoration. A global reduced-motion override exists, but every canvas/animation library must also avoid expensive initialization where possible.
- Forms and page states use shared notice/state components in several workflows.
- Because all routes are one SPA, direct-route focus restoration and route-change announcements are inconsistent and need explicit migration treatment.
- Existing colour tokens and focus treatments need measured contrast testing; source inspection alone is insufficient.

## REEBS findings

- Pages commonly use `<main>`, H1 headings, labels, `aria-live`, and lazy image attributes.
- Mobile navigation exposes expanded/control relationships.
- Checkout, booking, customer access, and cart flows are interaction-heavy and require end-to-end keyboard and announcement testing before migration.
- Some unknown routes are redirected to home, so users do not receive a clear not-found state.
- High image weight is an accessibility concern for mobile users on constrained connections, even where alt attributes are present.

### Astro follow-up — 2026-07-31

Native catalogue/category/product/error pages now provide skip-link targets, labelled landmarks, breadcrumbs, one initial `h1`, keyboard-visible links, descriptive availability text, and no-JavaScript access. Existing React form labels, live regions, dialog semantics, and reduced-motion rules were retained. Mobile and assistive-technology parity for live cart, booking, checkout, maps, and session flows remains a required preview gate.

## Stroane findings

- The shared layout previously had a main landmark but no skip link or stable focus target. This task added both.
- A global reduced-motion fallback was added so CSS animations/transitions collapse even where a component does not have a bespoke motion check.
- Component-specific motion checks already exist in scrolling/logo/service experiences.
- Product, search, account, and checkout flows need focused keyboard, error-summary, and live-region testing; the current source has useful patterns but no single enforced route standard.
- Social icons use accessible names. Decorative imagery and data-driven product images still need route-level alt review.

## TTNGH findings

- The artifact contains a basic landmark/heading structure and reduced-motion styles.
- It has no production navigation, support, donation, event-registration, or contact workflow to audit.
- Mental-health support pages will require a safeguarding-specific content and accessibility review, including crisis-language ownership, plain language, privacy, and low-bandwidth use.

## Low-risk corrections completed

- byNana: removed a duplicate banner landmark from the contact hero.
- Stroane: added a keyboard skip link, stable main target, and global reduced-motion fallback.
- No visual redesign, framework migration, or broad component replacement was performed.
