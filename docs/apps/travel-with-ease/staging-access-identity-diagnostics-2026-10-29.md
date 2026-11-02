# TWE staging: Cloudflare Access staff identity rejections (2026-10-29)

## Observed
On `develop` after PR #111, Railway logged `portal.access.rejected` with `reason: staff_identity_invalid` on the CMS origin. This is **after** JWT signature, signing-key, issuer, audience, expiry and not-before verification by `jose`. The portal request is correctly denied with HTTP 401. It happens **before** database staff-user provisioning or local session checks.

## Change
The verifier retains every existing fail-closed cryptographic and claim check. It now labels the individual post-verification denial using **fixed, allowlisted reason codes**, never raw JWT claims, headers, email, assertion content or authentication secrets:

- `jwt_type_invalid`: JWT header type is not `JWT`
- `signing_key_id_missing`: JWT header lacks `kid`
- `app_type_invalid`: identity is not a Cloudflare Access application token (`type=app`)
- `audience_shape_invalid`: signed claim doesn't contain precisely the configured staging application audience as a single array entry
- `subject_invalid`: user subject is missing or malformed
- `identity_nonce_missing`: token does not include a valid identity nonce
- `service_identity_detected`: token uses machine/service identity attributes
- `issued_in_future`: signed JWT issued-at field is ahead of current time
- `expiry_before_issue`: expiry does not follow issued-at time
- `staff_identity_invalid`: generic fallback for unknown identity exceptions

Standard JWT errors continue to use `aud_invalid`, `iss_invalid`, `token_expired`, `signing_key_not_found` etc.

## Operator next steps
1. Review latest **staging** TWE API deployment logs. Identify the reason for the **same request** when opening the CMS host `/api/auth/status` after completing a fresh Google+Cloudflare MFA login.
2. In Cloudflare Zero Trust → Access → Applications verify the CMS hostname is covered by **one self-hosted** Access application, not a service-token or broad overlapping policy. Check the staging Access AUD corresponds to `TWE_ACCESS_AUDIENCE` and the issuer team to `TWE_ACCESS_TEAM_DOMAIN`. Never paste JWTs, cookies or signing keys into issues or chat.
3. If the reason is `identity_nonce_missing`, compare behavior with Cloudflare's documented identity-token shape and confirm the browser session is through the intended self-hosted app. Do not drop the identity nonce check based only on an unauthenticated assertion.
4. If `app_type_invalid` or `service_identity_detected`, ensure the request uses an identity-based Google/MFA policy, not a service token.
5. If `audience_shape_invalid`, verify the Access application AUD list and stale/overlapping applications; do not disable JWT audience validation.
6. After the assertion passes, verify the auth-status JSON `configured=true`, then verify local app session/staff provisioning independently.

The staging diagnostics don't change authentication decisions or unlock any access.

## Follow-up: optional JOSE `typ` on Cloudflare Access tokens

Staging later logged `jwt_type_invalid` for a cryptographically verified assertion. The original `access.js` check rejected any token whose protected-header `typ` was not *exactly* uppercase `JWT`. This exceeds RFC 7519 §5.1: the field is optional, and media types are case-insensitive. Neither a missing `typ` nor mixed-case `JWT` is proof of an invalid assertion.

The verifier now allows `typ` to be omitted or to be `JWT`/`application/jwt` (case-insensitive), but rejects other explicit types. **All** signature, RS256, issuer, single configured staging audience, temporal, subject, `type=app`, nonce, service-token rejection, active DB staff account, and local session constraints remain enforced.

After review/CI, deploy to staging and retry a fresh Access session. If the reason advances to another fixed code, address that specific rejection without switching off the Access guard or using production credentials. If it stays `jwt_type_invalid`, the present token type may not be one of the recognized JWT types and needs further provider-specific validation; do not paste the token into tickets or chat.
