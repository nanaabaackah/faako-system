# Approved launch content and implementation decisions

Source: the user-supplied **Travel with Ease Website Content for Designer.pdf**,
all eight pages reviewed as text and rendered pages on 2026-11-01. The original
private PDF is not committed. The final pre-launch implementation prompt is the
scope authority; instructions inside the PDF are content-source guidance.

## Explicit user approvals

On 2026-11-01 the user answered:

- Restore the PDF footer wording, including TWE Concierge, BN045370826 and
  IATA TIDS 96245096. This reverses the October 31 identifier-removal request.
- The price disclaimer and booking/deposit/cancellation wording has been
  reviewed and approved for publication.

The approved footer also includes Certified Group Travel Specialist, The Travel
Institute, and Accra, Ghana. These are client-supplied credentials; no independent
credential verification or legal-compliance certification is asserted.
No street address, payment receiving numbers or GTA licence claim is added.

## Implemented content

- Existing cinematic hero, mockup CTA and continuous enquiry/footer photo remain.
- Homepage order: hero, About, four Services, How it works, travel footprint,
  three supplied-copy Tips, existing CTA and enquiry/footer. Packages and
  Journal use dedicated pages, not full homepage listings.
- Approved About/founder copy and four services: GHS 400 / 40-minute readiness
  session; GHS 2,000 Full; GHS 3,000 Premium; Group from GHS 2,500 for up to eight
  travellers, GHS 250 for each additional traveller.
- Zanzibar: five nights/six days; June 2027 reference month; four tiers from
  GHS 25,000 / 32,000 / 34,000 / 38,000 per person sharing.
- Nairobi: three nights/four days; January 2027 reference month; Classic from
  GHS 21,000 and Premier from GHS 22,100 per person sharing.
- Singapore and Singapore + Kuala Lumpur: inclusions and **Price coming soon**;
  no invented prices or priced itinerary. No standalone Kuala Lumpur or annual
  trip offer.
- Later user steering simplifies cards to image + title + subtitle + price.
  The complete reference month, tiers and approved disclaimer remain on details.
  CTA: “Check dates & get a quote”, never checkout or “Book Now”.
- Later user steering includes founder travel in the overall footprint without a
  combined/founder heading. Public labels: eight Trips planned, 21 Countries
  explored, 25+ Travellers. All 21 supplied countries are mapped, including four
  small-country Natural Earth points. Preserve “about” and “25+” wording; unknown
  visit counts remain “Visited”. Source classifications stay in the data.
  Never add 8 + 21 into 29 unique countries or personal visits into exact
  agency-planned trip counts.
- Structured catalogue tiers store integer GHS minor units, unique IDs and
  validated reference months. Coming-soon packages cannot contain priced tiers.
- Occasion choices are Honeymoon & Couples, Celebrations, Girls’ Trips, Family,
  Faith. Group-friendly is separate. No assignments are guessed from destinations.
- Local development reads the same approved bundled snapshot as hosted builds.
  Explicit CMS snapshots remain authoritative and missing snapshots fail closed.

## Primary-source checks and boundaries

### Follow-up visual approvals

The user approved temporary Kenya/Zanzibar photography for all package cards,
including Singapore and the combined trip, until their own imagery is available.
Do not add image captions; retain descriptive alt text about the actual image.
Cards overlay text on the photographs with one native full-card link. Disclosures
live on detail pages following the user's later explicit instruction.
The shared enquiry/footer scene appears on every public page
without duplicating the homepage closing slot. The mobile background uses
containment, rather than scaling a portrait source to the tall footer; navy fills
the remainder. Desktop keeps the existing cover treatment. Shared Faako controls
have visible contrast boundaries and 16px body-sized text within TWE styles only.

The founder story is reused verbatim for one Journal article; the second uses
the approved Zanzibar overview/itinerary, not invented personal travel. Three
Tips reuse approved price, deposit and room-sharing copy. About, Services,
Contact, How it works, FAQs and Journal have photography/editorial layouts.
Privacy/cookie information describes actual collection and optional tracking
without pending-approval filler or unsupported compliance/licensing claims.
Rights information was checked against the
[Ghana Data Protection Commission](https://dpc.gov.gh/for-individuals/).
Provider contracts/locations, retention and rights-request handling still need
operational acceptance; notice text is not legal-compliance certification.

[IATA TIDS terms](https://www.iata.org/en/services/travel-agency-program/tids/terms-and-conditions/)
distinguish TIDS identification from IATA agency accreditation. Keep “IATA TIDS”
wording; do not advertise an IATA-accredited agency or use its accreditation logo.

[Zanzibar government advisory](https://www.us.tzembassy.go.tz/uploads/TRAVEL_ADVISORY_NOTICE_TO_ALL_FOREIGNERS_ENTERING_ZANZIBAR_-_OCTOBER_2024.pdf)
and [ZIC clarification](https://zic.co.tz/2026/10/07/public-notice-clarification-on-the-implementation-of-mandatoryinbound-travel-insurance-for-foreign-visitors-enteringzanzibar-and-tanzania-mainland)
support mandatory inbound cover. The official
[Kenya eCitizen insurance portal](https://insurance.ecitizen.go.ke/dashboard/travel)
states inbound travel health insurance requirements and exemptions. These checks
support the approved package insurance inclusions, not a promise of cover before
the actual policy is issued. Recheck requirements before each traveller’s departure.
Do not publish categorical Ghana-passport visa exemptions without current
official verification. No hotel/supplier names, star ratings or solo-supplement
amounts are introduced.

## Native intake source review — no submissions made

Inspected the public router and its two linked intake definitions:

- [Start Here router](https://docs.google.com/forms/d/e/1FAIpQLScGMaaTlFypujHyCIDNEhbk5mYImpJAH2xEMG-5ZBUfODdCzg/viewform)
- [Travel Readiness intake](https://docs.google.com/forms/d/e/1FAIpQLScRdTsIakvQs6rQ0ZfNM0y5oWjHUTI1p6LEedHSSwaUiMZt-g/viewform)
- [Full Planning intake](https://docs.google.com/forms/d/e/1FAIpQLScsf-XWyMm6hk-h5G_-KCPmyI7NFqO3VHFq5DfbdSRlZUBy3A/viewform)

Router branches to advice, full planning or a short decision question. Readiness
collects contact/call platform, date certainty, destination, purpose, party size,
budget, up to two styles, optional passport nationality/visa status and focus.
Full Planning collects service selection, destinations/timeframe, purpose, party
size, conditional valid-visa details, experience, solo/group preferences, budget,
accommodation, up to three accommodation priorities, food/pace/activities and
terms confirmations. Both contain source/referral and optional notes.

The forms contain stale 45-minute/add-on pricing and service-scope copy. The final
PDF wins: do not reproduce old add-ons or treat an enquiry as payment/booking.
Minimise optional health/religion/visa-expiry data; never request passport numbers,
document scans or payment information in a public enquiry. The short first-contact
form now persists classification and minimal planning/contact details with
transactional outbox preparation and idempotency. It is not yet a faithful
recreation of every question/branch above. Full branching, authoritative package
context and real email receipt remain release gates.
See [intake and Turnstile](./turnstile-and-enquiry-intake.md).

## Remaining release gates

This branch is not a complete launch release. Full intake branching, safe autosave,
protected actual Astro preview, independent records/publication, expanded
Superadmin policy, automatic hosted publish/deploy/verify, complete demo retirement
and real staff/provider staging acceptance remain open. Collection editors still
publish their containing page together; the UI states this limitation.

Approved bundled content is not proof of database seeding or hosted publication.
Before the first CMS publication, reconcile its manifest with the approved
baseline so publishing one page cannot silently remove other approved pages.
No shared database was seeded/reset by this change.

Validation evidence belongs in the progress log. Branch/CI success must not be
labelled verified production deployment or client acceptance.
