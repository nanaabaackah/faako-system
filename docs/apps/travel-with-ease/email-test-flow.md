# TWE enquiry acknowledgement and email test flow

## Continuous worker — 2026-11-08

`notifications:worker` now runs the existing outbox continuously with graceful
shutdown; `notifications:once` remains one-job diagnostics and
`notifications:status` reports redacted queue/configuration state.
The API alone still does not deliver queued mail. Follow the
[dedicated staging worker settings and acceptance checklist](./workspace-refinements-2026-11-08.md#enquiry-email-diagnosis-and-railway-worker).
The dedicated staging worker was provisioned on 2026-11-14. It reported ready
and moved the four existing acknowledgements to sent with four provider IDs and
no failed or processing jobs. Provider acceptance is recorded; receipt in the
testing mailbox (including spam) remains a user acceptance check. Production
delivery remains unchanged and was not exercised.

## Routing (supersedes the earlier To/CC instructions)

| Environment | To | CC |
| --- | --- | --- |
| Development/staging | testing@travelwitheasegh.com | None |
| Production | Email from the saved, tenant-scoped enquiry | notifications@travelwitheasegh.com |

The recipient entered in a local/staging form is never a delivery destination.
The sender rechecks routing immediately before delivery, including pinned retries.
`TWE_EMAIL_RECIPIENT` and `TWE_EMAIL_TEST_RECIPIENTS` are obsolete and ignored.
Configure `APP_ENV`, `TWE_RESEND_API_KEY` and the Resend-verified `TWE_EMAIL_FROM`.
Keep authentication's `TWE_PORTAL_ORIGIN` setting; email no longer depends on it.

## Template and persistence

Modern Concierge uses the real gold logo on navy, white message body and cream
company footer. HTML and plain text include the company information from the
2026-10-30 supplied Faako onboarding submission. Personal account email is excluded.
Customer names are escaped; no private trip notes, tracking pixels, staff links,
booking promises or payment confirmations appear. Social links are present;
social icons use local PNG assets for email-client support. Chrome preview captures
are part of local verification; Gmail/Outlook inbox rendering remains a hosted test.

The enquiry and outbox are committed together. The worker looks up contact data
under the job's organisation and pins the complete payload in the claim transaction.
The payload exists only while delivery is pending or processing. Eligible retries
within the 23-hour provider-deduplication window preserve the original payload and
idempotency key. Sent, exhausted, expired and invalid jobs retain status, attempt,
provider-ID and bounded error evidence but erase recipient, rendered body and
private continuation URL. Migration `016_notification_payload_retention.sql`
backfills existing terminal jobs and enforces this invariant. Its trigger also
clears terminal writes from the previous worker version, so the migration can be
deployed before the API/worker without rejecting an already accepted delivery.
Malformed legacy contact data marks delivery failed for review without deleting the enquiry.
Previously attempted payloads incompatible with the new routing remain blocked;
never rewrite their body under an existing provider idempotency key.

This controls only TWE's PostgreSQL outbox. [Resend's current GDPR
documentation](https://resend.com/security/gdpr) states that email content and
delivery logs are stored in the United States and retained for 30 days on Free,
Pro and Scale plans; Enterprise retention is configurable. Resend has no API for
individual sent-email deletion, and early deletion requires a support request with
the provider email ID. Confirm the active account plan, [DPA](https://resend.com/legal/dpa)
and processor/rights procedure before production approval. Clearing the outbox
does not erase delivered mailboxes or provider-held copies.

Deploy migration `016` before the API and notification worker. The trigger keeps
the previous worker compatible during a rolling release. Roll back application
code first if needed; the migration may remain because it is compatible with the
previous worker and continues to enforce minimisation. If an exceptional schema
rollback is approved, drop `notification_outbox_terminal_payload_cleared`, then
the `notification_outbox_clear_terminal_payload` trigger, then
`twe.clear_terminal_notification_payload()`. Erased payloads are intentionally
not recoverable from the outbox; provider/mailbox copies remain separate.

## Testing

From `apps/travel-with-ease-api`, run only with an authorised non-production config:

```sh
node --env-file-if-exists=.env scripts/test-notification.mjs --send
```

This sends a labelled template preview to testing only, creates no enquiry and
refuses production. Provider acceptance is not proof of inbox delivery. CI uses
mocked transport. No live preview has been sent for this template revision yet.

Use synthetic data on the real staging enquiry path, then run `notifications:once`
with that same staging database for the full flow. Demo paths remain no-send.
Automatic staff invitation email is not implemented by this change.
Continuous delivery requires the new worker command to be supervised in the
approved environment. A Resend key alone does not drain the outbox. Repository
implementation does not itself provision the Railway service.
