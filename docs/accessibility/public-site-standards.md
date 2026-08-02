# Public-site accessibility standards

Public sites target WCAG 2.2 AA. Passing automated checks is necessary but not sufficient.

## Document and navigation

- Use one H1 that describes the page. Follow a logical heading hierarchy.
- Provide one primary `main` landmark and semantic header, navigation, aside, and footer landmarks where appropriate.
- Put a visible-on-focus skip link first in the interaction order.
- Use real links for navigation and real buttons for actions.
- Give the current navigation item a programmatic current state.
- Direct URLs and browser history must work. On client route changes, update title, move focus deliberately, and announce the new page where navigation is not a full document load.

## Keyboard and focus

- All controls must be reachable and operable with a keyboard.
- Never remove the focus indicator without an equally visible replacement.
- Focus order follows reading and visual order.
- Opening a modal moves focus inside; closing it restores focus to the trigger.
- Mobile menus expose expanded state, have a labelled trigger, support Escape, and do not trap focus behind an overlay.
- Do not add positive `tabindex` values.

## Forms and states

- Every input has a persistent, programmatically associated label.
- Instructions and required status are not conveyed by placeholder or colour alone.
- Validation identifies the field, explains how to recover, and links the message with `aria-describedby`.
- On failed submission, focus the first error or a concise error summary.
- Announce asynchronous success, error, loading, and retry states without stealing focus unnecessarily.
- Preserve entered data after recoverable failures and warn before discarding unsaved changes.
- Do not expose raw backend errors.

## Content and media

- Informative images have concise contextual alt text; decorative images use empty alt.
- Do not repeat nearby captions verbatim in alt text.
- Video requires captions; meaningful audio requires a transcript.
- Links make sense out of context. Avoid repeated “click here” labels.
- Do not use colour as the only carrier of meaning.
- Text and controls meet AA contrast in every brand theme and interactive state.

## Motion, responsive behaviour, and resilience

- Respect `prefers-reduced-motion` in CSS and JavaScript.
- Essential interaction must not depend on hover, animation, drag, or precise pointer movement.
- Support 320 CSS-pixel layouts and 200% text zoom without horizontal page scrolling, except genuinely two-dimensional content.
- Touch targets should be comfortably usable and separated.
- Keep primary tasks usable on slow connections and when optional third-party scripts fail.

## Astro and islands

- Static content remains available before islands hydrate.
- An island’s fallback must communicate the same purpose and must not create a keyboard dead end.
- Use `client:load` only when the first task requires immediate interaction.
- Test delayed and failed hydration.
- Do not put the page’s only H1, navigation destination, service description, product facts, event facts, or support instructions exclusively inside an island.

## Required validation

- Lint semantic JSX/Astro where supported.
- Run an automated accessibility scan on representative routes and states.
- Manually test keyboard navigation, visible focus, 200% zoom, reduced motion, mobile navigation, validation, and error recovery.
- Test at least one screen-reader/browser combination for navigation, forms, dialogs, and dynamic status.
- Record exceptions with severity, owner, target release, and proof of resolution.
