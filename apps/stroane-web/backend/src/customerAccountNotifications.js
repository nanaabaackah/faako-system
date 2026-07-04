import emailKit from "../../../../packages/email-kit/src/index.cjs";

const {
  EMAIL_THEMES,
  escapeHtml,
  renderButton,
  renderNotice,
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

const renderPasswordResetEmailHtml = ({
  subject,
  intro,
  expiryLabel,
  resetUrl,
  safetyNote,
  noticeHtml = "",
}) => {
  const theme = EMAIL_THEMES.faako;
  const resetButton = renderButton({
    href: resetUrl,
    label: "Reset password",
    theme,
  });

  return `
    <!DOCTYPE html>
    <html lang="en" style="margin:0;padding:0;color-scheme:light only;supported-color-schemes:light;">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <title>${escapeHtml(subject)}</title>
        <style>
          :root {
            color-scheme: light only;
            supported-color-schemes: light;
          }
          body,
          table,
          td,
          p,
          a {
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
          }
          @media only screen and (max-width: 620px) {
            .reset-email-shell {
              padding: 14px !important;
            }
            .reset-email-card {
              border-radius: 20px !important;
            }
            .reset-email-cell {
              padding: 22px 18px !important;
            }
            .reset-email-title {
              font-size: 26px !important;
              line-height: 1.16 !important;
            }
            .reset-email-link {
              font-size: 12px !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#eef5ff !important;color:${theme.text} !important;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;">
          Use this secure link to reset your Stroane account password.
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef5ff" style="width:100%;margin:0;padding:0;background-color:#eef5ff !important;">
          <tr>
            <td class="reset-email-shell" align="center" style="padding:28px 14px;background-color:#eef5ff !important;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="reset-email-card" bgcolor="#ffffff" style="width:100%;max-width:560px;border-collapse:separate;border-spacing:0;background-color:#ffffff !important;border:1px solid ${theme.border};border-radius:24px;overflow:hidden;">
                <tr>
                  <td class="reset-email-cell" bgcolor="#ffffff" style="padding:30px 28px 24px;background-color:#ffffff !important;color:${theme.text} !important;font-family:Arial,sans-serif;">
                    <p style="margin:0 0 12px;color:${theme.accent} !important;font:800 12px/1.2 Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Stroane Solutions</p>
                    <h1 class="reset-email-title" style="margin:0 0 18px;color:${theme.heading} !important;font:800 30px/1.14 Arial,sans-serif;">Reset your password</h1>
                    <p style="margin:0 0 12px;color:${theme.text} !important;font:400 15px/1.7 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                      intro[0]
                    )}</p>
                    <p style="margin:0 0 18px;color:${theme.text} !important;font:400 15px/1.7 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
                      intro[1]
                    )}</p>
                    ${noticeHtml}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.accentSoft}" style="width:100%;margin:0 0 18px;background-color:${theme.accentSoft} !important;border:1px solid ${theme.accentBorder};border-radius:18px;border-collapse:separate;">
                      <tr>
                        <td style="padding:18px;background-color:${theme.accentSoft} !important;color:${theme.text} !important;font-family:Arial,sans-serif;">
                          <p style="margin:0 0 8px;color:${theme.muted} !important;font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">Expires automatically</p>
                          <h2 style="margin:0 0 12px;color:${theme.heading} !important;font:800 19px/1.25 Arial,sans-serif;">Choose a new password</h2>
                          <p style="margin:0 0 16px;color:${theme.text} !important;font:400 15px/1.7 Arial,sans-serif;">This link expires in ${escapeHtml(
                            expiryLabel
                          )}. If you request another reset link, this one will stop working.</p>
                          <p style="margin:0 0 18px;">${resetButton}</p>
                          <p style="margin:0 0 8px;color:${theme.muted} !important;font:700 13px/1.55 Arial,sans-serif;">If the button does not open, copy and paste this link:</p>
                          <p style="margin:0;"><a class="reset-email-link" href="${escapeHtml(
                            resetUrl
                          )}" style="color:${theme.accent} !important;font:400 13px/1.6 Arial,sans-serif;word-break:break-all;overflow-wrap:anywhere;text-decoration:underline;">${escapeHtml(
                            resetUrl
                          )}</a></p>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.noteBg}" style="width:100%;margin:0 0 18px;background-color:${theme.noteBg} !important;border:1px solid ${theme.noteBorder};border-radius:16px;border-collapse:separate;">
                      <tr>
                        <td style="padding:14px 16px;background-color:${theme.noteBg} !important;color:${theme.noteText} !important;font-family:Arial,sans-serif;">
                          <p style="margin:0 0 8px;color:${theme.noteText} !important;font:800 12px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">Account safety</p>
                          <p style="margin:0 0 6px;color:${theme.noteText} !important;font:600 13px/1.55 Arial,sans-serif;">${escapeHtml(
                            safetyNote
                          )}</p>
                          <p style="margin:0;color:${theme.noteText} !important;font:600 13px/1.55 Arial,sans-serif;">Stroane will never email you a new password.</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;color:${theme.muted} !important;font:400 13px/1.65 Arial,sans-serif;">Need help? Reply to this email or contact ${escapeHtml(
                      SUPPORT_EMAIL
                    )}.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();
};

const buildPasswordResetContent = ({
  customerName,
  resetUrl,
  expiresInMinutes,
  noticeHtml = "",
}) => {
  const name = safeText(customerName, 120) || "there";
  const expiryLabel = `${Number(expiresInMinutes) || 60} minutes`;
  const subject = "Reset your Stroane account password";
  const safeResetUrl = String(resetUrl || "").trim();
  const intro = [
    `Hello ${name}, we received a request to reset your Stroane account password.`,
    `Use the secure reset link below within ${expiryLabel}. Every new reset request invalidates earlier links.`,
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
  const html = renderPasswordResetEmailHtml({
    subject,
    intro,
    expiryLabel,
    resetUrl: safeResetUrl,
    safetyNote,
    noticeHtml,
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
  const { subject, text, html } = buildPasswordResetContent({
    customerName: customer?.name,
    resetUrl,
    expiresInMinutes,
    noticeHtml: redirectHtml,
  });

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
        html: html.trim(),
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
