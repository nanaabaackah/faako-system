# Cleanup and security review

## Applied cleanup

The branch makes only reviewable cleanup, documentation and test-support changes:

- removed unreferenced retired OIDC adapter/config modules and their obsolete
  unit assertion; the active Cloudflare Access/session implementation is unchanged;
- removed unused direct dependencies `openid-client` and portal
  `react-router-dom`, with a minimal lockfile importer update;
- removed two obsolete public-site lint suppressions;
- made the invitation list refresh callback stable and effect dependencies
  truthful;
- corrected staff-authentication documentation so retired OIDC code is not
  presented as an active fallback;
- added the reusable provider-first readiness skill and this linked evidence set.

No route, API contract, schema, migration, provider configuration, production
content or approved design was changed.

## Cleanup still open

- Finding 15: add deterministic preview temp-directory lifecycle and crash/orphan
  recovery without deleting an active build.
- Finding 16: move preview coordination out of process memory or explicitly bind
  the service to one instance with an accepted availability limit.
- Finding 27: split oversized modules only after characterisation tests identify
  stable responsibilities; line count alone is not deletion evidence.
- Finding 28: replace the API syntax-only `typecheck` label with a genuine semantic
  JS/TS check, or rename it truthfully and introduce an independently named check.
- Audit stale documentation and provider variables only with consumer/provider
  evidence; do not bulk-delete files, migrations, content or assets by naming.

## Security assessment

Repository review found the following active controls:

- Express disables `X-Powered-By`, limits JSON bodies, applies shared security
  headers, exact origin/CSRF checks, boundary validation and bounded timeouts;
- signed Cloudflare Access assertions establish identity, while backend role and
  organisation checks remain authoritative;
- hosted database TLS defaults to certificate verification and rejects unsafe URL
  options rather than accepting a global TLS bypass;
- enquiries use minimal list projections and separate authorised detail reads;
- notification payloads are pinned, bounded, redacted from terminal records and
  protected by retry/idempotency rules;
- preview file paths and actor/organisation access are restricted, with a strict
  preview CSP;
- browser storage contains preferences/consent/UI state, not the active staff
  session; no high-signal raw HTML/eval/postMessage sink was identified in the
  scoped application review.

Unresolved security/reliability gates are not converted into false positives:

- Access negative/revocation acceptance and current production bindings;
- actual PostgreSQL runtime/migration grants and tenant boundary evidence;
- proxy identity and distributed rate limiting for a directly reachable Railway
  origin (Finding 13);
- production API/deployment recovery, alerts and an isolated restore drill;
- authenticated provider publication, email acceptance and mailbox delivery;
- approved privacy/retention implementation for enquiries (Finding 07).

The public-site CSP currently permits the inline behaviour required by the Astro,
analytics and Turnstile integration. That is exposure to minimise, not evidence
on its own of an exploitable injection. Any nonce/hash hardening must retain
tested hydration, consent and challenge flows.
