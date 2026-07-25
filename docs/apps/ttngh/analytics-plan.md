# TTN GH Google Analytics foundation

Google Analytics is a requested integration but is deliberately not loaded by the scaffold.

## Enablement gate

Before adding the Google tag:

1. Confirm the client-owned GA4 account, property, Ghana/Accra reporting context, and web data stream.
2. Approve the privacy/cookie notice, retention settings, user-data policy, and internal access roles.
3. Implement a consent mechanism that defaults analytics storage to denied and prevents Analytics from
   loading until the approved consent condition is met.
4. Ensure form text, URLs, page titles, and analytics payloads do not expose health information or
   other sensitive personal data.
5. Validate the implementation with Google Tag Assistant in both accept and reject paths.
6. Set `PUBLIC_ANALYTICS_ENABLED=true` and the approved `PUBLIC_GOOGLE_ANALYTICS_ID` only after review.

## Privacy-conscious event taxonomy

Proposed aggregate events:

- `navigation_cta_select` with a controlled CTA identifier
- `program_summary_view` with an approved public program slug
- `event_registration_select` with an approved public event slug
- `partnership_enquiry_start`
- `volunteer_enquiry_start`
- `donation_start` with currency and broad amount band, never donor identity
- `newsletter_signup_complete`
- `outbound_contact_select` with channel type only
- `resource_view` with an approved public resource slug

Never send names, email addresses, phone numbers, WhatsApp numbers, form text, health/support details,
payment references, free-text search terms that may reveal health information, or other direct
identifiers to Analytics.

## Success measures

- Qualified contact and partnership enquiries
- Program and event registration handoffs
- Volunteer and newsletter completions
- Verified donation completion rate, reconciled outside Google Analytics
- Resource engagement and return visits
- Mobile task completion and form-error rates

Traffic and engagement metrics should support decisions; they are not substitutes for service quality,
safeguarding outcomes, community trust, or evidenced impact.

## Official implementation references

- Google Analytics website setup:
  <https://support.google.com/analytics/answer/9304153>
- Google consent mode:
  <https://support.google.com/analytics/answer/10000067>
- Google consent verification:
  <https://support.google.com/analytics/answer/14218557>
- WCAG 2.2:
  <https://www.w3.org/TR/WCAG22/>
- Ghana Data Protection Commission:
  <https://dataprotection.org.gh/>
