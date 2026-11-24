# TWE How It Works — client revision of 16 November 2026

Source: client-supplied “Travel with Ease: How It Works and Enquiry Flow (for Designer)”, two pages, dated 16 November 2026.

## Approved page

The dedicated /how-it-works page has two accessible tabs, with five steps for package bookings and four for personal planning, each with a separate four-stage illustrative example and a link to the correct terms section:

1. **Booking a package**: choose package, tier, dates and travellers (no
   budget); receive a 14-day live quote; pay GHS 5,000 per person as a
   non-refundable deposit if withdrawing and pay balance on the quote date
   (typically 45–70 days before departure); receive itinerary, pack and
   travel support. The fifth step, added on 19 November, reads “Travel with your pack”: “You receive your travel pack with all your confirmed bookings, and we walk you through it on WhatsApp before you go.” Example: two friends considering a 3-night, 4-day Nairobi
   package. Terms section B: `/terms#package-terms`.
2. **Planning a trip with us**: complete the bespoke planning questionnaire
   including a budget; pay 50% planning-fee deposit (60% for groups), receive
   a day-by-day itinerary with one revision for Full Trip Planning or
   unlimited minor revisions for Premium Concierge; fund flights/hotels
   through a separate Travel Fund Request before bookings; settle planning
   balance to receive travel pack. Example: Italy anniversary trip.
   Terms section A: `/terms#planning-terms`.

Both flows display the shared sentence: “A clear plan, a live quote and
no bookings until your funds have cleared.”

The Annual Trip stays off this page. A distinct Travel Readiness Session
link leads to the paid advice-only service, rather than displaying booking
steps for that service.

The outdated combined guidance, including “Approximate total budget” for
packages and the statement about package deposit terms not automatically
applying to planning, is removed.

## Implementation / preservation

- `processFlows` contains two independently editable flows: five package steps and four planning steps in the
  approved public snapshot and optional validated CMS content schema. The
  portal's How It Works editor displays both sets of steps/examples and its
  Load approved copy action can import the client's 16 November revision.
- The homepage retains its original photograph, editorial framing and the
  existing React Bits stepper, now drawing the package-specific five steps,
  with a direct link to the separate planning tab.
- On /how-it-works, tabs use native buttons, roles, arrow-key/Home/End
  navigation and focus; without scripting, both flows and their terms are
  readable. Existing `ContentLink` supplies the Faako-designated icon.
- The Terms content, policy wording, imagery, navigation, typography,
  brand palette, footer and other service routes remain unchanged. Section
  anchors A/B attach to the corresponding existing Terms entries.
- A package-specific enquiry prefilled from ?package= never asks for or
  submits a budget. General/bespoke planning intake continues to collect
  budget information. The continuation questionnaire, staff CMS and API
  workflows are otherwise unchanged.
- Do not publish a stale CMS snapshot containing the old single-flow copy:
  load/review/save the approved November 16 content in the portal and use
  the normal publication process. Deploying code does not bypass approval
  or production's separate static holding-page gate.

## Validation

The repository tests assert both sets of approved steps and terms anchors,
native icon links, no package budget, CMS schema/editability, no-script
availability and desktop/mobile browser behavior. Confirm staging content
has both tabs after the reviewed deployment, and keep production behind the
approved holding page until go-live.

## Fifth package-booking step — 19 November 2026

Step 5 is **Travel with your pack**. Its client-supplied description is exactly:

> You receive your travel pack with all your confirmed bookings, and we walk you through it on WhatsApp before you go.

The existing four-stage *worked example* remains separate. Previously saved four-step CMS drafts are upgraded when edited, validated for publication, or rendered by the latest website build; this does not change personal planning's four steps. The homepage stepper, dedicated page and CMS editor share the same text. Hosted output still requires the existing verified CMS publication process.
