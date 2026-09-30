# Travel With Ease security architecture and threat model

## App registration and release checks

All three applications declare `appSystem.js` security metadata. The API uses
`api-service`, the portal uses `authenticated-workspace` with its existing
development bearer gate, and the website uses `public-interactive` without auth.
Registered API/portal origins are the existing localhost development origins;
this does not authorize any production host. Runtime deployment origins remain
controlled by `ALLOWED_ORIGINS`. Production launch remains blocked by the existing
API startup guard pending approved persistence and authentication adapters.

The API's conventional `src/security/securityHeaders.js` adapter delegates to
`@faako/security`. Its baseline and denied-origin behavior are tested. No header,
authentication or CORS check is bypassed to satisfy the repository security gate.

## Data classification matrix

| Classification | Examples | Controls |
| --- | --- | --- |
| PUBLIC | Published destinations, services, guides, testimonials | Editorial approval, integrity controls, cache/CDN allowed |
| INTERNAL | Supplier notes, draft content, estimator configuration | Staff RBAC, tenant scope, audit on changes, no public API |
| PERSONAL | Name, email, phone, preferences, trip membership | Purpose limitation, consent/notice, scoped reads, retention/deletion workflow |
| SENSITIVE | Itinerary, flight/hotel bookings, emergency contacts, visa status, financial history | Strong RBAC, field minimisation, encryption in transit/at rest, audited access |
| HIGHLY_SENSITIVE | Passport number/scan, visa documents, identity documents, encryption keys | Application-level field encryption, private objects, short signed URLs, no analytics/logs/AI/offline cache |

Inquiry Phase 1 accepts only contact and planning data. It does not accept identity documents, passport data or payment credentials.

## Controls and data flow

- TLS is mandatory. Staff authentication must support MFA, secure `HttpOnly`/`Secure`/`SameSite` cookies, short sessions, rotation and login/session history. The Phase 1 development token gate is explicitly non-production and the API fails closed in production without an approved auth adapter.
- API permission and organisation checks are authoritative. Clients see only explicitly linked records. Staff roles start as Owner/Admin, Agent and Client but permissions use stable action identifiers.
- Public submission uses boundary validation, unknown-key stripping, honeypot rejection, body limits, origin allowlisting and bounded rate limits. Request IDs are returned; internal errors are not.
- Structured logs redact credentials, tokens, passport/document keys and request bodies. Audit events are separate, append-oriented and contain references rather than sensitive snapshots.
- Highly sensitive structured fields use authenticated application encryption with versioned key IDs. Keys live in a secret manager/environment boundary, not PostgreSQL. Rotation decrypts with the old version and rewrites with the active version under audited jobs.
- Objects use separate public-media and private-document buckets. Private access is authorised per request and returns a short-lived signed URL. Signed URLs are never persisted or logged.
- Backups are encrypted, access-controlled and restore-tested. Retention jobs cover inquiries, inactive accounts, local/offline data, provider logs and backups. Legal/accounting holds are explicit.
- Consent records include purpose, version, source and timestamp. Deletion is a workflow across operational rows, derived analytics, object storage and processors, while preserving narrowly required finance/audit evidence.
- Processor register and incident runbooks are required before production: hosting/database, object storage, email, WhatsApp/Meta, Paystack, AI, monitoring, calendar and currency provider.

These controls treat Ghana's Data Protection Act, 2012 (Act 843) as an architecture constraint; launch still requires a Ghana-qualified privacy/legal review.

## Threat summary

| Threat | Principal mitigations | Residual action |
| --- | --- | --- |
| Public API used to enumerate CRM data | No public read endpoints; opaque IDs; separate routers; rate limits | Security tests on every route |
| IDOR across clients/organisations | Server derives actor/org; ownership joins; deny by default | Tenant-isolation integration tests |
| Passport/document disclosure | Private bucket, signed URL, encryption, audited access, no offline/AI | Key rotation and access-review runbooks |
| AI data exfiltration/prompt injection | Allowlisted projection and redaction; no documents/payment/passport fields; human approval | Provider DPA and adversarial tests |
| Webhook/payment forgery or replay | Raw-body signature verification, idempotency store, server verification | Paystack sandbox tests |
| Exchange-rate manipulation/staleness | Validated provider response, cached timestamp/status, override audit, no invented fallback | Dual-provider/alerting in finance phase |
| Lost/stolen offline device | Minimal allowlist, expiry, logout purge, no document cache, device/session revocation | Evaluate platform encryption before rollout |
| Staff account takeover | MFA, throttling, session rotation, least privilege, security events | Auth provider selection/pen test |
| Formula/CSV injection in exports | Neutralise leading formula characters; explicit schemas | Export fixtures |
| Sensitive telemetry leakage | Field classification, logger redaction, analytics denylist | Automated scan and sampling review |

## AI sanitisation boundary

AI receives a purpose-built itinerary DTO containing destination, dates, party composition bands, accessibility/dietary preferences where consented, budget band and pacing. It excludes names when unnecessary, exact birth dates, addresses, passport/visa identifiers, document objects, payment data, private notes and authentication data. The sanitiser is tested before any model adapter is enabled. Generated content remains `draft`; only an authorised agent can publish an official itinerary.

## Offline allowlist

Allowed: approved itinerary projection and timestamp. Conditional: emergency contact after explicit client choice. Denied: passport/visa scans, identity fields, payment data, document URLs, internal notes, audit events, other clients, provider tokens and raw API responses.
