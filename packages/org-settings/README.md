# @faako/org-settings

Shared organization/tenant configuration foundation for Faako apps.

## What it is

A pure data/helper package — no React, no side effects, no API calls, no persistence. It provides:

- **Constants**: supported currencies, supported timezones, org settings field registry
- **Normalize helper**: `normalizeOrganizationSettings(raw)` — validates, trims, and produces a safe `OrganizationSettings` shape from any raw input
- **Display helpers**: `getOrganizationDisplayName`, `getOrganizationCurrency`, `getOrganizationCurrencySymbol`, `getOrganizationTimezone`, `getOrganizationBranding`, `getOrganizationContactInfo`
- **Safe metadata helpers**: `isSafeOrgSettingsKey`, `stripSensitiveOrgSettings` — block API keys, secrets, tokens, and payment provider credentials from being passed to frontend or public payloads
- **JSDoc types**: `OrganizationSettings`, `OrganizationBranding`, `OrganizationContactInfo`, `OrganizationNotificationPrefs`

## What it is NOT

- It does not fetch or persist org settings — apps own their own API calls and storage
- It does not implement billing, subscriptions, or full multi-tenancy migration
- It does not change auth behavior, database schema, or live business workflows
- It does not include a backend org-settings service (see `TODO(org-settings-api)` in `src/index.js`)

## OrganizationSettings shape

| Field               | Type              | Default         | Notes                                      |
|---------------------|-------------------|-----------------|--------------------------------------------|
| `businessName`      | `string`          | `""`            | Display name for the organization          |
| `logoUrl`           | `string`          | `""`            | URL or path reference — not validated      |
| `faviconUrl`        | `string`          | `""`            | URL or path reference — not validated      |
| `primaryColor`      | `string`          | `""`            | CSS color value — not validated            |
| `accentColor`       | `string`          | `""`            | CSS color value — not validated            |
| `contactEmail`      | `string`          | `""`            | Primary contact email                      |
| `contactPhone`      | `string`          | `""`            | Primary contact phone                      |
| `whatsappNumber`    | `string`          | `""`            | WhatsApp contact number                    |
| `addressLine1`      | `string`          | `""`            | Street address line 1                      |
| `addressLine2`      | `string`          | `""`            | Suite / floor / line 2                     |
| `city`              | `string`          | `""`            | City                                       |
| `country`           | `string`          | `""`            | Country                                    |
| `currency`          | `string`          | `"GHS"`         | ISO 4217 code; validated against CURRENCY_CODES |
| `timezone`          | `string`          | `"Africa/Accra"`| IANA timezone; validated against TIMEZONE_VALUES |
| `enabledModules`    | `string[]` / `null` | `null`        | null = all modules enabled                 |
| `notificationPrefs` | `object` / `null` | `null`          | Per-org notification preferences           |

## Usage

```js
import {
  normalizeOrganizationSettings,
  getOrganizationDisplayName,
  getOrganizationCurrency,
  getOrganizationCurrencySymbol,
  getOrganizationTimezone,
  getOrganizationBranding,
  getOrganizationContactInfo,
  stripSensitiveOrgSettings,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  ORG_SETTINGS_FIELDS,
} from "@faako/org-settings";

// Normalize raw API response into a safe shape
const settings = normalizeOrganizationSettings(apiPayload);

// Display helpers — all accept raw or normalized settings
const name     = getOrganizationDisplayName(settings);  // "Acme Corp" or ""
const currency = getOrganizationCurrency(settings);     // "GHS" (fallback)
const symbol   = getOrganizationCurrencySymbol(settings); // "₵"
const tz       = getOrganizationTimezone(settings);     // "Africa/Accra" (fallback)
const branding = getOrganizationBranding(settings);     // { logoUrl, faviconUrl, primaryColor, accentColor }
const contact  = getOrganizationContactInfo(settings);  // { contactEmail, contactPhone, … }

// Before sending org data to a public payload or frontend, strip credentials
const safePayload = stripSensitiveOrgSettings(rawOrgData);
```

## Supported currencies

GHS, USD, EUR, GBP, NGN, KES, ZAR, UGX, XOF.
Expand `SUPPORTED_CURRENCIES` in `src/constants/currencies.js` when new currencies are approved.

## Supported timezones

Accra, Abidjan, Lagos, Johannesburg, Cairo, Nairobi, Kampala, Dar es Salaam, London, New York, UTC.
Expand `SUPPORTED_TIMEZONES` in `src/constants/timezones.js` when new regions are needed.

## Security rules

- `isSafeOrgSettingsKey` blocks: `apikey`, `secret`, `token`, `password`, `privatekey`,
  `webhooksecret`, `signingkey`, `encryptionkey`, `stripekey`, `paystackkey`, `hubtelkey`,
  `flutterwavekey`, `clientsecret`, `accesskey`. Matching is case-insensitive and substring-based.
- Always call `stripSensitiveOrgSettings` before including org data in public API responses,
  frontend payloads, receipts, or notification templates.
- Keep org settings scoped by `organizationId` from the authenticated session — never return
  one organization's settings to a user from a different organization.

## Future work

See `TODO` comments in `src/index.js` for planned wiring into:
- Dev ERP Settings (org display section)
- REEBS Portal admin settings panel
- Shared ERP shell branding (SystemProvider)
- `@faako/notifications` customer templates
- `@faako/finance` receipt presentation
- Module enable/disable persistence
- Audit logging via `@faako/audit`

## Tests

```
node --test packages/org-settings/test/org-settings.test.mjs
```

44 tests, all passing.

## Environment variables

None.
