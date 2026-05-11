import { formatCurrencyFromCents, formatCurrencyMajor } from "../helpers/currency.js";
import { normalizeReceiptMetadata } from "../helpers/metadata.js";

const getSnapshot = (receipt = {}) =>
  receipt?.snapshot && typeof receipt.snapshot === "object" ? receipt.snapshot : {};

const getReceiptAmountCents = (receipt = {}) => {
  const snapshot = getSnapshot(receipt);
  const payment = snapshot.payment && typeof snapshot.payment === "object" ? snapshot.payment : {};
  return receipt.amountCents ?? payment.amountCents ?? 0;
};

const getReceiptCurrency = (receipt = {}) => {
  const snapshot = getSnapshot(receipt);
  return receipt.currency || snapshot.currency || snapshot.payment?.currency || "GHS";
};

export const formatReceiptAmount = (receipt = {}, options = {}) =>
  formatCurrencyFromCents(getReceiptAmountCents(receipt), getReceiptCurrency(receipt), options);

export const buildReceiptDisplaySummary = (receipt = {}, options = {}) => {
  const snapshot = getSnapshot(receipt);
  const order = snapshot.order && typeof snapshot.order === "object" ? snapshot.order : {};
  const payer = snapshot.customer || snapshot.tenant || snapshot.client || {};
  const issuedAt = receipt.issuedAt || receipt.createdAt || snapshot.issuedAt || "";

  return {
    receiptNumber: receipt.receiptNumber || snapshot.receiptNumber || "Receipt",
    sourceLabel: order.orderNumber || receipt.orderId || receipt.sourceId || "-",
    payerName: payer.name || payer.customerName || payer.tenantName || payer.clientName || "",
    amountLabel: formatReceiptAmount(receipt, options),
    issuedAt,
    itemCount: Array.isArray(snapshot.items) ? snapshot.items.length : 0,
    metadata: normalizeReceiptMetadata({
      sourceApp: receipt.sourceApp,
      sourceType: receipt.sourceType || "receipt",
      sourceId: receipt.sourceId || receipt.orderId,
      paymentId: receipt.paymentId,
      deliveryChannel: receipt.deliveryChannel,
      deliveryTarget: receipt.deliveryTarget,
    }),
  };
};

export const formatReceiptLineItem = (item = {}, options = {}) => {
  const name = item.productName || item.name || item.sku || "Item";
  const quantity = Number(item.quantity || item.qty || 0);
  const amountCents = item.totalCents ?? item.total_amount ?? item.amountCents;
  const amountMajor = item.total ?? item.amount;
  const currency = item.currency || options.currency || "GHS";
  const amountLabel =
    amountCents != null
      ? formatCurrencyFromCents(amountCents, currency, options)
      : formatCurrencyMajor(amountMajor || 0, currency, options);

  return {
    name,
    quantity,
    amountLabel,
  };
};

export const formatPrintReceiptText = (receipt = {}, options = {}) => {
  const summary = buildReceiptDisplaySummary(receipt, options);
  const snapshot = getSnapshot(receipt);
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const lines = [
    summary.receiptNumber,
    summary.payerName ? `For: ${summary.payerName}` : "",
    `Source: ${summary.sourceLabel}`,
    `Paid: ${summary.amountLabel}`,
    "------------------------------",
    ...items.map((item) => {
      const line = formatReceiptLineItem(item, options);
      return `${line.name} x ${line.quantity} - ${line.amountLabel}`;
    }),
    "------------------------------",
    summary.issuedAt ? `Issued: ${summary.issuedAt}` : "",
  ];

  return lines.filter(Boolean).join("\n");
};

export const formatWhatsAppReceiptMessage = (receipt = {}, options = {}) => {
  const summary = buildReceiptDisplaySummary(receipt, options);
  const parts = [
    `Receipt ${summary.receiptNumber}`,
    summary.payerName ? `For ${summary.payerName}` : "",
    `Amount: ${summary.amountLabel}`,
    summary.sourceLabel && summary.sourceLabel !== "-" ? `Reference: ${summary.sourceLabel}` : "",
  ];
  return parts.filter(Boolean).join("\n");
};

export const formatEmailReceiptPlaceholder = (receipt = {}, options = {}) => {
  const summary = buildReceiptDisplaySummary(receipt, options);
  return {
    subject: `Receipt ${summary.receiptNumber}`,
    previewText: `${summary.amountLabel} receipt${summary.payerName ? ` for ${summary.payerName}` : ""}`,
    bodyText: formatPrintReceiptText(receipt, options),
  };
};
