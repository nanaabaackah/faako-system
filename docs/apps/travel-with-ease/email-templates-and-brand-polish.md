# Email templates and brand polish — 2026-10-31

## Website

- “A Little More You” uses Bonheur Royale, with the first letter of each word
  capitalised. Other semantic headings use Montserrat Extra Bold (800), including
  portal headings. Body text stays unchanged. Latin WOFF2 subsets are self-hosted;
  both SIL Open Font Licences are included in `public/fonts/`. No visitor request
  to Google Fonts is required. Sources: [Bonheur Royale](https://fonts.google.com/specimen/Bonheur+Royale)
  and [Montserrat](https://fonts.google.com/specimen/Montserrat).
- Journey cards retain one real link/focus target. Its hit area covers the card;
  no JavaScript navigation or nested interactive controls are introduced. Hover
  scales the image only, with a focus outline and reduced-motion fallback.
- Initial privacy notice remains a banner. Manage preferences and footer Cookie
  settings open a native modal dialog with focus containment, Escape, close
  without saving and focus restoration. Closing is not consent. Demo storage
  remains separate and does not enable analytics. No-JavaScript pages do not
  load analytics or display a nonfunctional consent form.
- Footer footprint has no panel background; its text inherits the light footer
  colour. The full-width photographic scene and final page gutter are preserved.
- Email previews no longer appear in the public demonstration website.

## Portal → Templates

The initial editable template is **Enquiry acknowledgement**. This module does
not claim to edit invitation, account recovery or provider-controlled login mail.
Only Owner has `templates.manage`; Editor and Platform Admin are denied by both
route middleware and service policy, including cross-tenant Owners.

Owner can edit subject, heading, message and button label; render an unsent
preview; save a draft; and explicitly activate the saved draft. Optimistic
versions prevent stale-tab overwrites. Unsaved fields use the existing portal
navigation warning. Preview uses a sandboxed iframe with no scripts or forms.
Editable copy is plain text escaped by the server, not arbitrary HTML. Logo,
company details, social destinations, button URL, automatic-send footer and
not-a-booking disclaimer remain code-owned. Recipient safety is unchanged:
local/staging use only testing@travelwitheasegh.com, production uses the customer
recipient plus notifications@travelwitheasegh.com CC.

Portal previews use bundled local logo/social images; outgoing emails retain
absolute public image URLs for mail-client compatibility. No Google Font service
is contacted by visitors. The two Latin WOFF2 font assets add about 40 kB outside
the JavaScript bundle; the Templates module and bundled preview icons add
approximately 6 kB gzipped JS (portal 121.10 kB versus 115.46 kB before this work).

Migration **010_email_templates.sql** adds tenant-scoped draft/active copy.
The migration runner grants only SELECT/INSERT/UPDATE to the existing restricted
runtime role; no resets or role/authentication changes are needed. Apply through
the established environment-scoped `db:deploy` before releasing the API/worker.
Activation and draft saves generate reference-only audit events. The notification
worker reads active copy for new payloads; immutable, already-prepared outbox
payloads retain their original copy and idempotency behaviour. Do not reroute or
resend queued notifications simply to change their design.

Rollback: save the documented default copy as a new draft and activate it, or
roll back API/worker code while leaving the additive table intact. The local
demo simulates drafts, previews and activation in memory only and resets on
reload. It never sends mail or changes hosted templates.

## Verification

Focused coverage includes field bounds/header injection, HTML escaping, fixed
recipients/footer, owner/editor/platform separation, CSRF, no-send preview,
demo draft/activation separation and reload reset. Disposable PostgreSQL coverage
checks runtime grants, tenant isolation, stale versions, audit events and service
recreation. Hosted migrations and live email delivery are not exercised here.
The browser script `check-templates-browser.mjs` checks typography, full-card
activation, dialog close/save/focus restoration, transparent footer footprint,
template preview/save/activation and overflow at 320/390/768/1440px.

Regular-worktree verification: 77 API tests, eight portal tests, 23 existing
website tests plus three focused brand tests, and eight shared UI tests passed.
Lint, portal typecheck/build and website typecheck/build passed. Chrome checks
passed at all four widths on the regular 4328/5188 servers with no API requests.
New persisted-template PostgreSQL checks are added but not executed locally;
they remain a required isolated integration gate before deployment.
The existing public follow-up browser suite also passed all four widths and its
no-JavaScript checks, including consent withdrawal through the new popup. Its
public email-preview assertion now requires the preview to be absent; equivalent
edit/preview/save/activate coverage lives in the portal CI browser suite.

All TWE source changes and their required shared UI files were brought into the
regular `faako-system` worktree, not left only in the isolated checkout. Existing
local TWE/shared UI source was archived before synchronisation. Private `.env`
files, unrelated apps, the existing Git branch and unrelated lockfile edits were
not changed by this transfer. Restart the normal dev command after further
package/config updates; stale Vite optimiser state can prevent island hydration.
