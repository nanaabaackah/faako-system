# @faako/notifications

Shared notification foundation for Faako ERP apps.

## What Changed

Added the Notification service foundation. This package provides notification channel constants, notification type constants, notification status constants, customer-safe message templates, text sanitizing helpers, channel availability helpers, and user-triggered link helpers for `mailto:` and WhatsApp draft links.

This package does not send automated WhatsApp messages, emails, SMS messages, in-app notifications, or receipt/payment/order updates.

## Where It Lives

- `src/constants/`: notification channels, types, statuses, and labels.
- `src/helpers/`: customer-safe text sanitizing, channel availability checks, and user-triggered link builders.
- `src/templates/`: receipt summary, payment reminder, booking confirmation, and delivery update draft formatters.
- `test/notifications.test.mjs`: low-risk tests for templates, availability, and link helpers.

## Channels

- `EMAIL`
- `WHATSAPP`
- `SMS`
- `IN_APP`
- `COPY`

## Notification Types

- `RECEIPT`
- `PAYMENT_REMINDER`
- `BOOKING_CONFIRMATION`
- `DELIVERY_UPDATE`
- `LOW_STOCK_ALERT`
- `SYNC_FAILURE`
- `GENERAL`

## Statuses

- `DRAFT`
- `READY`
- `SENT`
- `FAILED`
- `CANCELLED`
- `USER_TRIGGERED`

## How To Use It

```js
import {
  buildMailtoHref,
  formatReceiptSummaryMessage,
} from "@faako/notifications";

const body = formatReceiptSummaryMessage({
  businessName: "REEBS Party Themes",
  customerName: "Ama",
  receiptNumber: "REC-100",
  amountLabel: "GHS 120.00",
  reference: "ORD-22",
});

const href = buildMailtoHref({
  to: "customer@example.com",
  subject: "Receipt REC-100",
  body,
});
```

## Security And Privacy

Templates are intentionally customer-safe. They avoid internal notes, private staff notes, audit metadata, raw database IDs unless the app passes a public reference, secrets, and environment values.

Use these helpers only for display, copy, and user-triggered sharing until backend notification permissions, audit logging, preferences, opt-in, and provider integrations are designed.

## Environment Variables

None.

## Setup Or Migration Steps

None. No database migration, backend service, provider setup, or environment variable is required.

## Data Impact

None. The helpers return strings and links only.

## Security Impact

Customer-safe message templates only. No automated sending, backend behavior, receipt/payment/order workflow, Resend integration, WhatsApp Business API integration, SMS provider integration, auth behavior, permissions, or schema changes are introduced.

## Known Limitations

- No automated sending.
- No notification audit log.
- No notification preferences.
- No retry handling.
- No provider-specific status reconciliation.
- `mailto:` and WhatsApp helpers only create user-triggered links.

## Testing Notes

Run package tests:

```bash
pnpm --filter @faako/notifications run test
```

Manual app checks:

- REEBS receipt summary copy/mailto/WhatsApp drafts show customer-safe receipt details only.
- Dev ERP appointment link email draft uses the shared booking confirmation formatter.
- Existing backend email, receipt, payment, order, rent, and notification behavior remains unchanged.

## Future Work

- Resend email sender integration.
- WhatsApp Business API integration.
- SMS provider integration.
- Notification audit log.
- Notification preferences.
- Retry handling.
