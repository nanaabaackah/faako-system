# Portal actions, Water corrections and invoice opening

Date: 2026-10-02. Local implementation only; no deployment, migration, Git
operation or production/staging data write was performed.

## Action standard

Use `src/components/PortalAction/PortalAction.jsx` for new Portal action buttons
and action links. It reuses the shared Faako ERP action classes and Iconsax.

- At 768px and above: icon and text, except add/delete/view/open/archive, which
  are icon-only at every width.
- Below 768px: icon-only action controls.
- Always provide a descriptive accessible name and tooltip, visible focus and
  a minimum 44px target. Disabled/loading controls retain their name.
- Migrated action controls use Faako theme-filled pill shapes (circular for
  icon-only actions). Dashboard View affordances use arrows rather than eyes.
- Navigation, tabs, date/select triggers, quantity presets and disclosure
  summaries keep their text; they are not action-button labels.

Adopted for Dashboard actions, activity links, Water schedule/restock/sale/save/
archive actions and Commercial scheduling controls. Existing invoice header
actions follow the same responsive visibility, with archive icon-only.
This is not a claim that every legacy control across every module was migrated.

The Dashboard now places an Operational snapshot below Recent activity, using
existing permission-scoped booking, delivery and Core stock aggregates. It does
not introduce new metric calculations or mix Water into Core. Dashboard period
selection and Commercial effective dates use the shared Faako popovers/calendar.
System Health uses a Faako card disclosure with an explicit chevron, visible
keyboard focus, native Enter/Space operation and reduced-motion support.

## Water

Two independent failures were found:

1. A missing company/bulk schedule erased valid retail prices from the dashboard.
   Missing price types are now represented individually. Overlapping schedules,
   other configuration errors and database errors still fail closed. Retail
   preview can use its configured retail price when no bulk tier exists and
   respects the retail minimum quantity; the mutation remains authoritative.
2. A price-only correction unnecessarily resolved a historical schedule again.
   Owners/admins can now correct a recorded sale's price while retaining its
   original standard-price reference and cost snapshot. Existing transaction,
   stock and concurrent-edit checks remain. Water staff cannot correct prices.
   An unchanged date-only form value preserves the original sale timestamp.
   Quantity/channel/date changes still require a matching effective schedule.

Existing restock cost correction remains owner/admin-only. No override reason is
required. New sales still need an effective product/quantity/date price, a cost
basis and the required discount configuration; no invented or cross-product
default prices are introduced.

## Invoice and health failures

- `getInvoiceDetails` called the attendant calculator without its required rate,
  producing the reported booking-invoice 500. Viewing now uses saved `feeCents`
  (already rendered by the invoice builder) and saved expenses, without creating
  another attendant expense.
- `generateInvoice` had the equivalent missing delivery-rate argument. Viewing
  now uses saved grand total/delivery/tax amounts, without repricing or counting
  delivery twice. Compatibility identifiers remain available to the editor.
- Invoice detail requests use the existing authenticated shared API client.
- Health routes now answer OPTIONS using the existing origin allowlist. This
  fixes the health preflight 404 without allowing arbitrary origins or accessing
  the database during OPTIONS.

## Validation and release limits

Focused tests use mocked database clients and synthetic browser accounts; real
credentials and environment files are not loaded. See the dated follow-up in
`apps/reebs-portal/design-qa.md` for outcomes. Production must receive both frontend
and API changes before these local fixes can be verified there. The exact
production Water schedule/product/date combination has not been inspected.

Roadmap debt remains: linked-invoice/canonical settlement review (RI-012),
delivery-distance consistency (RI-018), and legacy action-button adoption.
