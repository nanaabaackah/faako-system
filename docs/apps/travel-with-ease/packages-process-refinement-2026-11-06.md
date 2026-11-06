# Package discovery, planning process and enquiry controls — 6 November 2026

## Scope

Focused website refinement from develop `826a1f3ee` on
`feat/twe-packages-process-refinement`. No migrations, API contract changes,
dependencies, authentication changes or automatic publication.

## Public pages

- `/packages`: concise introduction, existing Faako search/filters and
  photo-led cards showing duration, title, tagline and starting price. A single
  stretched native link makes each whole card clickable; it remains keyboard
  accessible and works without JavaScript.
- `/packages/[slug]`: preserve existing generated routes and all approved
  package data. Add an editorial photo/header, duration/price facts and section
  navigation. Retain accommodation tiers, pricing qualifications, inclusions,
  exclusions, real itinerary disclosures, gallery and enquiry controls. Do not
  invent itineraries or prices for packages whose data does not provide them.
- Homepage: featured package photography with navy information panels, gold
  details, whole-card links, visible focus and restrained reduced-motion-aware
  hover behaviour. Pricing disclaimers/reference months remain next to offers.
- `/how-it-works`: expand each approved step with practical guidance. A clearly
  labelled hypothetical two-friend example links to the published Nairobi
  package when available. It is not a testimonial, quote or booking. Preserve
  approved payment wording and distinguish package terms from planning services.
- The approved cinematic hero, CTA mockup arrangement, image placement controls,
  shared enquiry/footer and publication boundaries are unchanged.

All new presentation lives in external CSS files. Astro renders public content;
the existing React islands remain responsible for forms and filters.

## Services follow-up

The service overview now uses compact photo-led cards leading to four generated
detail routes: `/services/travel-readiness-session`, `/services/full-trip-planning`,
`/services/premium-concierge` and `/services/group-trip-planning`. Each retains
the exact published description/fee and CMS image placement, adds preparation
guidance, related services, a process link and an enquiry action. Existing
`/services#service-1` through `#service-4` anchors remain valid.

Detail routes and sitemap eligibility derive only from the published services
page; an unpublished page generates no service routes. Fees do not affect URLs.
Renaming a service title changes its derived slug and requires a tested redirect
in a subsequent content/code change. Duplicate/empty slugs fail the build.

## Enquiry selection defect

Reproduced with Chrome: choosing Full Trip Planning left `service=not_sure`.
Faako `SelectField.onChange` emits `target.value`, not `target.name`.
The form's generic native-input handler therefore could not update the intended
state key. Bind the two selects using the existing `onChangeValue` API with
explicit `enquiryType` / `service` state keys. Shared Faako components and their
other consumers are unchanged.

Regression coverage verifies pointer and keyboard selection, persistence while
editing other fields, submitted values and reset after confirmed success. Browser
requests are intercepted; no real enquiries, emails or publication operations are
performed.

## Verification and release boundary

Local results: website lint, Astro type checks (83 files, no diagnostics), static
build (29 routes) and all 50 website tests passed. Chrome collections acceptance
passed at 320/390/768/1440px, including all four service URLs, package details,
keyboard/pointer enquiry selections, mocked submission/reset and no-JavaScript
navigation. Separate shadow checks retain package elevation and remove service
card/image elevation. Package cards retain the requested shadows; service cards
use a flat presentation. All changes are mirrored into the regular workspace.

An initial parallel build exceeded the existing 120-second test budget while
other browser/build work was running. The complete suite passed serially without
increasing timeouts or weakening assertions. CI remains a separate release gate.

Run website lint, Astro type checks and the complete website test suite. The
collections browser script covers 320/390/768/1440px, package-card/detail routes,
gallery/disclosures, process example, homepage card activation and no-JavaScript
public content. Use local Chrome via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Passing local checks does not certify a deployed staging/production version.
Push the focused branch and review its PR into develop. Do not promote main or
publish website content as part of this task. Rollback is a normal revert of the
focused commit; the prior package routes/data and enquiry API remain compatible.
