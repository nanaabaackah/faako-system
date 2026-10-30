# TWE email test flow

Resend enquiry notifications contain no customer details or invitation codes.
The intended staff recipient remains in **To**, configured by `TWE_EMAIL_RECIPIENT`.
The server automatically adds **CC** `testing@travelwitheasegh.com` for
development/staging and `notifications@travelwitheasegh.com` for production.
There is no CC variable to set. Outside production, the intended To recipient must
also be explicitly approved in `TWE_EMAIL_TEST_RECIPIENTS`. This prevents accidental
test delivery to unapproved users without replacing the intended recipient.
Previously pinned payloads lacking the required CC fail closed; do not rewrite
already-attempted jobs under the same provider idempotency key. Review them manually.

Configure `TWE_RESEND_API_KEY`, a Resend-verified `TWE_EMAIL_FROM`,
`TWE_EMAIL_RECIPIENT`, and the exact HTTPS `TWE_PORTAL_ORIGIN` on the API/worker.
Outside production set `TWE_EMAIL_TEST_RECIPIENTS` to the approved To addresses
(comma-separated). The environment CC is added independently.
Store credentials only in local environment files or the hosting secret store.

From `apps/travel-with-ease-api`, run an explicitly authorised single test:

```sh
node --env-file-if-exists=.env scripts/test-notification.mjs --send
```

The command refuses production, creates no database records, and sends only a
labelled test message to the configured, allowlisted recipient with the testing CC.
Provider acceptance must be followed by a mailbox receipt
check. Automated unit/CI tests use a mocked transport and never send mail.

For an end-to-end staging enquiry, use synthetic contact data and the real enquiry
submission path, then run the existing `notifications:once` worker against that
same staging database. It processes one queued notification; it does not create
an enquiry. Verify the notification in the testing mailbox and the enquiry in the
authorised portal. Do not use production enquiries as test fixtures.

Invitation creation and claim are implemented separately. Codes are delivered
privately by the operator/Owner; automatic invitation emails are not implemented.
This transport currently sends staff enquiry alerts, not customer acknowledgements.
