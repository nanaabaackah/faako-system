# TTNGH analytics and privacy

Updated 13 October 2026. The public site uses the shared Faako Google Analytics utility and TTNGH's consent notice. This describes implementation, not a configured/live GA property.

## Activation

Set only the approved `PUBLIC_GA_MEASUREMENT_ID`. There is no PUBLIC_ANALYTICS_ENABLED or PUBLIC_GOOGLE_ANALYTICS_ID switch in this application. The tag is not loaded without explicit analytics consent. Marketing/ad storage remains denied and Do Not Track is respected. Revoking consent disables further collection and attempts removal of first-party GA cookies.

The organisation must approve its property owner, access roles, reporting timezone, retention and privacy notice before activation. Verify both accept and reject paths using an isolated staging property. Disable GA Enhanced Measurement **form interactions** and site-search capture; do not allow a provider setting to collect field values or sensitive query terms.

## Data boundaries

The shared page-view implementation strips query strings and hash fragments from page_location/page_path. No name, email, message, health concern, donor identity, payment reference, WhatsApp number or free-text search term may be sent. The contact script does not emit analytics events, store enquiry contents or put messages into URLs. Search operates locally.

Public structured data, metadata and sitemaps are publishing features, not visitor profiling. Search Console setup still needs verified domain ownership and access approval.

Future aggregate CTA/programme/event interactions require a controlled identifier allowlist and privacy review. They must not include visitor-entered text. No newsletter, payment-completion or enquiry-success analytics event is claimed implemented in Phase 2.

## Provider privacy

- Turnstile loads on explicit security-check interaction; its token is sent only to the Railway verifier and is not logged.
- Google Calendar loads after choosing “View full Google calendar”; event-level Google links are outbound and ICS downloads stay local.
- Sanity provides public content/assets only; private enquiries are never CMS records.
- Resend and the recipient inbox process enquiry contents for delivery and response. The organisation must approve retention/access/deletion responsibilities.

Before launch, verify provider settings and network requests in a real browser, obtain the organisation's privacy/legal approval, and record responsible owners. The final production phase still includes full analytics/privacy and deployed-header review.
