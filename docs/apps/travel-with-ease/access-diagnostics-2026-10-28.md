# Staging Access rejection diagnostics

The portal's generic 401 can mean either missing/duplicate assertion headers or
failed cryptographic/claim validation. Completing Google/MFA does not establish
which assertion reached the origin. A changed Railway audience must be verified
in the active deployment; a request ID alone cannot recover a cause that wasn't
logged. This change does not claim to fix the reported live login failure.

The embedded portal now emits the diagnostic event `portal.access.rejected`
through the existing application logger. Fields are limited to `eventName`,
the existing `requestId`, and an allowlisted `reason`. Raw errors, claims, tokens,
cookies, email addresses, subjects and arbitrary request URLs are never logged.
This is not a staff audit event because no staff identity has been established.
The external response and all authentication/tenant/permission checks are unchanged.

After deploying this focused branch to staging, reproduce one login failure and
search Railway runtime logs for its request ID or `portal.access.rejected`:

| Reason | Check next |
| --- | --- |
| `assertion_missing` / `assertion_header_invalid` | Access application coverage, forwarding/transform rules, duplicate headers; do not log the headers |
| `aud_invalid` / `iss_invalid` | Active Railway environment versus the staging Access application/team |
| `token_expired`, `nbf_invalid`, `iat_invalid` | Fresh Access session and origin clock |
| `signing_keys_timeout` / `signing_key_not_found` / `signing_keys_invalid` | Origin connectivity and configured team JWKS endpoint |
| `signature_invalid` / `algorithm_invalid` / `assertion_malformed` | Assertion provenance and proxy handling |
| `staff_identity_invalid` | Validated token is not an accepted staff application identity; service tokens remain prohibited |
| `*_missing` / `claim_invalid` / `verification_failed` | Further focused server-side diagnosis; never paste a JWT into chat or public decoders |

No dependencies, migrations, provider changes or authentication bypasses.
Rollback is the preceding application release; no database changes to reverse.
Tests cover reason allowlisting/redaction, correlation, missing/duplicate headers,
unchanged client errors, successful requests, and existing cryptographic/session
and role-separation cases. Hosted reproduction remains pending deployment.
