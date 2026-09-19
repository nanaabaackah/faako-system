# REEBS Invoicing architecture

## Domain contract

Invoicing owns draft composition, issue, immutable document snapshots, invoice numbering, PDF/export presentation, delivery metadata and invoice status projections. Payments owns collection, Paystack, manual payment authorization, payment records, payment applications, verification and refunds. Orders and Bookings remain the authoritative commercial sources for their own totals. Accounting consumes issued Core documents and verified payments; it does not make invoices paid.

Water is a standalone business domain. The Core endpoint accepts only `manual`, `orders` and `bookings` sources and persists `REEBS_CORE`. A future Water invoice must be owned by a Water route, Water permissions, Water numbering, Water financial views and Water reconciliation. Water values must never enter Core invoice totals by default.

## Lifecycle

```text
Draft (editable, unnumbered)
  -> Issue transaction
       -> lock draft
       -> reload trusted Order/Booking total or calculate manual lines
       -> snapshot source + customer + financial values
       -> reserve INV/REC-year-sequence atomically
       -> commit inventory compatibility side effect
       -> mark issued and audit
  -> Send persisted document by ID (delivery failure does not unissue)
  -> Payments applications derive unpaid / partially paid / paid / overdue
  -> Void only with permission + reason and only after applied payments are resolved
```

Issued and void documents are immutable in the staff editor. Corrections require a new draft; issued documents are never hard-deleted. Legacy rows remain readable with `paymentStateVersion = 0`, so the migration does not invent historical payments.

## Persistence

`invoiceDocument` stores the editable draft fields plus `businessUnit`, `currency`, `customerSnapshot`, `sourceSnapshot`, `financialSnapshot`, `paymentStateVersion`, issue/void actors and timestamps, and a revision. `invoiceNumberSequence` reserves a number by organization, type and year using one atomic upsert. The partial unique invoice-number index is the final collision guard.

The financial snapshot uses integer pesewas. Browser-supplied status, number and send timestamps are ignored for draft writes. Compact lists receive a derived payment summary; detail reads may also return a bounded safe payment timeline.

## Operations

- Validate schema: `pnpm --filter @faako/reebs-portal run db:validate:dev`
- Generate Prisma Client: `pnpm --filter @faako/reebs-portal run db:generate`
- Read-only development audit: `pnpm --filter @faako/reebs-portal run invoices:reconcile:dev`
- Read-only production audit: set `REEBS_ALLOW_PRODUCTION_READINESS_CHECK=true`, then run `invoices:reconcile:prod`.

Migration `20260904120000_invoicing_integrity` is additive. Apply it only through the normal reviewed deployment workflow. The reconciliation command never repairs or migrates data.

## Deferred boundaries

Customer self-service invoice history, credit notes, refunds, recurring invoices, automated reminders, statutory tax configuration, journal redesign and Water invoicing are not fabricated by this phase. PDF rendering remains dynamically loaded in the portal. Email uses the stored issued snapshot and trusted recipient; it does not accept a browser-authored financial document.
