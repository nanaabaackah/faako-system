# TTNGH editorial refresh

Branch: `feat/ttngh-editorial-refresh`. Based on fetched `origin/main` at
`0a7977e5e`; existing TTNGH working edits carried forward with permission.
No merge, deployment, provider configuration, or infrastructure change.
Unrelated Dev ERP/shared-UI work is not part of this implementation.

## Baseline and locked elements

The published homepage was retrieved successfully after the initial web-tool
failure. Its introduction, programme cards, activity section, home calendar,
Scroll Expand and footer correspond to the committed baseline. This is a
structure comparison, not a claim of pixel-identical deployment.

The existing SiteHeader, SiteFooter and SharedFaakoFooter composition and
interaction are retained. The user's pre-existing sticky top offset (2rem)
is carried forward. Footer pink, Get in touch display type, contact strip,
search, legal/navigation/social links and attribution remain intact.
ScrollExpandSection's implementation is unchanged.

## Visual system

- White and black form the main surfaces. Pink is reserved for interactive
  accents, small numbering and the approved footer.
- Primary content grid: 1152px; gutters remain responsive. Editorial sections,
  shared heroes and homepage content use the same inset calculation.
- Section spacing: clamp(3rem, 7vw, 7rem). Full-bleed image/black treatments
  are deliberate exceptions, not alternating rounded panels.
- Montserrat handles body and editorial headings. Existing Kaftan display
  face remains an accent for Peace, Scroll Expand's frame text and the footer.
  No fonts were added and no new licensing claims are made.
- Navigation links remain text links. The existing joined label/arrow button
  personality remains. No generic pill navigation was introduced.

## Hero family

| Composition | Routes | Mobile behaviour |
| --- | --- | --- |
| Flagship photographic | / | Dedicated immersive hero, at most two actions; not PageHero |
| Immersive | /about, /programmes, /events, /news | Full photo above dark copy area; no tight portrait crop |
| Editorial | /impact, /resources | Asymmetric typography/photo grid, single column on mobile |
| Editorial, text-first | /team | Compact introduction preserves prominent founder feature |
| Conversion | /contact, /get-involved, /support-us | Task-focused copy and supporting image |
| Formal | CMS/detail templates; legal pages retain their compact legal layout | Text-first, no policy hero photography |

## Page changes

Home: value strip, editorial programme rows, sourced/verified impact component,
one CMS-selected upcoming event (or explicit unpublished-dates fallback),
up to three published updates, one Scroll Expand and a calm partner row.
The full month calendar is only on Events.

About: narrative story, unboxed mission/vision, founder feature, consent-aware
team preview, values with rules, sequential roadmap, editorial FAQ.
Programmes: pillars before CMS programmes, category/audience/availability
information, unboxed activity descriptions.
Events: featured upcoming event, dated editorial listings with registration
state, native calendar, recurring programme context, photo ribbon, FAQ, CTA.
Impact: publishable evidence with source/period/status, milestones and
programme photography. Unsourced numeric fallback claims are not displayed.
Team: one H1 restored; portrait-led founder and compact mobile leadership rows.
Get Involved/Support: typographic participation/funding pathways; donation
instructions are not fabricated and online payments are not implied live.
Contact: white form, visible labels, existing validation/Turnstile behaviour,
simple contact channels. No new submission or data-collection functionality.
News/Resources: publication-style listings with dates/categories; reviewed
resources retain reviewer/review-date context and link to full source metadata.
CMS: minimal configured Studio gateway, approved-editors note; no replacement
login/account flows. Remains noindex and excluded from sitemap.

## Card audit

| Previous use | Decision | Replacement |
| --- | --- | --- |
| Homepage programme cards | Replace with editorial row | Number, heading, summary, arrow |
| Mission/vision glass/bubble cards | Replace with editorial row | Paired statements with rules |
| Values, pillars, support descriptions | Replace with editorial row | Typography-led lists |
| Roadmap cards | Redesign | Sequential ruled progression |
| Statistics cards | Redesign | Large verified figures with provenance |
| CMS/event cards | Redesign | Image-led publication/event rows |
| Contact form/sidebar cards | Remove | White task surface and channel rows |
| FAQ bubble cards | Remove | Native details/summary with thin dividers |
| Event details / publication facts / urgent notice | Keep | Distinct contextual information objects |
| Team portraits | Retain | No loop and no mechanical floating-card wrapper |

## FAQ and motion

FAQ uses native details/summary: keyboard operation, browser-provided expanded
state, visible focus, associated answer regions, +/close indicator. Visible
content still feeds the existing FAQ schema; no extra SEO questions were added.

Site-wide ScrollReveal blur/fade was removed, including its component/CSS.
No GradientWaves implementation/import remains in this app; the unused OGL
direct dependency and TTNGH lockfile importer entry were removed. OGL remains
in the workspace lockfile where other applications need it.

The photo ribbon follows the [React Bits Logo Loop concept](https://reactbits.dev/animations/logo-loop),
but is a small static Astro/CSS implementation, not a new React island/library.
Four contextual images, 85-second cycle, pause button, hover/focus pause,
touch-to-pause, hidden/inert clones, static responsive reduced-motion layout.
Essential content is outside the animated ribbon. With JavaScript unavailable,
the original gallery remains horizontally scrollable and clones are hidden.

Scroll Expand remains at most once per page and retains focus reveal,
reduced-motion and mobile behaviour. It is not replaced by the ribbon.

## Photography

No new Drive sync was available during this pass. Existing approved optimized
assets were preserved in accordance with the brief's pre-R2 fallback. This is
not a claim to have reviewed the latest Drive additions. No Drive files changed.
See the source IDs/consent basis in `phase-1-image-inventory.md`.

| Existing Drive-derived asset | Current use |
| --- | --- |
| vision-community | Home hero; Events CTA |
| tema-school-conversation | Organisation introduction; Get Involved; gallery |
| vision-reflection | No-upcoming-event feature; Resources; photo ribbon |
| vision-facilitator | Events hero; Home/About CTA |
| vision-listening | About story; News hero; Resources CTA |
| tema-school-team | About hero; programme/participation CTAs |
| tema-school-speaker | Programmes hero; gallery |
| tema-school-audience | Impact and Support heroes |
| vision-conversation | Gallery |
| Existing approved portraits/logos | Team, founder, partners |

No new web assets generated. Intentional repeated images remain across routes;
diversification with newly approved Drive/R2 media is a follow-up. Photos are
not labelled as counselling clients, diagnoses or undocumented volunteer events.

## Validation

Validation is recorded below after browser/fixture QA completes. Passing the
build alone is not visual acceptance. No WCAG certification or production
payment/contact activation is claimed.
