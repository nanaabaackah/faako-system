# Analytics standards

Google Analytics remains the approved public-site provider. This document does not approve a provider change.

## Collection rules

- Analytics is optional and consent-gated on public sites. Respect Do Not Track and default advertising/marketing storage to denied.
- Do not fetch the Google tag or initialise a measurement ID until analytics consent is granted. A local bootstrap may establish a denied consent default, but it must not call `js` or `config` and must leave collection disabled.
- Production and non-production use separate measurement IDs. Development collection is off unless explicitly enabled.
- Initialise each measurement ID once and emit one route-level `page_view` per completed navigation.
- Consent changes and route dispatch form one lifecycle: initialise or update consent first, then dispatch the current route. Revocation must disable collection immediately; re-consent may dispatch the current route once.
- Page locations and paths must not contain query strings or fragments. The shared utility enforces this because reset tokens, searches, form values and campaign parameters may contain personal/sensitive data.
- Never send names, emails, phone numbers, addresses, free-text form content, user IDs, organisation IDs, tokens, order references, payment references, or precise locations.
- Do not log analytics payloads containing user-provided data.

## Event model

Allowed event shape: `event_name`, `application`, `environment`, `route`, `outcome`, and a small allow-listed categorical context. Use lower snake case.

Recommended events when the underlying workflow exists:

- `contact_form_result` with `outcome=success|validation_error|service_error`
- `newsletter_signup_result`
- `event_registration_result`
- `donation_start` and `donation_result` without amount/reference unless a separate privacy decision approves coarse value reporting
- `catalogue_search` with result-count band, never the raw query
- `add_to_cart` with public product slug/category only
- `checkout_start` and `purchase_result`; never payment credentials or provider payloads
- `partnership_enquiry_result` and `volunteer_form_result`

## Duplicate prevention

- Route trackers must not coexist with provider auto-page-view for the same measurement ID (`send_page_view` remains false in the shared initializer).
- Conversion events fire after authoritative success, not button click, and should use a local one-shot/idempotency key when rerenders or redirects can repeat.
- Payment webhooks are operational/audit events, not browser analytics events.

## Current audit

- The 19 October 2026 public-site audit is recorded in [`google-analytics-audit-2026-10-19.md`](./google-analytics-audit-2026-10-19.md).
- byNana, Faako, REEBS and Stroane public surfaces initialise analytics through shared utilities or a thin adapter and have consent controls. TTNGH and Travel With Ease use the same utility from consent-aware Astro components.
- The shared Vite bootstrap now defaults consent locally and waits for explicit consent before fetching `gtag.js`. The shared route tracker applies consent/initialisation before its first page view and disables collection when consent is withdrawn.
- Query/fragment leakage at the shared page-view boundary was fixed in this phase.
- Conversion/commerce event coverage is sparse and inconsistent; add only as each real form/commerce workflow is verified.
- System Starter and UI Workbench must not collect production analytics by default because they are internal/reference tools.
