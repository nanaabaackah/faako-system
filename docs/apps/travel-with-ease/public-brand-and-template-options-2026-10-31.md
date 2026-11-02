# Public brand details and email options

## Publication instruction

Use **Travel With Ease** as the public brand. Removed the alternate business
name, registration identifier and street address from the shared public footer,
demo About copy, reviewed content drafts, company source summary and both HTML
and plain-text email branding. Approved business email, telephone, WhatsApp and
social links remain. No customer contact fields or collected enquiry addresses
were removed.

These changes do not rewrite Git history, already delivered emails or immutable
queued notification payloads. The Owner must review any previously saved CMS
About/Privacy/Terms copy and republish the cleaned drafts; explicit published
snapshots remain authoritative. No hosted database or archived audit evidence
was edited. Older deployments require a rebuild; this branch does not deploy
or merge automatically. Policy drafts still require their existing review.

## Email type selector

The Templates module uses Faako's accessible `SelectField` to choose:

- **Enquiry acknowledgement** — existing automated notification flow; draft,
  preview and activation affect only newly prepared emails. Delivery routing
  and existing immutable jobs remain unchanged.
- **Staff invitation** — separately saved invitation copy, branded preview and
  explicit approval. Current staff invitations use separately shared activation
  codes. This work does **not** introduce automated invitation delivery, issue
  invitation codes, change identity-provider requirements or grant staff access.
  The UI states this clearly; unsupported email types are not advertised.

Types have independent versions, drafts and approved/active copy per tenant.
Changing types asks before discarding unsaved edits; previews are reset on type
change. Preview HTML is escaped and shown in a sandboxed iframe. Logo, company
contacts, social links, automatic-send notice, invitation safety text and CTA
destinations remain code-owned. No template editor operation sends an email.

Owner-only server permissions and CSRF checks apply to both types. Editors,
platform administrators and cross-tenant owners do not gain template access.
Existing single-type endpoints remain compatible; named endpoints use
`/api/agent/templates/:slug` and `/:slug/{preview,draft,activate}`. Only the two
reviewed slugs are allowed. Invitation approval has distinct audit event names;
copy, recipients and activation codes are not written to audit logs.

## Migration and rollback

`011_email_template_options.sql` widens the existing slug CHECK constraint.
Apply through existing environment-scoped `db:deploy` before deploying this API.
It does not reset or rewrite template/staff records or add runtime DDL authority.
For rollback, revert application code and retain the widened constraint/data;
do not delete invitation drafts to reinstate an older constraint.

## Verification

Tests cover default endpoint compatibility, per-type allowlisting, escaped
invitation previews, owner/CSRF enforcement, independent demo state, unknown
types, unsaved-switch cancellation and no-send behaviour. The isolated PostgreSQL
test covers each type under runtime grants, recreation persistence, tenant/role
separation and audited approval. Website production/staging output tests reject
the removed identity details. Browser checks exercise the real selector and
both templates at 320, 390, 768 and 1440px without provider requests.

No private configuration changed; unrelated working edits are excluded from the
new `feat/twe-public-details-email-options` branch. Regular-worktree TWE sources
are kept in sync. Any unexecuted hosted/database check must remain pending.

### Executed locally

- All three TWE builds, lint and type checks passed (Astro: zero diagnostics).
- API: 79 tests; portal: 9 tests; website: 29 tests, all passed.
- Repository security scan/gate passed.
- Real portal browser checks passed at 320/390/768/1440px, including keyboard
  opening of the Faako selector, unsaved-switch cancellation, independent draft
  persistence, invitation preview/approval and zero API/provider requests.
- Fresh temporary PostgreSQL 17.11 integration passed, including runtime grants,
  migration 011, role/tenant enforcement and audited independent template state.
  Restart and logical restore fingerprints matched across all 20 tables and
  144 synthetic rows. The temporary database was stopped afterward; no existing
  database or application environment files were used.
- No hosted migration, merge, deployment or email send was performed.
