# Staff authentication — Cloudflare Access and historical decisions

Current decision (reviewed 2026-10-25): [Cloudflare Access and Faako Platform
Admin](./access-platform-admin-2026-10-23.md) replaced the earlier generic
OIDC proposal. Follow the [readiness checklist](./readiness-check.md),
[staging activation](./staging-activation-2026-10-24.md) and
[portal hosting instructions](./portal-hosting-preparation-2026-10-23.md).
The old OIDC discussion below is archived context, **not a deployment
configuration, authentication-provider selection task or release gate**.

## Active staff-authentication checks

- Configure **separate** staging and production Access applications/audiences,
  verified issuer and origin, exact staff allowlist and **independently enforced
  MFA**. Live MFA/policy and recovery still require real hosted acceptance.
- Protect the hosted Vite portal behind the separate Express proxy. Keep
  `VITE_API_BASE_URL` empty in hosted builds; route staff API calls through
  the same-origin proxy with a fixed server-only upstream.
- Verify the signed Access assertion on each private API request, together with
  an active, short-lived, hashed, revocable PostgreSQL session and CSRF/Origin
  checks. Identity comes from verified issuer/subject/audience, never email
  headers; only approved staff provisioning grants a role.
- Use application permissions for `platform_admin`, `owner` and `editor`;
  the platform role does not imply business content/enquiry privileges. Exercise
  revocation, inactive user, tenant isolation and Owner-approved expiring
  support access in staging.
- Start the **staging API** only after read-only PostgreSQL 17/Access
  preflight and the matching persistent session/repository receipt. Production
  API and background workers remain blocked pending separate acceptance.
- Do **not** provision `TWE_OIDC_*` callbacks/secrets, use the legacy
  developer bearer UI, add a second identity provider, or treat old PKCE/ACR
  tests as live Access/MFA acceptance requirements.

## Historical OIDC proposal (superseded 2026-10-23)

Use OpenID Connect Authorization Code flow with PKCE/state/nonce, performed on
the Express server. Keep provider tokens out of browser storage. Identify staff
by the configured issuer and immutable subject, not email domain or claims that
automatically grant administration. Staff are provisioned by a technical operator
into a server-owned organisation. Initial roles: owner and editor; no public signup.

After identity verification issue an opaque, expiring, revocable server session
in a host-only HttpOnly cookie. Mutations require a session-bound CSRF token and
exact portal Origin. Staff lookup on each request must reject disabled identities
and reflect current role. Logout revokes the local session; account recovery and
MFA enrolment/recovery belong to the selected provider. Provider-wide logout is
distinct from application logout.

Hosted acceptance requires verified MFA claim/policy mapping, HTTPS cookie flags,
expired/revoked/wrong-organisation denial, PKCE/state/nonce rejection tests,
controlled provider redirects and an observed recovery drill. Until then, keep
hosted startup blocked. Do not deploy the legacy development token screen.

## Historical OIDC implementation notes (2026-10-21; not active setup)

The existing `openid-client` integration remains the established protocol adapter;
no new vendor or account has been silently selected. Baaba/Faako must register a
confidential OIDC web application with the chosen MFA-capable provider, separately
for staging and production. Register exactly `TWE_API_ORIGIN/api/auth/callback`;
set issuer/client ID/client secret and a verified provider-specific MFA `acr`
value. Merely naming an assurance string is not proof that MFA was enforced.
The provider must support the code/PKCE flow and return the configured assurance
claim. Test weak-assurance rejection, MFA enrolment and recovery before acceptance.

Provision each approved issuer/subject explicitly into `twe.staff_users` through
the privileged operator path, bound to the environment's organisation UUID and
owner/editor role. Never enrol by email suffix or turn an unknown login into an
owner. Do not paste subject/secret values into committed SQL or Trello.

Server sessions expire after one hour; cookie values are opaque and only hashes
are stored. Logout revokes one session; `POST /api/auth/logout-all` revokes all
sessions for the authenticated staff member. Both require exact portal Origin
and CSRF. Browser-origin staff reads also reject other origins, including the
public website. Denied callbacks record a reference-only `auth.denied` event;
audit failures produce safe diagnostics and do not grant access.

For lost-device/account compromise, Baaba disables the affected staff row using
the provisioning role, revokes its session rows scoped to the organisation, and
performs provider recovery/re-enrolment with the approved staff member. Active
membership is checked on every request. Re-enable only after recovery acceptance.
Application logout does not terminate a provider-wide SSO session.

## Historical dependency decision: openid-client 6.8.8

1. Meets the requirement for an established configurable identity protocol.
2. Faako's shared security package supplies headers/permissions, not this OIDC
   client. Existing applications' provider/session assumptions differ.
3. A native/custom OAuth implementation would add security-sensitive protocol
   code; a maintained OIDC library is the smaller maintenance risk.
4. Server-only; the portal uses ordinary labelled sign-in/logout controls.
5. No browser hydration/bundle cost; discovery/token calls need bounded timeouts.
6. MIT-licensed, pinned library; provider configuration and patch/advisory review
   remain operational responsibilities. No vendor account or subscription is chosen.
7. Vetted protocol validation justifies the dependency over custom JWT/OAuth code.

The version was checked against npm before installation. Source/API reference:
[openid-client](https://github.com/panva/openid-client). This library choice is
not evidence of configured MFA, valid staff sessions or a working live login.
## Historical OIDC login-assistance milestone — 2026-10-22

- Remember me is opt-in cookie persistence, not a longer authentication grant. Checked: HttpOnly cookie survives browser closure for at most one hour; unchecked: session cookie. Server expiry remains one hour in both cases, and browser session restoration may restore session cookies. MFA, staff provisioning and revocation remain mandatory.
- Migration `005_login_preference.sql` stores the choice in the expiring, one-use OIDC flow. Apply it before deploying the updated API. Existing flows default to unchecked.
- Forgot password and Create account open explanatory panels. Optional operator-approved HTTPS provider URLs, `TWE_OIDC_RECOVERY_URL` and `TWE_OIDC_REGISTRATION_URL`, enable onward navigation. Without configuration, the panels explicitly direct staff to their workspace owner; no request is submitted.
- Provider enrollment never provisions a TWE staff user or role. No passwords, recovery codes, provider tokens or login credentials are stored in browser storage. No password database or public staff-signup endpoint was added.
- Pending approval/configuration: identity provider, recovery/enrollment URLs and invitation policy. Longer remembered sessions require a separately reviewed lifetime policy. Live provider recovery/enrollment has not been verified.
