# Public Privacy And Cookie Consent

Last updated: 2026-06-19

## Scope

This note covers the public-facing websites and storefronts:

- `apps/stroane-web` storefront routes
- `apps/faako-website`
- `apps/bynana-portfolio`
- `apps/reebs-website`

Admin portals and internal ERP apps should not reuse the public marketing copy verbatim. If a portal needs consent or privacy messaging, document it beside the app because portal storage, authentication, audit logs, and staff data policies are different.

## Consent Standard

Public websites should show a cookie or browser-storage consent prompt before optional analytics tracking runs.

Required prompt details:

- Essential storage that keeps the site working, such as cart contents, checkout progress, customer sessions, security state, theme/language preferences, or form drafts.
- Optional analytics, where enabled, must be described as aggregate site-performance and usage measurement.
- Optional marketing or personalization storage must be separate from analytics when the app supports it.
- Payment disclosure must state that card, mobile money, bank, PIN, CVV, and similar payment credentials are handled by Paystack or the payment provider and are not stored on Faako/Stroane/REEBS/By Nana systems.

Consent choices should be stored locally with a versioned app-specific key. Do not store private customer data in the consent record.

## Current Implementation

- Stroane uses `src/frontend/components/CookieConsentBanner.tsx` and `src/frontend/utils/cookieConsent.ts`. Storefront Google Analytics route tracking is gated by analytics consent. Portal route tracking remains separate from the public storefront consent prompt.
- Faako Website uses `src/components/CookieConsentBanner.jsx` and `src/utils/cookieConsent.js`. Google Analytics route tracking is gated by analytics consent.
- By Nana Portfolio uses `src/components/CookieConsentBanner.jsx` and `src/utils/cookieConsent.js`. Google Analytics route tracking is gated by analytics consent.
- REEBS Website uses the existing `src/components/CookieBanner/CookieBanner.jsx` as a global public-site banner mounted from `App.jsx`.

## Policy Pages

Policy pages should explain what is stored and what is not stored.

Required policy details:

- Contact, order, account, inquiry, or booking data that the app collects directly.
- Browser storage/cookie categories and why they are used.
- Analytics providers and consent choices.
- Payment-provider sharing for checkout or invoices.
- A clear statement that sensitive payment credentials are not stored on our systems.
- Contact path for privacy or data-access requests.

Current public policy pages:

- Stroane: `/privacy` and `/cookies`
- Faako Website: `/privacy`
- By Nana Portfolio: `/privacy`
- REEBS Website: `/privacy-policy`

## Maintenance

When checkout, auth, analytics, CRM, booking, or tracking behavior changes in a public app, update the matching consent banner, policy page, and this note in the same change set.
