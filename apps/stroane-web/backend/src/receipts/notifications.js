import emailKit from "../../../../../packages/email-kit/src/index.cjs";

const {
  EMAIL_THEMES,
  renderDataTable,
  renderEmailLayout,
  renderKeyValueTable,
  renderMetricGrid,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "Stroane Solutions <receipts@stroanesolutions.com>";
const DEFAULT_REPLY_TO = "info@stroanesolutions.com";
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RECEIPT_EMAIL_STATUSES = Object.freeze({
  SKIPPED: "skipped",
  SENT: "sent",
  FAILED: "failed",
});

const safeText = (value, maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeEmailRecipient = (value) => {
  const email = safeText(value, 180);
  return EMAIL_PATTERN.test(email) ? email : "";
};

const isProductionRuntime = () => {
  const appEnv = safeText(process.env.APP_ENV || process.env.NODE_ENV, 40).toLowerCase();
  return appEnv === "production" || appEnv === "prod";
};

const getLocalEmailRecipient = () =>
  normalizeEmailRecipient(process.env.EMAIL_FORCE_TO) || LOCAL_EMAIL_FALLBACK;

const resolveEmailDeliveryTarget = (recipient) => {
  const intendedRecipient = normalizeEmailRecipient(recipient);
  if (isProductionRuntime()) {
    return {
      intendedRecipient,
      deliveryRecipient: intendedRecipient,
      wasRerouted: false,
    };
  }

  const deliveryRecipient = getLocalEmailRecipient();
  return {
    intendedRecipient,
    deliveryRecipient,
    wasRerouted:
      Boolean(intendedRecipient) &&
      deliveryRecipient.toLowerCase() !== intendedRecipient.toLowerCase(),
  };
};

const toMoneyNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

const formatCurrency = (value, currency = "GHS") =>
  `${safeText(currency || "GHS", 12)} ${toMoneyNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeItems = (order = {}) =>
  (Array.isArray(order.items) ? order.items : []).map((item) => ({
    productName: safeText(item.productName || "Product", 180),
    sku: safeText(item.sku, 80),
    quantity: Number.isInteger(Number(item.quantity)) ? Number(item.quantity) : 0,
    unitPrice: toMoneyNumber(item.unitPrice),
    lineTotal: toMoneyNumber(item.lineTotal),
  }));

export const buildReceiptNotificationContent = (receipt = {}) => {
  const order = receipt.order || {};
  const currency = safeText(receipt.currency || order.currency || "GHS", 12);
  const receiptNumber = safeText(receipt.receiptNumber, 80);
  const orderNumber = safeText(order.orderNumber, 80);
  const customerName = safeText(receipt.customerName || order.customerName, 120);
  const customerEmail = safeText(receipt.customerEmail || order.customerEmail, 160);
  const customerPhone = safeText(order.customerPhone, 80);
  const items = normalizeItems(order);
  const subject = `Stroane receipt: ${receiptNumber || orderNumber || "order receipt"}`;
  const totalLabel = formatCurrency(receipt.total ?? order.total, currency);
  const theme = EMAIL_THEMES.faako;

  const itemRows = items.map((item) => [
    item.productName,
    item.sku || "N/A",
    String(item.quantity),
    formatCurrency(item.lineTotal, currency),
  ]);

  const bodyHtml = [
    renderMetricGrid(
      [
        { label: "Receipt", value: receiptNumber || "N/A" },
        { label: "Order", value: orderNumber || "N/A" },
        { label: "Total", value: totalLabel },
        { label: "Issued", value: formatDate(receipt.issuedAt) },
      ],
      { theme }
    ),
    renderPanel({
      title: "Receipt items",
      theme,
      bodyHtml: renderDataTable({
        headers: ["Item", "SKU", "Qty", "Line total"],
        rows: itemRows,
        aligns: ["left", "left", "right", "right"],
        theme,
      }),
    }),
    renderPanel({
      title: "Customer",
      theme,
      bodyHtml: renderKeyValueTable(
        [
          ["Name", customerName || "N/A"],
          ["Email", customerEmail || "N/A"],
          ["Phone", customerPhone || "N/A"],
          ["Payment reference", safeText(receipt.paymentReference || order.paymentReference, 120) || "N/A"],
          ["Payment status", safeText(receipt.paymentStatus || order.paymentStatus, 80) || "N/A"],
        ],
        { theme }
      ),
    }),
    renderNotice({
      title: "Purchase terms",
      lines: [
        "This receipt confirms payment for the Stroane order items listed above.",
        "Fulfillment follows the delivery or pickup details confirmed for the order.",
        "Please inspect products on delivery or pickup and contact Stroane Solutions promptly if anything does not match the confirmed order.",
        "Payment credentials such as card numbers, CVV codes, mobile money PINs, and bank credentials are processed by Paystack or the payment provider and are not stored by Stroane Solutions.",
      ],
      tone: "info",
      theme,
    }),
    renderNotice({
      title: "Support",
      lines: [
        "This is a customer-safe receipt. It does not include internal notes or payment secrets.",
        "Questions? Reply to this email or contact Stroane Solutions.",
      ],
      tone: "info",
      theme,
    }),
  ].join("");

  const text = [
    "Stroane receipt",
    "",
    `Receipt: ${receiptNumber || "N/A"}`,
    `Order: ${orderNumber || "N/A"}`,
    `Issued: ${formatDate(receipt.issuedAt)}`,
    `Total: ${totalLabel}`,
    "",
    "Items:",
    items
      .map(
        (item) =>
          `- ${item.productName} (${item.sku || "no SKU"}) x ${item.quantity}: ${formatCurrency(
            item.lineTotal,
            currency
          )}`
      )
      .join("\n") || "- No items listed",
    "",
    `Customer: ${customerName || "N/A"}`,
    `Email: ${customerEmail || "N/A"}`,
    `Payment reference: ${safeText(receipt.paymentReference || order.paymentReference, 120) || "N/A"}`,
    "",
    "Purchase terms:",
    "- This receipt confirms payment for the Stroane order items listed above.",
    "- Fulfillment follows the delivery or pickup details confirmed for the order.",
    "- Please inspect products on delivery or pickup and contact Stroane Solutions promptly if anything does not match the confirmed order.",
    "- Payment credentials such as card numbers, CVV codes, mobile money PINs, and bank credentials are processed by Paystack or the payment provider and are not stored by Stroane Solutions.",
  ].join("\n");

  return {
    subject,
    text,
    html: renderEmailLayout({
      theme,
      brandName: "Stroane Solutions",
      brandTagline: "Food safety products and compliance support",
      eyebrow: "Receipt",
      title: "Your Stroane receipt",
      subtitle: receiptNumber ? `Receipt ${receiptNumber}` : undefined,
      preheader: `Receipt for ${orderNumber || "your Stroane order"}`,
      introHtml: renderParagraphs(
        [`Hello ${customerName || "there"}, here is your Stroane receipt.`],
        { theme }
      ),
      bodyHtml,
    }),
  };
};

const parseResendBody = async (response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || "Resend email request failed.");
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 503;
    error.providerResponse = body || null;
    throw error;
  }
  return body || {};
};

const compactObject = (value = {}) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));

export const sendReceiptEmail = async ({ receipt } = {}) => {
  const apiKey = safeText(process.env.RESEND_API_KEY, 500);
  const from = safeText(process.env.RECEIPT_EMAIL_FROM, 260) || DEFAULT_FROM_EMAIL;
  const replyTo = safeText(process.env.RECEIPT_EMAIL_REPLY_TO, 260) || DEFAULT_REPLY_TO;
  const delivery = resolveEmailDeliveryTarget(receipt?.customerEmail || receipt?.order?.customerEmail);

  if (!delivery.intendedRecipient) {
    return {
      status: RECEIPT_EMAIL_STATUSES.SKIPPED,
      reason: "missing_customer_email",
      sent: false,
    };
  }

  if (!apiKey) {
    return {
      status: RECEIPT_EMAIL_STATUSES.SKIPPED,
      reason: "resend_not_configured",
      sent: false,
    };
  }

  const { subject, text, html } = buildReceiptNotificationContent(receipt);
  const redirectText = delivery.wasRerouted
    ? [
        "Local email redirect active",
        `Original recipient: ${delivery.intendedRecipient || "none"}`,
        `Delivered to: ${delivery.deliveryRecipient}`,
        "",
      ].join("\n")
    : "";
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      compactObject({
        from,
        to: [delivery.deliveryRecipient],
        subject: delivery.wasRerouted ? `[Local test] ${subject}` : subject,
        text: `${redirectText}${text}`.trim(),
        html,
        reply_to: replyTo,
      })
    ),
  });

  const body = await parseResendBody(response);
  return {
    status: RECEIPT_EMAIL_STATUSES.SENT,
    providerId: safeText(body.id || body?.data?.id, 120) || null,
    sent: true,
  };
};
