import emailKit from "../../../../packages/email-kit/src/index.cjs";

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

export const ORDER_NOTIFICATION_TYPES = Object.freeze({
  ORDER_RECEIVED: "order_received",
  PAYMENT_CONFIRMED: "payment_confirmed",
  ORDER_PROCESSING: "order_processing",
  ORDER_COMPLETED: "order_completed",
  PAYMENT_PENDING: "payment_pending",
  PAYMENT_FAILED: "payment_failed",
});

export const ORDER_NOTIFICATION_STATUSES = Object.freeze({
  SKIPPED: "skipped",
  SENT: "sent",
  FAILED: "failed",
});

const DEFAULT_FROM_EMAIL = "Stroane Solutions <orders@stroanesolutions.com>";
const DEFAULT_REPLY_TO = "info@stroanesolutions.com";
const SUPPORT_PHONE = "+233 24 279 4356";
const SUPPORT_EMAIL = "info@stroanesolutions.com";
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const intendedRecipient = safeText(recipient, 180);
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

const formatStatusLabel = (value = "") =>
  safeText(value, 80)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeItems = (order = {}) =>
  (Array.isArray(order.items) ? order.items : []).map((item) => ({
    productName: safeText(item.productName || "Product", 180),
    sku: safeText(item.sku, 80),
    quantity: Number.isInteger(Number(item.quantity)) ? Number(item.quantity) : 0,
    unitPrice: toMoneyNumber(item.unitPrice),
    lineTotal: toMoneyNumber(item.lineTotal),
  }));

export const buildCustomerSafeOrderSummary = (order = {}) => {
  const items = normalizeItems(order);
  const currency = safeText(order.currency || "GHS", 12);
  const total = toMoneyNumber(order.total);

  return {
    orderNumber: safeText(order.orderNumber, 80),
    customerName: safeText(order.customerName, 120),
    customerEmail: safeText(order.customerEmail, 160),
    customerPhone: safeText(order.customerPhone, 80),
    businessName: safeText(order.businessName, 160),
    deliveryAddress: safeText(order.deliveryAddress, 240),
    preferredContactMethod: safeText(order.preferredContactMethod || "email", 40),
    currency,
    subtotal: toMoneyNumber(order.subtotal),
    total,
    paymentStatus: safeText(order.paymentStatus || "payment_pending", 80),
    status: safeText(order.status || "PAYMENT_PENDING", 80),
    paidAt: order.paidAt,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalLabel: formatCurrency(total, currency),
  };
};

const getNotificationCopy = (summary, type) => {
  const orderLabel = summary.orderNumber || "your Stroane order";

  if (type === ORDER_NOTIFICATION_TYPES.ORDER_RECEIVED) {
    return {
      subject: `Stroane order received: ${orderLabel}`,
      title: "Your order request has been received",
      eyebrow: "Order received",
      intro: [
        `Hello ${summary.customerName || "there"}, we have received ${orderLabel}.`,
        "Our team will review availability and delivery details before fulfillment.",
      ],
      notice: "This is an order acknowledgement, not a payment receipt.",
    };
  }

  if (type === ORDER_NOTIFICATION_TYPES.ORDER_PROCESSING) {
    return {
      subject: `Stroane order processing: ${orderLabel}`,
      title: "Your order is being processed",
      eyebrow: "Order update",
      intro: [
        `Hello ${summary.customerName || "there"}, ${orderLabel} is now being processed.`,
        "Stroane will contact you if any delivery details need confirmation.",
      ],
      notice: "We will share the next update when the order is ready or completed.",
    };
  }

  if (type === ORDER_NOTIFICATION_TYPES.ORDER_COMPLETED) {
    return {
      subject: `Stroane order completed: ${orderLabel}`,
      title: "Your order is ready or completed",
      eyebrow: "Order complete",
      intro: [
        `Hello ${summary.customerName || "there"}, ${orderLabel} is marked ready or completed.`,
        "Thank you for choosing Stroane Solutions.",
      ],
      notice: "Please contact Stroane if you need a copy of your order details.",
    };
  }

  if (type === ORDER_NOTIFICATION_TYPES.PAYMENT_FAILED) {
    return {
      subject: `Stroane payment needs attention: ${orderLabel}`,
      title: "Payment needs attention",
      eyebrow: "Payment update",
      intro: [
        `Hello ${summary.customerName || "there"}, payment for ${orderLabel} was not confirmed.`,
        "Your order remains available for follow-up. Please contact Stroane with the order number if you need help.",
      ],
      notice: "Do not retry with a different payment method until you confirm the current status with Stroane.",
    };
  }

  if (type === ORDER_NOTIFICATION_TYPES.PAYMENT_PENDING) {
    return {
      subject: `Stroane payment pending: ${orderLabel}`,
      title: "Payment is still pending",
      eyebrow: "Payment update",
      intro: [
        `Hello ${summary.customerName || "there"}, payment for ${orderLabel} is still pending.`,
        "Please keep the order number for support while the payment status is reviewed.",
      ],
      notice: "Final payment confirmation comes only after server-side verification.",
    };
  }

  return {
    subject: `Stroane payment confirmed: ${orderLabel}`,
    title: "Payment confirmed",
    eyebrow: "Payment confirmed",
    intro: [
      `Hello ${summary.customerName || "there"}, payment for ${orderLabel} has been confirmed.`,
      "Stroane will now review fulfillment and contact you if delivery details need confirmation.",
    ],
    notice: "This email includes customer-safe order details only.",
  };
};

const renderOrderEmailBody = (summary, copy) => {
  const theme = EMAIL_THEMES.faako;
  const itemRows = summary.items.map((item) => [
    item.productName,
    item.sku || "N/A",
    String(item.quantity),
    formatCurrency(item.lineTotal, summary.currency),
  ]);

  return [
    renderMetricGrid(
      [
        { label: "Order", value: summary.orderNumber || "N/A" },
        { label: "Total", value: summary.totalLabel },
        { label: "Payment", value: formatStatusLabel(summary.paymentStatus) },
        { label: "Items", value: String(summary.itemCount || summary.items.length) },
      ],
      { theme }
    ),
    renderPanel({
      title: "Order items",
      theme,
      bodyHtml: renderDataTable({
        headers: ["Item", "SKU", "Qty", "Line total"],
        rows: itemRows,
        aligns: ["left", "left", "right", "right"],
        theme,
      }),
    }),
    renderPanel({
      title: "Customer contact",
      theme,
      bodyHtml: renderKeyValueTable(
        [
          ["Name", summary.customerName || "N/A"],
          ["Email", summary.customerEmail || "N/A"],
          ["Phone", summary.customerPhone || "N/A"],
          ["Business", summary.businessName || "N/A"],
          ["Preferred contact", formatStatusLabel(summary.preferredContactMethod)],
          ["Delivery / pickup", summary.deliveryAddress || "N/A"],
        ],
        { theme }
      ),
    }),
    renderNotice({
      title: "Support",
      lines: [
        copy.notice,
        `Questions? Contact Stroane at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}.`,
      ],
      tone:
        copy.eyebrow.toLowerCase().includes("failed") ||
        copy.eyebrow.toLowerCase().includes("attention")
          ? "warning"
          : "info",
      theme,
    }),
  ].join("");
};

const renderOrderEmailText = (summary, copy) => {
  const itemLines = summary.items
    .map(
      (item) =>
        `- ${item.productName} (${item.sku || "no SKU"}) x ${item.quantity}: ${formatCurrency(
          item.lineTotal,
          summary.currency
        )}`
    )
    .join("\n");

  return [
    copy.title,
    "",
    ...copy.intro,
    "",
    `Order number: ${summary.orderNumber || "N/A"}`,
    `Total: ${summary.totalLabel}`,
    `Payment status: ${formatStatusLabel(summary.paymentStatus)}`,
    "",
    "Items:",
    itemLines || "- No items listed",
    "",
    "Customer contact:",
    `Name: ${summary.customerName || "N/A"}`,
    `Email: ${summary.customerEmail || "N/A"}`,
    `Phone: ${summary.customerPhone || "N/A"}`,
    `Preferred contact: ${formatStatusLabel(summary.preferredContactMethod)}`,
    `Delivery / pickup: ${summary.deliveryAddress || "N/A"}`,
    "",
    copy.notice,
    `Support: ${SUPPORT_EMAIL} / ${SUPPORT_PHONE}`,
  ].join("\n");
};

export const buildOrderNotificationContent = (order, type) => {
  const summary = buildCustomerSafeOrderSummary(order);
  const copy = getNotificationCopy(summary, type);
  const introHtml = renderParagraphs(copy.intro, { theme: EMAIL_THEMES.faako });
  const bodyHtml = renderOrderEmailBody(summary, copy);
  const footerHtml = renderParagraphs(
    "This message was generated for the customer contact on this Stroane order. It does not include internal notes, audit metadata, raw database identifiers, or payment secrets.",
    { theme: EMAIL_THEMES.faako, color: EMAIL_THEMES.faako.muted, spacing: "10px 0 0" }
  );

  return {
    subject: copy.subject,
    text: renderOrderEmailText(summary, copy),
    html: renderEmailLayout({
      theme: EMAIL_THEMES.faako,
      brandName: "Stroane Solutions",
      brandTagline: "Food safety products and compliance support",
      eyebrow: copy.eyebrow,
      title: copy.title,
      subtitle: `Order ${summary.orderNumber || ""}`.trim(),
      preheader: `${copy.title} for ${summary.orderNumber || "your Stroane order"}`,
      introHtml,
      bodyHtml,
      footerHtml,
    }),
  };
};

export const formatOrderWhatsAppMessage = (order, type) => {
  const summary = buildCustomerSafeOrderSummary(order);
  const copy = getNotificationCopy(summary, type);
  const itemSummary = summary.items
    .slice(0, 4)
    .map((item) => `${item.productName} x ${item.quantity}`)
    .join("; ");
  const more = summary.items.length > 4 ? ` +${summary.items.length - 4} more` : "";

  return [
    `Stroane Solutions: ${copy.title}`,
    `Order: ${summary.orderNumber || "N/A"}`,
    `Total: ${summary.totalLabel}`,
    `Payment: ${formatStatusLabel(summary.paymentStatus)}`,
    `Items: ${itemSummary || "N/A"}${more}`,
    `Support: ${SUPPORT_PHONE}`,
  ].join("\n");
};

export const formatOrderSmsMessage = (order, type) => {
  const summary = buildCustomerSafeOrderSummary(order);
  const copy = getNotificationCopy(summary, type);
  return safeText(
    `Stroane: ${copy.title}. Order ${summary.orderNumber || "N/A"}, total ${
      summary.totalLabel
    }, payment ${formatStatusLabel(summary.paymentStatus)}. Help: ${SUPPORT_PHONE}`,
    300
  );
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

export const sendCustomerOrderEmail = async ({
  order,
  type = ORDER_NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
} = {}) => {
  const apiKey = safeText(process.env.RESEND_API_KEY, 500);
  const from = safeText(process.env.ORDER_NOTIFICATION_FROM, 260) || DEFAULT_FROM_EMAIL;
  const replyTo = safeText(process.env.ORDER_NOTIFICATION_REPLY_TO, 260) || DEFAULT_REPLY_TO;
  const delivery = resolveEmailDeliveryTarget(order?.customerEmail);

  if (!delivery.intendedRecipient) {
    return {
      status: ORDER_NOTIFICATION_STATUSES.SKIPPED,
      reason: "missing_customer_email",
      sent: false,
    };
  }

  if (!apiKey) {
    return {
      status: ORDER_NOTIFICATION_STATUSES.SKIPPED,
      reason: "resend_not_configured",
      sent: false,
    };
  }

  const { subject, text, html } = buildOrderNotificationContent(order, type);
  const redirectText = delivery.wasRerouted
    ? [
        "Local email redirect active",
        `Original recipient: ${delivery.intendedRecipient || "none"}`,
        `Delivered to: ${delivery.deliveryRecipient}`,
        "",
      ].join("\n")
    : "";
  const redirectHtml = delivery.wasRerouted
    ? renderNotice({
        theme: EMAIL_THEMES.faako,
        title: "Local email redirect active",
        tone: "warning",
        lines: [
          `Original recipient: ${delivery.intendedRecipient || "none"}`,
          `Delivered to: ${delivery.deliveryRecipient}`,
        ],
      })
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
        html: `${redirectHtml}${html}`.trim(),
        reply_to: replyTo,
      })
    ),
  });

  const body = await parseResendBody(response);
  return {
    status: ORDER_NOTIFICATION_STATUSES.SENT,
    providerId: safeText(body.id || body?.data?.id, 120) || null,
    sent: true,
  };
};

// TODO(order-notification-log): add a NotificationLog table for strict idempotency,
// retry state, provider payload references, and staff-visible delivery history.
// TODO(whatsapp-order-updates): connect WhatsApp Business API after consent,
// opt-out, template approval, and audit requirements are defined.
// TODO(sms-order-updates): connect an SMS provider after sender registration,
// delivery-cost controls, opt-out rules, and retry behavior are defined.
// TODO(order-status-automation): wire processing/completed templates only after
// fulfillment status changes are defined server-side.
// TODO(staff-order-alerts): add internal staff notifications without exposing
// customer-safe templates to admin-only metadata or notes.
