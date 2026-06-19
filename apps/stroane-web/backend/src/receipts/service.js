import { RECEIPT_EMAIL_STATUSES, sendReceiptEmail } from "./notifications.js";

const sanitizeText = (value = "", maxLength = 160) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

export const receiptInclude = {
  order: {
    include: {
      items: true,
    },
  },
};

const buildReceiptNumberBase = (order) =>
  sanitizeText(order.orderNumber || order.id, 80)
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase() || "STROANE";

export const isPaidOrder = (order = {}) =>
  String(order.paymentStatus || "").toLowerCase() === "paid" ||
  String(order.status || "").toUpperCase() === "PAID" ||
  Boolean(order.paidAt);

export const buildUniqueReceiptNumber = async (prisma, order) => {
  const base = buildReceiptNumberBase(order);
  const existingCount = await prisma.commerceReceipt.count({
    where: { orderId: order.id },
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = String(existingCount + attempt + 1).padStart(2, "0");
    const receiptNumber = `RCPT-${base}-${suffix}`;
    const existing = await prisma.commerceReceipt.findUnique({
      where: { receiptNumber },
      select: { id: true },
    });
    if (!existing) return receiptNumber;
  }

  return `RCPT-${base}-${Date.now()}`;
};

const buildReceiptSnapshot = (order, overrides = {}) => ({
  status: isPaidOrder(order) ? "issued" : overrides.status || "awaiting_payment",
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  currency: order.currency || "GHS",
  subtotal: order.subtotal,
  total: order.total,
  paymentReference: order.paymentReference || null,
  paymentStatus: order.paymentStatus || null,
  notes: sanitizeText(overrides.notes, 600) || null,
  createdById: overrides.createdById || null,
  createdByName: overrides.createdByName || null,
});

export const ensureReceiptForOrder = async (prisma, order, options = {}) => {
  if (!order?.id) {
    return { receipt: null, status: RECEIPT_EMAIL_STATUSES.SKIPPED, reason: "missing_order" };
  }
  if (!prisma.commerceReceipt?.findFirst || !prisma.commerceReceipt?.create) {
    return {
      receipt: null,
      status: RECEIPT_EMAIL_STATUSES.SKIPPED,
      reason: "receipt_storage_unavailable",
    };
  }
  if (String(order.status || "").toUpperCase() === "CANCELLED") {
    return {
      receipt: null,
      status: RECEIPT_EMAIL_STATUSES.SKIPPED,
      reason: "cancelled_order",
    };
  }

  const existing = await prisma.commerceReceipt.findFirst({
    where: { orderId: order.id },
    include: receiptInclude,
  });
  const snapshot = buildReceiptSnapshot(order, options);

  if (existing) {
    const receipt = await prisma.commerceReceipt.update({
      where: { id: existing.id },
      data: {
        customerName: snapshot.customerName,
        customerEmail: snapshot.customerEmail,
        currency: snapshot.currency,
        subtotal: snapshot.subtotal,
        total: snapshot.total,
        paymentReference: snapshot.paymentReference,
        paymentStatus: snapshot.paymentStatus,
        status: isPaidOrder(order) ? "issued" : existing.status || snapshot.status,
        notes: options.notes === undefined ? existing.notes : snapshot.notes,
      },
      include: receiptInclude,
    });
    return { receipt, status: "existing" };
  }

  const receiptNumber = await buildUniqueReceiptNumber(prisma, order);
  const receipt = await prisma.commerceReceipt.create({
    data: {
      receiptNumber,
      orderId: order.id,
      ...snapshot,
    },
    include: receiptInclude,
  });

  return { receipt, status: "created" };
};

export const sendReceiptForPaidOrder = async (prisma, order, options = {}) => {
  if (!isPaidOrder(order)) {
    return {
      receipt: null,
      status: RECEIPT_EMAIL_STATUSES.SKIPPED,
      reason: "order_not_paid",
      sent: false,
    };
  }

  const ensured = await ensureReceiptForOrder(prisma, order, options);
  const receipt = ensured.receipt;
  if (!receipt) {
    return {
      ...ensured,
      sent: false,
    };
  }

  if (receipt.sentAt || receipt.resendStatus === RECEIPT_EMAIL_STATUSES.SENT) {
    return {
      receipt,
      status: RECEIPT_EMAIL_STATUSES.SENT,
      reason: "already_sent",
      sent: false,
    };
  }

  try {
    const result = await sendReceiptEmail({ receipt });
    const updatedReceipt = await prisma.commerceReceipt.update({
      where: { id: receipt.id },
      data: {
        resendStatus: result.status,
        resendProviderId: result.providerId || null,
        resendError: result.sent ? null : result.reason || "receipt_email_skipped",
        sentAt: result.sent ? new Date() : receipt.sentAt,
      },
      include: receiptInclude,
    });
    return {
      ...result,
      receipt: updatedReceipt,
    };
  } catch (error) {
    const message = sanitizeText(error?.message || "Unable to send receipt email.", 240);
    const updatedReceipt = await prisma.commerceReceipt.update({
      where: { id: receipt.id },
      data: {
        resendStatus: RECEIPT_EMAIL_STATUSES.FAILED,
        resendError: message,
      },
      include: receiptInclude,
    });

    return {
      receipt: updatedReceipt,
      status: RECEIPT_EMAIL_STATUSES.FAILED,
      reason: message,
      sent: false,
    };
  }
};
