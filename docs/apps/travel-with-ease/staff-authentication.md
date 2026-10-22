# Staff authentication roadmap — Prompt 03

Status: provider-neutral implementation authorised in the conversation;
provider selection, account setup and live acceptance pending. Date: 2026-10-11.
Workstream: TWE-017. No other Faako application's authentication is changed.

## Decision and rollout

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

## Implemented controls and manual provider setup (2026-10-21)

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

## Dependency decision: openid-client 6.8.8

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
# Login assistance — 2026-10-22

- Remember me is opt-in cookie persistence, not a longer authentication grant. Checked: HttpOnly cookie survives browser closure for at most one hour; unchecked: session cookie. Server expiry remains one hour in both cases, and browser session restoration may restore session cookies. MFA, staff provisioning and revocation remain mandatory.
- Migration `005_login_preference.sql` stores the choice in the expiring, one-use OIDC flow. Apply it before deploying the updated API. Existing flows default to unchecked.
- Forgot password and Create account open explanatory panels. Optional operator-approved HTTPS provider URLs, `TWE_OIDC_RECOVERY_URL` and `TWE_OIDC_REGISTRATION_URL`, enable onward navigation. Without configuration, the panels explicitly direct staff to their workspace owner; no request is submitted.
- Provider enrollment never provisions a TWE staff user or role. No passwords, recovery codes, provider tokens or login credentials are stored in browser storage. No password database or public staff-signup endpoint was added.
- Pending approval/configuration: identity provider, recovery/enrollment URLs and invitation policy. Longer remembered sessions require a separately reviewed lifetime policy. Live provider recovery/enrollment has not been verified.
