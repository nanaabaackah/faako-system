import {
  compactNotificationLines,
  formatSafeCustomerName,
  formatSafeReference,
  sanitizeNotificationText,
} from "../helpers/safeText.js";

const safe = (value, maxLength = 160) => sanitizeNotificationText(value, { maxLength });

export const formatReceiptSummaryMessage = ({
  businessName = "Faako",
  customerName = "",
  receiptNumber = "",
  amountLabel = "",
  reference = "",
  issuedAt = "",
  supportContact = "",
} = {}) =>
  compactNotificationLines([
    `${safe(businessName, 80)} receipt${receiptNumber ? ` ${formatSafeReference(receiptNumber)}` : ""}`,
    `Hi ${formatSafeCustomerName(customerName)}, thanks for your payment.`,
    amountLabel ? `Amount: ${safe(amountLabel, 80)}` : "",
    reference ? `Reference: ${formatSafeReference(reference)}` : "",
    issuedAt ? `Issued: ${safe(issuedAt, 80)}` : "",
    supportContact ? `Questions? Contact ${safe(supportContact, 120)}.` : "",
  ]);

export const formatPaymentReminderDraft = ({
  businessName = "Faako",
  customerName = "",
  amountDueLabel = "",
  dueDate = "",
  reference = "",
  paymentLink = "",
} = {}) =>
  compactNotificationLines([
    `Hi ${formatSafeCustomerName(customerName)}, this is a payment reminder from ${safe(businessName, 80)}.`,
    amountDueLabel ? `Amount due: ${safe(amountDueLabel, 80)}` : "",
    dueDate ? `Due date: ${safe(dueDate, 80)}` : "",
    reference ? `Reference: ${formatSafeReference(reference)}` : "",
    paymentLink ? `Payment link: ${safe(paymentLink, 200)}` : "",
    "Please contact us if anything looks incorrect.",
  ]);

export const formatBookingConfirmationDraft = ({
  businessName = "Faako",
  customerName = "",
  bookingDate = "",
  bookingTime = "",
  location = "",
  bookingReference = "",
  bookingLink = "",
} = {}) =>
  compactNotificationLines([
    `Hi ${formatSafeCustomerName(customerName)}, your booking with ${safe(businessName, 80)} is ready to review.`,
    bookingDate ? `Date: ${safe(bookingDate, 80)}` : "",
    bookingTime ? `Time: ${safe(bookingTime, 80)}` : "",
    location ? `Location: ${safe(location, 160)}` : "",
    bookingReference ? `Reference: ${formatSafeReference(bookingReference)}` : "",
    bookingLink ? `Booking link: ${safe(bookingLink, 200)}` : "",
    "Reply if you need to update any details.",
  ]);

export const formatDeliveryUpdateDraft = ({
  businessName = "Faako",
  customerName = "",
  statusLabel = "",
  deliveryDate = "",
  deliveryWindow = "",
  reference = "",
  contact = "",
} = {}) =>
  compactNotificationLines([
    `Hi ${formatSafeCustomerName(customerName)}, this is a delivery update from ${safe(businessName, 80)}.`,
    statusLabel ? `Status: ${safe(statusLabel, 80)}` : "",
    deliveryDate ? `Date: ${safe(deliveryDate, 80)}` : "",
    deliveryWindow ? `Window: ${safe(deliveryWindow, 80)}` : "",
    reference ? `Reference: ${formatSafeReference(reference)}` : "",
    contact ? `Contact: ${safe(contact, 120)}` : "",
  ]);
