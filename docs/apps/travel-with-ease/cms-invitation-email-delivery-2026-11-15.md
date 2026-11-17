# TWE — simple, Cloudflare-verified staff email invitations (2026-11-15)

## New routine invitation flow

An authorised Owner (Editor invitations) or Superadmin (Editor or Owner invitations)
opens **CMS → Staff Access → Invitations**, enters **one email address**, selects a
role only if permitted, and clicks **Send invitation**. No Cloudflare Access
subject or approval reference is requested in the normal invitation form.

The API validates and normalises the email, creates a **24-hour, single-use**
email-bound invitation, generates an internal immutable audit reference of the
form `EMAIL-<invitation-UUID>`, and queues the branded Resend invitation in the
same PostgreSQL transaction. The response reports **queued**, not sent/received.
A provider-accepted message must still be verified separately in the mailbox.

The invitee receives a code, navigates to the protected CMS portal, and
authenticates using a Cloudflare Access identity admitted by the approved
app policy (including MFA). The API independently verifies the signed Access
assertion (issuer, audience, signature, lifetime, signed app type). It then
requires **exact case-insensitive equality between the signed email claim
and the email on this invitation**, plus a valid code, unexpired/unrevoked
invitation, authorised inviter, and no existing staff account. The user must
review and explicitly confirm activation.

A code **alone**, an email entered by the user, a logged-out recipient, a
Cloudflare identity with a different email, or a Cloudflare identity not
admitted by the Access policy cannot activate a staff account. An Access
assertion without a usable signed email claim cannot claim an email invite.
The Cloudflare subject from the *actual successful sign-in* is stored in the
staff user record, rather than guessing the subject when inviting.

## Compatibility and security

- New additive migration: `017_staff_email_invitation_binding.sql`. Preserve
  previous migrations, staff records and pending subject-bound invitations.
- The new `invited_email` binding is stored only in the protected invitations
  table and is readable only to authorised staff. It is not logged or sent to
  browser analytics.
- No plaintext invitation code is stored in the database, queue or audit log.
  The same environment-specific HMAC secret and Resend worker remain in use.
- Resend sends staging/development invitations only to
  `testing@travelwitheasegh.com`. Production delivery, when separately
  authorised, goes to the intended email.
- Reissuing to the same email automatically revokes older unaccepted
  email-bound invitations. Admins may revoke invitations explicitly. Existing
  manual subject-bound activations continue working, including first-Owner
  bootstrap; the routine CMS UI no longer exposes the manual subject workflow.
- An invited role cannot be elevated by the invitee. An Owner may invite an
  Editor, and only an authorised Superadmin may invite another Owner.

## Staging verification

Before activation, run reviewed migrations through the approved Railway
predeploy procedure, confirm API and notification worker use the same
environment/tenant and invitation HMAC secret, and verify Resend is configured.

Test with a synthetic staging Access user:

1. Authorised staff creates an email-only invitation; inspect queued status.
2. Confirm the message lands in the **testing mailbox** and includes the
   one-time code. Provider acceptance alone is insufficient.
3. A signed Cloudflare identity matching the invited email can preview,
   confirm and activate once, with the assigned role.
4. A different admitted Cloudflare identity with a different signed email,
   missing email claim, wrong audience, or no valid Access assertion cannot
   preview or claim the code.
5. Test expiry, revocation, reissue, retry/worker outage, wrong role, CSRF and
   cross-tenant isolation without changing production data.
6. Confirm no secret, invitee contact, code, or token appears in logs or
   screenshots.

**Never bypass Cloudflare Access or weaken permission checks to make activation
pass.** Enabling or deploying to production requires separate release approval.
