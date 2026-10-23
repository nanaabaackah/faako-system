# TTNGH editorial motion and asynchronous-state polish

Branch: `feat/ttngh-motion-polish`, from latest `develop` at `b85a6314c`.
Scope: presentation only. No merge, deployment, provider changes, CMS preview,
safe-area work, new content, or Turnstile/calendar architecture changes.

## Motion rules

Use CSS transitions, IntersectionObserver and existing requestAnimationFrame work.
No animation dependency was added. Entrances are explicitly selected rather than
applied globally: Home programmes, About founder pairing, Programmes initiatives.
They reveal once, with 12–16px translation and a 600ms easing. Above-fold content
is never delayed. There is no stagger because these are individual editorial blocks.

Legal/utility text, paragraph lists, navigation, footer navigation, long articles,
and sections already using ScrollExpand remain free of new entrances. Team, Impact,
News and Resources retain their existing layouts rather than receiving motion just
to increase coverage. To add another reveal, mark one major editorial block with
`data-reveal`; do not wrap entire pages or mark every child.

Content is visible in base HTML/CSS. JavaScript only marks below-fold targets pending
after checking observer support and reduced motion. Observation, focus, reduced-motion
changes or an eight-second fail-open timer remove the pending state. No React wrapper
or old global ScrollReveal is introduced.

## Component changes

- **ScrollExpandSection:** retained desktop clip/reveal identity. One pending frame
  replaces repeated cancellation/rescheduling; unchanged progress avoids repeated
  style writes. Viewport width is measured on resize rather than every frame.
  Mobile below 700px and reduced motion show the final open section with no long
  scroll track. Focus opens content immediately. Unsupported observers keep static
  content visible. Removed permanent will-change hints; active imagery alone is hinted.
  Scroll-controlled images do not inherit hover-transition lag.
- **EventGalleryRail:** existing 85-second loop, user pause, hover/focus pause,
  touch pause and hidden/inert clones remain. Offscreen and hidden-tab tracks pause.
  Reduced motion still uses the static photo grid. No additional movement layer.
- **EditorialImage:** explicit dimensions, native lazy loading and decoding remain.
  Unloaded lazy images may briefly use 92% opacity; cached images do not flash.
  Load/error/timeout fail open. No blur-up, fake skeleton, or changed image assets.
- **Buttons/links:** retain shared interaction rules and focus rings. Arrow rotation
  becomes a 2px shift on hover-capable devices. Reduced motion disables hover transforms,
  image zoom and spinner rotation, rather than only shortening durations.
- **Contact:** reusable presentation helper exposes idle → working → success/error.
  Stable label footprint; CSS spinner; existing Iconsax check icon; visible Sending,
  Sent and Try again labels; aria-busy and existing status region.
  Success persists until the visitor edits another enquiry. Errors permit retry,
  but the token guard still requires a new security check. Duplicate-request guard,
  manual Turnstile load, honeypot, consent, submission IDs, timeout, form reset and
  provider reset remain unchanged.
- **Calendar:** current grid remains during refresh, with subtle opacity emphasis;
  selected-day event summaries fade gently. No extra requests, changed cache/data
  contract, iframe, carousel-style month movement or new widget framework.

## Accessibility and performance boundaries

No-JS content is visible. Reduced motion renders reveals immediately and static
progress feedback still says Sending. Status is not conveyed by colour alone.
Keyboard focus opens reveal/ScrollExpand content; existing calendar controls and
announcements remain. The spinner is decorative inside the hidden icon container.

No layout-animation loop was added. ScrollExpand keeps its deliberate clip-path
signature on desktop; it is simplified on phones instead of running a costly effect
there. The ribbon runs only when visible. Real device/Safari/VoiceOver checks and a
deployed Lighthouse comparison remain useful; automated Chromium checks are not a
WCAG certification or measured mobile CPU benchmark.

## Verification

- `pnpm install --frozen-lockfile`: passed; no dependency/lockfile changes.
- `pnpm --filter @faako/ttngh test`: 31 passed.
- `pnpm --filter @faako/ttngh-api test`: 40 passed; server code unchanged.
- `pnpm --filter @faako/ttngh build`: passed, 16 HTML pages plus event ICS route.
- `pnpm --filter @faako/ttngh test:seo`: passed metadata, links, assets and JSON-LD.
- Focused ESLint and TypeScript checks cover the added/changed controller/helper/test
  scripts. Astro components compile through the normal build; no project-wide Astro
  typecheck command is defined.
- Browser runner: `scripts/check-motion-browser.mjs`, using Playwright and optional
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. It serves the local build temporarily and
  mocks/blocks external services. No actual enquiry is delivered.
- Existing `scripts/check-calendar-browser.mjs` is retained as calendar regression QA.

Browser results: the sweep completed all 182 page/width/motion combinations (13
routes including the published event detail, seven widths, normal/reduced motion),
with no horizontal overflow and successful reveal/focus/static-mobile assertions.
Its subsequent contact test caught a width change; the label now reserves the
original text width using an invisible CSS grid item. The focused contact rerun
passed in normal and reduced motion, including stable dimensions, duplicate-submit
blocking, success/error recovery, provider reset and manual-only Turnstile loading.
No-JS visibility passed. The existing calendar suite passed at all seven widths.
The full combined browser command was not rerun after the isolated contact fix.
An earlier harness assumption that every ScrollExpand contains an image was corrected.

The normal/reduced page sweep is automated Chromium QA, not a manual review in every
browser. Physical-device scrolling, Safari/VoiceOver and Lighthouse/frame-time
measurements remain follow-ups. No such measurements are claimed here.

## Changed files

Within `apps/ttngh`:

- `src/scripts/editorial-motion.ts`, `src/styles/components/motion.css`
- `src/lib/async-button.js`, `src/scripts/contact-form.ts`
- `src/components/ContactForm.astro`, `Icon.jsx`, `EditorialImage.astro`
- `src/components/ScrollExpandSection.astro`, `EventGalleryRail.astro`
- `src/components/HomeProgrammes.astro`, `src/pages/about.astro`,
  `src/pages/programmes.astro`, `src/layouts/BaseLayout.astro`
- component styles: `interactions.css`, `shared.css`, `scroll-expand.css`,
  `photo-ribbon.css`, `month-calendar.css`
- `tests/motion.test.js`, `package.json`,
  `scripts/check-motion-browser.mjs`, `scripts/local-test-server.mjs`

This report is the only documentation added. Concurrent Travel With Ease changes
in the shared checkout are outside this task and must not be included in its commit.

## Skeleton correction — 22 October 2026

The initial calendar controller rendered dates before its first request completed,
discarding the server-rendered skeleton. It now keeps 42 decorative placeholders
through initial loading and retries before the first success. Subsequent refreshes
retain existing dates. Failure exits the skeleton into the usable grid and Retry.
No artificial delay or whole-page skeleton was added to static content.

Validation: 32 website tests and the build passed. Updated browser checks confirm
placeholders remain while a mocked response is held and disappear after success,
at all seven widths (320–1440px), with no horizontal overflow. Existing calendar
navigation, retry, reduced-motion and agenda assertions also passed.
