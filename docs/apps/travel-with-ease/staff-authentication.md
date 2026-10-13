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
