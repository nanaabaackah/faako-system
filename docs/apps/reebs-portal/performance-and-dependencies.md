# REEBS performance and dependency boundaries

This note records the Phase 3 performance rules for REEBS Portal and REEBS Website.
It supplements the architecture foundation without changing business behavior.

## Loading boundaries

- Portal routes load through `src/app/routeConfig.js` and the domain loaders under
  `src/modules`. Accounting, Water, reports, audit, documents, invoicing, HR,
  maintenance, marketing, settings and delivery remain separate lazy routes.
- Water remains a standalone business bundle and data domain. Its route, permissions,
  reporting and finance behavior must not be merged into REEBS Core.
- Google Maps is restricted to the scheduler route in Portal. Website contact loads
  its map component through a dynamic import; other storefront routes do not request it.
- jsPDF and its table plugin are imported only when a user requests a PDF from
  Documents or Invoicing. The portal entry must not preload PDF chunks.
- The existing route fallback keeps the portal shell stable and provides an announced,
  readable loading state while lazy modules load.

## Website hydration

Astro remains responsible for URLs, HTML, metadata and SEO-visible catalogue content.
Use `client:load` only for immediately interactive cart, checkout, account, booking,
catalogue and navigation experiences. Non-critical scroll reveal, analytics, client
setup, static-page enhancements and catalogue footers use idle or visible hydration.
Do not replace server-rendered product names, descriptions or pricing context with a
client-only loading shell.

## Dependency decisions

- Iconsax React is the primary icon package. The inherited `iconsax`, `react-icons`
  and `lucide-react` packages are not required by either REEBS client.
- CSS owns ordinary transitions. `animejs`, `framer-motion`, `react-tsparticles` and
  `click-spark` had no REEBS consumers and are not runtime dependencies.
- Leaflet and React Leaflet had no consumers; both current map features use the Google
  Maps React package.
- Portal retains `pg`, Express and OpenAI for backend-only code; `csv-parse` and
  Papa Parse remain for explicit operational scripts. None are imported by `src/`.
- Website retains React Router because current interactive islands use MemoryRouter,
  route params, links and location state inside Astro-owned routes. Removing it requires
  a separately verified island rewrite.
- Website retains PropTypes for the shared interactive `SideNav` used by Shop and Rentals.
- `fs`, `psql`, `railway` and `brew` are not application dependencies. Node's built-in
  filesystem APIs remain valid in explicit scripts and build tooling.

## Bundle reporting and budgets

Build both apps and run `pnpm run bundle:reebs`. The report covers total emitted JS/CSS,
largest vendor/icon/PDF/map boundaries, Accounting and Water routes, website client JS,
and website hydration directives.

Current warning budgets allow normal build variance but should trigger review above:

| Metric | Review threshold |
| --- | ---: |
| Portal entry JS | 80 KiB |
| Portal vendor JS | 520 KiB |
| Portal largest lazy route JS | 140 KiB |
| Portal PDF chunk | 390 KiB |
| Portal map chunk | 165 KiB |
| Portal icon chunk | 360 KiB |
| Website total client JS | 1,050 KiB |
| Website largest JS chunk | 380 KiB |

These are review thresholds, not permission to merge domain bundles. Report any increase,
including CSS or hydration regressions, alongside the benefit that justified it.

## Remaining bottlenecks

- Phase 2 page CSS is repeated across many lazy Portal routes. Consolidation needs visual
  regression coverage and is deferred rather than risking an unapproved redesign.
- Website Navbar and storefront context code remains the largest client boundary because
  search, cart, currency, session and mobile navigation are immediately interactive.
- Large legacy public images need a reviewed thumbnail/medium/full derivative plan; do
  not silently recompress brand or product imagery in a dependency-cleanup pass.
- Several large administrative APIs still return complete collections. Server pagination
  requires compatible API work and is deferred.

