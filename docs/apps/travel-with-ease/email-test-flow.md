# TWE enquiry acknowledgement and email test flow

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
Retries preserve the original payload and idempotency key. Malformed legacy contact
data marks delivery failed for review without deleting the enquiry. Previously
attempted payloads incompatible with the new routing remain blocked; never rewrite
their body under an existing provider idempotency key.

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
Continuous delivery requires the existing worker command to be scheduled or
supervised in the approved environment. A Resend key alone does not drain the
outbox. Worker/scheduler hosting configuration is not changed by this branch.
