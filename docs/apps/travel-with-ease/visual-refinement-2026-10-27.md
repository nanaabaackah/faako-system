# Roadmap-aligned visual refinement — 27 October 2026

## Boundaries

Local implementation and demo only. No deployment, database migration, map editor,
live footprint API or portal-to-website draft synchronisation is included.
Existing authentication, permissions, tenant checks and publication approval remain.
Unrelated TTNGH and Dev ERP edits were left alone.

## Design and source decisions

- Homepage sequence follows the roadmap: hero, packages, footprint, process,
  journal, FAQs/testimonial approval state and final enquiry CTA.
- The closing CTA borrows the centred copy/button-to-image composition from
  https://flighty.com, using existing approved TWE photography in place of devices.
  Final new imagery still awaits the owner. No Flighty assets or claims are copied.
- Sileo (https://sileo.aaryan.design) informed the compact status capsule and
  expanding message treatment. Its package/code was not installed or copied.
- Fade Content and Animated Content from React Bits informed two native
  once-only opacity/12px translation reveals. Their current GSAP/ScrollTrigger
  implementations were not imported. The existing Faako reveal hook has blur and
  repeat/exit behaviour, so a small Astro-side native implementation avoids
  changing other apps or hydrating editorial text. Reduced motion is static.
- Iconsax Outline geometry is extracted from the already installed
  iconsax-react 0.0.8 package (MIT). Licence retained in
  packages/ui/src/components/Iconsax-LICENSE.txt. No icon dependency added.
  Its ArrowRight3/ArrowLeft3 exports correspond to the catalogue arrow-right-4/
  arrow-left-4 geometry; the facade exposes the requested *4 names.
- ArrowRight4 is explicitly rendered inside ContentLink and CTA buttons, never
  appended globally. Ordinary navigation, brand, legal and cookie links have none.

## Footprint

Natural Earth 1:110m country boundaries are public domain:
https://www.naturalearthdata.com/about/terms-of-use/

Source URL and SHA-256 are embedded in world-boundaries.json. Equirectangular
projection, rounded to 0.1 viewBox units; Antarctica omitted. Boundaries without
a valid ISO identifier remain neutral, not selectable. This is a country-level
overview, not a navigation or political-boundary authority.

Frontend records contain countryCode, total and status (verified/demo). Duplicate
countries, unknown codes, negative/fractional/unsafe totals and demo records in
public mode fail validation. Only aggregate fields survive the projection.
Totals represent completed + confirmed upcoming activity, supplied already
aggregated; the audited pipeline remains separate work.

Fixed base-10 bands: 0, 1–9, 10–99, 100–999, 1,000+. Zero and unavailable countries
are neutral; the accompanying text distinguishes absent records from known zero.
Zanzibar is represented within Tanzania. Local fixture counts are illustrative,
not business records, and are excluded from production pages. Public maps show
an honest empty-data state until approved records exist.

The homepage and compact footer use the same component, scale and country list.
Keyboard/tap selection updates a live detail line. The static list remains
available without JavaScript and avoids requiring precision taps on small countries.

## Feedback interface

Faako ToastProvider gains optional presentation="twe" and updateToast(id, patch).
Default presentation is unchanged. TWE-only CSS is explicitly imported by TWE.
The TWE variant replaces repeated IDs, pauses remaining time while hovered/focused,
keeps loading/error messages until resolved or dismissed, and never steals focus.
Status/alert regions announce messages. Toasts sit at the top, clear of bottom
navigation and cookie controls. Inline errors remain authoritative and durable.

Portal POST operations show completion only after the API resolves; publication
request success is explicitly not a deployment confirmation. Demo toasts say
nothing was sent/published. The website demo has separate personalised/package
states, no personal data, no API call and no persistent storage.

## Verification and handoff

Run browser-refinement.mjs with local-only TWE_TEST_WEB/TWE_TEST_PORTAL origins.
It checks four viewport widths, arrows, map/list agreement, keyboard selection,
both enquiry paths, no-send behaviour, toast timing/replacement/pause/dismissal,
reduced motion and no-JavaScript content. Screenshots are written to /tmp.

The existing 4328 dev server had an outdated Vite dependency cache. Verification
uses isolated 4338/5198 previews, without stopping the user's server. Restart
pnpm run dev:twe if the old session still reports Outdated Optimize Dep.

Bundle baseline before this phase: portal JS 314.99 kB (95.29 kB gzip), CSS
134.51 kB (20.37 kB gzip). First completed build: JS 329.19 kB (100.32 kB gzip),
CSS 136.26 kB (20.81 kB gzip). The map is server-rendered SVG, not a mapping
runtime. Demo hydration is absent from the production /demo redirect.

## Portal completion pass

All existing portal surfaces now share the TWE operational styling: dashboard,
enquiry list and individual enquiry, content editor (including preview, publication
and revision history), media library/upload, staff access, system diagnostics and
application-owned sign-in/help states. Cloudflare's hosted identity-provider page
is outside this CSS boundary.

The enquiry detail separates request fields, private contact information and
follow-up status; changing status does not imply a traveller was contacted
automatically. Mobile layouts stack the panels and retain the existing bottom
navigation. Content/media text fields use Faako components; the native file picker
remains for accessible OS file selection. Permissions and API contracts are unchanged.

UiSystemProvider exposes toastPresentation="twe"; toast portals mount only after
hydration to avoid SSR mismatch. No second provider is required.

Final portal build: JS 331.72 kB (100.85 kB gzip), CSS 139.52 kB (21.41 kB gzip).
Portal lint, typecheck and build passed. Website browser acceptance passed for
four sizes, map/list, keyboard, demo journeys/no-send, toast lifecycle, reduced
motion and no-JavaScript. The owner demo does not grant platform privileges:
system administration visual changes do not constitute live platform-role acceptance.
Owner-demo enquiry detail, content, media and staff screens passed Chrome overflow
checks at 320, 390, 768 and 1440px. Screenshots were captured for each screen/size.
Action buttons and dashboard shortcuts now use label-then-icon order as requested;
mobile bottom-navigation icon placement remains unchanged. Shared fields are
excluded from legacy native-input styling to avoid doubled borders.
