# TWE email test flow

Resend enquiry notifications contain no customer details or invitation codes.
The server enforces `testing@travelwitheasegh.com` for development/staging and
`notifications@travelwitheasegh.com` for production. A broader test allowlist cannot
override this rule. Previously queued payloads with different recipients fail closed.

Configure `TWE_RESEND_API_KEY`, a Resend-verified `TWE_EMAIL_FROM`,
`TWE_EMAIL_RECIPIENT`, and the exact HTTPS `TWE_PORTAL_ORIGIN` on the API/worker.
Outside production also set `TWE_EMAIL_TEST_RECIPIENTS` to the testing mailbox.
Store credentials only in local environment files or the hosting secret store.

From `apps/travel-with-ease-api`, run an explicitly authorised single test:

```sh
node --env-file-if-exists=.env scripts/test-notification.mjs --send
```

The command refuses production, creates no database records, and sends only a
labelled test message. Provider acceptance must be followed by a mailbox receipt
check. Automated unit/CI tests use a mocked transport and never send mail.

For an end-to-end staging enquiry, use synthetic contact data and the real enquiry
submission path, then run the existing `notifications:once` worker against that
same staging database. It processes one queued notification; it does not create
an enquiry. Verify the notification in the testing mailbox and the enquiry in the
authorised portal. Do not use production enquiries as test fixtures.

Invitation creation and claim are implemented separately. Codes are delivered
privately by the operator/Owner; automatic invitation emails are not implemented.
