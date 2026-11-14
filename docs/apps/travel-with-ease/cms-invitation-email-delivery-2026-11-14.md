# TWE CMS invitation email delivery — implementation and staged acceptance

## Current scope

This change adds **optional automatic staff invitation emails** to the existing Cloudflare Access, tenant-scoped CMS onboarding. Existing manual single-use codes and the initial Owner bootstrap remain supported.

From **Staff access → Invitations**, an authorised Owner/Superadmin can select **Email invitation**, enter the independently verified Cloudflare Access subject and corresponding recipient email, choose an approved role, and provide the required approval reference. The API issues an identity-bound 24-hour invitation and enqueues a *separate* durable email delivery in the same PostgreSQL transaction. The API responds **queued**, not **sent**. Invited staff sign into the protected portal through Cloudflare Access/MFA, enter the one-time code from the email, preview role/expiry, and explicitly claim it.

Manual code invitations remain available; they are the only supported first-Owner installer path. Editors cannot issue invitations. Only a Superadmin can issue an Owner invitation. No account is created by emailing the code.

## Secret and data handling

- The emailed one-time code is deterministically derived via HMAC-SHA256 from a **new, high-entropy 32-byte server secret**, environment, organisation, invitation UUID and verified subject. Only its SHA-256 hash is recorded in `staff_invitations`. Raw codes are never stored in database queue rows, logs, audits, or API responses for emailed invitations.
- `staff_invitation_deliveries` contains a tenant-scoped invitation reference, recipient address, processing state, bounded retry metadata, provider ID and a **snapshot of approved email template copy** (not the rendered email/code).
- Codes are **valid only for the configured Cloudflare Access issuer, subject, audience, environment, and tenant**, and are single-use/expiring. Changing or revoking an invitation invalidates its code, even if a previously sent email arrives late.
- A queued delivery is cancelled before claim when the invitation expires, is revoked or is accepted. The worker checks validity again immediately before sending. Provider acceptance is not proof of mailbox receipt. Do not log recipient addresses or the rendered email payload.
- The sender uses a distinct Resend idempotency key for each invitation; it does not alter the existing enquiry notification outbox, customer email routing, or continuation links.

## Configuration (not activated automatically)

Migration `015_staff_invitation_email_delivery.sql` **must be deployed through the existing reviewed migration process before enabling delivery**. Extend the existing runtime role grant to the new queue table.

Configure these new **server-only** environment variables on **both the API and the dedicated notification worker**, separately per environment:

- `TWE_INVITATION_DELIVERY_ENABLED=true` — explicit opt-in. Unset/false retains the manual workflow and keeps the worker enquiry-only.
- `TWE_INVITATION_DELIVERY_SECRET` — separate **32-byte base64url** random secret, identical only across API and worker of the **same** environment. Never copy staging and production values; never expose in browser variables, GitHub, chat, audit logs, or screenshots.
- `TWE_INVITATION_PORTAL_ORIGIN` — **worker-only**, the reviewed protected HTTPS portal origin, e.g. `https://portal-staging.travelwitheasegh.com` for staging if verified. Configure to the actual deployed origin, not an assumed URL. Do not include path, query, hash, credentials or custom port.

Generate the 32-byte secret locally using a trusted crypto generator, for example `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))"`, then store it only in the provider secret manager. Do not rotate until all outstanding emailed invitations have expired/revoked. Use least privilege; the notification worker does not need authentication assertions or migration credentials.

Existing `TWE_RESEND_API_KEY`, `TWE_EMAIL_FROM`, database identity/TLS, `TWE_NOTIFICATION_WORKER_ENABLED=true`, and continuous supervised worker configuration remain required.

**Delivery routing:** development/staging always sends to **testing@travelwitheasegh.com**, regardless of input recipient. **Production** sends only to the independently verified invitation recipient; staff invitation emails do not CC customer-notification recipients. The API never reports delivery as successful merely because a job was queued.

## Staging acceptance and release gate

After PR merge and migration approval, enable the two services in staging only, then:

1. Verify the staging API and worker use the same reviewed TWE tenant, environment, and derived-secret configuration; prove migration/readiness succeeds.
2. Create an invitation for an *authorized synthetic staging identity*, with corresponding staging contact email. Confirm API returns `delivery=queued` and never a plaintext code.
3. Inspect redacted queue diagnostics and worker logs. Confirm lease, provider acceptance, idempotency and status transition to `sent`.
4. Confirm **actual inbox receipt** in the testing mailbox (including spam). Provider IDs alone are insufficient.
5. Test Cloudflare Access sign-in, recipient-subject binding, code preview, explicit account activation, role permissions, one-time use, and rejection of expired/revoked/mismatched identities.
6. Check replay, double issue, wrong-tenant lookups, worker restart, provider rejection, and manual-code fallback without sending a production message.
7. Ensure no production secrets, recipients, user data or tokens appear in screenshots, logs or test artifacts.

Do not enable this in production until the approved API/worker migrations, credential separation, access-policy/MFA, alerting, staging UAT and rollback arrangements are verified. Production activation and real invitation sending require separate authorisation.

On rollback, disable `TWE_INVITATION_DELIVERY_ENABLED` on API and worker first. Keep queued rows and migration history; manual invitations continue to work. Do not roll back schema destructively or resend ambiguous jobs.
