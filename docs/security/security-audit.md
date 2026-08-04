# Final security audit

Audit date: 2026-08-04. This is a code/configuration review; no destructive penetration testing was performed. It uses the authentication, authorisation, logging, API-contract, and payment reviews already in `docs/security/` as source material and verifies their current implementation.

## Executive result

- No known critical dependency advisory remains after removing unused REEBS packages and upgrading patched direct/transitive dependencies.
- The production dependency audit fell from 20 high findings to 3. Two are non-runtime/applicability exceptions described below; the image-processing finding remains an upgrade task.
- REEBS Analytics now fails closed when `REEBS_ANALYTICS_SERVICE_SECRET` is absent (`services/reebs-analytics/app/main.py:32`).
- REEBS manager login throttles before password verification (`apps/reebs-portal/backend/functions/managerLogin.js:67`). Password reset now throttles before lookup/token creation.
- Shared analytics removes query strings and fragments before a page view is emitted (`packages/utils/src/googleAnalytics.ts:131`, `packages/utils/src/googleAnalytics.ts:240`).
- Shared logging redacts tokens, cookies, credentials, payment data, contact details, and production stacks (`packages/logger/src/index.js:17`, `packages/logger/src/index.js:86`).
- Security scan and configuration gate pass. The registry dependency gate still fails at `high` because acknowledged findings remain; it must not be presented as fully green.

## Findings

| ID | Severity | Area | Status | Finding and evidence |
| --- | --- | --- | --- | --- |
| SEC-001 | Critical | Dependencies | Closed | Unused REEBS `psql` and `railway` chains, vulnerable jsPDF, and old `concurrently` exposed critical advisories. Unused `brew`, `fs`, `psql`, and `railway` dependencies were removed; jsPDF and tooling were upgraded. `pnpm audit --audit-level critical` now passes. |
| SEC-002 | High | Service authentication | Closed | REEBS Analytics previously accepted requests when its service secret was absent. `_authorize` now returns 503 until configured and compares bearer credentials in constant time. Tests cover missing, invalid, and valid secrets. |
| SEC-003 | High | Brute-force protection | Closed | Manager PIN attempts were counted only after successful verification. The database-backed limiter now executes first and is regression-tested. Password-reset requests now use the same persistent window limiter before account lookup. |
| SEC-004 | High | Password recovery | Open, reduced | REEBS username recovery intentionally reveals whether personal-email setup or phone verification is required (`forgotPassword.js:307-359`). This supports an existing onboarding flow but enables account-state enumeration. Throttling is now present; redesigning recovery to use an administrator-issued setup challenge is a separate compatibility-sensitive task. |
| SEC-005 | High | Dependencies | Open/exception | `sharp <0.35` is pulled by Astro and flagged for inherited libvips issues. Upgrade only through an Astro version verified with the image pipeline. React Router's remaining high advisory affects RSC actions; these applications use SPA routing/Astro islands and do not enable RSC actions. A Prisma code-generation lodash path is build tooling, not request handling, and is pinned where its dependency graph permits. |
| SEC-006 | High | Session invalidation | Open | Password/role changes do not have one repository-wide session-version/revocation mechanism. Cookie expiry and JWT expiry exist, but invalidation behaviour varies. Implement per application without replacing the current authentication provider. |
| SEC-007 | Medium | CSRF | Open | Dev ERP has explicit CSRF middleware. REEBS uses same-site/cross-site checks for cookie flows and scoped bearer tokens for manager flows; Stroane admin uses bearer auth. A route-by-route write-method matrix is still needed before declaring one uniform CSRF posture. |
| SEC-008 | Medium | Rate limiting | Open | REEBS critical auth limits are database-backed. Some Express limits are process-local, so horizontal replicas do not share counters. Move high-risk endpoints to a shared store when scaling beyond one instance. |
| SEC-009 | Medium | FastAPI exposure | Open | REEBS Analytics exposes OpenAPI/docs by FastAPI default and does not configure trusted hosts. It is intended as a private service. Disable docs in production and allow-list hosts when the final network topology is approved. |
| SEC-010 | Medium | Headers/CSP | Open | Public deployments have CSP, HSTS-compatible headers, MIME sniffing and framing controls. Several CSPs retain `unsafe-inline` styles and localhost/WebSocket connect allowances; remove development sources from production-specific headers incrementally. |
| SEC-011 | Medium | Logging consistency | Open | Dev ERP and Stroane use the shared structured logger on primary HTTP paths, while legacy REEBS/Faako handlers still contain direct console logging. Sensitive values are not intentionally logged, but adoption/redaction is incomplete. |
| SEC-012 | Medium | File uploads | Open | Dev ERP proposal PDFs enforce size/type/storage controls, but malware scanning and object-storage quarantine are not standardised. Do not broaden accepted file types until that workflow exists. |
| SEC-013 | Medium | Webhooks | Partially closed | Paystack signatures and cron/webhook secrets have focused tests. Railway/activity webhooks use bearer secrets. Continue verifying raw-body signature handling and replay/idempotency per provider. |
| SEC-014 | Low | Error exposure | Monitored | Shared 5xx responses suppress internal details and include request IDs. Some legacy frontend `console.error` calls remain; raw errors must never be rendered to users. |
| SEC-015 | Informational | Payments | Verified boundary | Paystack keys remain server-side, webhooks are signature checked, repeated paid events do not reduce inventory twice, and payment credentials are excluded from logs. MTN MoMo/donation implementation is not present because TTNGH is deferred. |
| SEC-016 | Informational | XSS | Verified boundary | No user-controlled raw HTML sink was found. Stroane JSON-LD uses the tested `serializeJsonLd` escape boundary; the Faako SVG insertion is a constant application asset. |

## Tenant, CORS, cookie, and API conclusions

- Tenant IDs are resolved server-side in representative REEBS and Dev ERP paths; existing tests reject cross-organisation access and prevent a normal `admin` role from implying system-wide access.
- Credentialed CORS uses explicit origins in Stroane and documented origin lists elsewhere. Wildcard credentialed CORS is prohibited by the security gate.
- Operational sessions use HttpOnly cookies or scoped bearer tokens according to the existing application model. Browser persistence code strips legacy token/sensitive user fields in REEBS.
- Shared contracts define safe validation/authentication/permission/not-found/conflict/rate-limit/server errors and request IDs. Adoption is representative, not complete.

## Checks

| Check | Result |
| --- | --- |
| `pnpm security:scan` | Passed |
| `pnpm security:gate` | Passed |
| `pnpm audit --audit-level critical` | Passed: no critical findings |
| `pnpm audit --prod --audit-level high` | Failed: 3 documented high findings |
| REEBS manager/password-reset focused tests | Passed |
| REEBS Analytics tests | Blocked locally by Python 3.11+ / pytest absence; CI now provisions Python 3.12 and the dev extra |

