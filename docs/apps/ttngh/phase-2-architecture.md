# ADR — TTNGH Phase 2 operational content layer

Decision date: 13 October 2026. Status update: 18 October 2026. Website, API health,
Studio and public CMS reads are live; operational workflow verification remains
pending. See [production evidence](production-status-2026-10-18.md). Scope: TTNGH only.

## Decision

Retain Astro static-first public delivery in apps/ttngh. Add a separately built Sanity Studio at apps/ttngh/studio and an independently deployed Express service at services/ttngh-api, hosted on Railway. This records the tracked TTNGH scaffold/continuation explicitly requested by the user; it does not change the architecture of any other app.

Sanity is the source for routine public content. Astro fetches published, validated
records at build time; a server-only read token is optional for the observed PUBLIC
dataset and required if a private access policy is adopted. This records observed
deployment drift, not approval to change visibility. Publication filters are not
API access controls. Templates and navigation remain developer-owned. Sanity's
managed identity retains sign-in, account creation and recovery; there is no custom
password database or automatic editor membership.

Railway handles the signed Sanity rebuild hook and the protected enquiry-to-email workflow. Turnstile is verified server-side; Resend credentials never reach the browser. No contact-message database is introduced. Existing Faako request IDs, API contracts, client, logger, security headers, validation and UI are reused.

## Calendar extension — 20 October 2026

Railway now exposes a bounded, read-only public calendar endpoint. It retrieves the approved public Google ICS feed server-side and returns cached normalized occurrences to the custom Astro/vanilla-JavaScript calendar. Google is the live scheduling source; Sanity remains the reviewed editorial/SEO source. This extends the existing service without changing frameworks, authentication or deployment boundaries. No Google iframe, OAuth or API key is introduced. See [calendar decision and operational limits](calendar-data-source.md).

## Consequences

- Static content remains available during a CMS outage; failed validation/fetch stops a new deployment.
- Publishing Sanity editorial content requires a rebuild; daily scheduled rebuilds are also needed for listing time boundaries. Google calendar changes refresh through the API without a rebuild.
- Drafts are not exposed through public preview endpoints. Review is via Studio and controlled static previews.
- The service is single-replica until rate-limit/deduplication storage is externalised. Process restart may repeat a harmless build trigger.
- CMS roles, MFA, domain/email configuration, privacy/retention ownership and real provider verification are activation gates.
- Paystack, donor persistence/reconciliation and receipts remain the separately supplied next phase. No payment or new authentication architecture is silently introduced here.

Rollback and exact environment names: [deployment](deployment.md). Editorial and consent withdrawal process: [content operations](content-operations.md).
