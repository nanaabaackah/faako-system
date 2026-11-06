# TWE homepage visitor journey — 2026-11-06

## Purpose

Bring visitors from travel inspiration to a relevant enquiry without turning the homepage into a complete package catalogue or changing the existing cinematic brand system.

## Primary navigation

The brand links to Home. Main links, in order: Packages, Services, How It Works, Journal, About. One prominent **Plan My Trip** action scrolls to the existing enquiry section on the current page. Contact, FAQs, travel footprint and legal pages remain accessible through page content/footer instead of crowding the menu.

## Homepage order

1. Existing cinematic hero: **Plan your trip** and **Explore Packages**. Its scroll cue moves to About.
2. Short About introduction, using the approved CMS About copy and linking to /about.
3. Compact four-service overview, from the approved CMS Services data and prices. Each service links to its detail anchor on /services.
4. Two featured packages drawn from the published Packages collection (Zanzibar and Nairobi), with actual CMS imagery, starting prices and reference month. The full searchable/filterable catalogue stays on /packages. If a featured package is not published, it must not be fabricated or displayed.
5. How It Works, using the existing image-led chapter. The homepage wording is deliberately general; package-only deposits and balances remain in actual package terms.
6. Existing interactive cream Travel Footprint and underlying approved metrics.
7. Existing published Travel Tips preview, linking to the full collection/related Journal content.
8. Existing five-device closing CTA, enquiry experience and cinematic footer — unchanged in structure.

## Trust and commercial constraints

All offers are enquiry-led, not online checkouts. Starting package prices are indicative, per person sharing and include return flights from Accra; final quotes depend on live dates, airfare, availability and exchange rates. Source-backed packages and service descriptions come from the existing approved publication snapshot, not additional fixtures. Unpublished or incomplete packages are not introduced on the homepage.

Keep founder-experience and business-trip metrics distinct. Do not invent customer testimonials or business credentials.

## Implementation notes

- Home services: `HomeServices.astro`; CMS-driven, no new content database/schema.
- Featured packages: `FeaturedJourneys.astro`; CMS-driven with the existing pricing formatter.
- Styling: `styles/components/home-features.css`; responsive, scoped to new sections and existing design tokens.
- Hero, navigation and process labels: small in-place changes.
- Tests: `pnpm --filter @faako/travel-with-ease-web test` plus lint, typecheck and build. A source-level homepage contract test protects ordering and labels.
- Accessibility: semantic section headings, actual links, no new client-side JS or fake cards.
- Deployment and publication: no CMS snapshot, API, data migration or production settings changed as part of this UX-only branch. A merged PR does not on its own prove hosted staging acceptance.

## Local contributor sequence

If local edits existed before this feature branch was merged, fetch current `develop`, preserve uncommitted changes and reconcile overlapping edits before pushing. Never force-push `develop`.
