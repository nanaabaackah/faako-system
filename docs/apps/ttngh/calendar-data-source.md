# TTNGH live calendar: implementation and handoff

Updated 21 October 2026. Feature branch: `feat/ttngh-live-calendar`, based on inspected
`origin/main` at `54c42c77b821de2160921527b063f051183b1776`.
Review-only implementation: no merge, deployment or provider changes.

## Decision and source ownership

Google Calendar → public ICS → Railway TTNGH API → normalized cached JSON →
TTNGH MonthCalendar and selected-day agenda.

Google supplies scheduling dates, occurrences, times and public locations.
Sanity remains the source for reviewed listings, FeaturedEvent, detail pages, images,
registration, accessibility, programme relationships, Event structured data, local
ICS downloads and explicit Add to Google Calendar links. Those implementations are
unchanged. The current homepage keeps its editorial event feature, not a second grid.
No Sanity schemas, Presentation/preview, authentication or provider permissions change.

Normal calendar viewing never loads a Google iframe or Google Calendar browser bundle.
Google still receives infrastructure requests from Railway. The API processes browser
requests under its normal technical/security controls; no attendee data is collected
by this calendar. Privacy copy and CSP reflect this distinction.

## API contract and safeguards

`GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD`

The start is inclusive and the end exclusive; ranges must be real dates in 2000–2099,
ordered and at most 62 days. Unknown/duplicate/array parameters are rejected.
GET and CORS OPTIONS only; HEAD and writes return 405. Existing exact-origin CORS,
shared request IDs, error envelopes, logger and security headers are retained.
Contact origin controls are not relaxed. Reads are limited to 60 requests/minute/IP.

Success uses the shared `data` envelope with `events`, `refreshedAt` and
`freshnessSeconds`. Each event contains only:
`id, uid, title, start, end, allDay, timezone, location, status`.
Text is plain and length-limited. Descriptions, organiser details, HTML, attendee
information and meeting URLs are not exposed. Private/confidential and cancelled
events/occurrences are excluded. Tentative events are labelled.

The server constructs a fixed HTTPS Google public ICS URL from a validated Gmail or
Google group-calendar ID. No caller-controlled host, URL or calendar ID is accepted.
Redirects are rejected; upstream timeout is eight seconds; feed size is capped at 2 MiB.
Safe errors never return provider bodies or stacks.

## Parsing, recurrence, limits and freshness

The server-only dependency `node-ical@0.27.3` provides maintained RFC5545 parsing and
bounded recurrence expansion, including RRULE, EXDATE, RECURRENCE-ID, timezones and
multi-day/all-day events. Its temporal recurrence dependency handles DST.
Parsing runs in disposable workers, not on Express's main thread: three-second wall
limit, 64 MiB heap, at most two concurrent workers; excess work fails safely.
Limits are 2,000 source events and 1,000 returned occurrences.

One feed per process is fresh for five minutes. Refreshes are deduplicated and use
ETag/Last-Modified validators when supplied. There are at most 24 cached date ranges.
Failed upstream refreshes back off for 30 seconds. Expired results are not silently
returned as current. Process restart safely rebuilds the cache; retain one Railway
replica until shared rate limits/cache are designed.

The browser caches up to 12 months using the server's remaining freshness lifetime,
so cache layers do not each add another five minutes. A visible calendar checks once
per minute; fresh entries avoid a network request. Active-view freshness is normally
within roughly six minutes, subject to Google feed propagation and availability.
Google scheduling edits do not need a Cloudflare rebuild.

All-day dates retain calendar dates and exclusive ends. Timed occurrences preserve
their instants and are displayed in Africa/Accra. Multi-day entries appear on each
overlapping day. A deterministic occurrence hash plus original UID supports future
explicit linkage; no title/date matching is used.

## UI and accessibility

The existing TTNGH calendar shell is evolved, not replaced with a widget framework.
It has Monday–Sunday headings, Previous/Next/Today, selected-day state, today marker,
event counts and an inline agenda with title, date/time, location and tentative status.
Outside-month cells are intentionally blank.

The grid remains present during loading and failed navigation; controls prevent
duplicate requests. Retry targets the failed month. Refresh failures explicitly warn
that displayed dates may have changed. Empty months retain their grid.
The initial placeholder/pulse respects reduced motion.

Native buttons, table headings/caption, roving keyboard focus, arrow/Home/End keys,
visible focus, live status and selected-day announcements are provided. Phones use
counts rather than crowded event titles; the agenda wraps long titles. No fabricated
registration, image or editorial details are supplied for Google-only occurrences.

## Manual configuration (after review, not performed here)

1. On the dedicated Railway API, set `TTNGH_GOOGLE_CALENDAR_ID` to TTNGH's approved
   public events calendar ID. Blank leaves the endpoint safely unavailable.
2. Keep existing `TTNGH_ALLOWED_ORIGINS` exact for the approved website/staging origins.
   Keep the existing one-replica and verified trusted-proxy configuration.
3. The website uses its existing `PUBLIC_TTNGH_API_ORIGIN` pointing to that API.
   No Google API key, OAuth credentials, new database or Sanity token is required.
4. After both versions are reviewed and released, retire
   `PUBLIC_TTNGH_GOOGLE_CALENDAR_ID` from website build variables. Nothing removes
   hosted variables automatically.

The owner must confirm the selected feed is public and contains only information
approved for public website use. Do not make a personal/private calendar public as
a troubleshooting shortcut. Provider availability/public access is an activation
check, not something this branch changes.

## Verification and rollback

- API: `pnpm --filter @faako/ttngh-api test`.
- Website: `pnpm --filter @faako/ttngh test`, `build`, and `test:seo`.
- Browser: after building, run `node apps/ttngh/scripts/check-calendar-browser.mjs`
  with Playwright available and, if needed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
  It serves the local build temporarily, mocks calendar responses, and closes its
  server/browser. It never writes provider data.
- Check the API range above against staging: safe JSON only, exact CORS, no iframe,
  successful empty feed versus unavailable feed clearly distinguished.
- In an approved test calendar, add/edit/cancel a recurring event, wait for cache
  expiry, and verify without rebuilding the website. Check all-day and timezone cases.
- Manually verify Safari, VoiceOver, a real touch device and actual Railway ingress
  before launch. Chromium automation is not full WCAG certification.
- Retain the previous verified API/site versions for rollback. Blank calendar ID
  disables only the live schedule; static Sanity listings remain available.

## Future enrichment

A separately approved Sanity field such as `googleCalendarUid` can associate reviewed
editorial content with the returned UID. For per-occurrence editorial overrides,
also retain the recurrence identity. Google stays scheduling truth; Sanity supplies
presentation and registration. Do not infer associations from title or date.

## Validation results — 21 October 2026

- Final complete API suite: **40 passed**, including actual timeout and worker parsing.
  One earlier run had a failure under concurrent local work; the isolated calendar
  suite (12 tests) and subsequent full suite both passed.
- Website suite: **27 passed**.
- Production-style Astro build: **16 HTML pages**, plus the existing published
  Sanity event detail/ICS routes; built-site metadata/assets/link/schema checks passed.
- Final Chromium run: **320, 375, 390, 430, 768, 1024, 1440px**, no page/calendar
  horizontal overflow. Loading, success, empty, month cache/navigation, Today,
  failure preservation, Retry, multiple events, all-day/tentative agenda, literal
  untrusted text, keyboard navigation and reduced motion passed.
- Date targets measured at least **36.7 × 48px** at 320px and **44.6 × 48px**
  at 375px, exceeding the WCAG 2.2 minimum 24px target requirement.
- Source scan confirms no Google embed URL, load gate, iframe controller or obsolete
  gate styles in application source. Sanity editorial components/routes are unchanged.
- Public Google feed reachability returned **HTTP 200**; provider settings were not changed.
  The actual feed also normalized successfully through the new service: zero occurrences
  for 1 October–1 November 2026 (exclusive end), an empty month rather than a feed error.
- Existing lockfile dependency graph preserved; only parser dependencies added.
- Local long-running servers on ports 5177 and 4188 stopped at the user's request.
  Browser QA's temporary server closes automatically.

Safari, screen-reader and deployed Railway end-to-end verification remain manual
release checks. No claim of full WCAG compliance or production activation is made.

## Changed-file groups

- API: `src/calendar/{normalize,worker,service,route}.js`, `src/app.js`,
  `src/config.js`, `test/calendar.test.js`, package manifest and env example.
- Website: EventCalendar, MonthCalendar, calendar helpers/controller/styles, obsolete
  Events embed styles, privacy, CSP, env example, test command and calendar tests/QA.
- Workspace: only the parser's required dependency additions in `pnpm-lock.yaml`.
- Docs: this handoff, architecture, deployment, environment matrix, content operations,
  analytics plan and supersession notes in historical Phase 2 reports.
