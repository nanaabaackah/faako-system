import emailKit from "../../../../packages/email-kit/src/index.cjs";

const {
  EMAIL_THEMES,
  renderButton,
  renderEmailLayout,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "Stroane Solutions <accounts@stroanesolutions.com>";
const DEFAULT_REPLY_TO = "info@stroanesolutions.com";
const SUPPORT_EMAIL = "info@stroanesolutions.com";
const SUPPORT_PHONE = "+233 24 279 4356";
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CUSTOMER_ACCOUNT_EMAIL_STATUSES = Object.freeze({
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

const compactObject = (value = {}) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));

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

const buildPasswordResetContent = ({ customerName, resetUrl, expiresInMinutes }) => {
  const name = safeText(customerName, 120) || "there";
  const expiryLabel = `${Number(expiresInMinutes) || 60} minutes`;
  const subject = "Reset your Stroane account password";
  const intro = [
    `Hello ${name}, we received a request to reset your Stroane account password.`,
    `Use the secure reset link below within ${expiryLabel}.`,
  ];
  const safetyNote =
    "If you did not request this, ignore this email. Your current password will stay unchanged.";
  const text = [
    "Reset your Stroane account password",
    "",
    ...intro,
    "",
    resetUrl,
    "",
    safetyNote,
    "",
    `Support: ${SUPPORT_EMAIL} / ${SUPPORT_PHONE}`,
  ].join("\n");
  const html = renderEmailLayout({
    theme: EMAIL_THEMES.faako,
    title: subject,
    previewText: "Use this secure link to reset your Stroane account password.",
    body: [
      renderParagraphs(intro, { theme: EMAIL_THEMES.faako }),
      renderPanel({
        theme: EMAIL_THEMES.faako,
        title: "Secure password reset",
        bodyHtml: `<p style="margin:0 0 14px;color:${EMAIL_THEMES.faako.text};font:400 15px/1.7 Arial,sans-serif;">This link expires in ${expiryLabel}.</p><p style="margin:0">${renderButton({
          href: resetUrl,
          label: "Reset password",
          theme: EMAIL_THEMES.faako,
        })}</p>`,
      }),
      renderNotice({
        theme: EMAIL_THEMES.faako,
        title: "Account safety",
        lines: [safetyNote, "Stroane will never email you a new password."],
      }),
    ].join(""),
  });

  return { subject, text, html };
};

export const sendCustomerPasswordResetEmail = async ({
  customer,
  resetUrl,
  expiresInMinutes = 60,
} = {}) => {
  const apiKey = safeText(process.env.RESEND_API_KEY, 500);
  const from = safeText(process.env.CUSTOMER_ACCOUNT_EMAIL_FROM, 260) || DEFAULT_FROM_EMAIL;
  const replyTo = safeText(process.env.CUSTOMER_ACCOUNT_EMAIL_REPLY_TO, 260) || DEFAULT_REPLY_TO;
  const delivery = resolveEmailDeliveryTarget(customer?.email);

  if (!delivery.intendedRecipient) {
    return {
      status: CUSTOMER_ACCOUNT_EMAIL_STATUSES.SKIPPED,
      reason: "missing_customer_email",
      sent: false,
    };
  }

  if (!apiKey) {
    return {
      status: CUSTOMER_ACCOUNT_EMAIL_STATUSES.SKIPPED,
      reason: "resend_not_configured",
      sent: false,
    };
  }

  const { subject, text, html } = buildPasswordResetContent({
    customerName: customer?.name,
    resetUrl,
    expiresInMinutes,
  });
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
    status: CUSTOMER_ACCOUNT_EMAIL_STATUSES.SENT,
    sent: true,
    providerId: safeText(body?.id, 120),
    rerouted: delivery.wasRerouted,
  };
};
