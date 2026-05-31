import emailKit from "../../../../../packages/email-kit/src/index.cjs";
import { sanitizeNotificationText } from "@faako/notifications";

const {
  EMAIL_THEMES,
  renderDataTable,
  renderEmailLayout,
  renderMetricGrid,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "Stroane Operations <alerts@stroanesolutions.com>";
const DEFAULT_REPLY_TO = "info@stroanesolutions.com";

export const INVENTORY_ALERT_CHANNELS = Object.freeze({
  EMAIL: "EMAIL",
  WHATSAPP: "WHATSAPP",
});

export const INVENTORY_ALERT_DISPATCH_STATUSES = Object.freeze({
  SENT: "SENT",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
  PREPARED: "PREPARED",
});

const safeText = (value, maxLength = 240) =>
  sanitizeNotificationText(value, { maxLength });

const parseRecipients = (value, maxRecipients = 20) =>
  String(value || "")
    .split(",")
    .map((recipient) => safeText(recipient, 180))
    .filter(Boolean)
    .slice(0, maxRecipients);

const formatLabel = (value = "") =>
  safeText(value, 80)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatQuantity = (value) => (value === null || value === undefined ? "Not set" : String(value));

const normalizeAlerts = (alerts = []) =>
  (Array.isArray(alerts) ? alerts : []).map((alert) => ({
    id: safeText(alert.id, 120),
    alertType: safeText(alert.alertType, 40),
    productSlug: safeText(alert.inventoryItem?.productSlug || alert.productSlug, 160),
    productName: safeText(
      alert.inventoryItem?.product?.name || alert.productName || alert.inventoryItem?.productSlug,
      180
    ),
    sku: safeText(alert.inventoryItem?.sku || alert.sku, 100),
    availableQuantity: alert.availableQuantity,
    reservedQuantity: alert.reservedQuantity,
    reorderThreshold: alert.reorderThreshold,
    reason: safeText(alert.reason, 160),
  }));

export const buildInventoryAlertWhatsAppMessage = (alerts = []) => {
  const safeAlerts = normalizeAlerts(alerts);
  const lines = safeAlerts.slice(0, 8).map(
    (alert) =>
      `- ${alert.productName || alert.productSlug}: ${formatLabel(alert.alertType)} ` +
      `(available ${formatQuantity(alert.availableQuantity)}, reorder at ${formatQuantity(
        alert.reorderThreshold
      )})`
  );
  const more = safeAlerts.length > 8 ? `\n- +${safeAlerts.length - 8} more item(s)` : "";

  return [
    "Stroane inventory alert",
    `${safeAlerts.length} product alert(s) require review.`,
    ...lines,
    more,
    "Review the private Stroane admin inventory portal for details.",
  ]
    .filter(Boolean)
    .join("\n");
};

export const buildInventoryAlertEmailContent = (alerts = []) => {
  const safeAlerts = normalizeAlerts(alerts);
  const counts = safeAlerts.reduce(
    (result, alert) => ({ ...result, [alert.alertType]: (result[alert.alertType] || 0) + 1 }),
    {}
  );
  const theme = EMAIL_THEMES.faako;

  return {
    subject: `Stroane inventory alert: ${safeAlerts.length} item(s) need review`,
    text: [
      "Stroane inventory alert",
      "",
      `${safeAlerts.length} item(s) need operational review.`,
      "",
      ...safeAlerts.map(
        (alert) =>
          `- ${alert.productName || alert.productSlug}: ${formatLabel(alert.alertType)}; ` +
          `available ${formatQuantity(alert.availableQuantity)}; reorder at ${formatQuantity(
            alert.reorderThreshold
          )}`
      ),
      "",
      "Open the private Stroane admin inventory portal to review stock and record restocks.",
    ].join("\n"),
    html: renderEmailLayout({
      theme,
      brandName: "Stroane Solutions",
      brandTagline: "Private inventory operations",
      eyebrow: "Inventory monitoring",
      title: "Inventory items need review",
      subtitle: `${safeAlerts.length} operational alert(s)`,
      preheader: `${safeAlerts.length} Stroane inventory alert(s) need review`,
      introHtml: renderParagraphs(
        "Review the affected products in the private Stroane inventory portal. This summary contains operational stock values only.",
        { theme }
      ),
      bodyHtml: [
        renderMetricGrid(
          [
            { label: "Low stock", value: String(counts.LOW_STOCK || 0) },
            { label: "Out of stock", value: String(counts.OUT_OF_STOCK || 0) },
            { label: "Restocked", value: String(counts.RESTOCKED || 0) },
          ],
          { theme }
        ),
        renderPanel({
          title: "Affected products",
          theme,
          bodyHtml: renderDataTable({
            headers: ["Product", "Alert", "Available", "Reorder at"],
            rows: safeAlerts.map((alert) => [
              alert.productName || alert.productSlug,
              formatLabel(alert.alertType),
              formatQuantity(alert.availableQuantity),
              formatQuantity(alert.reorderThreshold),
            ]),
            aligns: ["left", "left", "right", "right"],
            theme,
          }),
        }),
        renderNotice({
          title: "Private operations notice",
          lines: [
            "Use the Stroane admin portal to review quantities and record accountable stock movements.",
            "Recipient details, supplier notes, and internal audit metadata are not included in this summary.",
          ],
          tone: counts.OUT_OF_STOCK ? "danger" : "warning",
          theme,
        }),
      ].join(""),
    }),
  };
};

const parseResendBody = async (response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || "Resend email request failed.");
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 503;
    throw error;
  }
  return body || {};
};

const compactObject = (value = {}) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));

export const sendInventoryAlertEmail = async ({ alerts } = {}) => {
  const recipients = parseRecipients(process.env.STROANE_ALERT_EMAILS);
  const apiKey = safeText(process.env.RESEND_API_KEY, 500);

  if (!recipients.length) {
    return {
      channel: INVENTORY_ALERT_CHANNELS.EMAIL,
      status: INVENTORY_ALERT_DISPATCH_STATUSES.SKIPPED,
      recipientCount: 0,
      reason: "alert_email_recipients_not_configured",
    };
  }

  if (!apiKey) {
    return {
      channel: INVENTORY_ALERT_CHANNELS.EMAIL,
      status: INVENTORY_ALERT_DISPATCH_STATUSES.SKIPPED,
      recipientCount: recipients.length,
      reason: "resend_not_configured",
    };
  }

  const { subject, text, html } = buildInventoryAlertEmailContent(alerts);
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      compactObject({
        from: safeText(process.env.STROANE_ALERT_FROM, 260) || DEFAULT_FROM_EMAIL,
        to: recipients,
        subject,
        text,
        html,
        reply_to: safeText(process.env.STROANE_ALERT_REPLY_TO, 260) || DEFAULT_REPLY_TO,
      })
    ),
  });
  const body = await parseResendBody(response);

  return {
    channel: INVENTORY_ALERT_CHANNELS.EMAIL,
    status: INVENTORY_ALERT_DISPATCH_STATUSES.SENT,
    recipientCount: recipients.length,
    providerId: safeText(body.id || body?.data?.id, 120) || null,
  };
};

export const prepareInventoryAlertWhatsApp = async ({ alerts } = {}) => {
  const recipients = parseRecipients(process.env.STROANE_ALERT_WHATSAPP_NUMBERS);

  if (!recipients.length) {
    return {
      channel: INVENTORY_ALERT_CHANNELS.WHATSAPP,
      status: INVENTORY_ALERT_DISPATCH_STATUSES.SKIPPED,
      recipientCount: 0,
      reason: "alert_whatsapp_recipients_not_configured",
    };
  }

  return {
    channel: INVENTORY_ALERT_CHANNELS.WHATSAPP,
    status: INVENTORY_ALERT_DISPATCH_STATUSES.PREPARED,
    recipientCount: recipients.length,
    provider: "unconfigured",
    message: buildInventoryAlertWhatsAppMessage(alerts),
  };
};
