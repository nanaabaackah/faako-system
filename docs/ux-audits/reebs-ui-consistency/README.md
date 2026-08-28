# REEBS portal and website UI/UX consistency audit

Date: 2026-08-13

## Phase 2 experience standard

This document is the durable REEBS Phase 2 standard. It records the current
patterns rather than introducing a parallel design system.

### Navigation hierarchy

- **Overview:** Dashboard, Reports.
- **Sales & Rentals:** Bookings, Rentals, Orders, Customers, POS where the role can use it.
- **Operations:** Inventory, Delivery, Maintenance, Documents.
- **Finance:** Receipts & Invoicing, Expenses, Accounting, Vendors.
- **People & Growth:** Human Resources, Marketing, Directory, Timesheets.
- **Water Business:** Water. Water sub-areas remain inside the implemented Water workspace; no empty routes are created.
- **Administration:** Audit Log, Settings, Users and the public website link where permitted.

Visible items use an intentional task order within each group. Existing route
paths and permission checks remain authoritative. `Water Business` is a
separate group, not a child of Inventory, Rentals or Accounting.

### Shared page and interaction patterns

- Admin pages use `AdminPageHeader`, backed by the shared `PageHeader`: concise
  title and context, then primary and secondary actions.
- The standard content order is header, optional decision-useful summary,
  search/filters, primary content, and pagination/supporting controls.
- Reuse `DataTable` or `ERPTable` for sortable data views and their loading,
  empty and error states. Keep primary columns visible on small screens and hide
  secondary columns before using intentional horizontal scrolling.
- Reuse the shared form fields, sections, validation messages, action bars and
  notices. Required fields are explicit, invalid inputs are associated with
  useful text, and submit buttons expose busy/disabled state.
- Reuse shared modal, drawer and confirmation primitives for new work. Dialogs
  must be named, trap focus, close with Escape when safe, and restore focus.
- Status components always pair colour with visible status text. Business
  status meaning remains in its owning domain.
- New generic UI belongs in `@faako/ui` only when more than one module can use
  it. Booking, rental and Water-specific components stay inside their domains.

### Responsive and accessibility rules

- Validate at 320, 375, 430, 768, 1024 and 1440 pixels. Reflow forms, filters,
  tables, dialogs and checkout rather than shrinking desktop layouts.
- Interactive controls retain visible focus, keyboard operation, accessible
  names and practical touch targets. Statuses never rely on colour alone.
- Motion must be subtle and respect `prefers-reduced-motion`. Dark-mode updates
  must retain readable inputs, tables, dialogs, badges, borders and focus rings.

### Water UX boundary

Water may share the shell, identity, access infrastructure and generic UI, but
its orders, customers, stock, revenue, costs and profitability remain
Water-specific. Core REEBS dashboards do not include those figures by default.
Any future cross-domain view must use the explicit label `Consolidated`. The
detailed domain rule remains in `docs/architecture/reebs-water-domain.md`.

## Scope and evidence

The audit inspected `@faako/ui`, application theme tokens, portal navigation and representative pages, plus the Astro website homepage, catalogue, product detail, cart, checkout, customer access, contact, policy and error views. Baseline and post-change screenshots are stored in `before/` and `after/`; each folder includes a capture manifest.

## Issues discovered

- Portal navigation was a flat alphabetical list with no requested business hierarchy; Water was nested conceptually under Inventory and lacked a distinct desktop treatment.
- Water used the ambiguous title `GWater`, nine equally weighted KPI cards and generic finance labels.
- Several operational pages mix shared page/table/form primitives with local variants. Orders is closest to the desired header-summary-filter-table flow; Inventory and Dashboard remain card-heavy.
- Settings is a long form whose save action disappeared below the viewport and whose muted/help text did not consistently meet AA contrast.
- Public transactional pages used full-viewport hero treatments, delaying cart, checkout and catalogue tasks.
- The homepage newsletter form was visually more prominent than rental and shop conversion paths.
- The consent component was announced as a non-modal dialog, occupied too much mobile height, and used undersized controls.
- The closed cart dialog remained in the accessibility tree and did not contain or restore focus.
- Four Water number inputs lacked accessible names; the shared date trigger used an unsupported ARIA attribute.

## Changes made

- Added portal groups: Overview, Sales & Rentals, Operations, Finance, People & Growth, Water Business and Admin.
- Renamed the final navigation group to Administration, exposed implemented
  task-level modules instead of ambiguous umbrella links, moved Documents to
  Operations, and used Customers rather than CRM in primary navigation.
- Added a distinct teal Water navigation treatment without changing REEBS branding or access rules.
- Reframed the Water page as a standalone business area, with four primary Water indicators and a separate cash/credit/cost breakdown.
- Added a sticky, accessible save-action surface for long Settings forms.
- Corrected shared table `aria-sort` placement and sort-control labeling.
- Added primary homepage rental/shop actions and made newsletter language secondary.
- Restored complete storefront navigation through one shared route configuration
  used by the React and Astro shells; corrected case-sensitive route links.
- Reduced catalogue, cart and checkout hero height so primary tasks enter the first viewport sooner.
- Compressed first-visit consent, increased touch targets, and represented it as a labeled region rather than a dialog.
- Removed closed cart dialogs from the accessibility tree; added focus containment, Escape close and focus restoration to cart and mobile portal dialogs.
- Corrected Water input labels, date-trigger ARIA, muted text contrast, current-breadcrumb contrast and Water bottom-navigation contrast.

## Water treatment

Water is not presented as ordinary REEBS revenue. The page explicitly says its stock, orders, revenue, costs and cash position are Water-only and excluded from REEBS rental/event metrics. The backend registry test continues to enforce default exclusion from core analytics. See `docs/architecture/reebs-water-domain.md`.

## Verification

- Phase 2 portal unit tests: 106 passed, including navigation hierarchy and Water separation coverage.
- Website tests: 10 passed, including preserved storefront design/bottom CTA, generated rental details and error recovery actions.
- Portal and website production builds: passed.
- Website Astro typecheck: 0 diagnostics.
- Focused lint: passed; full portal lint has 0 errors and 11 pre-existing warnings.
- Security scan and security gate: passed.
- Axe: no WCAG A/AA/2.1 AA violations on homepage, checkout, product detail, mobile Water or mobile Settings in the final run.
- Keyboard: cart and mobile navigation dialogs open with focus on Close, close with Escape and restore focus to their invoker.
- Reduced motion: browser preference detected and exercised.
- Responsive captures: no horizontal overflow at 1440 px or 390 px.
- Static route audit: 1,125 HTML routes, 22 rental details, 1,045 shop details
  and 18 linked assets passed.
- The latest full storefront browser pass reached every root route, all rental
  detail routes, desktop/mobile overflow checks, cart, navigation and reduced
  motion. Its only failure was the preview server returning HTTP 200 for the
  explicit `/404` document; the runner now accepts static-preview semantics
  while continuing to verify status-page content and recovery actions.

## Remaining debt

- Migrate page-local tables, filters and dialogs to shared patterns incrementally; Inventory, Invoicing, Bookings and the legacy Admin workspace are too large for a safe one-pass rewrite.
- Reduce Dashboard and Inventory card density after metric ownership and operator priorities are agreed.
- Keep Astro-rendered catalogue routes aligned with the established shared
  storefront chrome and preserved React views. Any visual change must be shown
  to and approved by the owner before implementation.
- Add maintained visual-regression assertions for the captured routes.
- Expand unsaved-change handling to remaining long forms; existing coverage is representative, not universal.
- Complete a dedicated customer account/authentication journey review; the current `Customer login` flow behaves more like booking continuation than a full account centre.
