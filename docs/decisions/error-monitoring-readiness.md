# Error-monitoring readiness

Status: ready for provider evaluation; no provider installed.

## Decision

The monorepo will standardize exception boundaries, request IDs, structured
logging, release metadata, and redaction before selecting an error-monitoring
service. No paid service is added by this change.

Any future provider must integrate with the existing authentication systems;
it must not require Auth0 or become an authorization source of truth.

## Required frontend integration

- Capture uncaught exceptions and unhandled promise rejections at one
  application-shell boundary.
- Add React error boundaries for REEBS and Stroane in bounded follow-up work;
  retain Dev ERP's existing route boundary.
- Capture Astro build failures in CI. If server-rendered Astro is introduced,
  add a runtime server exception boundary separately.
- Attach application, environment, release ID, route template, and request ID
  when available.
- Do not attach form values, browser storage, auth state objects, DOM text, URL
  query strings, or network bodies by default.
- Session replay must remain disabled unless a separate privacy, consent, and
  redaction decision approves it.

## Required backend integration

- Capture only at the owning final error boundary to avoid duplicates.
- Attach application, component, environment, release ID, request ID, safe
  organisation/user IDs, error type, and status.
- Preserve the current user-safe API response; provider event IDs must not
  replace `X-Request-Id`.
- Apply central redaction before events leave the process.
- Separate expected 4xx outcomes from operational exceptions.

## Source maps

- Generate production source maps as private build artifacts.
- Do not publish them alongside public JavaScript unless that is an explicit
  deployment decision.
- Upload maps against the exact application and release identifier.
- Remove or restrict maps after upload according to retention policy.
- Verify stack frames resolve in staging before production enablement.

## Releases and environments

Use an immutable release identifier, preferably the deployed Git commit SHA
plus application name. Development, preview, staging, and production events
must be separated. A monorepo release may contain different application
versions; each event therefore includes both repository release and
application.

## Privacy and access

Before enablement:

- document data residency and subprocessors;
- define retention and deletion periods;
- configure project/team least privilege and SSO where available;
- redact credentials, cookies, tokens, payment data, and personal information;
- scrub URL query strings and headers;
- sample high-volume non-fatal events;
- exclude health checks, expected permission denials, and validation noise; and
- test redaction with synthetic secrets and PII.

## Readiness checklist

- [x] Shared request ID convention
- [x] Structured backend logger and central redaction
- [x] Safe API error categories
- [x] Client-side safe error presentation model
- [x] Application/environment fields
- [ ] Shared immutable release ID supplied by every deployment
- [ ] Private source-map build/upload workflow
- [ ] REEBS and Stroane application-shell error boundaries
- [ ] Provider privacy/security review
- [ ] Staging redaction and alert-noise test
- [ ] On-call ownership and alert-routing decision

Provider selection and installation should be a separate decision/PR after the
unchecked items have owners.
# Final-phase observability review (2026-08-04)

The decision remains unchanged: no paid monitoring provider is approved or installed.

Current strengths are shared structured/redacted logging, request-ID middleware/contracts, Dev ERP request/audit logs, representative Stroane adoption, and separate audit-event conventions. Final gaps are: remaining legacy console logging; no central frontend exception transport; no release identifier/private source-map upload; no formal alert ownership/SLO; incomplete request-ID adoption in serverless REEBS handlers; and no provider-neutral exception envelope for the Python service. Before provider selection, approve data residency, retention, PII redaction, environment separation, source-map access, release naming, sampling, alert routing, and incident ownership.
