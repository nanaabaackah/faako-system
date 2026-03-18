import { APP_ENV } from "../../../runtimeEnv.js";

const DEFAULT_CATCHALL_EMAIL = "info@reebspartythemes.com";
const DEFAULT_FROM_EMAIL = `REEBS Party Themes <${DEFAULT_CATCHALL_EMAIL}>`;
const DEFAULT_FROM_NAME = "REEBS Party Themes";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const readEnv = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
};

const parseBoolean = (value, fallback = true) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeRecipients = (value) => {
  const rawValues = Array.isArray(value) ? value : String(value || "").split(",");
  return rawValues
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
};

const parseEmailIdentity = (value, fallback = {}) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return {
      email: fallback.email || "",
      name: fallback.name || "",
    };
  }

  const bracketMatch = normalized.match(/^(.*)<([^<>]+)>$/);
  if (bracketMatch) {
    const name = bracketMatch[1].trim().replace(/^"(.*)"$/, "$1");
    const email = bracketMatch[2].trim();
    return {
      email,
      name: name || fallback.name || "",
    };
  }

  return {
    email: normalized,
    name: fallback.name || "",
  };
};

const toBrevoRecipient = (value, fallback = {}) => {
  const identity = parseEmailIdentity(value, fallback);
  if (!identity.email) return null;
  return identity.name
    ? { email: identity.email, name: identity.name }
    : { email: identity.email };
};

const getReplyToEmail = () => readEnv("EMAIL_REPLY_TO") || getNotificationCatchallEmail();
const getForcedEmailRecipient = () => readEnv("EMAIL_FORCE_TO");

export const getNotificationCatchallEmail = () =>
  readEnv("EMAIL_CATCHALL_TO") || DEFAULT_CATCHALL_EMAIL;

export const isEmailNotificationsEnabled = () =>
  parseBoolean(readEnv("EMAIL_NOTIFICATIONS_ENABLED"), true);

export const sendNotificationEmail = async ({
  to,
  subject,
  text,
  replyTo = getReplyToEmail(),
}) => {
  const recipients = normalizeRecipients(to);
  const normalizedSubject = String(subject || "").trim();
  const normalizedText = String(text || "").trim();
  const apiKey = readEnv("BREVO_API_KEY");
  const from = readEnv("EMAIL_FROM") || DEFAULT_FROM_EMAIL;
  const forcedRecipient = getForcedEmailRecipient();
  const shouldForceRecipient =
    Boolean(forcedRecipient) && APP_ENV !== "production";
  const finalRecipients = shouldForceRecipient ? [forcedRecipient] : recipients;
  const redirectHeader = shouldForceRecipient
    ? [
        `[Local email redirect active]`,
        `Original recipient(s): ${recipients.join(", ") || "none"}`,
        `Delivered to: ${forcedRecipient}`,
        "",
      ].join("\n")
    : "";
  const finalSubject = shouldForceRecipient
    ? `[Local test] ${normalizedSubject}`
    : normalizedSubject;
  const finalText = `${redirectHeader}${normalizedText}`.trim();

  if (!isEmailNotificationsEnabled()) {
    return { skipped: true, reason: "disabled" };
  }
  if (!apiKey) {
    return { skipped: true, reason: "missing_api_key" };
  }
  if (!recipients.length || !normalizedSubject || !normalizedText) {
    return { skipped: true, reason: "missing_payload" };
  }

  const sender = parseEmailIdentity(from, {
    email: DEFAULT_CATCHALL_EMAIL,
    name: DEFAULT_FROM_NAME,
  });
  const replyToRecipient = toBrevoRecipient(replyTo);
  const toRecipients = finalRecipients
    .map((recipient) => toBrevoRecipient(recipient))
    .filter(Boolean);

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: sender.name
        ? { name: sender.name, email: sender.email }
        : { email: sender.email },
      to: toRecipients,
      subject: finalSubject,
      textContent: finalText,
      replyTo: replyToRecipient || undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Email send failed (${response.status}): ${errorText || response.statusText}`);
  }

  const providerResponse = await response.json().catch(() => ({ ok: true }));
  return {
    ok: true,
    redirected: shouldForceRecipient,
    requestedTo: recipients,
    deliveredTo: finalRecipients,
    provider: providerResponse,
  };
};
