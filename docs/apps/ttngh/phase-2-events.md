# Phase 2: event delivery foundation

## Events lifecycle redesign — 1 November 2026

Implementation branch: `feat/ttngh-events-page-redesign`, based on refreshed
`origin/develop` at `7cb2716b7`. This section supersedes the historical listing
layout below; deployment and staging acceptance are not implied.

- `/events` selects published Sanity events once through `getPublishedEvents()`.
  `selectEventHighlights()` reuses `groupEvents()`: an event ending at or after
  build time remains upcoming/current; completed events remain accessible.
- Next Up is the earliest upcoming start. Upcoming shows at most three subsequent
  records, without duplicating Next Up. Previous Event shows only the first past
  record (newest start first). Equal starts use slug order for deterministic results.
- Page order: hero, Next Up, Upcoming, Previous Event, live calendar, recurring
  programmes, gallery, FAQ, existing Donate ScrollExpand. Hero anchors only target
  present sections. Empty groups are omitted; no upcoming events gets an honest
  calendar/contact empty state. No archive route or invented events were added.
- A shared event spotlight provides strong next-event imagery and a quieter previous
  event composition. Existing grouped reveals, typography and motion tokens remain.
  Homepage FeaturedEvent is unchanged.
- Completed-event labels override stale registration metadata. Existing detail
  pages retain descriptions, dates, accessibility, related programme and structured
  data while hiding registration and calendar-add/download actions after completion.
- Google supplies the live schedule; Sanity supplies rich published editorial
  records. Exact optional `calendarUid` linking and the description privacy boundary
  are documented in [calendar operations](calendar-data-source.md).
- Static editorial date classification requires the existing scheduled rebuild.
  Live calendar updates do not rewrite the static Sanity detail dates.

Local verification: 48 website tests and 9 Studio tests pass, as do the
published-content Astro build (15 pages), fixture build (22 pages), built-site
metadata/link/schema checks for both builds and focused ESLint. Calendar
loading/error/retry/keyboard checks pass at 320, 375, 390, 430, 768, 1024 and 1440px.
The isolated populated fixture build generates seven event detail and ICS routes.
Browser checks at the same seven widths pass with normal and reduced motion:
highlight ordering, three-card limit, completed-event action suppression, exact UID
linking, calendar-only entries, keyboard navigation, no horizontal overflow and
no-JS visibility. No Sanity records or calendar entries were created for testing.

Fixture build: set `TTNGH_EVENTS_QA=true`, `SANITY_PROJECT_ID=fixture`,
`SANITY_DATASET=test`, empty `SANITY_READ_TOKEN`, `PUBLIC_SITE_INDEXABLE=false`,
preview `PUBLIC_SITE_URL`, and a dummy `PUBLIC_TTNGH_API_ORIGIN`. Use Node's
`--import` option with the absolute path to `tests/fixtures/events-build.mjs` in
`NODE_OPTIONS` for the build command only. Then run
`node apps/ttngh/scripts/check-events-browser.mjs`; the runner rejects a non-fixture
build and mocks all external traffic. Optional `TTNGH_EVENTS_SCREENSHOTS` saves
captures; `TTNGH_EVENTS_QA_WIDTHS` narrows a repeat run. Rebuild without the fixture
preload afterwards. **Never deploy fixture or dummy-API QA artifacts.**

Hosted staging acceptance, Safari/manual assistive-technology checks and production
promotion have not occurred. Drive/R2 synchronization is a separate branch/task.

> Historical record. Status reconciled 19 October 2026: use the
> [18 October production evidence](production-status-2026-10-18.md) for current
> service readiness. Branch/worktree, deployment, image-placement, typography and
> provider-status statements below describe their original milestone, not current
> operations. The later editorial refresh supersedes earlier visual treatments.

Status: local implementation, not deployed; continuation of `feat/ttngh-phase-1-refresh`.

Historical event-only milestone. The remaining CMS/form/email items below are superseded by the
[13 October Phase 2 implementation report](phase-2-implementation.md); live provider activation is still pending.

Calendar behaviour below is historical. The [20 October live-calendar extension](calendar-data-source.md) supersedes the static Sanity month grid and opt-in Google iframe, but preserves the editorial event features.

## Implemented

- Build-only Sanity HTTP reader with an explicit published perspective, draft/release exclusion,
  fixed provider host, request timeout and fail-closed provider errors. No SDK or client CMS token.
- Validation of public event fields, unique stable slugs, date ordering, timezone, image dimensions
  and alt text, content owner, accessibility text, registration state and HTTPS destinations.
- Static `/events/[slug]` pages with description, date/time/timezone, venue or public online link,
  accessibility, registration state, related programme, contact, metadata and Event structured data.
- `/events/[slug].ics`: UTC instants, stable UIDs, escaped text and UTF-8-aware line folding.
- Upcoming-first listings, most-recent past listings, honest empty states, homepage upcoming cards.
- Native linked calendar on homepage and Events, rendered without JavaScript for the build month;
  browser month navigation is progressive enhancement. Grid uses Ghana time; detail uses event timezone.
- Google Calendar add links and optional consent-gated public iframe; no OAuth or synchronization.
- Existing shared Faako card surfaces, pink footer and visual refresh retained.

No actual event records or dates were invented. Unconfigured local development intentionally shows
the empty state. Synthetic records under `tests/fixtures` are never imported by the content source.

## Event document contract for the forthcoming Studio

Type `event`; `publishState: published` is required in addition to Sanity publication. Fields:
`title`, `slug.current`, `summary`, `description` (plain text paragraphs), `start`, `end`, `timezone`,
`format` (`online` / `in-person`), `venue`, approved public `address`, public `onlineUrl`,
`registrationState` (`open` / `closed` / `not-open` / `not-required`), `registrationUrl`,
`accessibility`, `owner`, `relatedProgramme` reference, `seo.description`, and Sanity `image` with
`image.alt`. Image dimensions are read from asset metadata. Do not store private meeting credentials,
attendee lists, counselling information or unpublished addresses in these public fields.

Owner names are validated but not displayed as public contacts. Open registration requires an HTTPS
URL. Capacity, price and offer schema are deliberately omitted until an approved source supplies them.
Event slug changes require an explicit tested redirect; never silently regenerate a different URL.

## Ownership and publication

TTNGH must nominate an event owner and approver to verify dates, location visibility, registration,
accessibility, image context and consent. The user confirmed website consent for the supplied Drive
library; new CMS assets still need the same editorial rights/context check.

Sanity is the source of truth. A separate owner maintains any public Google Calendar. Future one-way
CMS → Google Calendar synchronization must preserve stable IDs, cancellations and privacy; it is not
implemented here. Do not enable two-way sync or place OAuth credentials in the website.

Static events require a rebuild on publication and on a schedule to advance past/upcoming grouping.
Before enabling production CMS, set `TTNGH_CMS_REQUIRED=true`, test a private staging dataset, and
confirm failed builds preserve the previous Cloudflare deployment. Roll back to the previous verified
deployment if records, templates or provider access fail; restore the record and rebuild rather than
silently falling back to an empty production event library.

## Remaining Phase 2 work

Sanity Studio and all nine document schemas; reviewed resource and verified impact gates; integration
of non-event content; authenticated publish/build hook; Railway enquiry API, Turnstile, rate limits,
transactional email; domain routing/DNS and retention runbooks; end-to-end launch verification.
The current contact mailto workflow is unchanged and must not be described as secure server delivery.

## Local verification

17 unit tests pass. A separate synthetic-provider build generated the event detail and ICS routes;
all 14 HTML pages passed metadata, local-link and JSON-LD assertions. Calendar browser checks at
390, 768 and 1440 pixels verify seven equal columns, centered date cells, consistent row spacing
and previous/next navigation on Home and Events. The date-cell alignment regression was caused by
Astro-scoped selectors not matching JavaScript-created cells; the rules now live in a dedicated
class-scoped `month-calendar.css`. Upcoming cards are below, not inside, the calendar column.

The synthetic-provider fixture is not part of the final normal build. Real Sanity access, native
Safari, published Google Calendar integration and full assistive-technology QA remain unverified.

## References

- [Sanity Query API](https://www.sanity.io/docs/http-reference/query)
- [Sanity published perspective](https://www.sanity.io/docs/content-lake/perspectives)
- [Astro routing](https://docs.astro.build/en/reference/routing-reference/)
