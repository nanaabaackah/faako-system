# Dev ERP Proposal Module Plan

## Purpose

Document the Dev ERP Proposal Generator foundation before server PDF rendering, digital signatures, invoice conversion, Paystack payment links, or AI-assisted proposal generation are implemented.

## Current Foundation

- Route: `/proposals`
- Internal preview route: `/proposals/:proposalId/preview`
- Frontend page: `apps/dev-erp/src/pages/Proposals/Proposals.jsx`
- Export-aware preview component: `apps/dev-erp/src/pages/Proposals/ProposalPreview.jsx`
- Client proposal view: `apps/dev-erp/src/pages/Proposals/ProposalClientView.jsx`
- Local schema helpers: `apps/dev-erp/src/pages/Proposals/proposalSchema.js`
- Template management helpers: `apps/dev-erp/src/pages/Proposals/proposalTemplates.js`
- Export metadata helpers: `apps/dev-erp/src/pages/Proposals/proposalExportConfig.js`
- Styles: `apps/dev-erp/src/pages/Proposals/Proposals.css`
- Authenticated API routes: `/api/proposals`, `/api/proposals/:id`, `/api/proposals/:id/share-token`
- Client-safe public API routes: `/api/proposals/view/:token`, `/api/proposals/view/:token/approve`, `/api/proposals/view/:token/request-changes`
- Client-facing route: `/proposal/view/:token`
- Additive schema: `Proposal`
- Migration: `apps/dev-erp/prisma/migrations/20260518000000_add_proposal_foundation/migration.sql`
- Registry entry: `apps/dev-erp/src/config/adminModules.js`
- Navigation adapter: `apps/dev-erp/src/app/navigation.js`

The current implementation supports private, authenticated proposal persistence, internal preview, secure token-based client view, and lightweight client approval/request-changes responses. Draft, internal-review, archived, invalid, and expired proposals are not exposed through the client view. Client actions are available only while a proposal is `shared`; approved and changes-requested proposals remain viewable for confirmation. Invoice/payment workflows remain disabled.

## Persistence Foundation

Saved proposals include:

- Organization scope
- Creator/last editor references
- Proposal title
- Client name
- Proposal type
- Proposal status
- Lightweight version number
- Metadata
- JSON proposal content
- Created/updated timestamps
- Optional secure token timestamps for future sharing

Statuses currently supported:

- `draft`
- `internal_review`
- `shared`
- `changes_requested`
- `approved`
- `archived`

The version number increments when a proposal record is saved through the authenticated update API. Full revision history is not implemented yet.

## Approval And Request Changes MVP

- Proposal status can be updated internally through the authenticated editor.
- Lightweight workflow metadata lives inside the proposal content JSON and is saved with the proposal record.
- Workflow metadata includes:
  - Internal review notes
  - Internal comments
  - Client change-request notes
  - Readiness checks for scope, pricing, timeline, terms, and approval copy
  - Server-owned status update metadata and status history
  - Lightweight client response metadata from secure proposal links
- Status history is generated server-side when the status changes and records status, timestamp, and the authenticated actor label where available.
- Shared proposal links expose Approve proposal and Request changes actions only when the proposal status is `shared`.
- Approving through the secure link updates the proposal status to `approved` and stores client name/contact plus an approved timestamp inside `content.workflow.clientResponse`.
- Requesting changes through the secure link requires feedback text, updates the proposal status to `changes_requested`, stores client name/contact/message plus requested-changes timestamp inside `content.workflow.clientResponse`, and mirrors the message into `clientChangeRequestNotes` for internal review.
- The internal Dev ERP proposal workflow panel shows the current status and any client response/feedback.
- This is not a full collaboration, notification, audit-log, digital signature, invoice conversion, or payment workflow system.

## Proposal Types

The schema prepares reusable proposal support for:

- ERP proposals
- Website proposals
- Onboarding proposals
- Future travel proposals

## Template Management Foundation

- Proposal templates now live in `proposalTemplates.js` instead of being hardcoded directly inside the base block schema.
- Each template includes:
  - Template key and id alias
  - Template name
  - Template description
  - Proposal type
  - Default section order
  - Enabled and disabled section metadata
  - Theme/style reference
  - Default content placeholders for branding, personal notes, and proposal blocks
- Current starter templates:
  - Start from scratch / blank proposal
  - ERP system
  - Business website
  - Client portal
  - Inventory/POS
  - Operational workflow
  - Business automation
  - Onboarding/implementation
  - Service proposal
  - Maintenance and support
  - Future travel itinerary
- Template selection creates a new local draft using the selected template defaults and stores template metadata on the draft.
- The blank proposal starter keeps the schema/block system, turns optional sections off by default, and lets admins manually enable and edit the sections they need.
- The template metadata is informational and draft-oriented. It does not change proposal APIs, invoice/payment behavior, PDF export, public sharing, or approval workflows.
- Full template marketplace/editor behavior is not implemented.

## Proposal Block Structure

Reusable blocks currently support:

- Cover section
- Personal note
- About/business section
- Project background
- Goals/objectives
- Proposed solution
- Deliverables
- Pricing summary
- Timeline/phases
- Terms/support
- Approval section

Blocks are ordered in the draft and can be moved up/down in the editor shell. Optional blocks can be hidden from preview without deleting the schema entry.

## Preview Behavior

- The proposal landing area now uses a clean hero, search/action area, category filter chips, thumbnail-first visual template gallery, and compact recent proposal list.
- Template cards keep text minimal, avoid heavy metadata, and start the selected template directly when clicked.
- Recent proposal cards open the selected saved proposal directly without extra card action strips.
- Desktop editing uses a two-column layout: editor/content inputs on the left and live document preview on the right.
- Tablet/mobile layout stacks sections and exposes a preview toggle from the editor actions.
- Preview supports simple theme variants using Dev ERP variables and shared tokens.
- Print media hides the hero, gallery, recent list, and editor shell, then prints the preview area only.
- `/proposals/:proposalId/preview` is an authenticated internal preview route. It does not expose proposal content publicly.

## PDF/Export Architecture Foundation

- The online proposal preview remains the source of truth for future PDF export.
- `ProposalPreview.jsx` owns the export-safe preview markup separately from editor/save behavior.
- `proposalExportConfig.js` defines export targets, section roles, page modes, print-break hints, and section metadata.
- Preview sections include `data-export-*` attributes for future renderer selection without changing saved proposal content.
- Export section roles currently cover cover, note, narrative, pricing, timeline, terms, and approval.
- The dedicated editable personal note renders once in the export preview; the older generic `personal_note` block is not duplicated in export output.
- Print CSS defines A4 page setup, hides app/editor chrome, preserves theme colors, avoids section breaks, and prepares cover/approval sections for page-aware rendering.
- The client proposal view includes a Download PDF button that uses the current print/save-as-PDF path.
- No server PDF renderer, generated PDF storage, or public export file endpoint is active yet.

## Secure Share-Link And Client View MVP

- Admin users can prepare a random secure share token for a saved proposal.
- Tokens are generated server-side with `crypto.randomBytes(32)`.
- Token expiry defaults to 14 days and is bounded by `PROPOSAL_SHARE_TOKEN_TTL_MS`.
- Prepared token metadata is stored on the proposal record.
- Client view route: `/proposal/view/:token`.
- Client-safe API route: `/api/proposals/view/:token`.
- Client view access is allowed when the proposal status is `shared`, `approved`, or `changes_requested`, the token exists, and the token has not expired.
- Client approval/request-changes actions are allowed only while the proposal status is `shared`.
- Client view responses strip runtime fields, metadata, internal workflow state, review notes, internal comments, staff/editor details, audit metadata, and the token itself. They may include the client response summary so clients can see confirmation after approval or change request.
- Client pages set `noindex,nofollow,noarchive` metadata and the API returns `X-Robots-Tag` with the same intent.
- Graceful client states exist for invalid links, unavailable proposals, expired tokens, and proposals that are not shared yet.

## Personal Note Support

The draft shape includes:

- Introduction note
- Founder/consultant message
- Optional closing note

These are editable in local state and visible in the preview shell.

## Styling Approach

- Uses Dev ERP app variables such as `--accent`, `--surface`, `--card`, `--border`, `--ink`, and `--muted`.
- Uses existing shared UI wrappers from `@faako/ui`.
- Does not introduce a new hardcoded visual system.
- The current UI direction is template-gallery first, inspired by clean proposal-template browsing patterns: simple hero, search/filter controls, thumbnail-led template cards, compact recent work, and a document-like preview surface.
- `bubble-card` is applied only where intended for template/search/recent proposal cards; the preview remains proposal-document oriented rather than dashboard-card heavy.
- Does not attempt to fully match the uploaded Stroane proposal PDF yet. PDF-specific styling belongs to a later PDF phase.

## Security And Data Boundaries

- Additive database schema only: new `Proposal` table.
- Authenticated proposal API routes require admin access.
- Proposal records are organization scoped.
- Drafts remain private.
- Public proposal content is limited to secure non-guessable token routes for `shared`, `approved`, or `changes_requested` proposals.
- Share tokens are random, server-generated, and not predictable.
- Share tokens are never returned by the client-safe proposal payload.
- Proposal metadata sanitization drops sensitive key names such as secrets, API keys, tokens, cookies, credentials, and webhook values.
- No server PDF generation.
- Lightweight client approval/request-changes actions are token-scoped and stored in proposal content JSON. No digital signature, server-owned approval record table, email notification, audit-log event, invoice conversion, or payment link is created.
- No invoice conversion.
- No Paystack payment links.
- No AI generation.
- No payment, invoice, rent, accounting, report, receipt, auth, permission, or existing production workflow behavior changed.

## Future TODOs

- Add access logging, expiry controls/renewal UX, and view tracking for the client-view route.
- Replace lightweight client response JSON with server-owned approval records and optional digital signatures after requirements are designed.
- Add email notification for approval/request-changes events after consent, delivery-provider, audit, and retry behavior are reviewed.
- Add proposal version lock after client approval.
- Add full proposal revision history and audit events.
- Add PDF generation following the approved presentation-style/Stroane proposal direction.
- Replace the approval foundation with server-owned approval records and digital signature support.
- Add proposal comments/feedback after notification and access-control rules are designed.
- Add invoice conversion after finance workflow review.
- Add Paystack payment links only after webhook verification, idempotency, and payment-reference persistence exist.
- Add onboarding conversion after approved-proposal handoff rules are mapped.
- Add proposal analytics after privacy and retention rules are defined.
- Add AI-assisted wording only after prompt safety, customer-data handling, and approval boundaries are reviewed.
- Reuse proposal blocks for travel proposals and itinerary approval flows after travel-specific data needs are mapped.
- Add drag-and-drop template editing after permissions and audit boundaries are reviewed.
- Add custom branding/themes and reusable cover designs after PDF/export styling decisions are approved.
- Add reusable pricing blocks after proposal-to-invoice conversion planning is complete.

## Recommended Implementation Order

1. Proposal-to-invoice conversion planning.
2. Server-owned approval records, approval audit logs, proposal version locks, and optional digital signature planning.
3. PDF renderer proof of concept using the online preview/export metadata as the source of truth.
4. Access logging, expiry controls, and view tracking for client proposal links.
5. Full revision history and audit events.
6. Paystack payment-link integration.
7. Onboarding conversion planning.
8. Travel itinerary proposal rendering and approval flow planning.
9. AI-assisted wording.

## Rollback Notes

Remove the `/proposals` and `/proposals/:proposalId/preview` routes, proposal API routes, registry/nav entry, `src/pages/Proposals`, the additive Proposal migration/schema changes, and this documentation. If the migration has already been applied, archive/export any saved proposal drafts before dropping the `Proposal` table.

## Manual Testing Checklist

- `/proposals` loads for authenticated admin users.
- Proposal list loads saved proposals scoped to the authenticated organization.
- Rent-only users remain scoped to rent/dashboard/profile behavior.
- Template selection resets the local draft only.
- Template selection applies the selected template's default section order, disabled sections, style reference, and placeholder content.
- Template search and category filters narrow the visible gallery without changing saved proposal data.
- Clicking a template card starts that local draft only.
- Saving a new draft creates a proposal record and navigates to `/proposals/:proposalId/preview`.
- Saving an existing proposal increments the version number.
- Proposal details edit the preview before save.
- Workflow status supports draft, internal_review, shared, changes_requested, approved, and archived.
- Review notes, internal comments, change-request notes, and readiness checks persist after save.
- Shared client links show Approve proposal and Request changes actions.
- Approved client links show the approval confirmation and do not offer another response.
- Changes-requested client links show the requested-changes confirmation and do not offer another response.
- Personal notes edit the preview.
- Blocks can be moved up/down.
- Optional blocks can be hidden from preview.
- Pricing and timeline rows render in preview.
- Secure token preparation is disabled for unsaved or dirty drafts.
- Secure token preparation stores token metadata and exposes client-safe proposal content only for shared/approved/changes-requested proposals.
- Client approval updates status to approved without creating invoices, payments, Paystack links, email notifications, or digital signatures.
- Client request changes updates status to changes_requested and preserves the message without creating comments, notifications, invoices, payments, or Paystack links.
- Mobile layout stacks without horizontal overflow.
- Print preview shows only the proposal preview area.
- Print preview preserves cover/personal note/pricing/timeline/terms/approval section ordering.
- Existing invoice, rent payment, accounting, report, and Paystack planning behavior remains unchanged.
