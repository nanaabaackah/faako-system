# Public enquiry intake and Turnstile setup

Implemented 2026-11-01. This is first-contact intake, not the complete conditional
Readiness/Full Planning form. No shared database reset or new migration is needed.

## Provider configuration

In Cloudflare: **Turnstile → Add widget → Managed → Create**. Leave pre-clearance
off. Enter hostnames without a scheme, port or path:

| Widget | Public website hostnames | Pages build variable | Railway API variable |
| --- | --- | --- | --- |
| TWE Staging | staging.travelwitheasegh.com | PUBLIC_TURNSTILE_SITE_KEY = staging site key | TWE_TURNSTILE_SECRET_KEY = staging secret |
| TWE Production | travelwitheasegh.com, www.travelwitheasegh.com | PUBLIC_TURNSTILE_SITE_KEY = production site key | TWE_TURNSTILE_SECRET_KEY = production secret |

Set the site key in the corresponding Cloudflare Pages build environment
(staging/preview versus production) and the paired secret in the corresponding
Railway TWE API environment. Rebuild Pages and redeploy the API. Do not configure
these secrets in the portal, public source, browser environment or chat.
The widget runs on the public website, not the portal or API hostname.

Cloudflare's root-hostname setting also permits its subdomains. The server
independently checks the exact environment-specific public hostname and expected
action; do not treat widget hostname settings alone as environment isolation.

Official references:
[widget creation](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/),
[hostname rules](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/),
[server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[CSP requirements](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

## Executable security behaviour

- The official script is loaded directly; no new CAPTCHA dependency is installed.
- API verification uses the fixed Cloudflare Siteverify endpoint with an
  eight-second timeout, checks success, action twe_enquiry and exact hostname,
  and does not retry unsafe submissions automatically.
- Hosted submissions cannot skip verification. Missing configuration blocks the
  enquiry mutation, not API startup, staff authentication or the CMS.
- Hosted dummy/test secrets are rejected. Token/secret contents never enter
  records, replay fingerprints, analytics or logs.
- The browser clears expired tokens and refreshes after an attempted submission.
  An unchanged retry retains its submission UUID and gets a fresh challenge.
- CSP adds only challenges.cloudflare.com to script/frame sources. Existing
  frame-ancestors protection remains.
- Local development uses the loopback API proxy, not a copied hosted API origin,
  and does not load hosted widgets. The development API launcher isolates hosted
  environment files. This local path cannot bypass hosted server verification.

## Contract and persistence

POST /api/public/enquiries accepts submissionId, enquiryType
(trip/gift/group/celebration), service, destination, travelTimeframe, travellers,
optional budget/notes, name/email/phone, consent, a honeypot and turnstileToken.
Schema bounds and exact allowed Origin apply. Rate limiting precedes persistence.
There are no passports, document uploads, payment fields or marketing opt-ins.

Existing twe.enquiries JSON details retain source and classification. A
tenant/submission advisory transaction lock serializes retries; the stored
fingerprint rejects changed payload reuse with 409. The enquiry and one existing
notification_outbox job commit together. A provider failure cannot delete the
saved enquiry. The UI reports received only after a valid persisted reference,
not “email delivered” or “booking confirmed”.

Local file persistence is private and supports the same replay/conflict behaviour,
without automatically sending real provider mail. Hosted delivery still requires
the separately configured worker and actual test-recipient receipt verification.
Non-production mail routing remains testing@travelwitheasegh.com only; production
uses the saved customer email with notifications@travelwitheasegh.com in CC.

## Remaining acceptance

Real widget keys and hosted challenge verification, complete Google Form
branching, authoritative package/tier context, inbox classification filters,
notification receipt and publication automation remain separate release gates.
Do not label mocked verification as a live Cloudflare or Resend acceptance test.

After copying the code into the normal worktree, restart pnpm run dev:twe once
to load the new API route. The API dev command now watches source changes;
no unrelated running processes need to be stopped.
