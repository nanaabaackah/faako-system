# REEBS responsive layout verification — 2026-09-29

## Scope and method

This is a corrective layout pass, not a redesign. Existing Faako cards, colours,
themes, navigation hierarchy and business rules are retained. Water remains a
separate business domain. Public storefront purchasing and booking remain paused.

The initial browser sweep covered 21 portal routes and 16 storefront routes at
320, 390 and 768 CSS pixels. It measured control intersections and clipping, not
just document horizontal overflow. Screenshots were captured with synthetic API
responses; no real customer data, credentials, database or provider was used.
Full-page screenshots alone are insufficient for the storefront's inner scroll
container, so targeted card/action checks supplement them.

## Findings and corrections

| Step | Surface | Finding / correction | Verification |
| --- | --- | --- | --- |
| 1 | Portal headers | The desktop `18rem` flex basis became a large blank vertical area when headers stacked. Reset the basis on small screens. | Header/control bounds at 320, 390, 768 and 1280px. |
| 2 | Inventory and shared actions | A non-wrapping toolbar clipped Archived, Recently deleted and Refresh. Allow wrapping; use explicit opt-in icon-only secondary controls with retained accessible names and 44px targets. Keep primary action text. | Toolbar and opened admin-menu bounds; keyboard activation. |
| 3 | CRM | Refresh text protruded from an icon-sized button; the absolutely positioned Archive action covered customer status/content. Keep archive in card flow and compact the register action. Preserve the register's horizontal scroll width. | Long customer names, separate click targets, compact Refresh keyboard operation. |
| 4 | Payments and Water | Desktop ellipsis rules truncated mobile card references and names. Allow card copy to wrap while retaining desktop table styling. Keep pagination names accessible when visual labels are compacted. | Populated cards, reference wrapping, pagination, payment dialog. |
| 5 | Documents | Grid intrinsic sizing and wrapping column controls pushed forms and copy beyond the visible area at 320px. Use shrinkable tracks and constrain file inputs and toolbar children. | Form controls within the viewport. |
| 6 | Scheduler | Holiday names expanded calendar tracks and clipped days/navigation. Use shrinkable seven-column tracks, stack navigation where necessary, and show an Iconsax holiday icon on phones. Full dates, holiday names and booking counts remain in accessible day labels. | Calendar buttons fit; month navigation works. |
| 7 | Settings | Bottom-sticky save bars floated over theme/profile fields. Keep save actions after their fields in normal flow. | Save preferences and theme selector do not intersect. |
| 8 | Smaller operational controls | Inventory filters/row menus, Marketing actions and Delivery filters had short touch targets. Give the scoped mobile controls a 44px minimum height. | CSS review and browser sweep. |
| 9 | Storefront shop | Empty-state copy had a `65ch` minimum width and was clipped by its container. Change this to a maximum width with shrinkable mobile tracks. | Explicit no-results search, nested content bounds at four widths. |
| 10 | Storefront rental details | Long disabled booking labels overflowed their action container at 320px. Allow labels and the flex child to shrink/wrap. | Containment and disabled-booking assertions. |
| 11 | Storefront Contact | Three fixed tablet columns crowded email and social links. Use content-sized responsive tracks, wrapping socials and breakable long links. | Pairwise link-intersection checks at four widths. |
| 12 | Payment pagination | Tablet pagination inherited the wide table's scroll track. Keep pagination outside the table scroller and allow its controls to wrap. | Pagination bounds checked independently of column scrolling. |

## Reproducible regression coverage

- `apps/reebs-portal/tests/mobile-layout.spec.ts`: phone/tablet/desktop headers,
  inventory menus, CRM, documents, scheduler, preferences and payment details.
- `apps/reebs-website/tests/mobile-layout.spec.ts`: empty search results, rental
  actions and contact links, with external requests blocked and API fixtures.
- Existing `bookings-modal.spec.ts`, `invoicing-responsive.spec.ts` and
  `water-responsive.spec.ts`: booking dialogs, issued-document protection, Water
  light/dark restock dialogs, focus/keyboard handling and automated accessibility.

The local runners use `REEBS_SKIP_ENV_FILES` with an explicit placeholder-only
environment and localhost API targets. Do not run these checks against production.

## Verification results

- Changed-file ESLint and Git whitespace checks pass.
- Storefront regression suite: four viewport tests pass (320, 390, 768, 1280px).
- Existing booking, invoicing and Water dialog checks: five selected tests pass,
  including Water light/dark keyboard and automated accessibility checks.
- Storefront production build passes: 1,125 static pages generated.
- Portal production build passes (1,633 modules). Final portal layout checks
  pass at 320, 390, 768 and 1280px across focused reruns; the last phone/desktop
  rerun also asserts full customer-cell wrapping.
- A development-server rerun timed out loading the first inventory page while
  builds and screenshots were running concurrently. This is recorded as a failed
  run, not counted as a passing viewport check.
- The expanded screenshot sweep attempted 30 portal routes at three widths:
  88 completed with no document overflow or intersecting visible form controls;
  two 320px screenshot captures timed out. The sweep exposed the payment
  pagination issue and an additional high-specificity rule affecting plain-text
  customer cells; both received focused corrections.

## Evidence limits and remaining debt

- This is browser-emulated Chromium coverage, not a claim of complete WCAG
  compliance or physical iOS/Android verification. On-device Safari, soft-keyboard
  resizing and assistive-technology testing remain release checks.
- Some broad-sweep modules use empty fixtures. Their layout checks do not establish
  that every populated ledger, permission combination or backend workflow works.
- Visually hidden table headings and native inputs behind custom controls require
  interpretation: raw rectangle intersection is not by itself a visible overlap.
- Tablet touch targets in Inventory, Marketing and Delivery still warrant an
  on-device review; the 44px overrides in this pass target phone breakpoints.
- Third-party fonts/services were blocked in isolated checks. No provider or map
  integration behavior was changed by this pass.
- Security scan and security gate pass. With separate owner approval, missing
  Travel With Ease metadata was corrected and its existing shared header/CORS
  behavior was tested. These release-readiness fixes are separate from the
  responsive commit; production startup remains blocked for Travel With Ease.

## Release separation

The pre-layout release candidate is `a949d6d13`. These responsive changes belong
on `develop` only and must not be included when promoting that earlier candidate.
Production auto-deploy is active. The owner subsequently authorized structural
migrations without deleting existing data and confirmed a recent restorable
backup. The eight migrations were source-reviewed; see
`PRODUCTION_MIGRATION_REVIEW_2026_09_30.md`. A separate release worktree preserves
the pre-layout cutoff and main-only Faako branding. No direct database, import
or migration command is part of this responsive pass.
