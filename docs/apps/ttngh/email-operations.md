# TTNGH email operations

Updated 18 November 2026. Public DNS shows Cloudflare routing MX/root SPF, a Resend
DKIM selector and monitoring DMARC. These do not prove alias destinations, sender
approval, API credentials or delivery. Those remain UNVERIFIED; no mail was sent.
See [production evidence](production-status-2026-10-18.md).

## Incoming mail: Cloudflare Email Routing

The domain owner should verify which of these proposed aliases exist and forward
to the approved inbox. Do not advertise an alias until tested:

- hello@thethrivingnetworkgh.org
- events@thethrivingnetworkgh.org
- partnerships@thethrivingnetworkgh.org
- donate@thethrivingnetworkgh.org

First obtain approval of the destination inbox and verify it in Cloudflare. Add the provider-generated routing records, then test each alias, spam folders and replies. This is forwarding, **not hosted mailboxes** and not an outgoing mail service. Do not imply that Gmail replies automatically use the domain alias. Google Workspace or another hosted-mail provider is a separate future decision for named staff accounts.

## Outgoing website messages: Resend from Railway

Use a separately approved transactional sender subdomain; `notifications.thethrivingnetworkgh.org` is a proposal, not a configured address. The provider supplies the actual records. Do not invent DNS values or replace Cloudflare Email Routing MX records at the root domain.

1. Domain owner approves the sender domain, fixed From address and receiving inbox.
2. Add Resend's generated DKIM and SPF/return-path records to the correct hostnames. There must not be competing SPF records at one hostname; coordinate any existing record rather than appending a second one.
3. Establish DMARC reporting to an approved destination, initially monitoring until legitimate senders pass alignment. Tighten policy only with domain-owner approval and verified delivery. Do not publish a guessed reporting address.
4. Keep the provider API key in Railway secrets only. Prefer a sending-only key scoped to the verified domain where available.
5. Set TTNGH_MAIL_FROM and TTNGH_ENQUIRY_TO, then test a non-sensitive enquiry through Turnstile on staging. Verify received headers, SPF/DKIM/DMARC alignment, Reply-To, spam placement and domain-routing coexistence.
6. Automatic branded visitor acknowledgement is now approved. It is enabled unless TTNGH_ACKNOWLEDGEMENT_APPROVED=false. Set TTNGH_REPLY_TO to the approved public reply inbox.

The staff notification and visitor acknowledgement use the existing October 2026 TTNGH branded HTML templates (PR #95), including accessible plain-text alternatives. Both use the display name The Thriving Network GH and a Resend-verified sender address. The staff notification uses the visitor's email as Reply-To; the visitor acknowledgement uses TTNGH_REPLY_TO. The staff message uses a validated Reply-To and no user-supplied mail headers. Names are single-line; email validation rejects header injection. Staff delivery uses a provider idempotency key derived from the submission UUID. Reusing the same submission after uncertain delivery does not intentionally send another copy. No automatic unsafe POST retry is performed by the browser.

Optional acknowledgement is generic and does not echo the enquiry. Staff delivery determines success; acknowledgement failure is logged only as a redacted event. Future event confirmations and verified donation receipts can reuse the server-only delivery function, but neither is fabricated or enabled in Phase 2. Payment redirects must never trigger a receipt by themselves.

## Privacy and ownership

The website API stores enquiry messages and consent timestamps in the restricted TTNGH PostgreSQL database, not in the public Sanity dataset, and does not include personal enquiry contents in application logs. The provider and recipient mailbox still process/store messages: the organisation must approve retention, deletion, authorised readers, MFA and a safeguarding escalation process. No retention period is invented by the implementation. Do not send enquiry fields to analytics or store them in the CMS. Use non-sensitive fixture data for tests.

## Failure and rotation runbook

- Delivery unavailable: keep the message on-screen, complete a new security check, retry deliberately or use verified direct contact details. Do not tell a visitor it succeeded before provider acceptance.
- Repeated provider failure: disable TTNGH_CONTACT_ENABLED; notify the named service/inbox owner; inspect redacted request IDs and provider delivery events under restricted access.
- Inbox compromise: revoke access, rotate credentials, assess exposure and follow the organisation's incident/privacy process.
- Rotate the Resend key in the provider console and Railway secret store; verify staging delivery before removing the old key. Never paste secrets into issues, commits or this runbook.

Operational checks must be recorded after configuration; code tests do not establish DNS or real mail delivery.

## Enquiry database and outbox activation (18 November 2026)

- The existing dedicated TTNGH PostgreSQL service remains the database of record. Do not provision a new database or use another application's connection string.
- Before releasing the API, take an approved backup and apply `services/ttngh-api/migrations/002-enquiries.sql` to the existing TTNGH database using a privileged migration connection. This creates `ttngh_contact.enquiries` and `ttngh_contact.notification_outbox`; it does not touch donor/payment tables.
- Keep the existing Railway API variable `DATABASE_URL` referencing the dedicated TTNGH PostgreSQL **private** connection. It must point to the same database where migration 002 ran. Do not create a second database variable or expose its value.
- Set `TTNGH_MAIL_FROM` to a sender email address verified in Resend (plain address only). Outgoing email uses the display name `The Thriving Network GH`. Confirm `TTNGH_ENQUIRY_TO` is the approved team inbox, and set `TTNGH_REPLY_TO` to the official reply mailbox.
- The long `@icloud.com` alias reported in incoming mail may be an Apple Hide My Email/forwarding address. A display-name change does not remove that alias. Check the real From, To and Return-Path headers and Cloudflare Email Routing destination before changing email routing.
- New submissions validate Turnstile and persist before any email attempt. An outbox job sends the staff notification first; only after successful Resend acceptance does the branded visitor acknowledgement become eligible.
- A lightweight loop in the existing Railway API service retries unsent notifications. After at most five failed attempts or 18 hours since the first attempt, a job is marked `review` rather than risking duplicates beyond Resend's deduplication window. Reconcile reviews manually from the restricted database/provider logs; never expose an unauthenticated listing endpoint.
- A successful form submission confirms safe storage. It does **not** guarantee the team has already received the email; Resend delivery outcomes should be validated during a staging test. Test: successful email pair, sender display name, Reply-To in each direction, failure retry, duplicate POST, and a restart between persistence and mail dispatch.
- Keep private-record access limited, define approved retention/deletion procedures before production use, and validate updated privacy notice against the organisation's practices.
