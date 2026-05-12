import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTIFICATION_CHANNELS,
  buildMailtoHref,
  buildWhatsAppHref,
  formatBookingConfirmationDraft,
  formatDeliveryUpdateDraft,
  formatPaymentReminderDraft,
  formatReceiptSummaryMessage,
  getAvailableNotificationChannels,
  sanitizeNotificationText,
} from "../src/index.js";

test("customer-safe templates return strings without internal metadata", () => {
  const receipt = formatReceiptSummaryMessage({
    businessName: "REEBS Party Themes",
    customerName: "Ama",
    receiptNumber: "REC-100",
    amountLabel: "GHS 120.00",
    reference: "ORD-22",
    issuedAt: "May 11, 2026",
    auditMetadata: "internal-only",
  });

  assert.match(receipt, /REC-100/);
  assert.match(receipt, /GHS 120.00/);
  assert.doesNotMatch(receipt, /internal-only/);
});

test("draft templates cover payment, booking, and delivery messages", () => {
  assert.match(
    formatPaymentReminderDraft({ customerName: "Kojo", amountDueLabel: "GHS 50.00" }),
    /payment reminder/
  );
  assert.match(
    formatBookingConfirmationDraft({ bookingLink: "https://example.com/book" }),
    /Booking link/
  );
  assert.match(
    formatDeliveryUpdateDraft({ statusLabel: "Out for delivery", reference: "ORD-9" }),
    /Out for delivery/
  );
});

test("channel availability is based on safe contact fields", () => {
  const channels = getAvailableNotificationChannels({
    email: "customer@example.com",
    phone: "+233244000000",
    inApp: true,
  });

  assert.equal(channels.includes(NOTIFICATION_CHANNELS.EMAIL), true);
  assert.equal(channels.includes(NOTIFICATION_CHANNELS.WHATSAPP), true);
  assert.equal(channels.includes(NOTIFICATION_CHANNELS.SMS), true);
  assert.equal(channels.includes(NOTIFICATION_CHANNELS.IN_APP), true);
  assert.equal(channels.includes(NOTIFICATION_CHANNELS.COPY), true);
});

test("link helpers create user-triggered links only", () => {
  const mailto = buildMailtoHref({
    to: "customer@example.com",
    subject: "Receipt REC-100",
    body: "Thanks",
  });
  const whatsapp = buildWhatsAppHref({
    phone: "+233244000000",
    text: "Receipt REC-100",
  });

  assert.match(mailto, /^mailto:customer@example\.com\?/);
  assert.match(whatsapp, /^https:\/\/wa\.me\/233244000000\?/);
});

test("sanitizer removes control characters and trims long values", () => {
  const result = sanitizeNotificationText(" Hello\u0007   customer ", { maxLength: 12 });
  assert.equal(result, "Hello cus...");
});
