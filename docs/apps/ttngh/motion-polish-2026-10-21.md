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

## Second editorial pass — 25 October 2026

Branch: `feat/ttngh-editorial-motion-pass-2`, based on current main at
`287828c3c` when this pass began. Target: a PR into `develop`, not a direct main merge.

### Architecture and deliberate rhythm

The existing native IntersectionObserver, lazy-image handling, shared interaction
contract and ScrollExpand remain the foundation. No animation dependency, global
mutation observer, new scroll handler or new scroll-controlled composition was added.
Observer construction/observation errors now explicitly leave content visible;
the existing eight-second recovery is scheduled before observation starts.

Hero presentation is CSS-only: 12px movement over 600–700ms, with a short
120–160ms follow-on for supporting copy/actions. Text starts at 85% opacity,
not zero; images start at 94% opacity and scale 1.015. This deliberately favours
immediate readable content and the existing eager/LCP image over an invisible
entrance. The complete title moves together, without character splitting. Formal
PageHero variants are exempt. Image figures clip the tiny scale without moving captions.

Grouped reveals: homepage value strip, intro pairing, programmes, impact block,
featured content and populated CMS content groups; About founder (preserved) and
values; Programmes pillars and initiatives (preserved); Events recurring compositions.
There are no nested paragraph/image/heading reveal chains or card-grid staggers.
Impact values remain the final verified markup: no count-up was introduced.

Shared motion timings live in `styles/global.css`: fast 180ms, UI 260ms, editorial
600ms, image 650ms, hero 700ms, with shared standard/out easing. Existing compatible
transition aliases are reused. Linked programme/event rows receive restrained
arrow/title/divider feedback. Linked CMS/event/team images share a 1.015 scale and
keyboard focus parity; unlinked informational portraits and photographs stay still.
The old recurring-event image hover zoom was removed for that reason.

Calendar fading now uses the 180ms token, without changing its fetching, skeleton,
navigation or agenda controller. FAQ/menu opening fades use the same fast token;
native details remain immediately operable. Button-icon keyboard feedback matches
hover. No new contact-form animation/controller logic was added: validation,
Turnstile, request IDs, duplicate guards, privacy, state labels and spinner remain intact.

Intentionally static: roadmap rows, unlinked portraits, captions, partner band,
footer composition, legal content and large team grids. Existing gallery controls
and motion are preserved; no new autoplay or carousel is added. Navbar/footer layout,
copy, colours, CMS, APIs, donations, SEO and routes are unchanged. ScrollExpand's
desktop behavior and mobile/reduced-motion static fallbacks are unchanged.

### Accessibility and checks

Reduced-motion rules disable entrances, image zoom, icon translation, spinner
rotation and transitions. No-JS markup is visible; CSS hero enhancement never
sets zero opacity. Keyboard focus retains its outline and reveals a pending group.
No essential content or interaction waits for animation.

- 42 website unit tests passed, including four second-pass regression tests.
- Focused ESLint passed for the motion controller, browser runner and unit tests.
- Preview build passed; all 15 generated pages passed HTML/SEO/noindex checks.
- Full browser run passed 168 page/viewport/motion combinations: 12 routes × seven
  widths (320–1440px) × normal/reduced motion, plus no-JS routes and missing/throwing
  observer scenarios.
- Mocked contact validation, loading labels, stable button width, duplicate-submit
  prevention, success/error and Turnstile reset passed in both motion modes.
- Calendar browser tests passed all seven widths, with held initial responses,
  skeleton replacement, retry, cached month navigation, keyboard agenda navigation
  and no horizontal overflow.
- Final focused run passed 90 combinations (15 routes including CMS/legal ×
  desktop/tablet/mobile × normal/reduced motion), with corrected screenshots,
  linked CMS/event/team image fixtures, keyboard focus, no-JS and observer-failure
  checks, and repeated mocked contact validation/success/error checks.

Checks use the existing `test`, `build`, `test:seo`, `check-motion-browser.mjs` and
`check-calendar-browser.mjs` tools. Browser QA accepts `TTNGH_QA_WIDTHS` for a focused
rerun and `TTNGH_MOTION_SCREENSHOT_DIR` for optional screenshots. The test runners
use local servers; external requests are blocked/mocked and no real enquiry is sent.
The build used public Sanity access with its read token omitted command-locally,
and dummy contact settings; no `.env` file changed. Do not deploy this QA output.

Visual evidence is saved locally under `/private/tmp/ttngh-motion-pass-2-20261025/`.
The first homepage full-page capture was rejected: back-navigation restarted reveals
before capture. The capture step now scrolls each composition and waits for pending
reveals to clear. Full-page screenshots alone cannot validate ScrollExpand's sticky
scroll travel; browser checks additionally cover its keyboard and static fallbacks.
The public dataset currently supplies empty team/news/resource/event-detail states;
local-only image fixtures exercise the linked-image CSS without inventing public content.
This is not a full WCAG audit or a measured field Core Web Vitals claim, and Safari
has not been tested in this pass.

### Visual review notes

Fresh captures were inspected with the Product Design audit guidance; rejected
captures were not treated as evidence. Screenshot filenames below are relative to
the local evidence directory above and are not shipped as website assets.

1. **Homepage — healthy after settled capture.** `home-hero-390.png` and
   `home-hero-1440.png` retain the existing photographic composition and navigation;
   `home-intro-390.png` and `home-impact-390.png` show readable grouped content and
   stable captions. No fabricated impact values appear. The existing faint hero
   photo caption is a contrast follow-up, not changed by this motion-only pass.
2. **About — layout preserved.** `-about-390.png` keeps founder/copy together and
   the values/roadmap readable without a cascade of paragraph animations.
3. **Programmes — healthy.** `-programmes-390.png` retains the editorial rows,
   FAQs and static-mobile CTA; keyboard tests cover the programme entry links.
4. **Events/calendar — usable fallback.** `-events-768.png` shows recurring
   compositions and a clear calendar failure/retry state with the live endpoint
   intentionally blocked. Separate synthetic calendar tests verify success and loading.
5. **Team — honest empty state.** `-team-1440.png` retains the founder split and
   shows the published-content empty message, rather than inventing team profiles.
   Linked portrait interaction is checked with local DOM fixtures.
6. **News/resources — readable empty states.** `-news-768.png` and
   `-resources-390.png` preserve hierarchy and context; populated CMS image behavior
   is checked with local fixtures, not claimed as a published-content visual audit.
7. **Contact/footer — layout preserved.** `-contact-390.png` shows the complete
   labelled form, consent and manual verification control, with the original pink
   footer. Mocked browser tests cover submission success/error without delivery.

These screenshots establish layout and visible-state evidence. They do not prove
screen-reader compatibility or contrast compliance throughout the site; focus,
reduced motion, navigation and form behavior are supported separately by browser checks.

### Modified files

- Tokens/styles: `src/styles/global.css`, component `motion.css`, `interactions.css`,
  `shared.css`, `faq.css`, `month-calendar.css`, and `styles/pages/events.css`.
- Group opt-ins: `CmsCards.astro`, `FeaturedEvent.astro`, and pages `index.astro`,
  `about.astro`, `programmes.astro`, `events.astro`.
- Fail-open handling: `src/scripts/editorial-motion.ts`.
- Checks: `tests/motion.test.js`, `scripts/check-motion-browser.mjs`.
- This existing report; no duplicate progress document.
