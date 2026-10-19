# TTNGH email operations

Updated 18 October 2026. Public DNS shows Cloudflare routing MX/root SPF, a Resend
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
6. Keep TTNGH_ACKNOWLEDGEMENT_APPROVED=false unless the organisation approves automatic visitor acknowledgement.

The notification is plain text with a fixed subject, validated Reply-To and no user-supplied mail headers. Names are single-line; email validation rejects header injection. Staff delivery uses a provider idempotency key derived from the submission UUID. Reusing the same submission after uncertain delivery does not intentionally send another copy. No automatic unsafe POST retry is performed by the browser.

Optional acknowledgement is generic and does not echo the enquiry. Staff delivery determines success; acknowledgement failure is logged only as a redacted event. Future event confirmations and verified donation receipts can reuse the server-only delivery function, but neither is fabricated or enabled in Phase 2. Payment redirects must never trigger a receipt by themselves.

## Privacy and ownership

The website API does not persist contact messages in a database or include them in logs. The provider and recipient mailbox still process/store messages: the organisation must approve retention, deletion, authorised readers, MFA and a safeguarding escalation process. No retention period is invented by the implementation. Do not send enquiry fields to analytics or store them in the CMS. Use non-sensitive fixture data for tests.

## Failure and rotation runbook

- Delivery unavailable: keep the message on-screen, complete a new security check, retry deliberately or use verified direct contact details. Do not tell a visitor it succeeded before provider acceptance.
- Repeated provider failure: disable TTNGH_CONTACT_ENABLED; notify the named service/inbox owner; inspect redacted request IDs and provider delivery events under restricted access.
- Inbox compromise: revoke access, rotate credentials, assess exposure and follow the organisation's incident/privacy process.
- Rotate the Resend key in the provider console and Railway secret store; verify staging delivery before removing the old key. Never paste secrets into issues, commits or this runbook.

Operational checks must be recorded after configuration; code tests do not establish DNS or real mail delivery.
